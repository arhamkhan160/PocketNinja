import { describe, test, expect, vi, afterEach } from "vitest";
import {
  formatCurrency,
  formatDate,
  toDateInputValue,
  todayInputValue,
  daysUntil,
  dueLabel,
  INTERVAL_LABELS,
  errorMessage,
} from "./formatters";

const DAY_MS = 24 * 60 * 60 * 1000;

afterEach(() => {
  vi.useRealTimers();
});

describe("planning/formatters — formatCurrency", () => {
  test("drops the decimals, unlike the transactions formatter", () => {
    expect(formatCurrency(1200)).toBe("$1,200");
    expect(formatCurrency(42.5)).toBe("$43");
  });

  test("rounds to the nearest whole unit", () => {
    expect(formatCurrency(0.4)).toBe("$0");
    expect(formatCurrency(0.6)).toBe("$1");
  });

  test("coerces junk to $0", () => {
    for (const bad of [null, undefined, NaN, "abc", {}]) {
      expect(formatCurrency(bad)).toBe("$0");
    }
  });

  test("handles negatives and thousands separators", () => {
    expect(formatCurrency(-50)).toBe("-$50");
    expect(formatCurrency(1234567)).toBe("$1,234,567");
  });
});

describe("planning/formatters — formatDate", () => {
  test("formats in UTC", () => {
    expect(formatDate("2026-08-15")).toBe("Aug 15, 2026");
  });

  test("returns an em dash for missing or invalid input", () => {
    // Guarded, unlike utils/format.formatDate.
    for (const bad of [null, undefined, "", "not-a-date"]) {
      expect(formatDate(bad)).toBe("—");
    }
  });

  test("does not shift the day at a UTC midnight boundary", () => {
    expect(formatDate("2026-01-01T00:00:00.000Z")).toBe("Jan 1, 2026");
  });
});

describe("planning/formatters — toDateInputValue", () => {
  test("produces yyyy-mm-dd", () => {
    expect(toDateInputValue("2026-08-15T10:00:00Z")).toBe("2026-08-15");
  });

  test("returns an empty string for missing or invalid input", () => {
    // Empty string is what a controlled <input type=date> needs; 'Invalid Date'
    // or undefined would make React warn about an uncontrolled input.
    for (const bad of [null, undefined, "", "not-a-date"]) {
      expect(toDateInputValue(bad)).toBe("");
    }
  });
});

describe("planning/formatters — todayInputValue", () => {
  test("returns today in yyyy-mm-dd", () => {
    expect(todayInputValue()).toBe(new Date().toISOString().slice(0, 10));
  });

  test("matches the date input shape", () => {
    expect(todayInputValue()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("planning/formatters — daysUntil", () => {
  test("returns 0 for today", () => {
    expect(daysUntil(new Date())).toBe(0);
  });

  test("treats later today as 0, not -1", () => {
    // Both sides floor to UTC midnight, so a time-of-day difference can't
    // flip the sign.
    const laterToday = new Date();
    laterToday.setUTCHours(23, 59, 0, 0);
    expect(daysUntil(laterToday)).toBe(0);
  });

  test("counts forward and backward in whole days", () => {
    expect(daysUntil(new Date(Date.now() + 3 * DAY_MS))).toBe(3);
    expect(daysUntil(new Date(Date.now() - 5 * DAY_MS))).toBe(-5);
  });

  test("returns null for missing or invalid input", () => {
    for (const bad of [null, undefined, "", "not-a-date"]) {
      expect(daysUntil(bad)).toBe(null);
    }
  });

  test("crosses a month boundary correctly", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-30T12:00:00Z"));
    expect(daysUntil("2026-02-02")).toBe(3);
  });

  test("is unaffected by the time of day on either side", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T23:00:00Z"));
    expect(daysUntil("2026-08-16T01:00:00Z")).toBe(1);
  });
});

describe("planning/formatters — dueLabel", () => {
  test("labels a missing date", () => {
    expect(dueLabel(null)).toEqual({ text: "No date", severity: "neutral" });
  });

  test("labels today and tomorrow distinctly", () => {
    expect(dueLabel(new Date())).toEqual({ text: "Due today", severity: "today" });
    expect(dueLabel(new Date(Date.now() + DAY_MS))).toEqual({
      text: "Due tomorrow",
      severity: "soon",
    });
  });

  test("labels overdue items with how far past they are", () => {
    expect(dueLabel(new Date(Date.now() - 3 * DAY_MS))).toEqual({
      text: "Overdue by 3d",
      severity: "overdue",
    });
  });

  test("day 7 is 'soon' and day 8 is 'later' — the severity boundary", () => {
    expect(dueLabel(new Date(Date.now() + 7 * DAY_MS)).severity).toBe("soon");
    expect(dueLabel(new Date(Date.now() + 8 * DAY_MS)).severity).toBe("later");
  });

  test("every severity is one of the four the UI styles", () => {
    const known = ["neutral", "overdue", "today", "soon", "later"];
    for (const offset of [-10, -1, 0, 1, 5, 7, 8, 100]) {
      const { severity } = dueLabel(new Date(Date.now() + offset * DAY_MS));
      expect(known).toContain(severity);
    }
  });

  test("invalid input degrades to the neutral label", () => {
    expect(dueLabel("not-a-date").severity).toBe("neutral");
  });
});

describe("planning/formatters — INTERVAL_LABELS", () => {
  test("covers exactly the three intervals the model allows", () => {
    expect(Object.keys(INTERVAL_LABELS).sort()).toEqual(["daily", "monthly", "weekly"]);
  });

  test("maps each to its display label", () => {
    expect(INTERVAL_LABELS.daily).toBe("Daily");
    expect(INTERVAL_LABELS.weekly).toBe("Weekly");
    expect(INTERVAL_LABELS.monthly).toBe("Monthly");
  });
});

describe("planning/formatters — errorMessage", () => {
  test("reads the server's { error } shape", () => {
    expect(errorMessage({ response: { data: { error: "Nope" } } })).toBe("Nope");
  });

  test("falls back for everything else", () => {
    const fallback = "Something went wrong. Try again.";
    for (const bad of [null, undefined, {}, new Error("x"), { response: { data: {} } }]) {
      expect(errorMessage(bad)).toBe(fallback);
    }
  });
});
