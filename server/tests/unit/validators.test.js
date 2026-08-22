require("../helpers/env");
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../helpers/db");
const {
  TYPES,
  isType,
  isMonth,
  isNonEmptyString,
  parseDate,
  parsePositiveNumber,
  parseNonNegativeNumber,
  ownsCategory,
} = require("../../utils/validators");
const Category = require("../../models/Category");
const { makeUser } = require("../helpers/client");

describe("utils/validators — pure functions", () => {
  test("TYPES is exactly income and expense", () => {
    assert.deepEqual(TYPES, ["income", "expense"]);
  });

  describe("isType", () => {
    test("accepts the two valid types", () => {
      assert.equal(isType("income"), true);
      assert.equal(isType("expense"), true);
    });

    test("rejects wrong case, unknown values and non-strings", () => {
      for (const bad of ["Income", "EXPENSE", "transfer", "", null, undefined, 0, {}, []]) {
        assert.equal(isType(bad), false, `expected ${JSON.stringify(bad)} to be rejected`);
      }
    });
  });

  describe("isMonth", () => {
    test("accepts a well-formed YYYY-MM", () => {
      assert.equal(isMonth("2026-01"), true);
      assert.equal(isMonth("2026-12"), true);
      assert.equal(isMonth("1999-08"), true);
    });

    test("rejects month 00 and month 13 — the off-by-one boundaries", () => {
      assert.equal(isMonth("2026-00"), false);
      assert.equal(isMonth("2026-13"), false);
    });

    test("rejects unpadded, over-long and wrong-shaped values", () => {
      for (const bad of ["2026-1", "26-01", "2026-011", "2026/01", "2026-01-01", "January", ""]) {
        assert.equal(isMonth(bad), false, `expected ${bad} to be rejected`);
      }
    });

    test("treats null/undefined as absent rather than throwing", () => {
      assert.equal(isMonth(null), false);
      assert.equal(isMonth(undefined), false);
    });
  });

  describe("isNonEmptyString", () => {
    test("accepts text with content", () => {
      assert.equal(isNonEmptyString("Food"), true);
      assert.equal(isNonEmptyString("  Food  "), true);
    });

    test("rejects empty and whitespace-only strings", () => {
      assert.equal(isNonEmptyString(""), false);
      assert.equal(isNonEmptyString("   "), false);
      assert.equal(isNonEmptyString("\t\n"), false);
    });

    test("rejects non-strings, including numbers that look like text", () => {
      for (const bad of [null, undefined, 42, {}, [], true]) {
        assert.equal(isNonEmptyString(bad), false);
      }
    });
  });

  describe("parseDate", () => {
    test("parses an ISO date string", () => {
      const d = parseDate("2026-08-15");
      assert.ok(d instanceof Date);
      assert.equal(d.toISOString().slice(0, 10), "2026-08-15");
    });

    test("parses a full ISO timestamp and a Date instance", () => {
      assert.equal(parseDate("2026-08-15T10:30:00.000Z").getUTCHours(), 10);
      assert.equal(parseDate(new Date("2026-08-15")).toISOString().slice(0, 10), "2026-08-15");
    });

    test("returns null for unparseable input instead of an Invalid Date", () => {
      // Returning Invalid Date would poison a Mongo query silently.
      for (const bad of ["not-a-date", "2026-13-45", "", undefined, {}]) {
        assert.equal(parseDate(bad), null, `expected ${JSON.stringify(bad)} to be null`);
      }
    });

    test("null parses to the epoch, which is why callers must check falsy input first", () => {
      // Documents real JS behaviour: new Date(null) === epoch, not invalid.
      assert.equal(parseDate(null).getTime(), 0);
    });
  });

  describe("parsePositiveNumber", () => {
    test("accepts positive numbers and numeric strings", () => {
      assert.equal(parsePositiveNumber(42), 42);
      assert.equal(parsePositiveNumber("42.5"), 42.5);
      assert.equal(parsePositiveNumber(0.01), 0.01);
    });

    test("rejects zero and negatives — the boundary", () => {
      assert.equal(parsePositiveNumber(0), null);
      assert.equal(parsePositiveNumber("0"), null);
      assert.equal(parsePositiveNumber(-1), null);
      assert.equal(parsePositiveNumber(-0.01), null);
    });

    test("rejects NaN and both infinities", () => {
      assert.equal(parsePositiveNumber("abc"), null);
      assert.equal(parsePositiveNumber(NaN), null);
      assert.equal(parsePositiveNumber(Infinity), null);
      assert.equal(parsePositiveNumber(-Infinity), null);
    });

    test("rejects empty string, null, undefined and objects", () => {
      // Number("") is 0 and Number(null) is 0 — both must fall out as null.
      for (const bad of ["", null, undefined, {}, [1, 2]]) {
        assert.equal(parsePositiveNumber(bad), null, `expected ${JSON.stringify(bad)} to be null`);
      }
    });

    test("rejects arrays and booleans that Number() would happily coerce", () => {
      // Number(["5"]) is 5 and Number(true) is 1 — neither is a number the
      // client meant to send.
      assert.equal(parsePositiveNumber(["5"]), null);
      assert.equal(parsePositiveNumber(true), null);
    });

    test("rejects whitespace-only strings", () => {
      assert.equal(parsePositiveNumber("   "), null);
    });
  });

  describe("parseNonNegativeNumber", () => {
    test("accepts zero — a 0 budget limit is legitimate", () => {
      assert.equal(parseNonNegativeNumber(0), 0);
      assert.equal(parseNonNegativeNumber("0"), 0);
    });

    test("accepts positives", () => {
      assert.equal(parseNonNegativeNumber(300), 300);
      assert.equal(parseNonNegativeNumber("99.99"), 99.99);
    });

    test("rejects negatives and non-finite values", () => {
      for (const bad of [-1, "-0.01", NaN, Infinity, "abc", undefined, {}]) {
        assert.equal(parseNonNegativeNumber(bad), null, `expected ${JSON.stringify(bad)} to be null`);
      }
    });

    test("rejects null, empty string and arrays instead of reading them as 0", () => {
      // The sharp edge this parser exists to guard: Number(null) === 0, so a
      // missing limit would otherwise be stored as a real limit of 0.
      for (const bad of [null, "", "  ", [], true]) {
        assert.equal(parseNonNegativeNumber(bad), null, `expected ${JSON.stringify(bad)} to be null`);
      }
    });
  });
});

describe("utils/validators — ownsCategory (the tenancy boundary)", () => {
  before(async () => db.connect());
  beforeEach(async () => db.clear());
  after(async () => db.disconnect());

  test("returns true for a category the user owns", async () => {
    const { userId } = await makeUser();
    const category = await Category.create({ userId, name: "Food", type: "expense" });

    assert.equal(await ownsCategory(userId, category._id), true);
  });

  test("returns false for another user's category", async () => {
    const owner = await makeUser();
    const attacker = await makeUser();
    const category = await Category.create({
      userId: owner.userId,
      name: "Food",
      type: "expense",
    });

    assert.equal(await ownsCategory(attacker.userId, category._id), false);
  });

  test("returns false for an id that is well-formed but does not exist", async () => {
    const { userId } = await makeUser();
    assert.equal(await ownsCategory(userId, "507f1f77bcf86cd799439011"), false);
  });

  test("returns false for a malformed id without throwing a CastError", async () => {
    const { userId } = await makeUser();
    for (const bad of ["not-an-id", "", null, undefined, 123]) {
      assert.equal(await ownsCategory(userId, bad), false);
    }
  });

  test("accepts a string id as well as an ObjectId", async () => {
    const { userId } = await makeUser();
    const category = await Category.create({ userId, name: "Food", type: "expense" });

    assert.equal(await ownsCategory(userId, String(category._id)), true);
  });
});
