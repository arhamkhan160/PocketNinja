const cron = require("node-cron");
const RecurringRule = require("../models/RecurringRule");
const { Transaction } = require("../models/_analyticsModels");

/**
 * Scheduled jobs for the Recurring + Reminders slice (owner: Mustain,
 * PROJECT_PLAN.md §10.4).
 *
 * Two daily passes:
 *   1. processDueRules() — materialise every rule whose nextRun has arrived
 *      into a real Transaction, then advance nextRun by its interval.
 *   2. sendReminders()   — push-notify users about bills coming due soon.
 *
 * Transaction is pulled from models/_analyticsModels.js on purpose: that file
 * exists precisely so slices can write to the real `transactions` collection
 * before Ibrahim's models/Transaction.js lands, and it defers to his schema
 * the moment it does. Do not add a second Transaction shim here.
 */

const REMINDER_LEAD_DAYS = Number(process.env.REMINDER_LEAD_DAYS) || 3;

// Runaway guard: a rule backdated by years shouldn't mint thousands of rows in
// one pass. Whatever is left over is simply picked up by the next tick.
const MAX_CATCHUP_PER_RULE = 50;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The next occurrence after `date`, in UTC.
 *
 * Monthly clamps to the end of the target month: Jan 31 + 1 month is Feb 28
 * (or 29), NOT Mar 3. Naively doing setUTCMonth(+1) on a day-31 date rolls
 * over into the following month and permanently drifts the rule.
 *
 * `anchorDay` is the day-of-month the rule was originally created on. Clamping
 * has to measure from the anchor rather than from the previous occurrence,
 * otherwise a rule due on the 31st clamps once to Feb 28 and is then stuck on
 * the 28th for good. Defaults to the given date's day when absent, which is
 * the correct behaviour for rules created before the field existed.
 */
const advance = (date, interval, anchorDay) => {
  const next = new Date(date);

  if (interval === "daily") {
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }

  if (interval === "weekly") {
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }

  const day = anchorDay || next.getUTCDate();
  const year = next.getUTCFullYear();
  const month = next.getUTCMonth();
  // Day 0 of (month + 2) is the last day of (month + 1).
  const daysInTargetMonth = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();

  next.setUTCDate(1); // park on the 1st so the month change can't roll over
  next.setUTCMonth(month + 1);
  next.setUTCDate(Math.min(day, daysInTargetMonth));
  return next;
};

/**
 * Generate transactions for every due rule.
 *
 * Pass `{ userId }` to scope the run to one user — that is what the
 * POST /api/recurring/run-now demo endpoint uses, so a user can only ever
 * trigger their own rules (§4).
 */
const processDueRules = async ({ userId } = {}) => {
  const now = new Date();

  const query = { active: true, nextRun: { $lte: now } };
  if (userId) query.userId = userId;

  const rules = await RecurringRule.find(query);

  let rulesProcessed = 0;
  let transactionsCreated = 0;

  for (const rule of rules) {
    try {
      let created = 0;
      let cursor = new Date(rule.nextRun);

      // Catch-up loop: if the server was down for a week, a daily rule owes
      // several transactions, one per missed occurrence — each dated when it
      // was actually due so the analytics charts stay honest.
      while (cursor <= now && created < MAX_CATCHUP_PER_RULE) {
        await Transaction.create({
          userId: rule.userId,
          amount: rule.template.amount,
          type: rule.template.type,
          categoryId: rule.template.categoryId || null,
          date: cursor,
          note: rule.template.note || "",
          recurringId: rule._id,
        });

        created += 1;
        cursor = advance(cursor, rule.interval, rule.anchorDay);
      }

      rule.nextRun = cursor;
      await rule.save();

      rulesProcessed += 1;
      transactionsCreated += created;
    } catch (err) {
      // One malformed rule must never abort the whole nightly pass.
      console.error(`[cron] rule ${rule._id} failed:`, err.message);
    }
  }

  return { rulesProcessed, transactionsCreated };
};

/**
 * push/webpush.js calls setVapidDetails() at require time and throws if the
 * VAPID env vars are missing. Requiring it lazily keeps the server bootable —
 * and keeps recurring generation working — for a teammate who hasn't put keys
 * in their .env yet (PROJECT_PLAN.md §12 fallback).
 */
let cachedPushHelper;
const getPushHelper = () => {
  if (cachedPushHelper !== undefined) return cachedPushHelper;

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
    console.warn("[cron] VAPID keys not configured — reminder push notifications are disabled");
    cachedPushHelper = null;
    return cachedPushHelper;
  }

  try {
    cachedPushHelper = require("../push/webpush").sendPushNotification;
  } catch (err) {
    console.error("[cron] push helper unavailable:", err.message);
    cachedPushHelper = null;
  }

  return cachedPushHelper;
};

const formatAmount = (amount) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);

const describeDue = (rules) => {
  if (rules.length === 1) {
    const rule = rules[0];
    const label = rule.template.note || (rule.template.type === "income" ? "Income" : "Bill");
    const when = new Date(rule.nextRun).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    return `${label} — ${formatAmount(rule.template.amount)} due ${when}`;
  }

  const total = rules.reduce((sum, r) => sum + r.template.amount, 0);
  return `${rules.length} items totalling ${formatAmount(total)} are due in the next ${REMINDER_LEAD_DAYS} days`;
};

/**
 * Notify each user once about everything they have coming due inside the
 * lead window. webpush.js already fans out to all of a user's subscriptions
 * and purges stale (404/410) ones, so there is nothing to duplicate here.
 */
const sendReminders = async () => {
  const sendPushNotification = getPushHelper();
  if (!sendPushNotification) return { usersProcessed: 0, rulesDue: 0 };

  const now = new Date();
  const until = new Date(now.getTime() + REMINDER_LEAD_DAYS * DAY_MS);

  const rules = await RecurringRule.find({
    active: true,
    nextRun: { $gt: now, $lte: until },
  });

  const byUser = new Map();
  rules.forEach((rule) => {
    const key = String(rule.userId);
    if (!byUser.has(key)) byUser.set(key, []);
    byUser.get(key).push(rule);
  });

  // Counts users we dispatched for, not confirmed deliveries: sendPushNotification
  // returns silently for a user with no registered subscriptions, so it can't
  // tell us whether a notification actually went anywhere.
  let usersProcessed = 0;

  for (const [userId, userRules] of byUser) {
    try {
      await sendPushNotification(userId, {
        title: "PocketNinja reminder",
        body: describeDue(userRules),
        url: "/planning",
      });
      usersProcessed += 1;
    } catch (err) {
      console.error(`[cron] reminder push failed for user ${userId}:`, err.message);
    }
  }

  return { usersProcessed, rulesDue: rules.length };
};

const runDailyTick = async () => {
  try {
    const generated = await processDueRules();
    console.log(
      `[cron] daily tick — ${generated.transactionsCreated} transaction(s) from ${generated.rulesProcessed} rule(s)`
    );

    const reminded = await sendReminders();
    console.log(
      `[cron] daily tick — dispatched reminders for ${reminded.usersProcessed} user(s), ${reminded.rulesDue} item(s) due`
    );
  } catch (err) {
    console.error("[cron] daily tick failed:", err.message);
  }
};

let started = false;

/** Schedules the 08:00 daily tick. Safe to call more than once. */
const startCronJobs = () => {
  if (started) return;
  started = true;

  cron.schedule("0 8 * * *", runDailyTick);
  console.log("[cron] daily job scheduled for 08:00");

  if (process.env.RUN_CRON_ON_STARTUP === "true") {
    console.log("[cron] RUN_CRON_ON_STARTUP set — running one pass now");
    runDailyTick();
  }
};

module.exports = { advance, processDueRules, sendReminders, runDailyTick, startCronJobs };
