# PocketNinja — Architecture, Workflow & Work Division

Personal Expense Tracker · MERN stack · Academic web-dev project (frontend-focused)

**Team**

| Name | ID | Slice |
|------|----|----|
| MD Arham Apon Utsho | 220042153 | Auth + App Shell + Push Infrastructure |
| Arham Ibrahim Khan | 220042160 | Transactions + Categories + Budget CRUD |
| Musabbereen Chishti | 220042126 | Analytics Dashboard (charts + aggregation) |
| Mustain Billah Taj | 220042166 | Recurring + Reminders + Savings Goals |

---

## 1. Overview

PocketNinja lets a user record income/expenses, categorize them, set budgets, track savings goals, and receive bill reminders via browser push notifications. It ships an interactive dashboard with charts summarizing spending.

Work is split into **four vertical slices**. Each person owns their slice end-to-end — MongoDB model, Express routes, and React UI. This avoids merge conflicts (people rarely touch the same files), balances load, and ensures everyone learns the full stack.

---

## 2. Tech Stack

**Frontend**
- React 18 + Vite (fast dev server, fast builds)
- React Router v6 (client-side routing)
- Tailwind CSS + shadcn/ui (styling + component primitives)
- Recharts (charts)
- axios (HTTP client)
- Context API + hooks for state (no Redux — not needed at this scale)

**Backend**
- Node.js + Express (REST API)
- Mongoose (MongoDB ODM)
- jsonwebtoken (JWT auth) + bcrypt (password hashing)
- web-push (Web Push / VAPID)
- node-cron (scheduled jobs for recurring txns + reminders)

**Database**
- MongoDB Atlas (free tier cluster)

**Dev/ops**
- Git + GitHub (feature-branch workflow)
- dotenv for config
- Backend deploy: Render or Railway (free tier — required for real push over HTTPS)
- Frontend deploy: Vercel or Netlify

---

## 3. System Architecture

```
┌──────────────────────┐        HTTP/JSON (axios)        ┌──────────────────────┐
│   React SPA (Vite)    │  ───────────────────────────>  │   Express REST API   │
│                       │  <───────────────────────────  │   (Node.js)          │
│  - Router + layout    │        JWT in Authorization     │                      │
│  - Context stores     │        header                   │  - Auth middleware   │
│  - shadcn/ui + Recharts│                                │  - Route controllers │
│  - Service Worker     │  <════ Web Push (VAPID) ════════│  - node-cron jobs    │
└──────────────────────┘        push notifications        └──────────┬───────────┘
                                                                      │ Mongoose
                                                                      ▼
                                                            ┌──────────────────────┐
                                                            │   MongoDB Atlas       │
                                                            │  users, categories,   │
                                                            │  transactions, budgets,│
                                                            │  recurring, goals,     │
                                                            │  pushsubscriptions     │
                                                            └──────────────────────┘
```

**Request flow (typical authed call)**
1. React calls `axios.get('/api/transactions')` with `Authorization: Bearer <token>`.
2. Express `auth` middleware verifies JWT, attaches `req.userId`.
3. Controller queries Mongoose scoped to `req.userId`.
4. JSON returned; React updates Context + re-renders.

**Push flow (bill reminder)**
1. User grants notification permission; client service worker subscribes; subscription POSTed to `/api/push/subscribe`, stored per user.
2. `node-cron` runs daily. Finds bills due / recurring rules to fire.
3. For each, generates the transaction (if recurring) and calls `web-push.sendNotification(subscription, payload)`.
4. Service worker `push` event fires → shows OS notification even if app closed.

---

## 4. Security & Multi-Tenancy (non-negotiable)

- **Every** domain document carries a `userId` (ref to User). **Every** query filters by `req.userId`. One user must never read or mutate another's data. This is the core security boundary — reviewed on every PR.
- Passwords stored as bcrypt hashes only (never plaintext, never logged).
- JWT signed with `JWT_SECRET` from env; short-ish expiry (e.g. 7d for an academic app).
- Auth middleware guards all routes except `POST /api/auth/register` and `POST /api/auth/login`.
- Secrets (`JWT_SECRET`, `MONGODB_URI`, `VAPID_*`) live in `.env`, never committed. Commit a `.env.example` with keys only.
- Input validation on write endpoints (amount is a number, type is `income|expense`, required fields present) — reject bad input at the boundary.

---

## 5. Data Models (Mongoose)

```js
// User  — owner: Apon
User {
  name: String,
  email: String (unique, lowercased),
  passwordHash: String,
  createdAt: Date
}

// PushSubscription — owner: Apon
PushSubscription {
  userId: ObjectId ref User,
  subscription: Object,   // browser PushSubscription JSON (endpoint + keys)
  createdAt: Date
}

// Category — owner: Ibrahim
Category {
  userId: ObjectId ref User,
  name: String,           // "Food", "Transport", ...
  type: String,           // "income" | "expense"
  icon: String,           // optional emoji/name for UI
  color: String           // optional, used by charts
}

// Transaction — owner: Ibrahim
Transaction {
  userId: ObjectId ref User,
  amount: Number,
  type: String,           // "income" | "expense"
  categoryId: ObjectId ref Category,
  date: Date,
  note: String,
  recurringId: ObjectId ref RecurringRule (nullable)  // set if auto-generated
}

// Budget — owner: Ibrahim (data) / Musabbereen (analytics reads it)
Budget {
  userId: ObjectId ref User,
  categoryId: ObjectId ref Category (nullable),  // null = overall monthly budget
  month: String,          // "2026-07"
  limit: Number
}

// RecurringRule — owner: Mustain
RecurringRule {
  userId: ObjectId ref User,
  template: {
    amount: Number,
    type: String,
    categoryId: ObjectId ref Category,
    note: String
  },
  interval: String,       // "daily" | "weekly" | "monthly"
  nextRun: Date,
  anchorDay: Number,      // 1-31, day-of-month the rule was created on.
                          // Monthly rules clamp from this, not from the last
                          // run — otherwise a rule due on the 31st clamps to
                          // Feb 28 and then stays on the 28th forever.
  active: Boolean
}

// Goal — owner: Mustain
Goal {
  userId: ObjectId ref User,
  title: String,
  target: Number,
  saved: Number,
  deadline: Date
}
```

---

## 6. API Contract

Base path `/api`. All routes except auth require `Authorization: Bearer <token>`. All list endpoints return only the caller's own data.

### Auth + Push — Apon
```
POST   /api/auth/register     { name, email, password }        → { token, user }
POST   /api/auth/login        { email, password }              → { token, user }
GET    /api/auth/me                                            → { user }
POST   /api/push/subscribe    { subscription }                 → 201
DELETE /api/push/subscribe    { endpoint }                     → 204
GET    /api/push/vapidPublicKey                                → { key }
```

### Transactions + Categories + Budgets — Ibrahim
```
GET    /api/categories                                         → [Category]
POST   /api/categories        { name, type, icon, color }      → Category
PUT    /api/categories/:id                                     → Category
DELETE /api/categories/:id                                     → 204

GET    /api/transactions?category=&from=&to=&type=            → [Transaction] (filtered)
POST   /api/transactions      { amount, type, categoryId, date, note } → Transaction
PUT    /api/transactions/:id                                   → Transaction
DELETE /api/transactions/:id                                   → 204

GET    /api/budgets?month=YYYY-MM                              → [Budget]
POST   /api/budgets           { categoryId?, month, limit }    → Budget
PUT    /api/budgets/:id                                        → Budget
DELETE /api/budgets/:id                                        → 204
```

### Analytics — Musabbereen (read-only aggregations)
```
GET /api/analytics/summary?month=YYYY-MM
    → { totalIncome, totalExpense, balance }
GET /api/analytics/by-category?month=YYYY-MM&type=expense
    → [{ categoryId, categoryName, total, color }]
GET /api/analytics/trend?from=&to=&groupBy=month
    → [{ period: "2026-07", income, expense }]
GET /api/analytics/budget-status?month=YYYY-MM
    → [{ categoryId, categoryName, limit, spent, remaining, overLimit }]
```

### Recurring + Reminders + Goals — Mustain
```
GET    /api/recurring                                          → [RecurringRule]
POST   /api/recurring         { template, interval, nextRun }  → RecurringRule
PUT    /api/recurring/:id                                      → RecurringRule
DELETE /api/recurring/:id                                      → 204
POST   /api/recurring/run-now                                  → { rulesProcessed, transactionsCreated }
       ↳ runs the cron's due-rule pass for the calling user only. Added so the
         daily job is demoable without waiting a day; scoped server-side, so it
         can never touch another user's rules.

GET    /api/goals                                              → [Goal]
POST   /api/goals             { title, target, saved, deadline } → Goal
PUT    /api/goals/:id         { saved, ... }                   → Goal
DELETE /api/goals/:id                                          → 204
```

> **Contract rule:** these JSON shapes are the interface between people. If you must change a shape, announce it in the team chat + update this doc first. Musabbereen's charts consume Ibrahim's transactions — Ibrahim publishes his shapes early so she can build against mock data in parallel.

---

## 7. Repository Structure

```
PocketNinja/
├── PROJECT_PLAN.md          ← this doc
├── README.md                ← setup instructions
├── client/                  ← React app (Vite)
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx          ← routes
│   │   ├── api/             ← axios instance + useApi hook
│   │   ├── context/         ← AuthContext, etc.
│   │   ├── components/      ← shared UI (shadcn/ui lives here)
│   │   ├── pages/           ← one folder per feature slice
│   │   │   ├── auth/        (Apon)
│   │   │   ├── transactions/(Ibrahim)
│   │   │   ├── dashboard/   (Musabbereen)
│   │   │   └── planning/    (Mustain: recurring, goals, reminders)
│   │   ├── layout/          ← nav, shell (Apon)
│   │   └── sw.js            ← service worker (Apon)
│   └── ...
└── server/
    ├── index.js             ← Express app entry
    ├── db.js                ← Mongoose connection
    ├── models/              ← one file per model
    ├── middleware/          ← auth.js (Apon)
    ├── routes/              ← one file per resource
    ├── controllers/         ← business logic
    ├── jobs/                ← cron.js (Mustain)
    ├── push/                ← web-push helper (Apon)
    └── .env.example
```

---

## 8. Development Workflow

**Git**
- `main` = always working/demo-able. No direct commits to `main`.
- Feature branches: `feat/<slice>-<thing>`, e.g. `feat/transactions-crud`.
- Open a PR into `main`. At least one teammate reviews. Merge after review.
- Keep PRs small and slice-scoped to avoid conflicts.

**Branch protection convention**
- Reviewer checks the security boundary (userId scoping) on every backend PR.
- Don't merge red CI / broken build.

**Local run**
```bash
# terminal 1
cd server && npm install && npm run dev     # nodemon on :5000

# terminal 2
cd client && npm install && npm run dev     # vite on :5173
```
Client proxies `/api` → `:5000` in dev (Vite proxy config).

**Environment**
- Each member has own `.env` (shared secrets over team chat, never committed).
- One shared MongoDB Atlas cluster, or each a free cluster during dev.

---

## 9. Seven-Day Timeline

Compressed schedule. Days 2–5 run all four people in parallel. The rule that makes 7 days work: **Day 1 is done together and Apon's auth ships end of Day 1** — nobody's protected routes or cron can be tested until it exists.

Each cell = that person's goal for that day. "Mock" = build UI against fake JSON, swap to live API later.

### Day 1 — Foundation (ALL together, do not split)
Nothing parallelizes cleanly before this is done. Sit together (or one call) and land:
- Scaffold `client/` (Vite + React) and `server/` (Express).
- MongoDB Atlas cluster live; `server/db.js` connects.
- Tailwind + shadcn/ui installed; base theme + nav layout agreed.
- Commit the API contract (§6) as the interface everyone codes to.
- **Apon ships auth first, same day:** `User` model, register/login/me, `middleware/auth.js`, axios instance, `AuthContext`. Push it so everyone pulls it Day 2.

### Days 2–7 — parallel per person

| Day | Apon (Auth/Shell/Push) | Ibrahim (Txn/Cat/Budget) | Musabbereen (Dashboard) | Mustain (Recurring/Goals) |
|-----|------------------------|--------------------------|-------------------------|---------------------------|
| **2** | App shell, nav, protected-route wrapper, login/register pages polished | `Category` + `Transaction` models + CRUD endpoints | Dashboard layout + summary cards (mock data) | `RecurringRule` + `Goal` models + CRUD endpoints |
| **3** | Login/register/logout fully wired to AuthContext; `useApi` hook finalized | Transaction list UI + add/edit/delete forms | Pie (by-category) + bar (income vs expense) charts on mock | Recurring rule create UI + goal create UI (mock) |
| **4** | VAPID keys, `PushSubscription` model, `/push/subscribe`, send helper | Filter bar (category + date range + type); category manager UI | `GET /analytics/summary` + `by-category` real endpoints; wire summary + pie to live | `node-cron` job: generate due recurring txns |
| **5** | Service worker + notification permission prompt + subscribe flow | `Budget` CRUD + budget set/edit UI | `trend` + `budget-status` endpoints; wire remaining charts + progress bars live | Cron fires reminders via Apon's push helper; goal progress UI live |
| **6** | **Integration + deploy (all four).** Deploy backend (Render/Railway, HTTPS) + frontend (Vercel). Wire push end-to-end against deployed URL. Fix broken cross-slice calls. | | | |
| **7** | **Polish + demo prep (all four).** Responsive pass (mobile+desktop — graded). Loading/empty/error states everywhere. Bug bash. README. Seed demo data. Rehearse the demo. | | | |

**Daily discipline**
- Merge to `main` every evening; keep `main` demo-able.
- 10-min sync each morning: what's blocked, what shapes changed.
- Ibrahim publishes transaction JSON Day 2 so Musabbereen mocks against the real shape.

**If you fall behind (cut in this order):**
1. Web push → fall back to in-app notification bell (drops service worker + VAPID + cron-push, keeps cron for recurring txns). Biggest scope saver.
2. Trend line chart → keep pie + bar only.
3. Category color/icon picker → default colors.
Do **not** cut: auth, transaction CRUD, one chart, budget tracking. That's the graded core.

---

## 10. Detailed Work Division

Each slice below lists backend + frontend tasks. Load is balanced: Apon's lighter auth slice absorbs push infra; Musabbereen drops budget CRUD but owns the heavy chart dashboard; Mustain owns the trickiest backend (cron) with lighter UI; Ibrahim carries the most CRUD but it's the most repetitive/straightforward.

### 10.1 — MD Arham Apon Utsho (220042153) · Auth + Shell + Push

**Backend**
- `User` model + bcrypt password hashing.
- `POST /register`, `POST /login` (issue JWT), `GET /me`.
- `middleware/auth.js` — verify JWT, attach `req.userId`. **Every other slice depends on this; ship it first.**
- VAPID key generation + `push/webpush.js` send helper.
- `PushSubscription` model + `POST/DELETE /api/push/subscribe` + `GET /vapidPublicKey`.

**Frontend**
- Login + Register pages (shadcn forms + validation).
- `AuthContext` (token storage, current user, login/logout).
- axios instance with auth-header interceptor + shared `useApi` hook.
- App shell: top nav / sidebar, responsive layout, route definitions in `App.jsx`.
- Protected-route wrapper (redirect to login if no token).
- Service worker registration + "enable notifications" permission prompt + subscribe call.

**Deliverable other slices consume:** working auth, `useApi` hook, layout shell, push send helper.

---

### 10.2 — Arham Ibrahim Khan (220042160) · Transactions + Categories + Budgets

**Backend**
- `Category` model + CRUD (scoped to userId).
- `Transaction` model + CRUD.
- Transaction list endpoint with query filters: `category`, `type`, date range `from`/`to`.
- `Budget` model + CRUD (per-category or overall monthly).
- Validation: amount numeric, type enum, required fields.

**Frontend**
- Transaction list view (table/cards, paginated or scrollable).
- Add / edit / delete transaction forms (shadcn dialog + form).
- Category manager (create/edit/delete categories, pick icon + color).
- Filter bar: category dropdown + date-range picker (`<input type="date">`) + type toggle.
- Budget set/edit UI (choose category or overall, month, limit).

**Publishes early:** transaction + category JSON shapes, so Musabbereen builds charts against them.

---

### 10.3 — Musabbereen Chishti (220042126) · Analytics Dashboard

**Backend (read-only aggregations, MongoDB aggregation pipeline)**
- `GET /analytics/summary` — total income, total expense, balance for a month.
- `GET /analytics/by-category` — spend grouped by category (feeds pie).
- `GET /analytics/trend` — income vs expense grouped by month (feeds bar/line).
- `GET /analytics/budget-status` — limit vs spent per category, `overLimit` flag.

**Frontend (the heavy dashboard — this is the graded centerpiece)**
- Summary cards: income, expense, balance (with month selector).
- Category breakdown **pie chart** (Recharts).
- Income-vs-expense **bar chart** by month.
- Spending **trend line chart** over time.
- Budget **progress bars** (spent/limit) with over-limit visual state.
- Over-limit **alert banners/toasts** when spending crosses a budget.
- Dashboard responsive grid layout; loading + empty states for every chart.

**Depends on:** Ibrahim's transaction/category data. Build against mock JSON in Phase 1, swap to live endpoints in Phase 2.

---

### 10.4 — Mustain Billah Taj (220042166) · Recurring + Reminders + Goals

**Backend**
- `RecurringRule` model + CRUD (template + interval + nextRun).
- `Goal` model + CRUD (target, saved, deadline).
- `jobs/cron.js` — **node-cron daily tick:**
  - Find recurring rules where `nextRun <= now`; create the transaction; advance `nextRun` by interval.
  - Find bills/rules due soon; call Apon's push send helper for each subscribed user.
- Handles the scheduling logic — the trickiest backend piece.

**Frontend**
- Recurring transactions UI (create rule: amount, category, interval; list/toggle active).
- Reminders / notifications list (in-app view of upcoming due items — complements push).
- Savings goals: create goal, contribute to it, progress bars toward target with deadline.

**Depends on:** Apon's push helper (for sending), Ibrahim's category model (for rule templates).

---

## 11. Load Balance Summary

| Person | Models | Endpoints | Screens | Special complexity |
|--------|:------:|:---------:|:-------:|--------------------|
| Apon | 2 | ~6 | ~4 | JWT + VAPID/service-worker infra (everyone depends on it) |
| Ibrahim | 3 | ~12 | ~5 | Most CRUD (but repetitive/straightforward) |
| Musabbereen | 0 (reads others) | ~4 | ~1 heavy | Aggregation pipelines + heavy Recharts dashboard |
| Mustain | 2 | ~8 | ~3 | node-cron scheduling + push integration |

Roughly even total effort; each person carries one genuinely hard part.

---

## 12. Fallbacks / Risk Notes

- **Push needs HTTPS + always-on server.** Works on Chrome localhost for dev. For live demo, deploy backend (Render/Railway). If deploy slips near deadline, fall back to an in-app notification bell — no service worker needed. Keep that path open.
- **node-cron needs the server process running.** Fine on a hosted backend. On free tiers that sleep, a wake-on-request or an external cron ping covers it — only worry about this if the demo requires closed-app push.
- **Aggregation load:** dataset is tiny (academic), so MongoDB aggregation pipelines are plenty fast. No caching needed.
- **Keep `main` demo-able at all times** — so there's always something to show.
