/**
 * One error tail for every CRUD handler in the Transactions / Categories /
 * Budgets slice (owner: Ibrahim).
 *
 *   } catch (err) {
 *     handleError(res, "Create transaction", err);
 *   }
 */
const handleError = (res, context, err) => {
  // A malformed :id reaches Mongoose as a cast failure. That's "no such row
  // for you" — 404, same answer as someone else's id, so nothing leaks.
  if (err.name === "CastError") {
    return res.status(404).json({ error: "Not found" });
  }

  if (err.name === "ValidationError") {
    const message = Object.values(err.errors || {})
      .map((e) => e.message)
      .join(", ");
    return res.status(400).json({ error: message || "Invalid input" });
  }

  // Duplicate key — the unique index on Budget (userId + month + categoryId).
  if (err.code === 11000) {
    return res.status(409).json({ error: "That already exists" });
  }

  console.error(`${context}:`, err.message);
  res.status(500).json({ error: "Server error" });
};

module.exports = handleError;
