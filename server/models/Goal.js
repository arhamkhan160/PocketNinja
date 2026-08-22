const mongoose = require("mongoose");

/**
 * A savings goal — target amount, running total, optional deadline
 * (owner: Mustain, PROJECT_PLAN.md §5/§10.4).
 */
const goalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "userId is required"],
    index: true,
  },
  title: {
    type: String,
    required: [true, "Title is required"],
    trim: true,
  },
  target: {
    type: Number,
    required: [true, "Target is required"],
    min: [0.01, "Target must be greater than 0"],
  },
  saved: {
    type: Number,
    default: 0,
    min: [0, "Saved cannot be negative"],
  },
  deadline: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Goal", goalSchema);
