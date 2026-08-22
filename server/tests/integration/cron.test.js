require("../helpers/env");
const { test, describe, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const cron = require("node-cron");
const db = require("../helpers/db");
const { makeUser } = require("../helpers/client");
const Category = require("../../models/Category");
const Transaction = require("../../models/Transaction");
const RecurringRule = require("../../models/RecurringRule");
const { processDueRules, sendReminders, runDailyTick, startCronJobs } = require("../../jobs/cron");

const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = (n) => new Date(Date.now() + n * DAY_MS);

describe("jobs/cron — processDueRules", () => {
  let owner;
  let other;
  let category;

  before(async () => db.connect());

  beforeEach(async () => {
    await db.clear();
    owner = await makeUser();
    other = await makeUser();
    category = await Category.create({ userId: owner.userId, name: "Rent", type: "expense" });
  });

  after(async () => db.disconnect());

  const rule = (overrides = {}) =>
    RecurringRule.create({
      userId: owner.userId,
      template: { amount: 100, type: "expense", categoryId: category._id, note: "Rent" },
      interval: "monthly",
      nextRun: daysFromNow(-1),
      anchorDay: 15,
      ...overrides,
    });

  test("creates one transaction for a rule that just came due", async () => {
    await rule();

    const result = await processDueRules();

    assert.deepEqual(result, { rulesProcessed: 1, transactionsCreated: 1 });
    assert.equal(await Transaction.countDocuments({}), 1);
  });

  test("copies every template field onto the transaction", async () => {
    const created = await rule();

    await processDueRules();
    const txn = await Transaction.findOne({});

    assert.equal(txn.amount, 100);
    assert.equal(txn.type, "expense");
    assert.equal(String(txn.categoryId), String(category._id));
    assert.equal(txn.note, "Rent");
    assert.equal(String(txn.userId), String(owner.userId));
    assert.equal(String(txn.recurringId), String(created._id));
  });

  test("stamps each transaction with the date it was actually due", async () => {
    // Backdating matters: the analytics charts would otherwise pile a week of
    // catch-up rows onto today.
    const dueDate = daysFromNow(-3);
    await rule({ interval: "daily", nextRun: dueDate });

    await processDueRules();
    const first = await Transaction.findOne({}).sort({ date: 1 });

    assert.equal(
      first.date.toISOString().slice(0, 10),
      dueDate.toISOString().slice(0, 10),
    );
  });

  test("leaves a rule that is not yet due alone", async () => {
    await rule({ nextRun: daysFromNow(5) });

    const result = await processDueRules();

    assert.deepEqual(result, { rulesProcessed: 0, transactionsCreated: 0 });
    assert.equal(await Transaction.countDocuments({}), 0);
  });

  test("ignores inactive rules however overdue", async () => {
    await rule({ nextRun: daysFromNow(-100), active: false });

    const result = await processDueRules();
    assert.equal(result.rulesProcessed, 0);
  });

  test("catches up one transaction per missed occurrence", async () => {
    // Server down for 5 days on a daily rule owes 6 rows (day -5 .. day 0).
    await rule({ interval: "daily", nextRun: daysFromNow(-5) });

    const result = await processDueRules();

    assert.equal(result.transactionsCreated, 6);
    assert.equal(await Transaction.countDocuments({}), 6);
  });

  test("caps catch-up at 50 per rule so a badly backdated rule can't flood", async () => {
    await rule({ interval: "daily", nextRun: daysFromNow(-500) });

    const result = await processDueRules();

    assert.equal(result.transactionsCreated, 50);
  });

  test("the leftover backlog is picked up by the next pass", async () => {
    await rule({ interval: "daily", nextRun: daysFromNow(-120) });

    const first = await processDueRules();
    const second = await processDueRules();

    assert.equal(first.transactionsCreated, 50);
    assert.equal(second.transactionsCreated, 50);
    assert.equal(await Transaction.countDocuments({}), 100);
  });

  test("advances nextRun past now so the rule does not re-fire immediately", async () => {
    const created = await rule({ interval: "daily", nextRun: daysFromNow(-2) });

    await processDueRules();
    const fresh = await RecurringRule.findById(created._id);

    assert.ok(fresh.nextRun > new Date(), "nextRun must land in the future");
  });

  test("running twice in a row is idempotent — no duplicate rows", async () => {
    await rule({ interval: "monthly", nextRun: daysFromNow(-1) });

    await processDueRules();
    const second = await processDueRules();

    assert.equal(second.transactionsCreated, 0);
    assert.equal(await Transaction.countDocuments({}), 1);
  });

  test("processes rules for every user when unscoped", async () => {
    await rule();
    // Monthly, so it owes exactly one row and the count isolates cross-user
    // processing rather than the catch-up loop.
    await RecurringRule.create({
      userId: other.userId,
      template: { amount: 7, type: "expense" },
      interval: "monthly",
      nextRun: daysFromNow(-1),
    });

    const result = await processDueRules();

    assert.equal(result.rulesProcessed, 2);
    assert.equal(await Transaction.countDocuments({ userId: other.userId }), 1);
  });

  test("scoping by userId touches only that user's rules", async () => {
    await rule();
    await RecurringRule.create({
      userId: other.userId,
      template: { amount: 7, type: "expense" },
      interval: "daily",
      nextRun: daysFromNow(-1),
    });

    const result = await processDueRules({ userId: owner.userId });

    assert.equal(result.rulesProcessed, 1);
    assert.equal(await Transaction.countDocuments({ userId: other.userId }), 0);
  });

  test("a null template categoryId produces an uncategorised transaction", async () => {
    await rule({ template: { amount: 10, type: "expense", categoryId: null, note: "" } });

    await processDueRules();

    assert.equal((await Transaction.findOne({})).categoryId, null);
  });

  test("handles income rules as well as expenses", async () => {
    await rule({ template: { amount: 2800, type: "income", note: "Salary" } });

    await processDueRules();

    assert.equal((await Transaction.findOne({})).type, "income");
  });

  test("one broken rule does not abort the whole pass", async () => {
    // Force a write failure by pointing the template at an invalid amount that
    // the Transaction schema rejects, bypassing rule-level validation.
    await RecurringRule.collection.insertOne({
      userId: owner.userId,
      template: { amount: -5, type: "expense", categoryId: null, note: "broken" },
      interval: "daily",
      nextRun: daysFromNow(-1),
      active: true,
      createdAt: new Date(),
    });
    await rule();

    const originalError = console.error;
    console.error = () => {};
    const result = await processDueRules();
    console.error = originalError;

    assert.equal(result.rulesProcessed, 1, "the healthy rule must still be processed");
    assert.equal(await Transaction.countDocuments({}), 1);
  });

  test("weekly rules advance by seven days", async () => {
    const created = await rule({ interval: "weekly", nextRun: daysFromNow(-1) });

    await processDueRules();
    const fresh = await RecurringRule.findById(created._id);
    const delta = fresh.nextRun.getTime() - daysFromNow(-1).getTime();

    assert.ok(Math.abs(delta - 7 * DAY_MS) < 1000, "should be exactly one week later");
  });

  test("returns zeros when there is nothing to do", async () => {
    assert.deepEqual(await processDueRules(), { rulesProcessed: 0, transactionsCreated: 0 });
  });
});

describe("jobs/cron — sendReminders", () => {
  let owner;

  before(async () => db.connect());

  beforeEach(async () => {
    await db.clear();
    owner = await makeUser();
  });

  after(async () => db.disconnect());

  const dueRule = (overrides = {}) =>
    RecurringRule.create({
      userId: owner.userId,
      template: { amount: 950, type: "expense", note: "Rent" },
      interval: "monthly",
      nextRun: daysFromNow(1),
      ...overrides,
    });

  test("counts rules falling inside the lead window", async () => {
    await dueRule();

    const result = await sendReminders();

    assert.equal(result.rulesDue, 1);
    assert.equal(result.usersProcessed, 1);
  });

  test("ignores rules beyond the lead window", async () => {
    await dueRule({ nextRun: daysFromNow(30) });

    assert.equal((await sendReminders()).rulesDue, 0);
  });

  test("ignores rules already overdue — those belong to processDueRules", async () => {
    await dueRule({ nextRun: daysFromNow(-1) });

    assert.equal((await sendReminders()).rulesDue, 0);
  });

  test("ignores inactive rules", async () => {
    await dueRule({ active: false });

    assert.equal((await sendReminders()).rulesDue, 0);
  });

  test("notifies each user once regardless of how many items they have due", async () => {
    await dueRule();
    await dueRule({ nextRun: daysFromNow(2) });
    await dueRule({ nextRun: daysFromNow(3) });

    const result = await sendReminders();

    assert.equal(result.rulesDue, 3);
    assert.equal(result.usersProcessed, 1, "one push per user, not per rule");
  });

  test("groups per user across several users", async () => {
    const second = await makeUser();
    await dueRule();
    await RecurringRule.create({
      userId: second.userId,
      template: { amount: 10, type: "expense" },
      interval: "daily",
      nextRun: daysFromNow(1),
    });

    const result = await sendReminders();

    assert.equal(result.usersProcessed, 2);
  });

  test("returns zeros when nothing is due", async () => {
    assert.deepEqual(await sendReminders(), { usersProcessed: 0, rulesDue: 0 });
  });
});

describe("jobs/cron — runDailyTick and startCronJobs", () => {
  let owner;
  let logs;
  let originalLog;

  before(async () => db.connect());

  beforeEach(async () => {
    await db.clear();
    owner = await makeUser();
    logs = [];
    originalLog = console.log;
    console.log = (...args) => logs.push(args.join(" "));
  });

  afterEach(() => {
    console.log = originalLog;
  });

  after(async () => {
    // startCronJobs registers a live 08:00 schedule. node-cron keeps a timer
    // on the event loop, so without this the test process never exits.
    for (const task of cron.getTasks().values()) {
      task.destroy();
    }
    await db.disconnect();
  });

  test("runDailyTick runs both passes and logs their outcome", async () => {
    await RecurringRule.create({
      userId: owner.userId,
      template: { amount: 10, type: "expense" },
      interval: "monthly",
      nextRun: daysFromNow(-1),
    });

    await runDailyTick();

    assert.equal(await Transaction.countDocuments({}), 1);
    assert.ok(logs.some((l) => l.includes("transaction(s) from")));
    assert.ok(logs.some((l) => l.includes("dispatched reminders")));
  });

  test("runDailyTick swallows errors rather than crashing the scheduler", async () => {
    const originalError = console.error;
    console.error = () => {};
    await assert.doesNotReject(() => runDailyTick());
    console.error = originalError;
  });

  test("startCronJobs is idempotent — a second call does not re-register", async () => {
    startCronJobs();
    const afterFirst = logs.filter((l) => l.includes("daily job scheduled")).length;

    startCronJobs();
    const afterSecond = logs.filter((l) => l.includes("daily job scheduled")).length;

    assert.equal(afterFirst, 1);
    assert.equal(afterSecond, 1);
  });
});
