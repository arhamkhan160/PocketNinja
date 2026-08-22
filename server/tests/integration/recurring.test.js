require("../helpers/env");
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../helpers/db");
const { startServer } = require("../helpers/app");
const { makeClient, makeUser } = require("../helpers/client");
const Category = require("../../models/Category");
const RecurringRule = require("../../models/RecurringRule");
const Transaction = require("../../models/Transaction");

const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

describe("/api/recurring", () => {
  let api;
  let server;
  let owner;
  let other;
  let category;

  before(async () => {
    await db.connect();
    server = await startServer();
    api = makeClient(server.baseUrl);
  });

  beforeEach(async () => {
    await db.clear();
    owner = await makeUser();
    other = await makeUser();
    category = await Category.create({ userId: owner.userId, name: "Rent", type: "expense" });
  });

  after(async () => {
    await server.close();
    await db.disconnect();
  });

  const validRule = () => ({
    template: { amount: 950, type: "expense", categoryId: String(category._id), note: "Rent" },
    interval: "monthly",
    nextRun: daysFromNow(5).toISOString(),
  });

  const create = (body = validRule(), token = owner.token) =>
    api.post("/recurring", body, { token });

  describe("auth guard", () => {
    test("every route rejects an unauthenticated caller with 401", async () => {
      assert.equal((await api.get("/recurring")).status, 401);
      assert.equal((await api.post("/recurring", validRule())).status, 401);
      assert.equal((await api.put("/recurring/507f1f77bcf86cd799439011", {})).status, 401);
      assert.equal((await api.del("/recurring/507f1f77bcf86cd799439011")).status, 401);
      assert.equal((await api.post("/recurring/run-now", {})).status, 401);
    });
  });

  describe("POST /recurring", () => {
    test("creates with 201 and defaults active to true", async () => {
      const res = await create();

      assert.equal(res.status, 201);
      assert.equal(res.body.template.amount, 950);
      assert.equal(res.body.active, true);
    });

    test("derives anchorDay from nextRun", async () => {
      const res = await create({ ...validRule(), nextRun: "2026-08-31T00:00:00.000Z" });
      assert.equal(res.body.anchorDay, 31);
    });

    test("trims the template note and defaults it to empty", async () => {
      const withNote = await create({
        ...validRule(),
        template: { amount: 10, type: "expense", note: "  Rent  " },
      });
      assert.equal(withNote.body.template.note, "Rent");

      const without = await create({
        ...validRule(),
        template: { amount: 10, type: "expense" },
      });
      assert.equal(without.body.template.note, "");
    });

    test("accepts a null or empty categoryId", async () => {
      const nulled = await create({
        ...validRule(),
        template: { amount: 10, type: "expense", categoryId: null },
      });
      assert.equal(nulled.body.template.categoryId, null);

      const empty = await create({
        ...validRule(),
        template: { amount: 10, type: "expense", categoryId: "" },
      });
      assert.equal(empty.body.template.categoryId, null);
    });

    test("ownership comes from the token, not the body", async () => {
      const res = await create({ ...validRule(), userId: String(other.userId) });
      assert.equal(res.body.userId, String(owner.userId));
    });

    test("rejects a zero, negative or non-numeric template amount", async () => {
      for (const amount of [0, -5, "abc", undefined]) {
        const res = await create({
          ...validRule(),
          template: { amount, type: "expense" },
        });
        assert.equal(res.status, 400, `amount=${JSON.stringify(amount)} should be 400`);
      }
    });

    test("rejects an invalid template type and a missing template", async () => {
      assert.equal(
        (await create({ ...validRule(), template: { amount: 10, type: "nope" } })).status,
        400,
      );
      assert.equal((await create({ interval: "daily", nextRun: new Date().toISOString() })).status, 400);
    });

    test("rejects an invalid interval", async () => {
      for (const interval of [undefined, "", "yearly", "Daily"]) {
        const res = await create({ ...validRule(), interval });
        assert.equal(res.status, 400, `interval=${JSON.stringify(interval)} should be 400`);
        assert.match(res.body.error, /daily, weekly or monthly/);
      }
    });

    test("accepts all three valid intervals", async () => {
      for (const interval of ["daily", "weekly", "monthly"]) {
        assert.equal((await create({ ...validRule(), interval })).status, 201, interval);
      }
    });

    test("rejects a missing or unparseable nextRun", async () => {
      assert.equal((await create({ ...validRule(), nextRun: "nope" })).status, 400);
      assert.equal(
        (await create({ template: validRule().template, interval: "daily" })).status,
        400,
      );
    });

    test("rejects a malformed categoryId", async () => {
      const res = await create({
        ...validRule(),
        template: { amount: 10, type: "expense", categoryId: "not-an-id" },
      });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /valid id/);
    });

    test("coerces active to a boolean", async () => {
      const res = await create({ ...validRule(), active: "no" });
      // Any non-empty string is truthy — documents the coercion.
      assert.equal(res.body.active, true);

      const off = await create({ ...validRule(), active: false });
      assert.equal(off.body.active, false);
    });
  });

  describe("GET /recurring", () => {
    test("returns only the caller's rules, soonest first", async () => {
      await create({ ...validRule(), nextRun: daysFromNow(10).toISOString() });
      await create({ ...validRule(), nextRun: daysFromNow(2).toISOString() });
      await create(validRule(), other.token);

      const res = await api.get("/recurring", { token: owner.token });

      assert.equal(res.body.length, 2);
      assert.ok(new Date(res.body[0].nextRun) < new Date(res.body[1].nextRun));
    });

    test("returns an empty array for a new user", async () => {
      const res = await api.get("/recurring", { token: owner.token });
      assert.deepEqual(res.body, []);
    });
  });

  describe("PUT /recurring/:id", () => {
    let rule;

    beforeEach(async () => {
      rule = (await create()).body;
    });

    const put = (body, token = owner.token) => api.put(`/recurring/${rule._id}`, body, { token });

    test("toggles active without touching anything else", async () => {
      const res = await put({ active: false });

      assert.equal(res.status, 200);
      assert.equal(res.body.active, false);
      assert.equal(res.body.template.amount, 950);
    });

    test("updates the interval and the template", async () => {
      const res = await put({
        interval: "weekly",
        template: { amount: 25, type: "income", note: "Refund" },
      });

      assert.equal(res.body.interval, "weekly");
      assert.equal(res.body.template.amount, 25);
      assert.equal(res.body.template.type, "income");
    });

    test("re-anchors anchorDay when nextRun changes", async () => {
      const res = await put({ nextRun: "2026-09-15T00:00:00.000Z" });
      assert.equal(res.body.anchorDay, 15);
    });

    test("an empty body is a no-op", async () => {
      const res = await put({});

      assert.equal(res.status, 200);
      assert.equal(res.body.template.amount, 950);
    });

    test("rejects an invalid interval, template and nextRun", async () => {
      assert.equal((await put({ interval: "yearly" })).status, 400);
      assert.equal((await put({ template: { amount: -1, type: "expense" } })).status, 400);
      assert.equal((await put({ nextRun: "nope" })).status, 400);
    });

    test("returns 404 for another user's rule and leaves it unchanged", async () => {
      const res = await put({ active: false }, other.token);

      assert.equal(res.status, 404);
      assert.equal((await RecurringRule.findById(rule._id)).active, true);
    });

    test("returns 404 for non-existent and malformed ids", async () => {
      assert.equal(
        (await api.put("/recurring/507f1f77bcf86cd799439011", {}, { token: owner.token })).status,
        404,
      );
      assert.equal(
        (await api.put("/recurring/not-an-id", {}, { token: owner.token })).status,
        404,
      );
    });
  });

  describe("DELETE /recurring/:id", () => {
    let rule;

    beforeEach(async () => {
      rule = (await create()).body;
    });

    test("deletes and returns 204", async () => {
      const res = await api.del(`/recurring/${rule._id}`, undefined, { token: owner.token });

      assert.equal(res.status, 204);
      assert.equal(await RecurringRule.countDocuments({ _id: rule._id }), 0);
    });

    test("returns 404 for another user's rule and does not delete it", async () => {
      const res = await api.del(`/recurring/${rule._id}`, undefined, { token: other.token });

      assert.equal(res.status, 404);
      assert.equal(await RecurringRule.countDocuments({ _id: rule._id }), 1);
    });

    test("a repeat delete and a malformed id both return 404", async () => {
      await api.del(`/recurring/${rule._id}`, undefined, { token: owner.token });
      assert.equal(
        (await api.del(`/recurring/${rule._id}`, undefined, { token: owner.token })).status,
        404,
      );
      assert.equal(
        (await api.del("/recurring/not-an-id", undefined, { token: owner.token })).status,
        404,
      );
    });
  });

  describe("POST /recurring/run-now", () => {
    test("materialises a due rule into a transaction and advances nextRun", async () => {
      const rule = await RecurringRule.create({
        userId: owner.userId,
        template: { amount: 50, type: "expense", categoryId: category._id, note: "Bill" },
        interval: "monthly",
        nextRun: daysFromNow(-1),
        anchorDay: 15,
      });

      const res = await api.post("/recurring/run-now", {}, { token: owner.token });

      assert.equal(res.status, 200);
      assert.equal(res.body.rulesProcessed, 1);
      assert.equal(res.body.transactionsCreated, 1);

      const txn = await Transaction.findOne({ userId: owner.userId });
      assert.equal(txn.amount, 50);
      assert.equal(String(txn.recurringId), String(rule._id));

      const fresh = await RecurringRule.findById(rule._id);
      assert.ok(fresh.nextRun > new Date(), "nextRun must move into the future");
    });

    test("does nothing for a rule that is not yet due", async () => {
      await RecurringRule.create({
        userId: owner.userId,
        template: { amount: 50, type: "expense" },
        interval: "daily",
        nextRun: daysFromNow(5),
      });

      const res = await api.post("/recurring/run-now", {}, { token: owner.token });

      assert.deepEqual(res.body, { rulesProcessed: 0, transactionsCreated: 0 });
      assert.equal(await Transaction.countDocuments({}), 0);
    });

    test("skips inactive rules even when overdue", async () => {
      await RecurringRule.create({
        userId: owner.userId,
        template: { amount: 50, type: "expense" },
        interval: "daily",
        nextRun: daysFromNow(-10),
        active: false,
      });

      const res = await api.post("/recurring/run-now", {}, { token: owner.token });
      assert.equal(res.body.rulesProcessed, 0);
    });

    test("is scoped to the caller — it never fires another user's rules", async () => {
      // The security property of exposing a cron trigger over HTTP.
      await RecurringRule.create({
        userId: other.userId,
        template: { amount: 999, type: "expense" },
        interval: "daily",
        nextRun: daysFromNow(-1),
      });

      const res = await api.post("/recurring/run-now", {}, { token: owner.token });

      assert.equal(res.body.rulesProcessed, 0);
      assert.equal(await Transaction.countDocuments({ userId: other.userId }), 0);
    });

    test("returns zeros when the user has no rules at all", async () => {
      const res = await api.post("/recurring/run-now", {}, { token: owner.token });
      assert.deepEqual(res.body, { rulesProcessed: 0, transactionsCreated: 0 });
    });
  });
});
