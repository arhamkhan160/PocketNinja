import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("./axios", () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: "RESULT" })) },
}));

const api = (await import("./axios")).default;
const analytics = await import("./analytics");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("api/analytics", () => {
  test("getSummary passes the month through", async () => {
    await expect(analytics.getSummary("2026-08")).resolves.toBe("RESULT");
    expect(api.get).toHaveBeenCalledWith("/analytics/summary", {
      params: { month: "2026-08" },
    });
  });

  test("getByCategory defaults type to expense", async () => {
    await analytics.getByCategory("2026-08");
    expect(api.get).toHaveBeenCalledWith("/analytics/by-category", {
      params: { month: "2026-08", type: "expense" },
    });
  });

  test("getByCategory honours an explicit income type", async () => {
    await analytics.getByCategory("2026-08", "income");
    expect(api.get).toHaveBeenCalledWith("/analytics/by-category", {
      params: { month: "2026-08", type: "income" },
    });
  });

  test("getTrend sends the range and the month grouping", async () => {
    await analytics.getTrend("2026-03", "2026-08");
    expect(api.get).toHaveBeenCalledWith("/analytics/trend", {
      params: { from: "2026-03", to: "2026-08", groupBy: "month" },
    });
  });

  test("getBudgetStatus passes the month through", async () => {
    await analytics.getBudgetStatus("2026-08");
    expect(api.get).toHaveBeenCalledWith("/analytics/budget-status", {
      params: { month: "2026-08" },
    });
  });

  test("an undefined month is forwarded so the server applies its default", async () => {
    await analytics.getSummary(undefined);
    expect(api.get).toHaveBeenCalledWith("/analytics/summary", {
      params: { month: undefined },
    });
  });

  test("errors propagate to the caller", async () => {
    const boom = new Error("500");
    api.get.mockRejectedValueOnce(boom);

    await expect(analytics.getSummary("2026-08")).rejects.toBe(boom);
  });
});
