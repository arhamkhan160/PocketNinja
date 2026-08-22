import { describe, test, expect } from "vitest";
import { upcomingReminders, REMINDER_WINDOW_DAYS } from "./reminders";

const DAY_MS = 24 * 60 * 60 * 1000;
const inDays = (n) => new Date(Date.now() + n * DAY_MS).toISOString();

const rule = (overrides = {}) => ({
  _id: "r1",
  template: { amount: 100, type: "expense", note: "Rent" },
  interval: "monthly",
  nextRun: inDays(2),
  active: true,
  ...overrides,
});

describe("lib/reminders", () => {
  test("the window matches the server's REMINDER_LEAD_DAYS story", () => {
    expect(REMINDER_WINDOW_DAYS).toBe(7);
  });

  test("returns an empty array for null, undefined and empty input", () => {
    expect(upcomingReminders(null)).toEqual([]);
    expect(upcomingReminders(undefined)).toEqual([]);
    expect(upcomingReminders([])).toEqual([]);
  });

  test("includes a rule due inside the window", () => {
    expect(upcomingReminders([rule()])).toHaveLength(1);
  });

  test("includes overdue rules", () => {
    expect(upcomingReminders([rule({ nextRun: inDays(-5) })])).toHaveLength(1);
  });

  test("includes day 7 and excludes day 8 — the boundary", () => {
    expect(upcomingReminders([rule({ nextRun: inDays(7) })])).toHaveLength(1);
    expect(upcomingReminders([rule({ nextRun: inDays(8) })])).toHaveLength(0);
  });

  test("excludes inactive rules however close they are", () => {
    expect(upcomingReminders([rule({ active: false, nextRun: inDays(1) })])).toHaveLength(0);
  });

  test("excludes rules with an unparseable or missing date", () => {
    expect(upcomingReminders([rule({ nextRun: "not-a-date" })])).toHaveLength(0);
    expect(upcomingReminders([rule({ nextRun: null })])).toHaveLength(0);
  });

  test("skips null entries instead of throwing", () => {
    expect(upcomingReminders([null, rule(), undefined])).toHaveLength(1);
  });

  test("sorts soonest first, overdue at the top", () => {
    const result = upcomingReminders([
      rule({ _id: "c", nextRun: inDays(5) }),
      rule({ _id: "a", nextRun: inDays(-2) }),
      rule({ _id: "b", nextRun: inDays(1) }),
    ]);

    expect(result.map((r) => r._id)).toEqual(["a", "b", "c"]);
  });

  test("does not mutate the array it was given", () => {
    const rules = [rule({ _id: "b", nextRun: inDays(5) }), rule({ _id: "a", nextRun: inDays(1) })];
    const order = rules.map((r) => r._id);

    upcomingReminders(rules);

    expect(rules.map((r) => r._id)).toEqual(order);
  });
});
