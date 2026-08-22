require("../helpers/env");
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../helpers/db");
const { startServer } = require("../helpers/app");
const { makeClient, makeUser } = require("../helpers/client");
const Category = require("../../models/Category");
const Transaction = require("../../models/Transaction");
const Budget = require("../../models/Budget");

describe("/api/categories", () => {
  let api;
  let server;
  let owner;
  let other;

  before(async () => {
    await db.connect();
    server = await startServer();
    api = makeClient(server.baseUrl);
  });

  beforeEach(async () => {
    await db.clear();
    owner = await makeUser();
    other = await makeUser();
  });

  after(async () => {
    await server.close();
    await db.disconnect();
  });

  const create = (body, token = owner.token) => api.post("/categories", body, { token });

  describe("auth guard", () => {
    test("all four verbs reject an unauthenticated caller with 401", async () => {
      assert.equal((await api.get("/categories")).status, 401);
      assert.equal((await api.post("/categories", { name: "x", type: "expense" })).status, 401);
      assert.equal((await api.put("/categories/507f1f77bcf86cd799439011", {})).status, 401);
      assert.equal((await api.del("/categories/507f1f77bcf86cd799439011")).status, 401);
    });
  });

  describe("GET /categories", () => {
    test("returns an empty array for a new user", async () => {
      const res = await api.get("/categories", { token: owner.token });
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, []);
    });

    test("returns only the caller's own categories", async () => {
      await Category.create({ userId: owner.userId, name: "Mine", type: "expense" });
      await Category.create({ userId: other.userId, name: "Theirs", type: "expense" });

      const res = await api.get("/categories", { token: owner.token });

      assert.equal(res.body.length, 1);
      assert.equal(res.body[0].name, "Mine");
    });

    test("sorts by type then name — expense before income, alphabetical within", async () => {
      await create({ name: "Zebra", type: "expense" });
      await create({ name: "Apple", type: "expense" });
      await create({ name: "Salary", type: "income" });

      const res = await api.get("/categories", { token: owner.token });

      assert.deepEqual(
        res.body.map((c) => c.name),
        ["Apple", "Zebra", "Salary"],
      );
    });
  });

  describe("POST /categories", () => {
    test("creates and returns 201 with the persisted document", async () => {
      const res = await create({ name: "Food", type: "expense", icon: "F", color: "#fff" });

      assert.equal(res.status, 201);
      assert.equal(res.body.name, "Food");
      assert.equal(res.body.icon, "F");
      assert.equal(res.body.color, "#fff");
      assert.ok(res.body._id);
    });

    test("assigns ownership from the token, ignoring any userId in the body", async () => {
      const res = await create({
        name: "Food",
        type: "expense",
        userId: String(other.userId),
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.userId, String(owner.userId));
    });

    test("trims the name", async () => {
      const res = await create({ name: "   Food   ", type: "expense" });
      assert.equal(res.body.name, "Food");
    });

    test("defaults icon and color to empty strings", async () => {
      const res = await create({ name: "Food", type: "expense" });
      assert.equal(res.body.icon, "");
      assert.equal(res.body.color, "");
    });

    test("rejects a missing, empty or whitespace-only name", async () => {
      for (const name of [undefined, "", "   "]) {
        const res = await create({ name, type: "expense" });
        assert.equal(res.status, 400, `name=${JSON.stringify(name)} should be 400`);
        assert.match(res.body.error, /Name is required/);
      }
    });

    test("rejects a missing or invalid type", async () => {
      for (const type of [undefined, "", "transfer", "Expense", 1]) {
        const res = await create({ name: "Food", type });
        assert.equal(res.status, 400, `type=${JSON.stringify(type)} should be 400`);
        assert.match(res.body.error, /income.*expense/);
      }
    });

    test("allows duplicate names — no uniqueness constraint by design", async () => {
      await create({ name: "Food", type: "expense" });
      const second = await create({ name: "Food", type: "expense" });
      assert.equal(second.status, 201);
    });

    test("allows the same name under a different type", async () => {
      await create({ name: "Bonus", type: "expense" });
      assert.equal((await create({ name: "Bonus", type: "income" })).status, 201);
    });
  });

  describe("PUT /categories/:id", () => {
    let category;

    beforeEach(async () => {
      const res = await create({ name: "Food", type: "expense", icon: "A", color: "#111" });
      category = res.body;
    });

    test("updates the given fields and returns the new document", async () => {
      const res = await api.put(
        `/categories/${category._id}`,
        { name: "Groceries", color: "#222" },
        { token: owner.token },
      );

      assert.equal(res.status, 200);
      assert.equal(res.body.name, "Groceries");
      assert.equal(res.body.color, "#222");
    });

    test("leaves unspecified fields untouched", async () => {
      const res = await api.put(
        `/categories/${category._id}`,
        { name: "Groceries" },
        { token: owner.token },
      );

      assert.equal(res.body.type, "expense");
      assert.equal(res.body.icon, "A");
    });

    test("allows clearing icon and color to empty strings", async () => {
      const res = await api.put(
        `/categories/${category._id}`,
        { icon: "", color: "" },
        { token: owner.token },
      );

      assert.equal(res.body.icon, "");
      assert.equal(res.body.color, "");
    });

    test("rejects an empty name with 400", async () => {
      const res = await api.put(
        `/categories/${category._id}`,
        { name: "   " },
        { token: owner.token },
      );

      assert.equal(res.status, 400);
      assert.match(res.body.error, /cannot be empty/);
    });

    test("rejects an invalid type with 400", async () => {
      const res = await api.put(
        `/categories/${category._id}`,
        { type: "nope" },
        { token: owner.token },
      );
      assert.equal(res.status, 400);
    });

    test("an empty body is a no-op that returns the unchanged document", async () => {
      const res = await api.put(`/categories/${category._id}`, {}, { token: owner.token });

      assert.equal(res.status, 200);
      assert.equal(res.body.name, "Food");
    });

    test("returns 404 for another user's category and leaves it untouched", async () => {
      const res = await api.put(
        `/categories/${category._id}`,
        { name: "Hacked" },
        { token: other.token },
      );

      assert.equal(res.status, 404);
      const fresh = await Category.findById(category._id);
      assert.equal(fresh.name, "Food");
    });

    test("returns 404 for a non-existent id", async () => {
      const res = await api.put(
        "/categories/507f1f77bcf86cd799439011",
        { name: "x" },
        { token: owner.token },
      );
      assert.equal(res.status, 404);
    });

    test("returns 404 for a malformed id rather than 500", async () => {
      const res = await api.put("/categories/not-an-id", { name: "x" }, { token: owner.token });
      assert.equal(res.status, 404);
    });
  });

  describe("DELETE /categories/:id", () => {
    let category;

    beforeEach(async () => {
      category = (await create({ name: "Food", type: "expense" })).body;
    });

    test("deletes and returns 204 with no body", async () => {
      const res = await api.del(`/categories/${category._id}`, undefined, {
        token: owner.token,
      });

      assert.equal(res.status, 204);
      assert.equal(res.body, null);
      assert.equal(await Category.countDocuments({ _id: category._id }), 0);
    });

    test("nulls categoryId on the caller's transactions rather than orphaning them", async () => {
      await Transaction.create({
        userId: owner.userId,
        amount: 10,
        type: "expense",
        categoryId: category._id,
        date: new Date(),
      });

      await api.del(`/categories/${category._id}`, undefined, { token: owner.token });

      const txn = await Transaction.findOne({ userId: owner.userId });
      assert.equal(txn.categoryId, null);
      assert.equal(await Transaction.countDocuments({ userId: owner.userId }), 1);
    });

    test("deletes budgets that pointed at the category", async () => {
      await Budget.create({
        userId: owner.userId,
        categoryId: category._id,
        month: "2026-08",
        limit: 100,
      });

      await api.del(`/categories/${category._id}`, undefined, { token: owner.token });

      assert.equal(await Budget.countDocuments({ userId: owner.userId }), 0);
    });

    test("leaves the overall (null-category) budget alone", async () => {
      await Budget.create({ userId: owner.userId, month: "2026-08", limit: 900 });

      await api.del(`/categories/${category._id}`, undefined, { token: owner.token });

      assert.equal(await Budget.countDocuments({ userId: owner.userId }), 1);
    });

    test("returns 404 for another user's category and does not delete it", async () => {
      const res = await api.del(`/categories/${category._id}`, undefined, {
        token: other.token,
      });

      assert.equal(res.status, 404);
      assert.equal(await Category.countDocuments({ _id: category._id }), 1);
    });

    test("cascade never touches another user's rows", async () => {
      // A second user holds a transaction whose categoryId happens to be the
      // same id. Deleting must not reach across the tenancy boundary.
      await Transaction.create({
        userId: other.userId,
        amount: 10,
        type: "expense",
        categoryId: category._id,
        date: new Date(),
      });

      await api.del(`/categories/${category._id}`, undefined, { token: owner.token });

      const theirs = await Transaction.findOne({ userId: other.userId });
      assert.equal(String(theirs.categoryId), String(category._id));
    });

    test("returns 404 for a malformed id and for a repeat delete", async () => {
      assert.equal(
        (await api.del("/categories/not-an-id", undefined, { token: owner.token })).status,
        404,
      );
      await api.del(`/categories/${category._id}`, undefined, { token: owner.token });
      assert.equal(
        (await api.del(`/categories/${category._id}`, undefined, { token: owner.token }))
          .status,
        404,
      );
    });
  });
});
