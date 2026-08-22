require("../helpers/env");
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { advance } = require("../../jobs/cron");

const utc = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const iso = (date) => date.toISOString().slice(0, 10);

describe("jobs/cron — advance()", () => {
  describe("daily", () => {
    test("adds one day", () => {
      assert.equal(iso(advance(utc(2026, 8, 15), "daily")), "2026-08-16");
    });

    test("rolls over a month boundary", () => {
      assert.equal(iso(advance(utc(2026, 8, 31), "daily")), "2026-09-01");
    });

    test("rolls over a year boundary", () => {
      assert.equal(iso(advance(utc(2026, 12, 31), "daily")), "2027-01-01");
    });

    test("handles the leap day", () => {
      assert.equal(iso(advance(utc(2028, 2, 28), "daily")), "2028-02-29");
      assert.equal(iso(advance(utc(2028, 2, 29), "daily")), "2028-03-01");
    });
  });

  describe("weekly", () => {
    test("adds seven days", () => {
      assert.equal(iso(advance(utc(2026, 8, 1), "weekly")), "2026-08-08");
    });

    test("crosses a month boundary correctly", () => {
      assert.equal(iso(advance(utc(2026, 8, 28), "weekly")), "2026-09-04");
    });

    test("preserves the weekday", () => {
      const start = utc(2026, 8, 15);
      assert.equal(advance(start, "weekly").getUTCDay(), start.getUTCDay());
    });
  });

  describe("monthly", () => {
    test("adds one month for a safe day-of-month", () => {
      assert.equal(iso(advance(utc(2026, 8, 15), "monthly")), "2026-09-15");
    });

    test("clamps Jan 31 to Feb 28, not Mar 3", () => {
      // The naive setUTCMonth(+1) bug: Jan 31 + 1 month overflows into March.
      assert.equal(iso(advance(utc(2026, 1, 31), "monthly", 31)), "2026-02-28");
    });

    test("clamps Jan 31 to Feb 29 in a leap year", () => {
      assert.equal(iso(advance(utc(2028, 1, 31), "monthly", 31)), "2028-02-29");
    });

    test("anchorDay un-sticks a clamped rule the following month", () => {
      // This is the whole reason anchorDay exists: Feb 28 + 1 month must go
      // back to the 31st (clamped to 31 in March), not stay on the 28th.
      assert.equal(iso(advance(utc(2026, 2, 28), "monthly", 31)), "2026-03-31");
    });

    test("without anchorDay the rule sticks to the clamped day", () => {
      // Documents the legacy behaviour for rules created before the field.
      assert.equal(iso(advance(utc(2026, 2, 28), "monthly")), "2026-03-28");
    });

    test("clamps day 31 into every 30-day month", () => {
      assert.equal(iso(advance(utc(2026, 3, 31), "monthly", 31)), "2026-04-30");
      assert.equal(iso(advance(utc(2026, 5, 31), "monthly", 31)), "2026-06-30");
      assert.equal(iso(advance(utc(2026, 8, 31), "monthly", 31)), "2026-09-30");
      assert.equal(iso(advance(utc(2026, 10, 31), "monthly", 31)), "2026-11-30");
    });

    test("day 30 clamps in February but is safe elsewhere", () => {
      assert.equal(iso(advance(utc(2026, 1, 30), "monthly", 30)), "2026-02-28");
      assert.equal(iso(advance(utc(2026, 4, 30), "monthly", 30)), "2026-05-30");
    });

    test("crosses the year boundary", () => {
      assert.equal(iso(advance(utc(2026, 12, 15), "monthly", 15)), "2027-01-15");
      assert.equal(iso(advance(utc(2026, 12, 31), "monthly", 31)), "2027-01-31");
    });

    test("day 1 never clamps", () => {
      assert.equal(iso(advance(utc(2026, 1, 1), "monthly", 1)), "2026-02-01");
    });

    test("twelve successive monthly advances from the 31st land back on the 31st", () => {
      // The drift regression, end to end: a year of ticks must not degrade
      // the anchor.
      let cursor = utc(2026, 1, 31);
      for (let i = 0; i < 12; i += 1) {
        cursor = advance(cursor, "monthly", 31);
      }
      assert.equal(iso(cursor), "2027-01-31");
    });
  });

  describe("purity and unknown intervals", () => {
    test("does not mutate the date it was given", () => {
      const original = utc(2026, 8, 15);
      const copy = new Date(original);
      advance(original, "monthly", 15);
      assert.equal(original.getTime(), copy.getTime());
    });

    test("preserves the time-of-day component", () => {
      const withTime = new Date(Date.UTC(2026, 7, 15, 13, 45, 30));
      const next = advance(withTime, "daily");
      assert.equal(next.getUTCHours(), 13);
      assert.equal(next.getUTCMinutes(), 45);
    });

    test("an unknown interval falls through to the monthly branch", () => {
      // Documents current behaviour: only daily/weekly short-circuit, and the
      // model's enum is what actually keeps bad intervals out of the database.
      assert.equal(iso(advance(utc(2026, 8, 15), "yearly", 15)), "2026-09-15");
    });
  });
});
