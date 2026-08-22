const express = require("express");
const router = express.Router();
const {
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} = require("../controllers/transactionController");
const auth = require("../middleware/auth");

router.get("/", auth, listTransactions);
router.post("/", auth, createTransaction);
router.put("/:id", auth, updateTransaction);
router.delete("/:id", auth, deleteTransaction);

module.exports = router;
