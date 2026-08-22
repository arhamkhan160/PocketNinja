require("../helpers/env");
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../helpers/db");
const { startServer } = require("../helpers/app");
const { makeClient, makeUser } = require("../helpers/client");
const Category = require("../../models/Category");
const Transaction = require("../../models/Transaction");

describe("/api/transactions", () => {
  let api;
  let server;
  let owner;
  let other;
  let food;
  let salary;

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
    salary = await Category.create({ userId: owner.userId, name: "Salary", type: "income" });
  });

  after(async () => {
    await server.close();
    await db.disconnect();
  });

  const create = (body, token = owner.token) => api.post("/transactions", body, { token });

  const seed = (overrides = {}) =>
    Transaction.create({
      userId: owner.userId,
      amount: 10,
      type: "expense",
      categoryId: food._id,
      date: new Date("2026-08-15"),
      ...overrides,
    });

  describe("auth guard", () => {
    test("all four verbs reject an unauthenticated caller with 401", async () => {
      assert.equal((await api.get("/transactions")).status, 401);
      assert.equal((await api.post("/transactions", { amount: 1, type: "expense" })).status, 401);
      assert.equal((await api.put("/transactions/507f1f77bcf86cd799439011", {})).status, 401);
      assert.equal((await api.del("/transactions/507f1f77bcf86cd799439011")).status, 401);
    });
  });

  describe("POST /transactions", () => {
    test("creates with 201 and echoes the stored values", async () => {
      const res = await create({
        amount: 42.5,
        type: "expense",
        categoryId: String(food._id),
        date: "2026-08-15",
        note: "Lunch",
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.amount, 42.5);
      assert.equal(res.body.note, "Lunch");
      assert.equal(res.body.categoryId, String(food._id));
    });

    test("coerces a numeric string amount", async () => {
      const res = await create({ amount: "42.50", type: "expense" });
      assert.equal(res.body.amount, 42.5);
    });

    test("defaults date to now and note to empty when omitted", async () => {
      const res = await create({ amount: 5, type: "income" });

      assert.equal(res.status, 201);
      assert.equal(res.body.note, "");
      assert.ok(new Date(res.body.date).getTime() > 0);
    });

    test("accepts a null / omitted categoryId as Uncategorized", async () => {
      assert.equal((await create({ amount: 5, type: "expense" })).body.categoryId, null);
      assert.equal(
        (await create({ amount: 5, type: "expense", categoryId: null })).body.categoryId,
        null,
      );
    });

    test("ownership comes from the token, not the body", async () => {
      const res = await create({
        amount: 5,
        type: "expense",
        userId: String(other.userId),
      });
      assert.equal(res.body.userId, String(owner.userId));
    });

    test("rejects zero, negative and non-numeric amounts", async () => {
      for (const amount of [0, -1, "abc", "", null, undefined, NaN, {}]) {
        const res = await create({ amount, type: "expense" });
        assert.equal(res.status, 400, `amount=${JSON.stringify(amount)} should be 400`);
        assert.match(res.body.error, /Amount must be a number greater than 0/);
      }
    });

    test("accepts the 0.01 minimum boundary", async () => {
      assert.equal((await create({ amount: 0.01, type: "expense" })).status, 201);
    });

    test("rejects a missing or invalid type", async () => {
      for (const type of [undefined, "", "transfer", "Income"]) {
        const res = await create({ amount: 5, type });
        assert.equal(res.status, 400, `type=${JSON.stringify(type)} should be 400`);
      }
    });

    test("rejects an unparseable date with 400", async () => {
      const res = await create({ amount: 5, type: "expense", date: "not-a-date" });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /Invalid date/);
    });

    test("rejects another user's categoryId — the cross-tenant leak", async () => {
      const theirs = await Category.create({
        userId: other.userId,
        name: "Secret",
        type: "expense",
      });

      const res = await create({
        amount: 5,
        type: "expense",
        categoryId: String(theirs._id),
      });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /Category not found/);
      assert.equal(await Transaction.countDocuments({}), 0);
    });

    test("rejects a non-existent and a malformed categoryId with 400", async () => {
      assert.equal(
        (await create({ amount: 5, type: "expense", categoryId: "507f1f77bcf86cd799439011" }))
          .status,
        400,
      );
      assert.equal(
        (await create({ amount: 5, type: "expense", categoryId: "not-an-id" })).status,
        400,
      );
    });

    test("does not require the category type to match the transaction type", async () => {
      // Deliberate: the UI filters the dropdown, the API stays permissive.
      const res = await create({ amount: 5, type: "expense", categoryId: String(salary._id) });
      assert.equal(res.status, 201);
    });
  });

  describe("GET /transactions — listing and filters", () => {
    test("returns only the caller's rows", async () => {
      await seed();
      await Transaction.create({
        userId: other.userId,
        amount: 99,
        type: "expense",
        date: new Date("2026-08-15"),
      });

      const res = await api.get("/transactions", { token: owner.token });

      assert.equal(res.body.length, 1);
      assert.equal(res.body[0].amount, 10);
    });

    test("sorts newest first", async () => {
      await seed({ date: new Date("2026-08-01"), amount: 1 });
      await seed({ date: new Date("2026-08-20"), amount: 2 });
      await seed({ date: new Date("2026-08-10"), amount: 3 });

      const res = await api.get("/transactions", { token: owner.token });

      assert.deepEqual(
        res.body.map((t) => t.amount),
        [2, 3, 1],
      );
    });

    test("filters by type", async () => {
      await seed({ type: "expense", amount: 1 });
      await seed({ type: "income", amount: 2, categoryId: salary._id });

      const res = await api.get("/transactions?type=income", { token: owner.token });

      assert.equal(res.body.length, 1);
      assert.equal(res.body[0].amount, 2);
    });

    test("filters by category", async () => {
      await seed({ categoryId: food._id, amount: 1 });
      await seed({ categoryId: salary._id, amount: 2 });

      const res = await api.get(`/transactions?category=${food._id}`, { token: owner.token });

      assert.equal(res.body.length, 1);
      assert.equal(res.body[0].amount, 1);
    });

    test("filters by from date, inclusive of the boundary day", async () => {
      await seed({ date: new Date("2026-08-10"), amount: 1 });
      await seed({ date: new Date("2026-08-20"), amount: 2 });

      const res = await api.get("/transactions?from=2026-08-20", { token: owner.token });

      assert.equal(res.body.length, 1);
      assert.equal(res.body[0].amount, 2);
    });

    test("to date includes the whole boundary day, not just midnight", async () => {
      // The classic off-by-one: a 14:30 row on the 'to' day must be included.
      await Transaction.create({
        userId: owner.userId,
        amount: 7,
        type: "expense",
        date: new Date("2026-08-20T14:30:00Z"),
      });

      const res = await api.get("/transactions?to=2026-08-20", { token: owner.token });

      assert.equal(res.body.length, 1);
    });

    test("combines from and to into a range", async () => {
      await seed({ date: new Date("2026-07-31"), amount: 1 });
      await seed({ date: new Date("2026-08-15"), amount: 2 });
      await seed({ date: new Date("2026-09-01"), amount: 3 });

      const res = await api.get("/transactions?from=2026-08-01&to=2026-08-31", {
        token: owner.token,
      });

      assert.equal(res.body.length, 1);
      assert.equal(res.body[0].amount, 2);
    });

    test("combines every filter at once", async () => {
      await seed({ type: "expense", categoryId: food._id, date: new Date("2026-08-15"), amount: 1 });
      await seed({ type: "income", categoryId: salary._id, date: new Date("2026-08-15"), amount: 2 });
      await seed({ type: "expense", categoryId: food._id, date: new Date("2026-09-15"), amount: 3 });

      const res = await api.get(
        `/transactions?type=expense&category=${food._id}&from=2026-08-01&to=2026-08-31`,
        { token: owner.token },
      );

      assert.equal(res.body.length, 1);
      assert.equal(res.body[0].amount, 1);
    });

    test("an inverted range returns an empty list rather than erroring", async () => {
      await seed();
      const res = await api.get("/transactions?from=2026-09-01&to=2026-08-01", {
        token: owner.token,
      });

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, []);
    });

    test("rejects a malformed category id with 400, not 404", async () => {
      const res = await api.get("/transactions?category=not-an-id", { token: owner.token });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /Invalid category id/);
    });

    test("rejects an invalid type with 400", async () => {
      const res = await api.get("/transactions?type=sideways", { token: owner.token });
      assert.equal(res.status, 400);
    });

    test("rejects unparseable from and to dates with 400", async () => {
      assert.equal((await api.get("/transactions?from=nope", { token: owner.token })).status, 400);
      assert.equal((await api.get("/transactions?to=nope", { token: owner.token })).status, 400);
    });

    test("empty filter values are ignored, not treated as filters", async () => {
      await seed();
      const res = await api.get("/transactions?category=&type=&from=&to=", {
        token: owner.token,
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.length, 1);
    });

    test("filtering by another user's category returns an empty list, not their rows", async () => {
      const theirs = await Category.create({
        userId: other.userId,
        name: "Secret",
        type: "expense",
      });
      await Transaction.create({
        userId: other.userId,
        amount: 99,
        type: "expense",
        categoryId: theirs._id,
        date: new Date(),
      });

      const res = await api.get(`/transactions?category=${theirs._id}`, {
        token: owner.token,
      });

      assert.deepEqual(res.body, []);
    });

    test("caps the result set at 500 rows", async () => {
      await Transaction.insertMany(
        Array.from({ length: 505 }, (_, i) => ({
          userId: owner.userId,
          amount: i + 1,
          type: "expense",
          date: new Date("2026-08-15"),
        })),
      );

      const res = await api.get("/transactions", { token: owner.token });
      assert.equal(res.body.length, 500);
    });
  });

  describe("PUT /transactions/:id", () => {
    let txn;

    beforeEach(async () => {
      txn = await seed({ amount: 10, note: "original" });
    });

    const put = (body, token = owner.token) =>
      api.put(`/transactions/${txn._id}`, body, { token });

    test("updates a single field and leaves the rest", async () => {
      const res = await put({ amount: 99 });

      assert.equal(res.status, 200);
      assert.equal(res.body.amount, 99);
      assert.equal(res.body.note, "original");
    });

    test("updates type, date, note and category", async () => {
      const res = await put({
        type: "income",
        date: "2026-01-01",
        note: "changed",
        categoryId: String(salary._id),
      });

      assert.equal(res.body.type, "income");
      assert.equal(res.body.note, "changed");
      assert.equal(res.body.date.slice(0, 10), "2026-01-01");
      assert.equal(res.body.categoryId, String(salary._id));
    });

    test("an explicit null categoryId clears the category", async () => {
      const res = await put({ categoryId: null });
      assert.equal(res.body.categoryId, null);
    });

    test("allows clearing the note to an empty string", async () => {
      assert.equal((await put({ note: "" })).body.note, "");
    });

    test("an empty body is a no-op returning the unchanged row", async () => {
      const res = await put({});

      assert.equal(res.status, 200);
      assert.equal(res.body.amount, 10);
    });

    test("rejects invalid amount, type and date with 400", async () => {
      assert.equal((await put({ amount: 0 })).status, 400);
      assert.equal((await put({ amount: -5 })).status, 400);
      assert.equal((await put({ amount: "abc" })).status, 400);
      assert.equal((await put({ type: "nope" })).status, 400);
      assert.equal((await put({ date: "not-a-date" })).status, 400);
    });

    test("rejects re-pointing at another user's category", async () => {
      const theirs = await Category.create({
        userId: other.userId,
        name: "Secret",
        type: "expense",
      });

      const res = await put({ categoryId: String(theirs._id) });
      assert.equal(res.status, 400);
    });

    test("returns 404 for another user's transaction and leaves it unchanged", async () => {
      const res = await put({ amount: 999 }, other.token);

      assert.equal(res.status, 404);
      assert.equal((await Transaction.findById(txn._id)).amount, 10);
    });

    test("returns 404 for non-existent and malformed ids", async () => {
      assert.equal(
        (await api.put("/transactions/507f1f77bcf86cd799439011", { amount: 1 }, { token: owner.token }))
          .status,
        404,
      );
      assert.equal(
        (await api.put("/transactions/not-an-id", { amount: 1 }, { token: owner.token })).status,
        404,
      );
    });

    test("a rejected update writes nothing", async () => {
      await put({ amount: -5 });
      assert.equal((await Transaction.findById(txn._id)).amount, 10);
    });
  });

  describe("DELETE /transactions/:id", () => {
    let txn;

    beforeEach(async () => {
      txn = await seed();
    });

    test("deletes and returns 204 with no body", async () => {
      const res = await api.del(`/transactions/${txn._id}`, undefined, { token: owner.token });

      assert.equal(res.status, 204);
      assert.equal(res.body, null);
      assert.equal(await Transaction.countDocuments({ _id: txn._id }), 0);
    });

    test("returns 404 for another user's transaction and does not delete it", async () => {
      const res = await api.del(`/transactions/${txn._id}`, undefined, { token: other.token });

      assert.equal(res.status, 404);
      assert.equal(await Transaction.countDocuments({ _id: txn._id }), 1);
    });

    test("a repeat delete returns 404", async () => {
      await api.del(`/transactions/${txn._id}`, undefined, { token: owner.token });
      const second = await api.del(`/transactions/${txn._id}`, undefined, {
        token: owner.token,
      });

      assert.equal(second.status, 404);
    });

    test("returns 404 for a malformed id", async () => {
      assert.equal(
        (await api.del("/transactions/not-an-id", undefined, { token: owner.token })).status,
        404,
      );
    });
  });
});
