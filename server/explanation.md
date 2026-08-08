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
