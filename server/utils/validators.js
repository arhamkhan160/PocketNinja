const mongoose = require("mongoose");
const Category = require("../models/Category");

/**
 * Input rules shared by the transaction / category / budget controllers.
 * Parsers return the coerced value or null — never throw.
 */

const TYPES = ["income", "expense"];
const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

const isType = (value) => TYPES.includes(value);

const isMonth = (value) => MONTH_REGEX.test(value || "");

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const parseDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Only a number or a numeric string is a number. Without this guard Number()
 * quietly turns null, "" and [] into 0 — which parsePositiveNumber survives
 * (0 fails its > 0 test) but parseNonNegativeNumber would accept, letting a
 * missing budget limit land in the database as a very real limit of 0.
 */
const toFiniteNumber = (value) => {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const parsePositiveNumber = (value) => {
  const n = toFiniteNumber(value);
  return n !== null && n > 0 ? n : null;
};

const parseNonNegativeNumber = (value) => {
  const n = toFiniteNumber(value);
  return n !== null && n >= 0 ? n : null;
};

/**
 * Security boundary: a categoryId from a request body must belong to the
 * caller. Otherwise user B could attach user A's category and leak its name
 * into B's analytics ($lookup joins by _id alone).
 */
const ownsCategory = async (userId, categoryId) => {
  if (!mongoose.isValidObjectId(categoryId)) return false;
  return Boolean(await Category.exists({ _id: categoryId, userId }));
};

module.exports = {
  TYPES,
  isType,
  isMonth,
  isNonEmptyString,
  parseDate,
  parsePositiveNumber,
  parseNonNegativeNumber,
  ownsCategory,
};
