import { describe, test, expect } from "vitest";
import {
  formatCurrency,
  formatDate,
  toDateInput,
  currentMonth,
  errorMessage,
} from "./format";

describe("utils/format — formatCurrency", () => {
  test("formats a whole number with two decimals", () => {
    expect(formatCurrency(1200)).toBe("$1,200.00");
  });

  test("formats fractional amounts", () => {
    expect(formatCurrency(42.5)).toBe("$42.50");
    expect(formatCurrency(0.01)).toBe("$0.01");
  });

  test("accepts numeric strings", () => {
    expect(formatCurrency("99.9")).toBe("$99.90");
  });

  test("groups thousands", () => {
    expect(formatCurrency(1234567)).toBe("$1,234,567.00");
  });

  test("formats zero rather than an empty string", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  test("coerces null, undefined, NaN and junk to $0.00", () => {
    // Number(x) || 0 — the guard that stops "$NaN" reaching the UI.
    for (const bad of [null, undefined, NaN, "abc", {}]) {
      expect(formatCurrency(bad)).toBe("$0.00");
    }
  });

  test("renders negatives with a minus sign", () => {
    expect(formatCurrency(-50)).toBe("-$50.00");
  });

  test("rounds to two decimals", () => {
    expect(formatCurrency(1.005)).toBe("$1.01");
    expect(formatCurrency(1.994)).toBe("$1.99");
  });
});

describe("utils/format — formatDate", () => {
  test("formats an ISO date in UTC", () => {
    expect(formatDate("2026-08-15")).toBe("Aug 15, 2026");
  });

  test("does not shift the day across a timezone boundary", () => {
    // Without timeZone: 'UTC' a midnight date renders as the previous day in
    // any negative-offset timezone.
    expect(formatDate("2026-01-01T00:00:00.000Z")).toBe("Jan 1, 2026");
    expect(formatDate("2026-12-31T23:59:59.000Z")).toBe("Dec 31, 2026");
  });

  test("accepts a Date instance", () => {
    expect(formatDate(new Date("2026-03-09T12:00:00Z"))).toBe("Mar 9, 2026");
  });

  test("returns 'Invalid Date' for unparseable input", () => {
    // Documents the sharp edge: unlike the planning formatter, this one has no
    // guard, so callers must not hand it junk.
    expect(formatDate("not-a-date")).toBe("Invalid Date");
  });
});

describe("utils/format — toDateInput", () => {
  test("produces the yyyy-mm-dd shape <input type=date> needs", () => {
    expect(toDateInput("2026-08-15T10:30:00Z")).toBe("2026-08-15");
  });

  test("round-trips a plain ISO date", () => {
    expect(toDateInput("2026-08-15")).toBe("2026-08-15");
  });

  test("accepts a Date instance", () => {
    expect(toDateInput(new Date(Date.UTC(2026, 0, 5)))).toBe("2026-01-05");
  });

  test("zero-pads single-digit months and days", () => {
    expect(toDateInput(new Date(Date.UTC(2026, 0, 1)))).toBe("2026-01-01");
  });
});

describe("utils/format — currentMonth", () => {
  test("returns the current month as YYYY-MM", () => {
    expect(currentMonth()).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
  });

  test("agrees with the current UTC date", () => {
    expect(currentMonth()).toBe(new Date().toISOString().slice(0, 7));
  });
});

describe("utils/format — errorMessage", () => {
  test("reads the server's { error } shape", () => {
    const err = { response: { data: { error: "Amount must be greater than 0" } } };
    expect(errorMessage(err)).toBe("Amount must be greater than 0");
  });

  test("falls back for a network error with no response", () => {
    expect(errorMessage(new Error("Network Error"))).toBe(
      "Something went wrong. Try again.",
    );
  });

  test("falls back for null, undefined and partial shapes", () => {
    const fallback = "Something went wrong. Try again.";
    expect(errorMessage(null)).toBe(fallback);
    expect(errorMessage(undefined)).toBe(fallback);
    expect(errorMessage({})).toBe(fallback);
    expect(errorMessage({ response: {} })).toBe(fallback);
    expect(errorMessage({ response: { data: {} } })).toBe(fallback);
  });

  test("falls back when the server sends an empty error string", () => {
    expect(errorMessage({ response: { data: { error: "" } } })).toBe(
      "Something went wrong. Try again.",
    );
  });
});
