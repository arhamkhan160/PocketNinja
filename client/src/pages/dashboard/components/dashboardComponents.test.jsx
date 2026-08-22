import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ChartCard from "./ChartCard";
import SummaryCards from "./SummaryCards";
import OverLimitBanner from "./OverLimitBanner";
import BudgetProgress from "./BudgetProgress";
import MonthSelector from "./MonthSelector";
import CategoryPieChart from "./CategoryPieChart";
import IncomeExpenseBarChart from "./IncomeExpenseBarChart";
import TrendLineChart from "./TrendLineChart";
import { STATUS_GOOD, STATUS_WARNING, STATUS_CRITICAL } from "../chartColors";

describe("ChartCard", () => {
  test("renders the title, subtitle and children when it has data", () => {
    render(
      <ChartCard title="Spending" subtitle="This month">
        <div>chart body</div>
      </ChartCard>,
    );

    expect(screen.getByText("Spending")).toBeInTheDocument();
    expect(screen.getByText("This month")).toBeInTheDocument();
    expect(screen.getByText("chart body")).toBeInTheDocument();
  });

  test("omits the subtitle when not given", () => {
    render(<ChartCard title="Spending">x</ChartCard>);
    expect(screen.getByText("Spending")).toBeInTheDocument();
  });

  test("shows a skeleton and hides the body while loading", () => {
    const { container } = render(
      <ChartCard title="t" isLoading>
        <div>chart body</div>
      </ChartCard>,
    );

    expect(container.querySelector(".animate-pulse")).toBeTruthy();
    expect(screen.queryByText("chart body")).not.toBeInTheDocument();
  });

  test("shows the error state instead of the body", () => {
    render(
      <ChartCard title="t" error="Server error">
        <div>chart body</div>
      </ChartCard>,
    );

    expect(screen.getByText("Couldn't load this chart")).toBeInTheDocument();
    expect(screen.getByText("Server error")).toBeInTheDocument();
    expect(screen.queryByText("chart body")).not.toBeInTheDocument();
  });

  test("shows the empty state with its message", () => {
    render(
      <ChartCard title="t" isEmpty emptyMessage="No expenses yet.">
        <div>chart body</div>
      </ChartCard>,
    );

    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
    expect(screen.getByText("No expenses yet.")).toBeInTheDocument();
  });

  test("loading takes precedence over error and empty", () => {
    render(
      <ChartCard title="t" isLoading error="boom" isEmpty emptyMessage="empty">
        <div>body</div>
      </ChartCard>,
    );

    expect(screen.queryByText("boom")).not.toBeInTheDocument();
    expect(screen.queryByText("empty")).not.toBeInTheDocument();
  });

  test("error takes precedence over empty", () => {
    render(
      <ChartCard title="t" error="boom" isEmpty emptyMessage="empty">
        <div>body</div>
      </ChartCard>,
    );

    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(screen.queryByText("empty")).not.toBeInTheDocument();
  });

  test("applies a custom height to the body area", () => {
    const { container } = render(
      <ChartCard title="t" height={420}>
        <div>body</div>
      </ChartCard>,
    );

    expect(container.querySelector('[style*="min-height"]')).toHaveStyle({
      minHeight: "420px",
    });
  });
});

describe("SummaryCards", () => {
  test("renders three skeleton tiles while loading", () => {
    const { container } = render(<SummaryCards isLoading summary={null} />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);
  });

  test("renders income, expense and balance", () => {
    render(
      <SummaryCards
        isLoading={false}
        summary={{ totalIncome: 2800, totalExpense: 1500, balance: 1300 }}
      />,
    );

    expect(screen.getByText("Income")).toBeInTheDocument();
    expect(screen.getByText("$2,800.00")).toBeInTheDocument();
    expect(screen.getByText("$1,500.00")).toBeInTheDocument();
    expect(screen.getByText("$1,300.00")).toBeInTheDocument();
  });

  test("falls back to zeros for a null summary rather than crashing", () => {
    render(<SummaryCards isLoading={false} summary={null} />);
    expect(screen.getAllByText("$0.00")).toHaveLength(3);
  });

  test("fills in missing fields with zero", () => {
    render(<SummaryCards isLoading={false} summary={{ totalIncome: 100 }} />);

    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(screen.getAllByText("$0.00")).toHaveLength(2);
  });

  test("colors a negative balance red", () => {
    render(
      <SummaryCards
        isLoading={false}
        summary={{ totalIncome: 100, totalExpense: 500, balance: -400 }}
      />,
    );

    expect(screen.getByText("-$400.00").className).toContain("#EF4444");
  });

  test("does not color a zero balance red — the boundary", () => {
    render(
      <SummaryCards isLoading={false} summary={{ totalIncome: 0, totalExpense: 0, balance: 0 }} />,
    );

    const tiles = screen.getAllByText("$0.00");
    expect(tiles[2].className).toContain("#1C1917");
  });
});

describe("OverLimitBanner", () => {
  test("renders nothing when there is nothing over limit", () => {
    const { container } = render(<OverLimitBanner overLimitRows={[]} onDismiss={() => {}} />);
    expect(container.firstChild).toBe(null);
  });

  test("renders nothing for null or undefined rows", () => {
    const { container } = render(<OverLimitBanner overLimitRows={null} />);
    expect(container.firstChild).toBe(null);
  });

  test("uses the singular headline for one category", () => {
    render(<OverLimitBanner overLimitRows={[{ categoryName: "Food" }]} />);

    expect(screen.getByText("Over budget")).toBeInTheDocument();
    expect(screen.getByText("Food")).toBeInTheDocument();
  });

  test("counts and lists several categories", () => {
    render(
      <OverLimitBanner
        overLimitRows={[{ categoryName: "Food" }, { categoryName: "Transport" }]}
      />,
    );

    expect(screen.getByText("Over budget on 2 categories")).toBeInTheDocument();
    expect(screen.getByText("Food, Transport")).toBeInTheDocument();
  });

  test("the dismiss button calls onDismiss", async () => {
    const onDismiss = vi.fn();
    render(<OverLimitBanner overLimitRows={[{ categoryName: "Food" }]} onDismiss={onDismiss} />);

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test("renders no dismiss button when onDismiss is absent", () => {
    render(<OverLimitBanner overLimitRows={[{ categoryName: "Food" }]} />);
    expect(screen.queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();
  });
});

describe("BudgetProgress", () => {
  const rows = [
    { categoryId: "c1", categoryName: "Food", limit: 300, spent: 100, overLimit: false },
  ];

  test("shows the empty state when there are no budgets", () => {
    render(<BudgetProgress isLoading={false} error={null} rows={[]} />);
    expect(screen.getByText("No budgets set for this month yet.")).toBeInTheDocument();
  });

  test("renders a meter with spent and limit", () => {
    render(<BudgetProgress isLoading={false} error={null} rows={rows} />);

    expect(screen.getByText("Food")).toBeInTheDocument();
    expect(screen.getByText(/\$100/)).toBeInTheDocument();
    expect(screen.getByText(/\$300/)).toBeInTheDocument();
  });

  test("labels a comfortable budget 'good'", () => {
    render(<BudgetProgress isLoading={false} error={null} rows={rows} />);
    expect(screen.getByText(/good/)).toBeInTheDocument();
  });

  test("labels 80% spent as 'warning' — the ramp boundary", () => {
    render(
      <BudgetProgress
        isLoading={false}
        error={null}
        rows={[{ ...rows[0], spent: 240 }]}
      />,
    );

    expect(screen.getByText(/warning/)).toBeInTheDocument();
  });

  test("labels a fully-spent budget 'critical'", () => {
    render(
      <BudgetProgress isLoading={false} error={null} rows={[{ ...rows[0], spent: 300 }]} />,
    );

    expect(screen.getByText(/critical/)).toBeInTheDocument();
  });

  test("shows a warning icon only when over limit", () => {
    const { unmount } = render(
      <BudgetProgress isLoading={false} error={null} rows={rows} />,
    );
    expect(screen.queryByLabelText("Over budget")).not.toBeInTheDocument();
    unmount();

    render(
      <BudgetProgress
        isLoading={false}
        error={null}
        rows={[{ ...rows[0], spent: 400, overLimit: true }]}
      />,
    );
    expect(screen.getByLabelText("Over budget")).toBeInTheDocument();
  });

  test("caps the bar width at 100% when overspent", () => {
    const { container } = render(
      <BudgetProgress
        isLoading={false}
        error={null}
        rows={[{ ...rows[0], spent: 900, overLimit: true }]}
      />,
    );

    const bar = container.querySelector('[style*="width"]');
    expect(bar).toHaveStyle({ width: "100%" });
  });

  test("treats a zero limit as good rather than dividing by zero", () => {
    const { container } = render(
      <BudgetProgress
        isLoading={false}
        error={null}
        rows={[{ categoryId: "c", categoryName: "X", limit: 0, spent: 0, overLimit: false }]}
      />,
    );

    const bar = container.querySelector('[style*="width"]');
    expect(bar).toHaveStyle({ width: "0%", backgroundColor: STATUS_GOOD });
  });

  test("uses distinct colors across the status ramp", () => {
    expect(new Set([STATUS_GOOD, STATUS_WARNING, STATUS_CRITICAL]).size).toBe(3);
  });

  test("renders the error state", () => {
    render(<BudgetProgress isLoading={false} error="Server error" rows={null} />);
    expect(screen.getByText("Server error")).toBeInTheDocument();
  });

  test("renders one meter per row", () => {
    render(
      <BudgetProgress
        isLoading={false}
        error={null}
        rows={[
          { categoryId: "c1", categoryName: "Food", limit: 100, spent: 10, overLimit: false },
          { categoryId: null, categoryName: "Overall", limit: 900, spent: 10, overLimit: false },
        ]}
      />,
    );

    expect(screen.getByText("Food")).toBeInTheDocument();
    expect(screen.getByText("Overall")).toBeInTheDocument();
  });
});

describe("MonthSelector", () => {
  test("renders the month as a readable label", () => {
    render(<MonthSelector month="2026-08" onChange={() => {}} />);
    expect(screen.getByText("August 2026")).toBeInTheDocument();
  });

  test("steps back a month", async () => {
    const onChange = vi.fn();
    render(<MonthSelector month="2026-08" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));

    expect(onChange).toHaveBeenCalledWith("2026-07");
  });

  test("steps forward a month", async () => {
    const onChange = vi.fn();
    render(<MonthSelector month="2026-08" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Next month" }));

    expect(onChange).toHaveBeenCalledWith("2026-09");
  });

  test("stepping back from January crosses the year boundary", async () => {
    const onChange = vi.fn();
    render(<MonthSelector month="2026-01" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));

    expect(onChange).toHaveBeenCalledWith("2025-12");
  });

  test("stepping forward from December crosses the year boundary", async () => {
    const onChange = vi.fn();
    render(<MonthSelector month="2026-12" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Next month" }));

    expect(onChange).toHaveBeenCalledWith("2027-01");
  });

  test("zero-pads single-digit months", async () => {
    const onChange = vi.fn();
    render(<MonthSelector month="2026-10" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Next month" }));

    expect(onChange).toHaveBeenCalledWith("2026-11");
  });

  test("the hidden month input reflects the current value", () => {
    const { container } = render(<MonthSelector month="2026-08" onChange={() => {}} />);
    expect(container.querySelector('input[type="month"]')).toHaveValue("2026-08");
  });
});

describe("CategoryPieChart", () => {
  const rows = [
    { categoryId: "c1", categoryName: "Food", total: 300 },
    { categoryId: "c2", categoryName: "Transport", total: 100 },
  ];

  test("shows the empty state when there are no rows", () => {
    render(<CategoryPieChart isLoading={false} error={null} rows={[]} month="2026-08" />);
    expect(screen.getByText(/No expenses recorded for this month/)).toBeInTheDocument();
  });

  test("shows the empty state for null rows", () => {
    render(<CategoryPieChart isLoading={false} error={null} rows={null} month="2026-08" />);
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });

  test("shows a skeleton while loading", () => {
    const { container } = render(
      <CategoryPieChart isLoading error={null} rows={null} month="2026-08" />,
    );
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  test("shows the error state", () => {
    render(
      <CategoryPieChart isLoading={false} error="Server error" rows={null} month="2026-08" />,
    );
    expect(screen.getByText("Couldn't load this chart")).toBeInTheDocument();
  });

  test("renders its title and a legend entry per category", async () => {
    render(<CategoryPieChart isLoading={false} error={null} rows={rows} month="2026-08" />);

    expect(screen.getByText("Spending by category")).toBeInTheDocument();
    expect(await screen.findByText("Food")).toBeInTheDocument();
    expect(screen.getByText("Transport")).toBeInTheDocument();
  });
});

describe("IncomeExpenseBarChart", () => {
  const rows = [
    { period: "2026-07", income: 2800, expense: 1500 },
    { period: "2026-08", income: 2800, expense: 1200 },
  ];

  test("renders its title", () => {
    render(<IncomeExpenseBarChart isLoading={false} error={null} rows={rows} />);
    expect(screen.getByText("Income vs. expense")).toBeInTheDocument();
  });

  test("treats all-zero rows as empty — a zero-filled scaffold is not data", () => {
    render(
      <IncomeExpenseBarChart
        isLoading={false}
        error={null}
        rows={[
          { period: "2026-07", income: 0, expense: 0 },
          { period: "2026-08", income: 0, expense: 0 },
        ]}
      />,
    );

    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });

  test("renders the chart when at least one month has a value", async () => {
    render(
      <IncomeExpenseBarChart
        isLoading={false}
        error={null}
        rows={[{ period: "2026-08", income: 0, expense: 5 }]}
      />,
    );

    expect(screen.queryByText("Nothing here yet")).not.toBeInTheDocument();
  });

  test("shows the empty state for null rows", () => {
    render(<IncomeExpenseBarChart isLoading={false} error={null} rows={null} />);
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });

  test("shows the error and loading states", () => {
    const { unmount, container } = render(
      <IncomeExpenseBarChart isLoading error={null} rows={null} />,
    );
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
    unmount();

    render(<IncomeExpenseBarChart isLoading={false} error="boom" rows={null} />);
    expect(screen.getByText("boom")).toBeInTheDocument();
  });
});

describe("TrendLineChart", () => {
  const rows = [
    { period: "2026-07", income: 2800, expense: 1500 },
    { period: "2026-08", income: 2800, expense: 1200 },
  ];

  test("renders its title", () => {
    render(<TrendLineChart isLoading={false} error={null} rows={rows} />);
    expect(screen.getByText("Spending trend")).toBeInTheDocument();
  });

  test("treats all-zero rows as empty", () => {
    render(
      <TrendLineChart
        isLoading={false}
        error={null}
        rows={[{ period: "2026-08", income: 0, expense: 0 }]}
      />,
    );

    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });

  test("shows the error and loading states", () => {
    const { unmount, container } = render(<TrendLineChart isLoading error={null} rows={null} />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
    unmount();

    render(<TrendLineChart isLoading={false} error="boom" rows={null} />);
    expect(screen.getByText("boom")).toBeInTheDocument();
  });
});
