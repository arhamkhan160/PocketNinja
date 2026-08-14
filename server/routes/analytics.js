const express = require("express");
const router = express.Router();
const { getSummary, getByCategory, getTrend, getBudgetStatus } = require("../controllers/analyticsController");
const auth = require("../middleware/auth");

router.get("/summary", auth, getSummary);
router.get("/by-category", auth, getByCategory);
router.get("/trend", auth, getTrend);
router.get("/budget-status", auth, getBudgetStatus);

module.exports = router;
