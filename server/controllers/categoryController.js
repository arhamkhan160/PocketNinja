const Category = require("../models/Category");
const Transaction = require("../models/Transaction");
const Budget = require("../models/Budget");
const handleError = require("../utils/handleError");
const { isType, isNonEmptyString } = require("../utils/validators");

const listCategories = async (req, res) => {
  try {
    const categories = await Category.find({ userId: req.userId }).sort({
      type: 1,
      name: 1,
    });
    res.json(categories);
  } catch (err) {
    handleError(res, "List categories", err);
  }
};

const createCategory = async (req, res) => {
  try {
    const { name, type, icon, color } = req.body;

    if (!isNonEmptyString(name)) {
      return res.status(400).json({ error: "Name is required" });
    }
    if (!isType(type)) {
      return res.status(400).json({ error: "Type must be 'income' or 'expense'" });
    }

    const category = await Category.create({
      userId: req.userId,
      name: name.trim(),
      type,
      icon: icon || "",
      color: color || "",
    });

    res.status(201).json(category);
  } catch (err) {
    handleError(res, "Create category", err);
  }
};

const updateCategory = async (req, res) => {
  try {
    const { name, type, icon, color } = req.body;
    const updates = {};

    if (name !== undefined) {
      if (!isNonEmptyString(name)) {
        return res.status(400).json({ error: "Name cannot be empty" });
      }
      updates.name = name.trim();
    }
    if (type !== undefined) {
      if (!isType(type)) {
        return res.status(400).json({ error: "Type must be 'income' or 'expense'" });
      }
      updates.type = type;
    }
    if (icon !== undefined) updates.icon = icon;
    if (color !== undefined) updates.color = color;

    // userId in the filter — never findById-then-check. One query, no leak window.
    const category = await Category.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      updates,
      { returnDocument: "after", runValidators: true },
    );

    if (!category) return res.status(404).json({ error: "Category not found" });
    res.json(category);
  } catch (err) {
    handleError(res, "Update category", err);
  }
};

const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!category) return res.status(404).json({ error: "Category not found" });

    // No dangling refs: transactions fall back to "Uncategorized" in analytics,
    // and a budget for a dead category is meaningless.
    await Transaction.updateMany(
      { userId: req.userId, categoryId: category._id },
      { categoryId: null },
    );
    await Budget.deleteMany({ userId: req.userId, categoryId: category._id });

    res.status(204).end();
  } catch (err) {
    handleError(res, "Delete category", err);
  }
};

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
