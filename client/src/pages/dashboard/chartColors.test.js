import { describe, test, expect } from "vitest";
import {
  CATEGORY_PALETTE,
  OTHER_SLICE_COLOR,
  CATEGORY_SLICE_CAP,
  INCOME_COLOR,
  EXPENSE_COLOR,
  STATUS_GOOD,
  STATUS_WARNING,
  STATUS_CRITICAL,
  GRID_COLOR,
  AXIS_TEXT_COLOR,
  assignSliceColors,
} from "./chartColors";

const rows = (n) =>
  Array.from({ length: n }, (_, i) => ({
    categoryId: `id-${i}`,
    categoryName: `Cat ${i}`,
    total: (n - i) * 10,
  }));

describe("chartColors — palette constants", () => {
  test("the categorical palette holds exactly the capped number of colors", () => {
    expect(CATEGORY_PALETTE).toHaveLength(CATEGORY_SLICE_CAP);
  });

  test("every palette entry is a distinct hex color", () => {
    expect(new Set(CATEGORY_PALETTE).size).toBe(CATEGORY_PALETTE.length);
    for (const color of CATEGORY_PALETTE) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  test("every exported color is a valid hex value", () => {
    const colors = [
      OTHER_SLICE_COLOR,
      INCOME_COLOR,
      EXPENSE_COLOR,
      STATUS_GOOD,
      STATUS_WARNING,
      STATUS_CRITICAL,
      GRID_COLOR,
      AXIS_TEXT_COLOR,
    ];
    for (const color of colors) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  test("income and expense stay visually opposed", () => {
    expect(INCOME_COLOR).not.toBe(EXPENSE_COLOR);
  });

  test("the status ramp has three distinct steps", () => {
    expect(new Set([STATUS_GOOD, STATUS_WARNING, STATUS_CRITICAL]).size).toBe(3);
  });

  test("the 'Other' slice color sits outside the categorical palette", () => {
    // It must read as de-emphasised, not as another category.
    expect(CATEGORY_PALETTE).not.toContain(OTHER_SLICE_COLOR);
  });
});

describe("chartColors — assignSliceColors", () => {
  test("returns an empty array for empty, null and undefined input", () => {
    expect(assignSliceColors([])).toEqual([]);
    expect(assignSliceColors(null)).toEqual([]);
    expect(assignSliceColors(undefined)).toEqual([]);
  });

  test("assigns a palette color to each uncolored row", () => {
    const result = assignSliceColors(rows(3));

    expect(result).toHaveLength(3);
    expect(result[0].color).toBe(CATEGORY_PALETTE[0]);
    expect(result[1].color).toBe(CATEGORY_PALETTE[1]);
    expect(result[2].color).toBe(CATEGORY_PALETTE[2]);
  });

  test("honours a user-picked category color over the palette", () => {
    const result = assignSliceColors([
      { categoryId: "a", categoryName: "A", total: 10, color: "#ABCDEF" },
    ]);

    expect(result[0].color).toBe("#ABCDEF");
  });

  test("keeps every row when the count is exactly at the cap", () => {
    const result = assignSliceColors(rows(CATEGORY_SLICE_CAP));

    expect(result).toHaveLength(CATEGORY_SLICE_CAP);
    expect(result.some((r) => r.categoryName === "Other")).toBe(false);
  });

  test("folds the overflow into a single Other slice one past the cap", () => {
    const result = assignSliceColors(rows(CATEGORY_SLICE_CAP + 1));

    expect(result).toHaveLength(CATEGORY_SLICE_CAP + 1);
    const other = result[result.length - 1];
    expect(other.categoryName).toBe("Other");
    expect(other.categoryId).toBe("other");
    expect(other.color).toBe(OTHER_SLICE_COLOR);
  });

  test("the Other slice sums every folded row", () => {
    const input = rows(9);
    const foldedTotal = input
      .slice(CATEGORY_SLICE_CAP)
      .reduce((sum, r) => sum + r.total, 0);

    const result = assignSliceColors(input);
    const other = result[result.length - 1];

    expect(other.total).toBe(foldedTotal);
  });

  test("no total is lost in the fold", () => {
    const input = rows(20);
    const inputTotal = input.reduce((sum, r) => sum + r.total, 0);
    const outputTotal = assignSliceColors(input).reduce((sum, r) => sum + r.total, 0);

    expect(outputTotal).toBe(inputTotal);
  });

  test("caps the visible slices at CATEGORY_SLICE_CAP plus Other", () => {
    expect(assignSliceColors(rows(100))).toHaveLength(CATEGORY_SLICE_CAP + 1);
  });

  test("preserves the incoming order — the endpoint sorts by total", () => {
    const result = assignSliceColors(rows(4));

    expect(result.map((r) => r.categoryName)).toEqual(["Cat 0", "Cat 1", "Cat 2", "Cat 3"]);
  });

  test("does not mutate the rows it was given", () => {
    const input = rows(3);
    const snapshot = JSON.parse(JSON.stringify(input));

    assignSliceColors(input);

    expect(input).toEqual(snapshot);
  });

  test("a single row gets the first palette color", () => {
    expect(assignSliceColors(rows(1))[0].color).toBe(CATEGORY_PALETTE[0]);
  });

  test("carries every original field through", () => {
    const result = assignSliceColors([
      { categoryId: "a", categoryName: "Food", total: 42 },
    ]);

    expect(result[0]).toMatchObject({ categoryId: "a", categoryName: "Food", total: 42 });
  });
});
