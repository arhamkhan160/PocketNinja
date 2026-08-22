require("../helpers/env");
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const db = require("../helpers/db");
const { makeUser } = require("../helpers/client");

// Required in the same order index.js uses, so the authoritative schemas win
// the model names before _analyticsModels registers its placeholders.
const Category = require("../../models/Category");
const Transaction = require("../../models/Transaction");
const Budget = require("../../models/Budget");
const Goal = require("../../models/Goal");
const RecurringRule = require("../../models/RecurringRule");
const User = require("../../models/User");
const PushSubscription = require("../../models/PushSubscription");
const analyticsModels = require("../../models/_analyticsModels");

describe("models", () => {
  let userId;

  before(async () => db.connect());
  beforeEach(async () => {
    await db.clear();
    ({ userId } = await makeUser());
  });
  after(async () => db.disconnect());

  describe("User", () => {
    test("requires name, email and password", async () => {
      await assert.rejects(() => User.create({}), /Name is required/);
    });

    test("lowercases and trims the email", async () => {
      const user = await User.create({
        name: "A",
        email: "  MiXeD@Case.COM  ",
        password: "x",
      });
      assert.equal(user.email, "mixed@case.com");
    });

    test("enforces the unique email index", async () => {
      await User.create({ name: "A", email: "dupe@test.local", password: "x" });
      await assert.rejects(
        () => User.create({ name: "B", email: "dupe@test.local", password: "y" }),
        (err) => err.code === 11000,
      );
    });

    test("defaults createdAt", async () => {
      const user = await User.create({ name: "A", email: "c@t.local", password: "x" });
      assert.ok(user.createdAt instanceof Date);
    });
  });

  describe("Category", () => {
    test("creates with defaults for icon and color", async () => {
      const category = await Category.create({ userId, name: "Food", type: "expense" });
      assert.equal(category.icon, "");
      assert.equal(category.color, "");
    });

    test("trims the name", async () => {
      const category = await Category.create({ userId, name: "  Food  ", type: "expense" });
      assert.equal(category.name, "Food");
    });

    test("requires userId", async () => {
      await assert.rejects(() => Category.create({ name: "Food", type: "expense" }));
    });

    test("rejects a type outside the enum", async () => {
      await assert.rejects(() => Category.create({ userId, name: "F", type: "transfer" }));
    });
  });

  describe("Transaction", () => {
    test("rejects a zero or negative amount at the schema level", async () => {
      await assert.rejects(
        () => Transaction.create({ userId, amount: 0, type: "expense", date: new Date() }),
        /Amount must be greater than 0/,
      );
      await assert.rejects(
        () => Transaction.create({ userId, amount: -5, type: "expense", date: new Date() }),
        /Amount must be greater than 0/,
      );
    });

    test("accepts the 0.01 minimum boundary", async () => {
      const txn = await Transaction.create({
        userId,
        amount: 0.01,
        type: "expense",
        date: new Date(),
      });
      assert.equal(txn.amount, 0.01);
    });

    test("defaults categoryId, note and recurringId", async () => {
      const txn = await Transaction.create({ userId, amount: 5, type: "income", date: new Date() });
      assert.equal(txn.categoryId, null);
      assert.equal(txn.note, "");
      assert.equal(txn.recurringId, null);
    });

    test("defaults date to now when omitted", async () => {
      const txn = await Transaction.create({ userId, amount: 5, type: "income" });
      assert.ok(txn.date instanceof Date);
    });

    test("rejects a type outside the enum", async () => {
      await assert.rejects(() => Transaction.create({ userId, amount: 5, type: "refund" }));
    });
  });

  describe("Budget", () => {
    test("accepts a zero limit", async () => {
      const budget = await Budget.create({ userId, month: "2026-08", limit: 0 });
      assert.equal(budget.limit, 0);
    });

    test("rejects a negative limit", async () => {
      await assert.rejects(
        () => Budget.create({ userId, month: "2026-08", limit: -1 }),
        /Limit cannot be negative/,
      );
    });

    test("rejects a malformed month", async () => {
      await assert.rejects(
        () => Budget.create({ userId, month: "2026-13", limit: 10 }),
        /Month must be in YYYY-MM format/,
      );
    });

    test("blocks a duplicate (user, category, month)", async () => {
      const category = await Category.create({ userId, name: "Food", type: "expense" });
      await Budget.create({ userId, categoryId: category._id, month: "2026-08", limit: 100 });

      await assert.rejects(
        () => Budget.create({ userId, categoryId: category._id, month: "2026-08", limit: 200 }),
        (err) => err.code === 11000,
      );
    });

    test("blocks a duplicate overall budget (null categoryId) for the same month", async () => {
      await Budget.create({ userId, month: "2026-08", limit: 100 });
      await assert.rejects(
        () => Budget.create({ userId, month: "2026-08", limit: 200 }),
        (err) => err.code === 11000,
      );
    });

    test("allows the same category in a different month", async () => {
      const category = await Category.create({ userId, name: "Food", type: "expense" });
      await Budget.create({ userId, categoryId: category._id, month: "2026-08", limit: 100 });
      const second = await Budget.create({
        userId,
        categoryId: category._id,
        month: "2026-09",
        limit: 100,
      });
      assert.ok(second._id);
    });

    test("allows two users to hold the same category-month slot", async () => {
      const other = await makeUser();
      await Budget.create({ userId, month: "2026-08", limit: 100 });
      const theirs = await Budget.create({ userId: other.userId, month: "2026-08", limit: 100 });
      assert.ok(theirs._id);
    });
  });

  describe("Goal", () => {
    test("defaults saved to 0 and deadline to null", async () => {
      const goal = await Goal.create({ userId, title: "Laptop", target: 1000 });
      assert.equal(goal.saved, 0);
      assert.equal(goal.deadline, null);
    });

    test("rejects a non-positive target and a negative saved", async () => {
      await assert.rejects(() => Goal.create({ userId, title: "x", target: 0 }));
      await assert.rejects(() => Goal.create({ userId, title: "x", target: 10, saved: -1 }));
    });

    test("allows saved to exceed target — an over-funded goal is valid", async () => {
      const goal = await Goal.create({ userId, title: "x", target: 100, saved: 150 });
      assert.equal(goal.saved, 150);
    });
  });

  describe("RecurringRule", () => {
    const template = { amount: 100, type: "expense", note: "Rent" };

    test("defaults active to true and template.categoryId to null", async () => {
      const rule = await RecurringRule.create({
        userId,
        template,
        interval: "monthly",
        nextRun: new Date(),
      });
      assert.equal(rule.active, true);
      assert.equal(rule.template.categoryId, null);
    });

    test("rejects an interval outside the enum", async () => {
      await assert.rejects(
        () => RecurringRule.create({ userId, template, interval: "yearly", nextRun: new Date() }),
        /Interval must be daily, weekly or monthly/,
      );
    });

    test("requires nextRun", async () => {
      await assert.rejects(
        () => RecurringRule.create({ userId, template, interval: "daily" }),
        /nextRun is required/,
      );
    });

    test("rejects a template amount of 0 and a bad template type", async () => {
      await assert.rejects(() =>
        RecurringRule.create({
          userId,
          template: { ...template, amount: 0 },
          interval: "daily",
          nextRun: new Date(),
        }),
      );
      await assert.rejects(() =>
        RecurringRule.create({
          userId,
          template: { ...template, type: "nope" },
          interval: "daily",
          nextRun: new Date(),
        }),
      );
    });

    test("constrains anchorDay to 1..31", async () => {
      await assert.rejects(() =>
        RecurringRule.create({
          userId,
          template,
          interval: "monthly",
          nextRun: new Date(),
          anchorDay: 32,
        }),
      );
      await assert.rejects(() =>
        RecurringRule.create({
          userId,
          template,
          interval: "monthly",
          nextRun: new Date(),
          anchorDay: 0,
        }),
      );
    });
  });

  describe("PushSubscription", () => {
    test("stores an arbitrary subscription object", async () => {
      const sub = await PushSubscription.create({
        userId,
        subscription: { endpoint: "https://push.test/abc", keys: { p256dh: "k", auth: "a" } },
      });
      assert.equal(sub.subscription.endpoint, "https://push.test/abc");
    });

    test("requires userId", async () => {
      await assert.rejects(() =>
        PushSubscription.create({ subscription: { endpoint: "https://push.test/x" } }),
      );
    });
  });

  describe("_analyticsModels placeholder resolution", () => {
    test("re-exports the authoritative models, not a second registration", () => {
      // The whole point of the `mongoose.models.X || ...` guard: analytics must
      // reuse Ibrahim's schemas once they are loaded, or validation silently
      // disappears for anything written through analytics.
      assert.equal(analyticsModels.Transaction, Transaction);
      assert.equal(analyticsModels.Category, Category);
      assert.equal(analyticsModels.Budget, Budget);
    });

    test("only one model is registered per name", () => {
      assert.equal(mongoose.models.Transaction, Transaction);
      assert.equal(mongoose.models.Category, Category);
      assert.equal(mongoose.models.Budget, Budget);
    });

    test("writes through the analytics handle still enforce validation", async () => {
      await assert.rejects(
        () => analyticsModels.Transaction.create({ userId, amount: -1, type: "expense" }),
        /Amount must be greater than 0/,
      );
    });
  });
});
