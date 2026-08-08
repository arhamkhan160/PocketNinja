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
