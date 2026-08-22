const mongoose = require("mongoose");

/**
 * Authoritative Category schema (owner: Ibrahim, PROJECT_PLAN.md §5).
 * models/_analyticsModels.js registers a placeholder under the same name, so
 * this file must be required FIRST — see the require order in index.js.
 */
const categorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  name: { type: String, required: [true, "Name is required"], trim: true },
  type: { type: String, enum: ["income", "expense"], required: true },
  icon: { type: String, default: "" },
  color: { type: String, default: "" },
});

module.exports = mongoose.model("Category", categorySchema);
