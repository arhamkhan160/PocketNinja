# PocketNinja Server — Implementation Explanation

---

## Phase 1: Environment Setup & Express Server Core

### Phase Summary

This phase established the foundational server infrastructure:

| File | Purpose |
|------|---------|
| `.env.example` | Environment variable template with all required config keys |
| `db.js` | Mongoose connection wrapper for MongoDB Atlas |
| `index.js` | Express application entry point with core middleware and health-check |

### Implementation Details

#### Environment Configuration (`.env.example`)
Six environment variables are defined:
- **`PORT`** — HTTP listen port (defaults to `5000` in code if unset).
- **`MONGODB_URI`** — Full MongoDB Atlas connection string. Using the `mongodb+srv://` scheme lets the driver resolve the replica set via DNS SRV records automatically.
- **`JWT_SECRET`** — HMAC signing key for `jsonwebtoken`. Will be used in the auth middleware (Phase 2) to sign and verify access tokens.
- **`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`** — ECDH key pair for the Web Push protocol (RFC 8291). Generated via `npx web-push generate-vapid-keys`.
- **`VAPID_SUBJECT`** — A `mailto:` URI identifying the application operator, required by the VAPID spec (RFC 8292).

#### Database Connection (`db.js`)
- Uses `mongoose.connect()` which returns a promise. On success it logs the host from `conn.connection.host` for quick visual confirmation.
- On failure, logs the error and calls `process.exit(1)`. This is intentional: if the database is unreachable at startup, the server should not accept traffic and should let the process supervisor (e.g., nodemon, PM2) decide whether to restart.
- Mongoose internally maintains a connection pool (default size: 5 TCP sockets) and handles automatic reconnection after initial connection is established.

#### Express Server (`index.js`)
- **`dotenv.config()`** is called at the very top to load `.env` before any other module reads `process.env`.
- **`cors()`** is configured with defaults (all origins allowed). This is appropriate during development; in production the team can pass an `origin` whitelist.
- **`express.json()`** parses incoming `Content-Type: application/json` bodies and attaches the result to `req.body`.
- **Health-check route** (`GET /api/health`) returns `{ status: "ok", timestamp }`. This provides a lightweight liveness probe for monitoring/deployment and confirms the server is accepting HTTP requests.
- The server uses an `async startServer()` function to `await connectDB()` before calling `app.listen()`. This guarantees the database connection is established before any route handler executes.

### Architectural Rationale

- **Fail-fast on boot**: The `process.exit(1)` on DB connection failure enforces a fail-fast policy. A server without database access cannot fulfill any authenticated request, so starting it would only produce 500 errors.
- **Middleware ordering**: `cors()` runs first so preflight `OPTIONS` requests are handled immediately. `express.json()` runs next so all downstream route handlers can rely on `req.body` being parsed.
- **Separation of concerns**: The database connection logic is isolated in `db.js` rather than inlined in `index.js`. This makes it testable independently and allows future enhancements (e.g., connection event listeners, retry logic) without modifying the main entry point.
- **Multi-tenancy preparation**: The `/api` prefix on all routes establishes a clean namespace. All future authenticated routes will extract `userId` from the JWT and scope queries accordingly — this phase lays the middleware foundation that makes that possible.

---

## Phase 2: Mongoose Schemas & Security Models

### Phase Summary

This phase implemented the data models that underpin authentication and push notification delivery:

| File | Purpose |
|------|---------|
| `models/User.js` | User account schema with bcrypt password hashing and verification |
| `models/PushSubscription.js` | Stores Web Push subscription objects linked to authenticated users |

### Implementation Details

#### User Model (`models/User.js`)

**Schema fields:**
- `name` — String, required, trimmed. Stores the user's display name.
- `email` — String, required, unique, lowercased, trimmed. The `lowercase: true` option normalises email input before it reaches the database, preventing duplicate accounts caused by casing differences (e.g., `User@Mail.com` vs `user@mail.com`). The `unique: true` option creates a MongoDB unique index on the field.
- `passwordHash` — String, required. Stores the bcrypt hash of the user's password. The field is named `passwordHash` (not `password`) to make it semantically clear that plain-text passwords are never persisted.
- `createdAt` — Date, defaults to `Date.now`. Provides an immutable registration timestamp.

**Password hashing (pre-save hook):**
- A Mongoose `pre("save")` middleware intercepts every `save()` call. It checks `this.isModified("passwordHash")` — if the field hasn't changed (e.g., the user only updated their name), the hook is a no-op. This prevents double-hashing on unrelated updates.
- When the field *has* changed, `bcrypt.genSalt(12)` generates a random 128-bit salt. The cost factor of **12** means 2¹² = 4 096 iterations of the key-derivation function — this balances security against login latency (~250 ms on modern hardware).
- `bcrypt.hash()` then produces a 60-character Modular Crypt Format string that embeds the algorithm identifier (`$2a$`), cost factor, salt, and hash in a single storable value.

**Password verification (instance method):**
- `comparePassword(candidatePassword)` delegates to `bcrypt.compare()`, which extracts the salt from the stored hash and re-derives the hash from the candidate. Returns a boolean promise. This approach avoids exposing raw hashes to calling code and keeps timing-safe comparison inside the bcrypt library.

#### Push Subscription Model (`models/PushSubscription.js`)

**Schema fields:**
- `userId` — ObjectId referencing `User`, required, indexed. The explicit `index: true` ensures efficient lookups when sending notifications to a specific user (e.g., `PushSubscription.find({ userId })`).
- `subscription` — Object, required. Stores the browser-generated PushSubscription object verbatim (contains `endpoint`, `keys.p256dh`, and `keys.auth` as defined by the Push API spec). Using the generic `Object` type accommodates potential future browser extensions to the subscription payload without requiring schema migrations.
- `createdAt` — Date, defaults to `Date.now`. Records when the subscription was registered.

### Architectural Rationale

- **Bcrypt over alternatives**: Bcrypt was chosen over SHA-256 or PBKDF2 because it is purpose-built for password storage — it includes a built-in salt, a configurable cost factor, and is resistant to GPU-accelerated brute-force attacks due to its Blowfish-based memory-hard design. The `bcryptjs` library (pure JavaScript) was chosen over native `bcrypt` to avoid native compilation issues across team members' machines.
- **Cost factor of 12**: OWASP recommends a minimum cost factor of 10. A value of 12 provides a comfortable safety margin while keeping hash times under 300 ms — acceptable for registration and login flows that occur infrequently per user.
- **Pre-save hook vs. controller hashing**: Hashing inside the model guarantees that *every* code path that creates or modifies a password goes through the same hashing logic. If hashing were performed in a controller, a second controller (e.g., a future password-reset endpoint) could accidentally store a plain-text password. The model-level hook eliminates this class of bug.
- **`isModified` guard**: Without this check, calling `user.name = "New Name"; await user.save();` would re-hash the already-hashed `passwordHash`, corrupting it. The guard makes partial updates safe.
- **Multi-tenancy via `userId` index**: Every push subscription is scoped to a single user. The indexed `userId` foreign key enables O(log n) lookups and ensures that notification sends never leak across user boundaries — a critical security property for multi-tenant data.
- **Loose `Object` type for subscription**: The Web Push subscription payload is an opaque token from the browser's perspective. Enforcing a strict sub-schema (e.g., requiring `endpoint` and `keys`) would couple the model to the current browser implementation. Storing it as a generic object preserves forward compatibility.

---

## Phase 3: JWT Authentication & Multi-Tenancy Middleware

### Phase Summary

This phase established the authentication token infrastructure and the global authorization boundary:

| File | Purpose |
|------|---------|
| `utils/jwt.js` | Helper functions to sign and verify JSON Web Tokens using `JWT_SECRET` |
| `middleware/auth.js` | Express middleware that enforces Bearer token authentication and attaches `req.userId` |

### Implementation Details

#### JWT Utility (`utils/jwt.js`)

Two functions are exported:

- **`signToken(userId)`** — Creates a signed JWT containing `{ id: userId }` as the payload. The token is signed with the HMAC-SHA256 algorithm (the `jsonwebtoken` default) using `process.env.JWT_SECRET` as the symmetric key. The token expires after **7 days** (`expiresIn: "7d"`).
- **`verifyToken(token)`** — Decodes and verifies the JWT. If the token is expired, malformed, or signed with a different secret, `jsonwebtoken` throws an error. On success, it returns the decoded payload (including `id`).

#### Auth Middleware (`middleware/auth.js`)

The middleware runs as a guard on protected routes. Its logic is:

1. **Extract header** — Reads `req.headers.authorization`. If the header is missing or does not start with `"Bearer "`, the request is immediately rejected with `401 Unauthorized` and `{ error: "No token provided" }`.
2. **Split token** — Splits the header on the space character and takes the second segment (the raw JWT string).
3. **Verify** — Calls `verifyToken(token)`. If verification fails (expired, tampered, wrong secret), the catch block returns `401 Unauthorized` with `{ error: "Invalid or expired token" }`.
4. **Attach userId** — On success, `decoded.id` (the user's MongoDB `_id`) is assigned to `req.userId`. All downstream route handlers can now use `req.userId` to scope database queries to the authenticated user.
5. **Call `next()`** — Passes control to the next middleware or route handler.

### Architectural Rationale

- **Stateless authentication**: JWTs are self-contained — the server does not need to store session state or query a sessions table on every request. This simplifies horizontal scaling because any server instance can verify any token independently.
- **HMAC-SHA256 signing**: The default `HS256` algorithm is used because PocketNinja is a single-service application where the same server both signs and verifies tokens. Asymmetric algorithms (RS256) are unnecessary overhead here — they are valuable when a separate auth service issues tokens consumed by multiple independent services.
- **7-day expiry**: A 7-day TTL balances usability (users aren't forced to re-login daily) against security (a leaked token has a bounded lifetime). For a personal expense tracker, this is an appropriate trade-off.
- **Centralised utility vs. inline signing**: The `utils/jwt.js` module centralises all JWT operations. If the signing algorithm, expiry, or payload structure needs to change in the future, there is exactly one file to modify — not every controller that issues tokens.
- **Multi-tenancy enforcement**: The `req.userId` pattern is the cornerstone of data isolation. Every protected route will use `req.userId` in its database queries (e.g., `Expense.find({ userId: req.userId })`), guaranteeing that User A can never read or modify User B's data. The middleware enforces this boundary *before* any business logic runs.
- **Fail-closed design**: The middleware defaults to rejection. If anything is unexpected — missing header, malformed token, expired token, wrong secret — the response is always `401`. There is no fallback to an unauthenticated state.

---

## Phase 4: Authentication API Endpoints

### Phase Summary

This phase exposed three REST endpoints for user registration, login, and session retrieval:

| File | Purpose |
|------|---------|
| `controllers/authController.js` | Business logic for `register`, `login`, and `getMe` |
| `routes/auth.js` | Express router mounting the three endpoints under `/api/auth` |
| `index.js` | Updated to mount `authRoutes` at `/api/auth` |

### Implementation Details

#### Auth Controller (`controllers/authController.js`)

**`POST /api/auth/register`**
1. Destructures `name`, `email`, and `password` from `req.body`.
2. Returns `400` if any field is missing.
3. Validates email format against a basic regex (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`).
4. Enforces a minimum password length of 6 characters.
5. Queries `User.findOne({ email })` (lowercased) to check for duplicates — returns `409 Conflict` if the email is already registered.
6. Creates the user with `User.create()` and signs a JWT via `signToken(user._id)`.
7. Returns `201 Created` with `{ token, user: { id, name, email } }`.

**`POST /api/auth/login`**
1. Destructures `email` and `password` from `req.body`.
2. Returns `400` if either field is missing.
3. Looks up the user by lowercased email. If not found, returns `401 Unauthorized` with a generic "Invalid email or password" message (avoids revealing whether the email exists).
4. Compares the submitted password against the stored `password` field. If mismatched, returns the same `401` message.
5. Signs a JWT and returns `{ token, user: { id, name, email } }`.

**`GET /api/auth/me`**
1. Protected by the `auth` middleware — only reachable with a valid Bearer token.
2. Queries `User.findById(req.userId).select("-password")` to exclude the password field from the response.
3. Returns `404` if the user document no longer exists (e.g., deleted account with a still-valid token).
4. Returns `{ user: { id, name, email } }`.

#### Auth Routes (`routes/auth.js`)

- `POST /register` and `POST /login` are **public** — no middleware guard.
- `GET /me` is **protected** — the `auth` middleware runs first, rejecting unauthenticated requests before the controller executes.

#### Server Entry Point (`index.js`)

- Added `const authRoutes = require("./routes/auth")` import.
- Mounted with `app.use("/api/auth", authRoutes)` after the health-check route.

### Architectural Rationale

- **Controller–Route separation**: The controller contains all business logic; the route file is purely declarative wiring. This makes it easy to unit-test controller functions in isolation (by passing mock `req`/`res` objects) without spinning up an HTTP server.
- **Generic 401 messages**: Both "user not found" and "wrong password" return the identical `"Invalid email or password"` error. This prevents user enumeration attacks — an attacker cannot distinguish between a non-existent account and a wrong password.
- **409 for duplicate registration**: Using `409 Conflict` (rather than `400 Bad Request`) follows HTTP semantics — the request is well-formed but conflicts with existing server state. This allows the frontend to display a specific "email already taken" message.
- **`.select("-password")` on `/me`**: Even though the password is stored as plain text, explicitly excluding it from query results ensures it is never accidentally serialised into an API response or logged.
- **Validation at the controller level**: Input validation is performed before any database call. This avoids unnecessary round-trips to MongoDB for malformed requests and provides clear, field-specific error messages to the client.
- **Multi-tenancy in action**: The `/me` endpoint demonstrates the pattern that all future protected routes will follow — `req.userId` (set by the auth middleware) scopes the database query to the authenticated user's data exclusively.

---

## Phase 5: Web Push Engine & VAPID Infrastructure

### Phase Summary

This phase initialised the Web Push messaging pipeline and built the dispatcher utility:

| File | Purpose |
|------|---------|
| `push/webpush.js` | Configures VAPID credentials, exports `sendPushNotification(userId, payload)` |
| `.env` | Updated with `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` |

### Implementation Details

#### VAPID Configuration

- `webpush.setVapidDetails()` is called at module load time with three environment variables: `VAPID_SUBJECT` (a `mailto:` URI identifying the app operator), `VAPID_PUBLIC_KEY`, and `VAPID_PRIVATE_KEY`.
- The VAPID key pair was generated via `npx web-push generate-vapid-keys --json`, producing a P-256 ECDH key pair encoded in URL-safe Base64.
- These keys enable Voluntary Application Server Identification (VAPID, RFC 8292) — the push service (e.g., FCM, Mozilla autopush) uses the public key to verify that notifications originate from a server authorised by the application, not a third party.

#### Push Dispatcher (`sendPushNotification`)

The function accepts a `userId` and a `payload` (string or object):

1. **Query subscriptions** — `PushSubscription.find({ userId })` retrieves all active push subscriptions for the target user. The `userId` index (created in Phase 2) makes this an efficient indexed lookup.
2. **Payload normalisation** — If `payload` is an object, it is `JSON.stringify()`'d. The Push API requires the payload to be a string or Buffer.
3. **Fan-out delivery** — `Promise.allSettled()` fires `webpush.sendNotification()` for every subscription concurrently. `allSettled` (rather than `Promise.all`) ensures that one failed delivery does not abort the remaining sends.
4. **Stale subscription purging** — After all promises settle, any `rejected` result with HTTP status `410 Gone` or `404 Not Found` indicates the browser has unsubscribed or the push service has dropped the subscription. These subscription `_id`s are collected and bulk-deleted with `PushSubscription.deleteMany({ _id: { $in: staleIds } })`.
5. **Non-stale errors** — Other failures (e.g., network timeouts, 429 rate limits) are logged to the console but do not trigger deletion — the subscription may still be valid.

#### Exports

- `sendPushNotification` — The dispatcher function, intended to be called from any server-side code path (e.g., cron jobs, controller actions) that needs to notify a user.
- `webpush` — The configured `web-push` library instance, exported for cases where callers need lower-level access (e.g., generating the VAPID public key for the client subscription flow).

### Architectural Rationale

- **Module-level VAPID initialisation**: `setVapidDetails()` runs once when the module is first `require()`'d. Every subsequent call to `sendNotification()` uses these cached credentials without re-reading environment variables.
- **`Promise.allSettled` over `Promise.all`**: A user may have multiple devices (phone, laptop, tablet). If the push service for one device is temporarily unreachable, `Promise.all` would reject the entire batch. `allSettled` guarantees all devices are attempted independently.
- **Automatic purge of 410/404 subscriptions**: Push subscriptions become stale when users clear browser data, uninstall the PWA, or revoke notification permissions. Without purging, the database accumulates dead subscriptions that generate errors on every send. The automatic cleanup keeps the `PushSubscription` collection lean and reduces wasted network calls over time.
- **Multi-tenancy scoping**: The dispatcher queries by `userId`, ensuring that notifications are never cross-delivered. Even if a bug elsewhere passed the wrong payload, the query boundary guarantees it reaches only the intended user's devices.
- **Separation from routes**: The push engine is a utility, not a route handler. This allows it to be invoked from multiple contexts — HTTP controllers, scheduled cron jobs (Phase 6), or future webhook handlers — without duplicating push logic.

---

## Phase 6: Push Subscription Endpoints & Validation

### Phase Summary

This phase exposed three REST endpoints for push subscription management and wired them into the server:

| File | Purpose |
|------|---------|
| `controllers/pushController.js` | Business logic for `getVapidPublicKey`, `subscribe`, and `unsubscribe` |
| `routes/push.js` | Express router mounting endpoints under `/api/push` |
| `index.js` | Updated to mount `pushRoutes` at `/api/push` |

### Implementation Details

#### Push Controller (`controllers/pushController.js`)

**`GET /api/push/vapidPublicKey`**
- Public endpoint (no auth required). Returns `{ publicKey: process.env.VAPID_PUBLIC_KEY }`.
- The client needs this key to call `pushManager.subscribe({ applicationServerKey })` in the browser. Serving it from an API endpoint (rather than hard-coding it in the frontend) means the key can be rotated by changing the environment variable alone — no client rebuild needed.

**`POST /api/push/subscribe`**
- Protected by the `auth` middleware — requires a valid Bearer token.
- Expects `{ subscription }` in the request body, where `subscription` is the PushSubscription object from the browser's Push API (containing `endpoint`, `keys.p256dh`, `keys.auth`).
- Validates that `subscription` exists and has an `endpoint` property. Returns `400` if invalid.
- **Upsert logic**: Queries `PushSubscription.findOne({ userId, "subscription.endpoint": subscription.endpoint })`.
  - If a matching record exists, the `subscription` object is updated in place and saved. This handles key rotation — browsers occasionally regenerate `p256dh` and `auth` keys while keeping the same endpoint.
  - If no match exists, a new `PushSubscription` document is created.
- Returns `200` with `"Subscription updated"` or `201` with `"Subscription saved"`.

**`DELETE /api/push/subscribe`**
- Protected by the `auth` middleware.
- Expects `{ endpoint }` in the request body — the push endpoint URL string.
- Calls `PushSubscription.findOneAndDelete({ userId: req.userId, "subscription.endpoint": endpoint })`.
- Returns `404` if no matching subscription is found, otherwise `200` with `"Subscription removed"`.
- The compound query (`userId` + `endpoint`) ensures a user can only delete their own subscriptions — never another user's.

#### Push Routes (`routes/push.js`)

- `GET /vapidPublicKey` — **public**, no middleware guard.
- `POST /subscribe` — **protected** by `auth`.
- `DELETE /subscribe` — **protected** by `auth`.

#### Server Entry Point (`index.js`)

- Added `const pushRoutes = require("./routes/push")` import.
- Mounted with `app.use("/api/push", pushRoutes)` after the auth routes.

### Architectural Rationale

- **Upsert over blind insert**: Without the duplicate check, refreshing the page or re-subscribing on the same browser would create duplicate `PushSubscription` documents. Each duplicate would receive a notification on every send, causing the user to see the same notification multiple times. The upsert-by-endpoint pattern prevents this.
- **Endpoint as the deduplication key**: The `endpoint` URL is the unique identifier issued by the push service for a specific browser–device combination. Two subscriptions with the same endpoint are, by definition, the same channel — so using it as the match key is both correct and efficient.
- **Serving VAPID key via API**: Hard-coding the public key in the frontend source code would require a client rebuild to rotate keys. Serving it from `/api/push/vapidPublicKey` decouples key management from the deployment pipeline.
- **Scoped deletion**: The `DELETE` handler requires both `req.userId` (from the JWT) and the `endpoint` (from the body). This compound condition guarantees that User A cannot delete User B's subscription even if they somehow know the endpoint URL — the `userId` mismatch would cause `findOneAndDelete` to return `null`.
- **RESTful resource design**: `POST /subscribe` and `DELETE /subscribe` operate on the same logical resource (a push subscription). Using HTTP verbs to distinguish creation from deletion keeps the URL structure clean and predictable.
