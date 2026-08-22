const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  amount: {
    type: Number,
    required: true,
    min: [0.01, "Amount must be greater than 0"],
  },
  type: { type: String, enum: ["income", "expense"], required: true },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    default: null,
  },
  date: { type: Date, required: true, default: Date.now },
  note: { type: String, trim: true, default: "" },
  recurringId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "RecurringRule",
    default: null,
  },
});

// Every read is "this user's rows, newest first" — list view and analytics both.
transactionSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model("Transaction", transactionSchema);
