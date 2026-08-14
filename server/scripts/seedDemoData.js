/**
 * Optional dev utility — seeds one demo user with a few months of
 * categories/transactions/budgets so the Analytics Dashboard (and anyone
 * else's UI) has real data to render against instead of an empty database.
 *
 * Not part of the graded slice; safe to delete once Ibrahim's transaction
 * CRUD UI makes this unnecessary. Re-running it wipes and re-seeds only the
 * demo user's own data.
 *
 * Usage:  node scripts/seedDemoData.js   (reads server/.env, same as index.js)
 */
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../db");
const User = require("../models/User");
const { Transaction, Category, Budget } = require("../models/_analyticsModels");

const DEMO_EMAIL = "demo@pocketninja.app";
const DEMO_PASSWORD = "demo1234";

const CATEGORY_SEED = [
  { name: "Food", type: "expense" },
  { name: "Transport", type: "expense" },
  { name: "Rent", type: "expense" },
  { name: "Entertainment", type: "expense" },
  { name: "Salary", type: "income" },
  { name: "Freelance", type: "income" },
];

// [Food, Transport, Rent, Entertainment] expense amounts, [Salary, Freelance] income amounts, per month (oldest -> newest)
const MONTHLY_EXPENSE_PATTERN = [
  [320, 90, 950, 60],
  [280, 110, 950, 140],
  [410, 95, 950, 40],
  [260, 130, 950, 180],
  [500, 100, 950, 75],
  [340, 85, 950, 220], // current month — Food intentionally high to trip the budget demo
];
const MONTHLY_INCOME_PATTERN = [
  [2800, 300],
  [2800, 0],
  [2800, 450],
  [2800, 0],
  [2800, 600],
  [2800, 0],
];

const monthKey = (d) => d.toISOString().slice(0, 7);

const seed = async () => {
  await connectDB();

  let user = await User.findOne({ email: DEMO_EMAIL });
  if (!user) {
    user = await User.create({ name: "Demo User", email: DEMO_EMAIL, password: DEMO_PASSWORD });
    console.log(`Created demo user ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  } else {
    console.log(`Reusing existing demo user ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  }

  await Promise.all([
    Transaction.deleteMany({ userId: user._id }),
    Category.deleteMany({ userId: user._id }),
    Budget.deleteMany({ userId: user._id }),
  ]);

  const categories = await Category.insertMany(
    CATEGORY_SEED.map((c) => ({ ...c, userId: user._id }))
  );
  const byName = Object.fromEntries(categories.map((c) => [c.name, c]));

  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    months.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  }

  const transactions = [];
  months.forEach((month, i) => {
    const [year, mon] = month.split("-").map(Number);
    const [food, transport, rent, entertainment] = MONTHLY_EXPENSE_PATTERN[i];
    const [salary, freelance] = MONTHLY_INCOME_PATTERN[i];

    const push = (categoryName, type, amount, day) => {
      if (amount <= 0) return;
      transactions.push({
        userId: user._id,
        categoryId: byName[categoryName]._id,
        type,
        amount,
        date: new Date(Date.UTC(year, mon - 1, day)),
        note: "",
      });
    };

    push("Food", "expense", food, 5);
    push("Transport", "expense", transport, 8);
    push("Rent", "expense", rent, 1);
    push("Entertainment", "expense", entertainment, 20);
    push("Salary", "income", salary, 1);
    push("Freelance", "income", freelance, 15);
  });
  await Transaction.insertMany(transactions);

  const currentMonth = months[months.length - 1];
  await Budget.insertMany([
    { userId: user._id, categoryId: byName.Food._id, month: currentMonth, limit: 300 }, // intentionally over
    { userId: user._id, categoryId: byName.Transport._id, month: currentMonth, limit: 120 },
    { userId: user._id, categoryId: byName.Rent._id, month: currentMonth, limit: 950 },
    { userId: user._id, categoryId: byName.Entertainment._id, month: currentMonth, limit: 150 },
  ]);

  console.log(`Seeded ${categories.length} categories, ${transactions.length} transactions, 4 budgets across ${months.join(", ")}`);
  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
