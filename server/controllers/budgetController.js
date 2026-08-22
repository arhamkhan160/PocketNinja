const Budget = require("../models/Budget");
const handleError = require("../utils/handleError");
const {
  isMonth,
  parseNonNegativeNumber,
  ownsCategory,
} = require("../utils/validators");

const listBudgets = async (req, res) => {
  try {
    const { month } = req.query;
    const filter = { userId: req.userId };

    if (month) {
      if (!isMonth(month)) {
        return res.status(400).json({ error: "Month must be in YYYY-MM format" });
      }
      filter.month = month;
    }

    const budgets = await Budget.find(filter).sort({ month: -1 });
    res.json(budgets);
  } catch (err) {
    handleError(res, "List budgets", err);
  }
};

const createBudget = async (req, res) => {
  try {
    const { categoryId, month, limit } = req.body;

    if (!isMonth(month)) {
      return res.status(400).json({ error: "Month must be in YYYY-MM format" });
    }

    const numericLimit = parseNonNegativeNumber(limit);
    if (numericLimit === null) {
      return res.status(400).json({ error: "Limit must be a number of 0 or more" });
    }
    if (categoryId && !(await ownsCategory(req.userId, categoryId))) {
      return res.status(400).json({ error: "Category not found" });
    }

    // "Set budget" is idempotent: re-posting the same category+month overwrites
    // the limit instead of creating a duplicate the unique index would reject.
    const budget = await Budget.findOneAndUpdate(
      { userId: req.userId, categoryId: categoryId || null, month },
      { limit: numericLimit },
      { returnDocument: "after", upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );

    res.status(201).json(budget);
  } catch (err) {
    handleError(res, "Create budget", err);
  }
};

const updateBudget = async (req, res) => {
  try {
    const { limit, month } = req.body;
    const updates = {};

    if (limit !== undefined) {
      const numericLimit = parseNonNegativeNumber(limit);
      if (numericLimit === null) {
        return res.status(400).json({ error: "Limit must be a number of 0 or more" });
      }
      updates.limit = numericLimit;
    }
    if (month !== undefined) {
      if (!isMonth(month)) {
        return res.status(400).json({ error: "Month must be in YYYY-MM format" });
      }
      updates.month = month;
    }

    const budget = await Budget.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      updates,
      { returnDocument: "after", runValidators: true },
    );

    if (!budget) return res.status(404).json({ error: "Budget not found" });
    res.json(budget);
  } catch (err) {
    handleError(res, "Update budget", err);
  }
};

const deleteBudget = async (req, res) => {
  try {
    const budget = await Budget.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!budget) return res.status(404).json({ error: "Budget not found" });
    res.status(204).end();
  } catch (err) {
    handleError(res, "Delete budget", err);
  }
};

module.exports = { listBudgets, createBudget, updateBudget, deleteBudget };
