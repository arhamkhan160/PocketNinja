const mongoose = require("mongoose");
const RecurringRule = require("../models/RecurringRule");
const { processDueRules } = require("../jobs/cron");

const TYPES = ["income", "expense"];
const INTERVALS = ["daily", "weekly", "monthly"];

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

/**
 * Validates + normalises a rule payload from the client.
 * Returns { error } or { value }. Never trusts a client-sent userId (§4).
 */
const parseRulePayload = (body, { partial = false } = {}) => {
  const value = {};

  if (body.template !== undefined || !partial) {
    const template = body.template || {};

    const amount = Number(template.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { error: "Amount must be a number greater than 0" };
    }

    if (!TYPES.includes(template.type)) {
      return { error: "Type must be income or expense" };
    }

    if (template.categoryId != null && template.categoryId !== "" && !isValidObjectId(template.categoryId)) {
      return { error: "categoryId must be a valid id" };
    }

    value.template = {
      amount,
      type: template.type,
      // Ibrahim's categories may not exist yet — null is a valid template.
      categoryId: template.categoryId ? template.categoryId : null,
      note: typeof template.note === "string" ? template.note.trim() : "",
    };
  }

  if (body.interval !== undefined || !partial) {
    if (!INTERVALS.includes(body.interval)) {
      return { error: "Interval must be daily, weekly or monthly" };
    }
    value.interval = body.interval;
  }

  if (body.nextRun !== undefined || !partial) {
    const nextRun = new Date(body.nextRun);
    if (Number.isNaN(nextRun.getTime())) {
      return { error: "nextRun must be a valid date" };
    }
    value.nextRun = nextRun;
    // Re-anchor monthly clamping whenever the client sets a new start date.
    value.anchorDay = nextRun.getUTCDate();
  }

  if (body.active !== undefined) {
    value.active = Boolean(body.active);
  }

  return { value };
};

const list = async (req, res) => {
  try {
    const rules = await RecurringRule.find({ userId: req.userId }).sort({ nextRun: 1 });
    res.json(rules);
  } catch (err) {
    console.error("Recurring list error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

const create = async (req, res) => {
  try {
    const { error, value } = parseRulePayload(req.body);
    if (error) return res.status(400).json({ error });

    const rule = await RecurringRule.create({ ...value, userId: req.userId });
    res.status(201).json(rule);
  } catch (err) {
    console.error("Recurring create error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

const update = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "Recurring rule not found" });
    }

    const { error, value } = parseRulePayload(req.body, { partial: true });
    if (error) return res.status(400).json({ error });

    // Scoped by userId, not just _id — another user's rule must 404, not update.
    const rule = await RecurringRule.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: value },
      { new: true, runValidators: true }
    );

    if (!rule) return res.status(404).json({ error: "Recurring rule not found" });
    res.json(rule);
  } catch (err) {
    console.error("Recurring update error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

const remove = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "Recurring rule not found" });
    }

    const rule = await RecurringRule.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!rule) return res.status(404).json({ error: "Recurring rule not found" });

    res.status(204).send();
  } catch (err) {
    console.error("Recurring delete error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * Demo/manual trigger for the cron pass — the daily schedule would otherwise
 * mean waiting until tomorrow to see a rule fire. Scoped to the caller, so it
 * can only ever generate the caller's own transactions.
 */
const runNow = async (req, res) => {
  try {
    const result = await processDueRules({ userId: req.userId });
    res.json(result);
  } catch (err) {
    console.error("Recurring run-now error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { list, create, update, remove, runNow };
