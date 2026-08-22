require("../helpers/env");
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../helpers/db");
const { startServer } = require("../helpers/app");
const { makeClient, makeUser } = require("../helpers/client");
const Category = require("../../models/Category");
const Budget = require("../../models/Budget");

describe("/api/budgets", () => {
  let api;
  let server;
  let owner;
  let other;
  let food;

  before(async () => {
    await db.connect();
    server = await startServer();
    api = makeClient(server.baseUrl);
  });

  beforeEach(async () => {
    await db.clear();
    owner = await makeUser();
    other = await makeUser();
    food = await Category.create({ userId: owner.userId, name: "Food", type: "expense" });
  });

  after(async () => {
    await server.close();
    await db.disconnect();
  });

  const create = (body, token = owner.token) => api.post("/budgets", body, { token });

  describe("auth guard", () => {
    test("all four verbs reject an unauthenticated caller with 401", async () => {
      assert.equal((await api.get("/budgets")).status, 401);
      assert.equal((await api.post("/budgets", { month: "2026-08", limit: 1 })).status, 401);
      assert.equal((await api.put("/budgets/507f1f77bcf86cd799439011", {})).status, 401);
      assert.equal((await api.del("/budgets/507f1f77bcf86cd799439011")).status, 401);
    });
  });

  describe("POST /budgets", () => {
    test("creates a per-category budget with 201", async () => {
      const res = await create({
        categoryId: String(food._id),
        month: "2026-08",
        limit: 300,
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.limit, 300);
      assert.equal(res.body.categoryId, String(food._id));
    });

    test("creates an overall budget when categoryId is omitted or null", async () => {
      const omitted = await create({ month: "2026-08", limit: 900 });
      assert.equal(omitted.status, 201);
      assert.equal(omitted.body.categoryId, null);

      const explicitNull = await create({ categoryId: null, month: "2026-09", limit: 900 });
      assert.equal(explicitNull.body.categoryId, null);
    });

    test("re-posting the same category and month upserts instead of duplicating", async () => {
      const first = await create({ categoryId: String(food._id), month: "2026-08", limit: 300 });
      const second = await create({ categoryId: String(food._id), month: "2026-08", limit: 450 });

      assert.equal(second.status, 201);
      assert.equal(second.body.limit, 450);
      assert.equal(second.body._id, first.body._id);
      assert.equal(await Budget.countDocuments({ userId: owner.userId }), 1);
    });

    test("upsert also applies to the overall budget", async () => {
      await create({ month: "2026-08", limit: 900 });
      await create({ month: "2026-08", limit: 1000 });

      assert.equal(await Budget.countDocuments({ userId: owner.userId }), 1);
    });

    test("accepts a limit of exactly 0", async () => {
      const res = await create({ month: "2026-08", limit: 0 });

      assert.equal(res.status, 201);
      assert.equal(res.body.limit, 0);
    });

    test("coerces a numeric string limit", async () => {
      assert.equal((await create({ month: "2026-08", limit: "250.75" })).body.limit, 250.75);
    });

    test("rejects a negative or non-numeric limit", async () => {
      for (const limit of [-1, "abc", undefined, null, NaN, {}]) {
        const res = await create({ month: "2026-08", limit });
        assert.equal(res.status, 400, `limit=${JSON.stringify(limit)} should be 400`);
        assert.match(res.body.error, /Limit must be a number of 0 or more/);
      }
    });

    test("rejects a missing or malformed month", async () => {
      for (const month of [undefined, "", "2026-13", "2026-00", "2026-1", "August", "2026-08-01"]) {
        const res = await create({ month, limit: 100 });
        assert.equal(res.status, 400, `month=${JSON.stringify(month)} should be 400`);
        assert.match(res.body.error, /YYYY-MM/);
      }
    });

    test("accepts the month boundaries 01 and 12", async () => {
      assert.equal((await create({ month: "2026-01", limit: 1 })).status, 201);
      assert.equal((await create({ month: "2026-12", limit: 1 })).status, 201);
    });

    test("rejects another user's categoryId", async () => {
      const theirs = await Category.create({
        userId: other.userId,
        name: "Secret",
        type: "expense",
      });

      const res = await create({
        categoryId: String(theirs._id),
        month: "2026-08",
        limit: 100,
      });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /Category not found/);
      assert.equal(await Budget.countDocuments({}), 0);
    });

    test("rejects a non-existent and a malformed categoryId", async () => {
      assert.equal(
        (await create({ categoryId: "507f1f77bcf86cd799439011", month: "2026-08", limit: 1 }))
          .status,
        400,
      );
      assert.equal(
        (await create({ categoryId: "not-an-id", month: "2026-08", limit: 1 })).status,
        400,
      );
    });

    test("ownership comes from the token, not the body", async () => {
      const res = await create({
        month: "2026-08",
        limit: 100,
        userId: String(other.userId),
      });
      assert.equal(res.body.userId, String(owner.userId));
    });

    test("two users can each hold the same category-month slot", async () => {
      await create({ month: "2026-08", limit: 100 });
      const theirs = await create({ month: "2026-08", limit: 200 }, other.token);

      assert.equal(theirs.status, 201);
      assert.equal(await Budget.countDocuments({}), 2);
    });
  });

  describe("GET /budgets", () => {
    test("returns an empty array when none are set", async () => {
      const res = await api.get("/budgets", { token: owner.token });

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, []);
    });

    test("returns every month when no month filter is given", async () => {
      await create({ month: "2026-07", limit: 1 });
      await create({ month: "2026-08", limit: 2 });

      const res = await api.get("/budgets", { token: owner.token });
      assert.equal(res.body.length, 2);
    });

    test("filters by month", async () => {
      await create({ month: "2026-07", limit: 1 });
      await create({ month: "2026-08", limit: 2 });

      const res = await api.get("/budgets?month=2026-08", { token: owner.token });

      assert.equal(res.body.length, 1);
      assert.equal(res.body[0].limit, 2);
    });

    test("sorts by month descending", async () => {
      await create({ month: "2026-07", limit: 1 });
      await create({ month: "2026-09", limit: 3 });
      await create({ month: "2026-08", limit: 2 });

      const res = await api.get("/budgets", { token: owner.token });

      assert.deepEqual(
        res.body.map((b) => b.month),
        ["2026-09", "2026-08", "2026-07"],
      );
    });

    test("rejects a malformed month filter with 400", async () => {
      const res = await api.get("/budgets?month=2026-13", { token: owner.token });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /YYYY-MM/);
    });

    test("an empty month parameter is ignored rather than rejected", async () => {
      await create({ month: "2026-08", limit: 1 });
      const res = await api.get("/budgets?month=", { token: owner.token });

      assert.equal(res.status, 200);
      assert.equal(res.body.length, 1);
    });

    test("returns only the caller's budgets", async () => {
      await create({ month: "2026-08", limit: 1 });
      await create({ month: "2026-08", limit: 2 }, other.token);

      const res = await api.get("/budgets", { token: owner.token });

      assert.equal(res.body.length, 1);
      assert.equal(res.body[0].limit, 1);
    });
  });

  describe("PUT /budgets/:id", () => {
    let budget;

    beforeEach(async () => {
      budget = (await create({ month: "2026-08", limit: 100 })).body;
    });

    const put = (body, token = owner.token) => api.put(`/budgets/${budget._id}`, body, { token });

    test("updates the limit", async () => {
      const res = await put({ limit: 250 });

      assert.equal(res.status, 200);
      assert.equal(res.body.limit, 250);
    });

    test("updates the month", async () => {
      const res = await put({ month: "2026-09" });
      assert.equal(res.body.month, "2026-09");
    });

    test("accepts a limit of 0", async () => {
      assert.equal((await put({ limit: 0 })).body.limit, 0);
    });

    test("rejects a negative limit and a malformed month", async () => {
      assert.equal((await put({ limit: -1 })).status, 400);
      assert.equal((await put({ limit: "abc" })).status, 400);
      assert.equal((await put({ month: "2026-13" })).status, 400);
    });

    test("an empty body is a no-op", async () => {
      const res = await put({});

      assert.equal(res.status, 200);
      assert.equal(res.body.limit, 100);
    });

    test("returns 404 for another user's budget and leaves it unchanged", async () => {
      const res = await put({ limit: 999 }, other.token);

      assert.equal(res.status, 404);
      assert.equal((await Budget.findById(budget._id)).limit, 100);
    });

    test("returns 404 for non-existent and malformed ids", async () => {
      assert.equal(
        (await api.put("/budgets/507f1f77bcf86cd799439011", { limit: 1 }, { token: owner.token }))
          .status,
        404,
      );
      assert.equal(
        (await api.put("/budgets/not-an-id", { limit: 1 }, { token: owner.token })).status,
        404,
      );
    });

    test("moving a budget onto an occupied category-month slot returns 409", async () => {
      await create({ month: "2026-09", limit: 200 });

      const res = await put({ month: "2026-09" });

      assert.equal(res.status, 409);
      assert.match(res.body.error, /already exists/);
    });
  });

  describe("DELETE /budgets/:id", () => {
    let budget;

    beforeEach(async () => {
      budget = (await create({ month: "2026-08", limit: 100 })).body;
    });

    test("deletes and returns 204", async () => {
      const res = await api.del(`/budgets/${budget._id}`, undefined, { token: owner.token });

      assert.equal(res.status, 204);
      assert.equal(await Budget.countDocuments({ _id: budget._id }), 0);
    });

    test("returns 404 for another user's budget and does not delete it", async () => {
      const res = await api.del(`/budgets/${budget._id}`, undefined, { token: other.token });

      assert.equal(res.status, 404);
      assert.equal(await Budget.countDocuments({ _id: budget._id }), 1);
    });

    test("a repeat delete and a malformed id both return 404", async () => {
      await api.del(`/budgets/${budget._id}`, undefined, { token: owner.token });
      assert.equal(
        (await api.del(`/budgets/${budget._id}`, undefined, { token: owner.token })).status,
        404,
      );
      assert.equal(
        (await api.del("/budgets/not-an-id", undefined, { token: owner.token })).status,
        404,
      );
    });

    test("deleting frees the category-month slot for reuse", async () => {
      await api.del(`/budgets/${budget._id}`, undefined, { token: owner.token });
      const again = await create({ month: "2026-08", limit: 500 });

      assert.equal(again.status, 201);
      assert.equal(again.body.limit, 500);
    });
  });
});
