const mongoose = require("mongoose");
const { Transaction, Category, Budget } = require("../models/_analyticsModels");

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

const currentMonth = () => new Date().toISOString().slice(0, 7);

// "YYYY-MM" -> [start, end) as UTC Date bounds
const monthRange = (month) => {
  const [year, mon] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, mon - 1, 1));
  const end = new Date(Date.UTC(year, mon, 1));
  return { start, end };
};

const monthKey = (date) => date.toISOString().slice(0, 7);

const addMonths = (month, delta) => {
  const [year, mon] = month.split("-").map(Number);
  const d = new Date(Date.UTC(year, mon - 1 + delta, 1));
  return monthKey(d);
};

const getSummary = async (req, res) => {
  try {
    const month = req.query.month && MONTH_REGEX.test(req.query.month) ? req.query.month : currentMonth();
    const { start, end } = monthRange(month);

    const rows = await Transaction.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.userId), date: { $gte: start, $lt: end } } },
      { $group: { _id: "$type", total: { $sum: "$amount" } } },
    ]);

    const totals = { income: 0, expense: 0 };
    rows.forEach((r) => {
      if (r._id === "income" || r._id === "expense") totals[r._id] = r.total;
    });

    res.json({
      totalIncome: totals.income,
      totalExpense: totals.expense,
      balance: totals.income - totals.expense,
    });
  } catch (err) {
    console.error("Analytics summary error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

const getByCategory = async (req, res) => {
  try {
    const month = req.query.month && MONTH_REGEX.test(req.query.month) ? req.query.month : currentMonth();
    const type = req.query.type === "income" ? "income" : "expense";
    const { start, end } = monthRange(month);

    const rows = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.userId),
          type,
          date: { $gte: start, $lt: end },
        },
      },
      { $group: { _id: "$categoryId", total: { $sum: "$amount" } } },
      { $sort: { total: -1 } },
      {
        $lookup: {
          from: Category.collection.name,
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          categoryId: "$_id",
          categoryName: { $ifNull: ["$category.name", "Uncategorized"] },
          total: 1,
          color: "$category.color",
        },
      },
    ]);

    res.json(rows);
  } catch (err) {
    console.error("Analytics by-category error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

const getTrend = async (req, res) => {
  try {
    const to = req.query.to && MONTH_REGEX.test(req.query.to) ? req.query.to : currentMonth();
    const from = req.query.from && MONTH_REGEX.test(req.query.from) ? req.query.from : addMonths(to, -5);

    const { start } = monthRange(from);
    const { end } = monthRange(to);

    const rows = await Transaction.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.userId), date: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: { period: { $dateToString: { format: "%Y-%m", date: "$date" } }, type: "$type" },
          total: { $sum: "$amount" },
        },
      },
    ]);

    // Build a zero-filled month scaffold so the chart never has gaps.
    const byPeriod = new Map();
    let cursor = from;
    while (cursor <= to) {
      byPeriod.set(cursor, { period: cursor, income: 0, expense: 0 });
      if (cursor === to) break;
      cursor = addMonths(cursor, 1);
    }

    rows.forEach((r) => {
      const bucket = byPeriod.get(r._id.period);
      if (bucket && (r._id.type === "income" || r._id.type === "expense")) {
        bucket[r._id.type] = r.total;
      }
    });

    res.json(Array.from(byPeriod.values()));
  } catch (err) {
    console.error("Analytics trend error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

const getBudgetStatus = async (req, res) => {
  try {
    const month = req.query.month && MONTH_REGEX.test(req.query.month) ? req.query.month : currentMonth();
    const { start, end } = monthRange(month);
    const userId = new mongoose.Types.ObjectId(req.userId);

    const budgets = await Budget.find({ userId, month }).lean();
    if (budgets.length === 0) return res.json([]);

    const spentRows = await Transaction.aggregate([
      { $match: { userId, type: "expense", date: { $gte: start, $lt: end } } },
      { $group: { _id: "$categoryId", spent: { $sum: "$amount" } } },
    ]);
    const spentByCategory = new Map(spentRows.map((r) => [String(r._id), r.spent]));
    const totalSpent = spentRows.reduce((sum, r) => sum + r.spent, 0);

    const categoryIds = budgets.map((b) => b.categoryId).filter(Boolean);
    const categories = await Category.find({ _id: { $in: categoryIds } }).lean();
    const categoryNameById = new Map(categories.map((c) => [String(c._id), c.name]));

    const result = budgets.map((b) => {
      const spent = b.categoryId ? spentByCategory.get(String(b.categoryId)) || 0 : totalSpent;
      return {
        categoryId: b.categoryId || null,
        categoryName: b.categoryId ? categoryNameById.get(String(b.categoryId)) || "Uncategorized" : "Overall",
        limit: b.limit,
        spent,
        remaining: b.limit - spent,
        overLimit: spent > b.limit,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("Analytics budget-status error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { getSummary, getByCategory, getTrend, getBudgetStatus };
