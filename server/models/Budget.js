const mongoose = require("mongoose");

const budgetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    default: null, // null = overall monthly budget
  },
  month: {
    type: String,
    required: true,
    match: [/^\d{4}-(0[1-9]|1[0-2])$/, "Month must be in YYYY-MM format"],
  },
  limit: { type: Number, required: true, min: [0, "Limit cannot be negative"] },
});

// One budget per (user, category, month). Without this, analytics
// budget-status renders the same category twice. A null categoryId indexes as
// a value, so the "overall" budget is covered by the same constraint.
budgetSchema.index({ userId: 1, month: 1, categoryId: 1 }, { unique: true });

module.exports = mongoose.model("Budget", budgetSchema);
