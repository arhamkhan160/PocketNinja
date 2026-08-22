const mongoose = require("mongoose");

/**
 * A rule that auto-generates a transaction on a schedule (owner: Mustain,
 * PROJECT_PLAN.md §5/§10.4). `jobs/cron.js` reads rules where
 * `nextRun <= now`, materialises the template into a real Transaction, then
 * advances `nextRun` by `interval`.
 */
const recurringRuleSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "userId is required"],
    index: true,
  },
  template: {
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0.01, "Amount must be greater than 0"],
    },
    type: {
      type: String,
      enum: {
        values: ["income", "expense"],
        message: "Type must be income or expense",
      },
      required: [true, "Type is required"],
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
  },
  interval: {
    type: String,
    enum: {
      values: ["daily", "weekly", "monthly"],
      message: "Interval must be daily, weekly or monthly",
    },
    required: [true, "Interval is required"],
  },
  nextRun: {
    type: Date,
    required: [true, "nextRun is required"],
  },
  // Day-of-month the rule was originally anchored to, for monthly rules.
  // Without it a "due on the 31st" rule clamps to Feb 28 and then stays on the
  // 28th forever; with it, February is the only month that clamps. Set from
  // nextRun on create, recomputed whenever nextRun is explicitly changed.
  anchorDay: {
    type: Number,
    min: 1,
    max: 31,
  },
  active: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// The cron job's hot query: active rules that are due.
recurringRuleSchema.index({ active: 1, nextRun: 1 });

module.exports = mongoose.model("RecurringRule", recurringRuleSchema);
