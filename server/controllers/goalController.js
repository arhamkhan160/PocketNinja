const mongoose = require("mongoose");
const Goal = require("../models/Goal");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

/**
 * Validates + normalises a goal payload. Returns { error } or { value }.
 * Never trusts a client-sent userId (§4).
 */
const parseGoalPayload = (body, { partial = false } = {}) => {
  const value = {};

  if (body.title !== undefined || !partial) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return { error: "Title is required" };
    value.title = title;
  }

  if (body.target !== undefined || !partial) {
    const target = Number(body.target);
    if (!Number.isFinite(target) || target <= 0) {
      return { error: "Target must be a number greater than 0" };
    }
    value.target = target;
  }

  if (body.saved !== undefined) {
    const saved = Number(body.saved);
    if (!Number.isFinite(saved) || saved < 0) {
      return { error: "Saved must be a number of 0 or more" };
    }
    value.saved = saved;
  }

  if (body.deadline !== undefined) {
    if (body.deadline === null || body.deadline === "") {
      value.deadline = null;
    } else {
      const deadline = new Date(body.deadline);
      if (Number.isNaN(deadline.getTime())) {
        return { error: "Deadline must be a valid date" };
      }
      value.deadline = deadline;
    }
  }

  return { value };
};

const list = async (req, res) => {
  try {
    const goals = await Goal.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(goals);
  } catch (err) {
    console.error("Goal list error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

const create = async (req, res) => {
  try {
    const { error, value } = parseGoalPayload(req.body);
    if (error) return res.status(400).json({ error });

    const goal = await Goal.create({ saved: 0, ...value, userId: req.userId });
    res.status(201).json(goal);
  } catch (err) {
    console.error("Goal create error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

const update = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "Goal not found" });
    }

    const { error, value } = parseGoalPayload(req.body, { partial: true });
    if (error) return res.status(400).json({ error });

    // Scoped by userId, not just _id — another user's goal must 404, not update.
    const goal = await Goal.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: value },
      { new: true, runValidators: true }
    );

    if (!goal) return res.status(404).json({ error: "Goal not found" });
    res.json(goal);
  } catch (err) {
    console.error("Goal update error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

const remove = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "Goal not found" });
    }

    const goal = await Goal.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!goal) return res.status(404).json({ error: "Goal not found" });

    res.status(204).send();
  } catch (err) {
    console.error("Goal delete error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { list, create, update, remove };
