require("../helpers/env");
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../helpers/db");
const { startServer } = require("../helpers/app");
const { makeClient } = require("../helpers/client");

describe("app wiring", () => {
  let api;
  let server;

  before(async () => {
    await db.connect();
    server = await startServer();
    api = makeClient(server.baseUrl);
  });

  after(async () => {
    await server.close();
    await db.disconnect();
  });

  test("GET /api/health is public and reports ok", async () => {
    const res = await api.get("/health");

    assert.equal(res.status, 200);
    assert.equal(res.body.status, "ok");
    assert.ok(!Number.isNaN(Date.parse(res.body.timestamp)));
  });

  test("every resource is mounted at its contracted path", async () => {
    // 401 rather than 404 proves the router is mounted and auth-guarded.
    const guarded = [
      "/auth/me",
      "/categories",
      "/transactions",
      "/budgets",
      "/analytics/summary",
      "/analytics/by-category",
      "/analytics/trend",
      "/analytics/budget-status",
      "/recurring",
      "/goals",
    ];

    for (const path of guarded) {
      assert.equal((await api.get(path)).status, 401, `${path} should be mounted and guarded`);
    }
  });

  test("the VAPID key route is mounted and public", async () => {
    assert.equal((await api.get("/push/vapidPublicKey")).status, 200);
  });

  test("an unknown path returns 404", async () => {
    assert.equal((await api.get("/nope")).status, 404);
  });

  test("a wrong verb on a known path returns 404", async () => {
    assert.equal((await api.post("/analytics/summary", {})).status, 404);
  });

  test("malformed JSON is rejected without crashing the process", async () => {
    const res = await fetch(`${server.baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ not json",
    });

    assert.ok(res.status >= 400, "should reject, not accept");
    assert.equal((await api.get("/health")).status, 200, "server must still be alive");
  });

  test("Ibrahim's authoritative models win the model registry", async () => {
    // Regression guard for the require-order trap in index.js: if
    // routes/analytics loaded first, the placeholder schemas from
    // _analyticsModels.js would own these names and validation would vanish.
    const mongoose = require("mongoose");
    const Transaction = require("../../models/Transaction");

    assert.equal(mongoose.models.Transaction, Transaction);
    assert.ok(
      mongoose.models.Transaction.schema.path("amount").options.min,
      "the authoritative schema carries the amount minimum",
    );
  });
});
