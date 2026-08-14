const mongoose = require("mongoose");

/**
 * Read-side model handles for the Analytics slice (owner: Musabbereen).
 *
 * Transaction/Category/Budget are owned end-to-end by Ibrahim (see
 * PROJECT_PLAN.md §5/§10.2). This file does NOT define the authoritative
 * schemas — it registers just enough shape (matching the §5 contract) so
 * analytics aggregation can run before models/Transaction.js,
 * models/Category.js and models/Budget.js exist.
 *
 * `mongoose.models.X || mongoose.model(...)` means: once Ibrahim's real
 * model files are merged and required anywhere in the app (e.g. from his
 * routes), his definition wins for the rest of the process and this file
 * just reuses it — no OverwriteModelError, no file-level merge conflict
 * since this path isn't one he needs to touch.
 */

const Transaction =
  mongoose.models.Transaction ||
  mongoose.model(
    "Transaction",
    new mongoose.Schema({
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      amount: { type: Number, required: true },
      type: { type: String, enum: ["income", "expense"], required: true },
      categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
      date: { type: Date, required: true },
      note: String,
      recurringId: { type: mongoose.Schema.Types.ObjectId, ref: "RecurringRule", default: null },
    })
  );

const Category =
  mongoose.models.Category ||
  mongoose.model(
    "Category",
    new mongoose.Schema({
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      name: { type: String, required: true },
      type: { type: String, enum: ["income", "expense"], required: true },
      icon: String,
      color: String,
    })
  );

const Budget =
  mongoose.models.Budget ||
  mongoose.model(
    "Budget",
    new mongoose.Schema({
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
      month: { type: String, required: true }, // "YYYY-MM"
      limit: { type: Number, required: true },
    })
  );

module.exports = { Transaction, Category, Budget };
