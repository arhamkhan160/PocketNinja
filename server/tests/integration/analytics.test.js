require("../helpers/env");
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../helpers/db");
const { startServer } = require("../helpers/app");
const { makeClient, makeUser } = require("../helpers/client");
const Category = require("../../models/Category");
const Transaction = require("../../models/Transaction");
const Budget = require("../../models/Budget");

const thisMonth = () => new Date().toISOString().slice(0, 7);

describe("/api/analytics", () => {
  let api;
  let server;
  let owner;
  let other;
  let food;
  let transport;
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
    food = await Category.create({
      userId: owner.userId,
      name: "Food",
      type: "expense",
      color: "#111",
    });
    transport = await Category.create({
      userId: owner.userId,
      name: "Transport",
      type: "expense",
    });
    salary = await Category.create({ userId: owner.userId, name: "Salary", type: "income" });
  });

  after(async () => {
    await server.close();
    await db.disconnect();
  });

  const txn = (overrides) =>
    Transaction.create({
      userId: owner.userId,
      amount: 10,
      type: "expense",
      date: new Date("2026-08-15"),
      ...overrides,
    });

  describe("auth guard", () => {
    test("every analytics endpoint rejects an unauthenticated caller", async () => {
      for (const path of ["/summary", "/by-category", "/trend", "/budget-status"]) {
        assert.equal((await api.get(`/analytics${path}`)).status, 401, path);
      }
    });
  });

  describe("GET /analytics/summary", () => {
    test("returns zeros for a user with no data", async () => {
      const res = await api.get("/analytics/summary?month=2026-08", { token: owner.token });

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, { totalIncome: 0, totalExpense: 0, balance: 0 });
    });

    test("totals income and expense and derives the balance", async () => {
      await txn({ amount: 100, type: "expense", categoryId: food._id });
      await txn({ amount: 50, type: "expense", categoryId: transport._id });
      await txn({ amount: 500, type: "income", categoryId: salary._id });

      const res = await api.get("/analytics/summary?month=2026-08", { token: owner.token });

      assert.deepEqual(res.body, { totalIncome: 500, totalExpense: 150, balance: 350 });
    });

    test("a negative balance is reported, not clamped", async () => {
      await txn({ amount: 500, type: "expense" });
      await txn({ amount: 100, type: "income" });

      const res = await api.get("/analytics/summary?month=2026-08", { token: owner.token });
      assert.equal(res.body.balance, -400);
    });

    test("excludes rows outside the month, including the boundary days", async () => {
      await txn({ amount: 1, date: new Date("2026-07-31T23:59:59Z") });
      await txn({ amount: 2, date: new Date("2026-08-01T00:00:00Z") });
      await txn({ amount: 4, date: new Date("2026-08-31T23:59:59Z") });
      await txn({ amount: 8, date: new Date("2026-09-01T00:00:00Z") });

      const res = await api.get("/analytics/summary?month=2026-08", { token: owner.token });

      assert.equal(res.body.totalExpense, 6, "only the two in-month rows should count");
    });

    test("excludes other users' transactions", async () => {
      await Transaction.create({
        userId: other.userId,
        amount: 999,
        type: "expense",
        date: new Date("2026-08-15"),
      });

      const res = await api.get("/analytics/summary?month=2026-08", { token: owner.token });
      assert.equal(res.body.totalExpense, 0);
    });

    test("falls back to the current month when the parameter is missing or malformed", async () => {
      await txn({ amount: 25, date: new Date() });

      for (const query of ["", "?month=", "?month=nonsense", "?month=2026-13"]) {
        const res = await api.get(`/analytics/summary${query}`, { token: owner.token });
        assert.equal(res.status, 200, query);
        assert.equal(res.body.totalExpense, 25, `query "${query}" should default to now`);
      }
    });

    test("handles fractional amounts", async () => {
      await txn({ amount: 10.25, type: "expense" });
      await txn({ amount: 0.75, type: "expense" });

      const res = await api.get("/analytics/summary?month=2026-08", { token: owner.token });
      assert.equal(res.body.totalExpense, 11);
    });
  });

  describe("GET /analytics/by-category", () => {
    test("returns an empty array when there is nothing to group", async () => {
      const res = await api.get("/analytics/by-category?month=2026-08", {
        token: owner.token,
      });

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, []);
    });

    test("groups by category and carries the category name and color", async () => {
      await txn({ amount: 30, categoryId: food._id });
      await txn({ amount: 12, categoryId: food._id });
      await txn({ amount: 20, categoryId: transport._id });

      const res = await api.get("/analytics/by-category?month=2026-08", {
        token: owner.token,
      });

      assert.equal(res.body.length, 2);
      assert.equal(res.body[0].categoryName, "Food");
      assert.equal(res.body[0].total, 42);
      assert.equal(res.body[0].color, "#111");
    });

    test("sorts by total descending — the pie chart depends on it", async () => {
      await txn({ amount: 5, categoryId: food._id });
      await txn({ amount: 90, categoryId: transport._id });

      const res = await api.get("/analytics/by-category?month=2026-08", {
        token: owner.token,
      });

      assert.deepEqual(
        res.body.map((r) => r.categoryName),
        ["Transport", "Food"],
      );
    });

    test("labels null-category rows Uncategorized instead of dropping them", async () => {
      await txn({ amount: 15, categoryId: null });

      const res = await api.get("/analytics/by-category?month=2026-08", {
        token: owner.token,
      });

      assert.equal(res.body.length, 1);
      assert.equal(res.body[0].categoryName, "Uncategorized");
      assert.equal(res.body[0].total, 15);
    });

    test("defaults to expense and honours type=income", async () => {
      await txn({ amount: 30, type: "expense", categoryId: food._id });
      await txn({ amount: 500, type: "income", categoryId: salary._id });

      const expense = await api.get("/analytics/by-category?month=2026-08", {
        token: owner.token,
      });
      assert.equal(expense.body.length, 1);
      assert.equal(expense.body[0].categoryName, "Food");

      const income = await api.get("/analytics/by-category?month=2026-08&type=income", {
        token: owner.token,
      });
      assert.equal(income.body.length, 1);
      assert.equal(income.body[0].categoryName, "Salary");
    });

    test("an unrecognised type falls back to expense", async () => {
      await txn({ amount: 30, type: "expense", categoryId: food._id });

      const res = await api.get("/analytics/by-category?month=2026-08&type=banana", {
        token: owner.token,
      });
      assert.equal(res.body.length, 1);
    });

    test("never joins another user's category name", async () => {
      // The $lookup matches on _id alone, so the userId filter upstream is the
      // only thing keeping a foreign category name out of this response.
      const theirs = await Category.create({
        userId: other.userId,
        name: "TopSecret",
        type: "expense",
      });
      await Transaction.create({
        userId: other.userId,
        amount: 99,
        type: "expense",
        categoryId: theirs._id,
        date: new Date("2026-08-15"),
      });

      const res = await api.get("/analytics/by-category?month=2026-08", {
        token: owner.token,
      });

      assert.deepEqual(res.body, []);
      assert.equal(JSON.stringify(res.body).includes("TopSecret"), false);
    });
  });

  describe("GET /analytics/trend", () => {
    test("zero-fills every month in the window so the chart has no gaps", async () => {
      const res = await api.get("/analytics/trend?from=2026-03&to=2026-08", {
        token: owner.token,
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.length, 6);
      assert.deepEqual(
        res.body.map((r) => r.period),
        ["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"],
      );
      assert.ok(res.body.every((r) => r.income === 0 && r.expense === 0));
    });

    test("buckets income and expense into the right months", async () => {
      await txn({ amount: 100, type: "expense", date: new Date("2026-06-10") });
      await txn({ amount: 200, type: "income", date: new Date("2026-06-20") });
      await txn({ amount: 50, type: "expense", date: new Date("2026-07-01") });

      const res = await api.get("/analytics/trend?from=2026-06&to=2026-08", {
        token: owner.token,
      });

      assert.deepEqual(res.body[0], { period: "2026-06", income: 200, expense: 100 });
      assert.deepEqual(res.body[1], { period: "2026-07", income: 0, expense: 50 });
      assert.deepEqual(res.body[2], { period: "2026-08", income: 0, expense: 0 });
    });

    test("a single-month window returns exactly one bucket", async () => {
      const res = await api.get("/analytics/trend?from=2026-08&to=2026-08", {
        token: owner.token,
      });
      assert.equal(res.body.length, 1);
    });

    test("defaults to a six-month window ending this month", async () => {
      const res = await api.get("/analytics/trend", { token: owner.token });

      assert.equal(res.body.length, 6);
      assert.equal(res.body[5].period, thisMonth());
    });

    test("malformed from/to fall back to the defaults instead of erroring", async () => {
      const res = await api.get("/analytics/trend?from=bad&to=worse", { token: owner.token });

      assert.equal(res.status, 200);
      assert.equal(res.body.length, 6);
    });

    test("crosses a year boundary", async () => {
      const res = await api.get("/analytics/trend?from=2025-11&to=2026-02", {
        token: owner.token,
      });

      assert.deepEqual(
        res.body.map((r) => r.period),
        ["2025-11", "2025-12", "2026-01", "2026-02"],
      );
    });

    test("an inverted range yields a single bucket rather than looping forever", async () => {
      // The scaffold loop breaks when cursor > to; guards against a hang.
      const res = await api.get("/analytics/trend?from=2026-08&to=2026-03", {
        token: owner.token,
      });

      assert.equal(res.status, 200);
      assert.ok(res.body.length <= 1);
    });

    test("excludes other users' rows", async () => {
      await Transaction.create({
        userId: other.userId,
        amount: 999,
        type: "expense",
        date: new Date("2026-08-15"),
      });

      const res = await api.get("/analytics/trend?from=2026-08&to=2026-08", {
        token: owner.token,
      });
      assert.equal(res.body[0].expense, 0);
    });
  });

  describe("GET /analytics/budget-status", () => {
    test("returns an empty array when no budgets are set", async () => {
      await txn({ amount: 50, categoryId: food._id });

      const res = await api.get("/analytics/budget-status?month=2026-08", {
        token: owner.token,
      });

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, []);
    });

    test("reports limit, spent, remaining and the overLimit flag", async () => {
      await Budget.create({
        userId: owner.userId,
        categoryId: food._id,
        month: "2026-08",
        limit: 100,
      });
      await txn({ amount: 40, categoryId: food._id });

      const res = await api.get("/analytics/budget-status?month=2026-08", {
        token: owner.token,
      });

      assert.equal(res.body.length, 1);
      assert.deepEqual(
        {
          categoryName: res.body[0].categoryName,
          limit: res.body[0].limit,
          spent: res.body[0].spent,
          remaining: res.body[0].remaining,
          overLimit: res.body[0].overLimit,
        },
        { categoryName: "Food", limit: 100, spent: 40, remaining: 60, overLimit: false },
      );
    });

    test("flags overspending and reports negative remaining", async () => {
      await Budget.create({
        userId: owner.userId,
        categoryId: food._id,
        month: "2026-08",
        limit: 100,
      });
      await txn({ amount: 140, categoryId: food._id });

      const res = await api.get("/analytics/budget-status?month=2026-08", {
        token: owner.token,
      });

      assert.equal(res.body[0].overLimit, true);
      assert.equal(res.body[0].remaining, -40);
    });

    test("spending exactly the limit is not over limit — the boundary", async () => {
      await Budget.create({
        userId: owner.userId,
        categoryId: food._id,
        month: "2026-08",
        limit: 100,
      });
      await txn({ amount: 100, categoryId: food._id });

      const res = await api.get("/analytics/budget-status?month=2026-08", {
        token: owner.token,
      });

      assert.equal(res.body[0].overLimit, false);
      assert.equal(res.body[0].remaining, 0);
    });

    test("the overall budget sums every expense category", async () => {
      await Budget.create({ userId: owner.userId, month: "2026-08", limit: 1000 });
      await txn({ amount: 100, categoryId: food._id });
      await txn({ amount: 50, categoryId: transport._id });
      await txn({ amount: 25, categoryId: null });

      const res = await api.get("/analytics/budget-status?month=2026-08", {
        token: owner.token,
      });

      assert.equal(res.body[0].categoryName, "Overall");
      assert.equal(res.body[0].spent, 175);
    });

    test("income never counts against a budget", async () => {
      await Budget.create({ userId: owner.userId, month: "2026-08", limit: 1000 });
      await txn({ amount: 5000, type: "income", categoryId: salary._id });

      const res = await api.get("/analytics/budget-status?month=2026-08", {
        token: owner.token,
      });

      assert.equal(res.body[0].spent, 0);
    });

    test("a budget with no spending reports zero, not a missing row", async () => {
      await Budget.create({
        userId: owner.userId,
        categoryId: food._id,
        month: "2026-08",
        limit: 100,
      });

      const res = await api.get("/analytics/budget-status?month=2026-08", {
        token: owner.token,
      });

      assert.equal(res.body[0].spent, 0);
      assert.equal(res.body[0].remaining, 100);
    });

    test("only counts spending inside the budget's month", async () => {
      await Budget.create({
        userId: owner.userId,
        categoryId: food._id,
        month: "2026-08",
        limit: 100,
      });
      await txn({ amount: 70, categoryId: food._id, date: new Date("2026-07-15") });

      const res = await api.get("/analytics/budget-status?month=2026-08", {
        token: owner.token,
      });

      assert.equal(res.body[0].spent, 0);
    });

    test("returns only the caller's budgets", async () => {
      await Budget.create({ userId: other.userId, month: "2026-08", limit: 100 });

      const res = await api.get("/analytics/budget-status?month=2026-08", {
        token: owner.token,
      });
      assert.deepEqual(res.body, []);
    });

    test("a limit of 0 with any spending is over limit", async () => {
      await Budget.create({
        userId: owner.userId,
        categoryId: food._id,
        month: "2026-08",
        limit: 0,
      });
      await txn({ amount: 1, categoryId: food._id });

      const res = await api.get("/analytics/budget-status?month=2026-08", {
        token: owner.token,
      });

      assert.equal(res.body[0].overLimit, true);
    });
  });
});
