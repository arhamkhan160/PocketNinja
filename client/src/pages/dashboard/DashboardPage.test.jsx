import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../api/analytics", () => ({
  getSummary: vi.fn(),
  getByCategory: vi.fn(),
  getTrend: vi.fn(),
  getBudgetStatus: vi.fn(),
}));

const analytics = await import("../../api/analytics");
const DashboardPage = (await import("./DashboardPage")).default;

const thisMonth = () => new Date().toISOString().slice(0, 7);

beforeEach(() => {
  vi.clearAllMocks();
  analytics.getSummary.mockResolvedValue({
    totalIncome: 2800,
    totalExpense: 1500,
    balance: 1300,
  });
  analytics.getByCategory.mockResolvedValue([]);
  analytics.getTrend.mockResolvedValue([]);
  analytics.getBudgetStatus.mockResolvedValue([]);
});

describe("DashboardPage", () => {
  test("renders every chart card", async () => {
    render(<DashboardPage />);

    expect(await screen.findByText("Spending by category")).toBeInTheDocument();
    expect(screen.getByText("Budget status")).toBeInTheDocument();
    expect(screen.getByText("Income vs. expense")).toBeInTheDocument();
    expect(screen.getByText("Spending trend")).toBeInTheDocument();
  });

  test("fetches all four endpoints for the current month on mount", async () => {
    render(<DashboardPage />);

    await waitFor(() => expect(analytics.getSummary).toHaveBeenCalledWith(thisMonth()));
    expect(analytics.getByCategory).toHaveBeenCalledWith(thisMonth(), "expense");
    expect(analytics.getBudgetStatus).toHaveBeenCalledWith(thisMonth());
    expect(analytics.getTrend).toHaveBeenCalled();
  });

  test("requests a six-month trend window ending this month", async () => {
    render(<DashboardPage />);

    await waitFor(() => expect(analytics.getTrend).toHaveBeenCalled());
    const [from, to] = analytics.getTrend.mock.calls[0];

    expect(to).toBe(thisMonth());
    expect(from).toMatch(/^\d{4}-\d{2}$/);
    expect(from < to).toBe(true);
  });

  test("renders the summary figures", async () => {
    render(<DashboardPage />);

    expect(await screen.findByText("$2,800.00")).toBeInTheDocument();
    expect(screen.getByText("$1,500.00")).toBeInTheDocument();
    expect(screen.getByText("$1,300.00")).toBeInTheDocument();
  });

  test("changing the month refetches every endpoint", async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(analytics.getSummary).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));

    await waitFor(() => expect(analytics.getSummary).toHaveBeenCalledTimes(2));
    expect(analytics.getByCategory).toHaveBeenCalledTimes(2);
    expect(analytics.getTrend).toHaveBeenCalledTimes(2);
    expect(analytics.getBudgetStatus).toHaveBeenCalledTimes(2);
  });

  test("one failing endpoint does not blank the others", async () => {
    // Each slice owns its own error state, so a broken pie chart must not take
    // the summary cards down with it.
    analytics.getByCategory.mockRejectedValue({
      response: { data: { error: "Aggregation failed" } },
    });

    render(<DashboardPage />);

    expect(await screen.findByText("Aggregation failed")).toBeInTheDocument();
    expect(screen.getByText("$2,800.00")).toBeInTheDocument();
  });

  test("shows the over-limit banner when a budget is blown", async () => {
    analytics.getBudgetStatus.mockResolvedValue([
      { categoryId: "c1", categoryName: "Food", limit: 300, spent: 400, overLimit: true },
    ]);

    render(<DashboardPage />);

    expect(await screen.findByText("Over budget")).toBeInTheDocument();
    expect(screen.getAllByText("Food").length).toBeGreaterThan(0);
  });

  test("hides the banner when nothing is over limit", async () => {
    analytics.getBudgetStatus.mockResolvedValue([
      { categoryId: "c1", categoryName: "Food", limit: 300, spent: 100, overLimit: false },
    ]);

    render(<DashboardPage />);

    await waitFor(() => expect(analytics.getBudgetStatus).toHaveBeenCalled());
    expect(screen.queryByText("Over budget")).not.toBeInTheDocument();
  });

  test("the banner can be dismissed", async () => {
    analytics.getBudgetStatus.mockResolvedValue([
      { categoryId: "c1", categoryName: "Food", limit: 300, spent: 400, overLimit: true },
    ]);

    render(<DashboardPage />);
    await screen.findByText("Over budget");

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByText("Over budget")).not.toBeInTheDocument();
  });

  test("a dismissed banner comes back when the month changes", async () => {
    analytics.getBudgetStatus.mockResolvedValue([
      { categoryId: "c1", categoryName: "Food", limit: 300, spent: 400, overLimit: true },
    ]);

    render(<DashboardPage />);
    await screen.findByText("Over budget");
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));

    expect(await screen.findByText("Over budget")).toBeInTheDocument();
  });

  test("counts several over-limit categories in the banner", async () => {
    analytics.getBudgetStatus.mockResolvedValue([
      { categoryId: "c1", categoryName: "Food", limit: 300, spent: 400, overLimit: true },
      { categoryId: "c2", categoryName: "Transport", limit: 100, spent: 150, overLimit: true },
      { categoryId: "c3", categoryName: "Rent", limit: 950, spent: 950, overLimit: false },
    ]);

    render(<DashboardPage />);

    expect(await screen.findByText("Over budget on 2 categories")).toBeInTheDocument();
  });

  test("renders empty states across the board for a user with no data", async () => {
    render(<DashboardPage />);

    await waitFor(() => expect(analytics.getSummary).toHaveBeenCalled());
    expect(screen.getAllByText("Nothing here yet").length).toBeGreaterThan(0);
    expect(screen.getByText("No budgets set for this month yet.")).toBeInTheDocument();
  });

  test("shows the month selector label", async () => {
    render(<DashboardPage />);

    await waitFor(() => expect(analytics.getSummary).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Next month" })).toBeInTheDocument();
  });
});
