const express = require("express");
const router = express.Router();
const {
  listBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
} = require("../controllers/budgetController");
const auth = require("../middleware/auth");

router.get("/", auth, listBudgets);
router.post("/", auth, createBudget);
router.put("/:id", auth, updateBudget);
router.delete("/:id", auth, deleteBudget);

module.exports = router;
