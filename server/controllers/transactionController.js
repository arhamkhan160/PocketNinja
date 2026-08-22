const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const handleError = require("../utils/handleError");
const {
  isType,
  parseDate,
  parsePositiveNumber,
  ownsCategory,
} = require("../utils/validators");

// ponytail: no pagination. Academic dataset. Add skip/limit params if a demo
// user ever passes 500 rows.
const LIST_LIMIT = 500;

// Turns ?category=&type=&from=&to= into a Mongo filter, or an error string.
const buildListFilter = (userId, { category, type, from, to }) => {
  const filter = { userId };

  if (category) {
    if (!mongoose.isValidObjectId(category)) {
      return { error: "Invalid category id" };
    }
    filter.categoryId = category;
  }

  if (type) {
    if (!isType(type)) {
      return { error: "Type must be 'income' or 'expense'" };
    }
    filter.type = type;
  }

  if (from || to) {
    filter.date = {};
    if (from) {
      const start = parseDate(from);
      if (!start) return { error: "Invalid 'from' date" };
      filter.date.$gte = start;
    }
    if (to) {
      const end = parseDate(to);
      if (!end) return { error: "Invalid 'to' date" };
      end.setUTCHours(23, 59, 59, 999); // 'to' includes the whole day
      filter.date.$lte = end;
    }
  }

  return { filter };
};

const listTransactions = async (req, res) => {
  try {
    const { filter, error } = buildListFilter(req.userId, req.query);
    if (error) return res.status(400).json({ error });

    const transactions = await Transaction.find(filter)
      .sort({ date: -1, _id: -1 })
      .limit(LIST_LIMIT);

    res.json(transactions);
  } catch (err) {
    handleError(res, "List transactions", err);
  }
};

const createTransaction = async (req, res) => {
  try {
    const { amount, type, categoryId, date, note } = req.body;

    const numericAmount = parsePositiveNumber(amount);
    if (numericAmount === null) {
      return res
        .status(400)
        .json({ error: "Amount must be a number greater than 0" });
    }
    if (!isType(type)) {
      return res.status(400).json({ error: "Type must be 'income' or 'expense'" });
    }

    const txnDate = date ? parseDate(date) : new Date();
    if (!txnDate) return res.status(400).json({ error: "Invalid date" });

    if (categoryId && !(await ownsCategory(req.userId, categoryId))) {
      return res.status(400).json({ error: "Category not found" });
    }

    const transaction = await Transaction.create({
      userId: req.userId,
      amount: numericAmount,
      type,
      categoryId: categoryId || null,
      date: txnDate,
      note: note || "",
    });

    res.status(201).json(transaction);
  } catch (err) {
    handleError(res, "Create transaction", err);
  }
};

const updateTransaction = async (req, res) => {
  try {
    const { amount, type, categoryId, date, note } = req.body;
    const updates = {};

    if (amount !== undefined) {
      const numericAmount = parsePositiveNumber(amount);
      if (numericAmount === null) {
        return res
          .status(400)
          .json({ error: "Amount must be a number greater than 0" });
      }
      updates.amount = numericAmount;
    }
    if (type !== undefined) {
      if (!isType(type)) {
        return res.status(400).json({ error: "Type must be 'income' or 'expense'" });
      }
      updates.type = type;
    }
    if (date !== undefined) {
      const txnDate = parseDate(date);
      if (!txnDate) return res.status(400).json({ error: "Invalid date" });
      updates.date = txnDate;
    }
    if (categoryId !== undefined) {
      if (categoryId && !(await ownsCategory(req.userId, categoryId))) {
        return res.status(400).json({ error: "Category not found" });
      }
      updates.categoryId = categoryId || null;
    }
    if (note !== undefined) updates.note = note;

    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      updates,
      { returnDocument: "after", runValidators: true },
    );

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    res.json(transaction);
  } catch (err) {
    handleError(res, "Update transaction", err);
  }
};

const deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    res.status(204).end();
  } catch (err) {
    handleError(res, "Delete transaction", err);
  }
};

module.exports = {
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
};
