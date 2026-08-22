import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../api/planning", () => ({
  getRecurring: vi.fn(() => Promise.resolve([])),
  createRecurring: vi.fn(() => Promise.resolve({})),
  updateRecurring: vi.fn(() => Promise.resolve({})),
  deleteRecurring: vi.fn(() => Promise.resolve()),
  runRecurringNow: vi.fn(() =>
    Promise.resolve({ rulesProcessed: 0, transactionsCreated: 0 }),
  ),
  getGoals: vi.fn(() => Promise.resolve([])),
  createGoal: vi.fn(() => Promise.resolve({})),
  updateGoal: vi.fn(() => Promise.resolve({})),
  deleteGoal: vi.fn(() => Promise.resolve()),
  getCategoriesSafe: vi.fn(() => Promise.resolve([])),
}));

vi.mock("../../components/layout/NotificationBell", () => ({
  default: () => <div>NOTIFICATION BELL</div>,
}));
vi.mock("../../components/layout/PushOptInStrip", () => ({ default: () => null }));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ user: { name: "Ada", email: "a@b.c" }, logout: vi.fn() }),
}));

const planning = await import("../../api/planning");
const PlanningPage = (await import("./PlanningPage")).default;

const DAY_MS = 24 * 60 * 60 * 1000;
const inDays = (n) => new Date(Date.now() + n * DAY_MS).toISOString();

const aRule = {
  _id: "r1",
  template: { amount: 950, type: "expense", categoryId: null, note: "Rent" },
  interval: "monthly",
  nextRun: inDays(3),
  active: true,
};

const aGoal = { _id: "g1", title: "Laptop", target: 1200, saved: 300, deadline: null };

const renderPage = () =>
  render(
    <MemoryRouter>
      <PlanningPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  // Re-arm every mock here: the global afterEach calls restoreAllMocks, which
  // strips the implementations declared in the vi.mock factory above.
  planning.getRecurring.mockResolvedValue([]);
  planning.getGoals.mockResolvedValue([]);
  planning.getCategoriesSafe.mockResolvedValue([]);
  planning.createRecurring.mockResolvedValue({});
  planning.updateRecurring.mockResolvedValue({});
  planning.deleteRecurring.mockResolvedValue();
  planning.createGoal.mockResolvedValue({});
  planning.updateGoal.mockResolvedValue({});
  planning.deleteGoal.mockResolvedValue();
  planning.runRecurringNow.mockResolvedValue({
    rulesProcessed: 0,
    transactionsCreated: 0,
  });
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("PlanningPage", () => {
  test("renders inside the app shell with all three sections", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Planning" })).toBeInTheDocument();
    expect(screen.getByText("Recurring rules")).toBeInTheDocument();
    expect(screen.getByText("Upcoming reminders")).toBeInTheDocument();
    expect(screen.getByText("Savings goals")).toBeInTheDocument();
  });

  test("loads rules, goals and categories on mount", async () => {
    renderPage();

    await waitFor(() => expect(planning.getRecurring).toHaveBeenCalled());
    expect(planning.getGoals).toHaveBeenCalled();
    expect(planning.getCategoriesSafe).toHaveBeenCalled();
  });

  test("renders loaded rules and goals", async () => {
    planning.getRecurring.mockResolvedValue([aRule]);
    planning.getGoals.mockResolvedValue([aGoal]);

    renderPage();

    expect(await screen.findByText("Laptop")).toBeInTheDocument();
    expect(screen.getAllByText("Rent").length).toBeGreaterThan(0);
  });

  test("the reminders section is derived from the same rules — no extra request", async () => {
    planning.getRecurring.mockResolvedValue([aRule]);

    renderPage();

    expect(await screen.findByText("Due in 3 days")).toBeInTheDocument();
    expect(planning.getRecurring).toHaveBeenCalledTimes(1);
  });

  test("a failed rules request shows the error in both rule-driven sections", async () => {
    planning.getRecurring.mockRejectedValue({
      response: { data: { error: "Server error" } },
    });

    renderPage();

    await waitFor(() => expect(screen.getAllByText("Server error")).toHaveLength(2));
  });

  test("a failed goals request does not break the rules section", async () => {
    planning.getGoals.mockRejectedValue(new Error("boom"));
    planning.getRecurring.mockResolvedValue([aRule]);

    renderPage();

    expect(await screen.findByText("Something went wrong. Try again.")).toBeInTheDocument();
    expect(screen.getAllByText("Rent").length).toBeGreaterThan(0);
  });

  test("categories failing entirely leaves the page usable", async () => {
    planning.getCategoriesSafe.mockRejectedValue(new Error("boom"));

    renderPage();

    expect(await screen.findByRole("heading", { name: "Planning" })).toBeInTheDocument();
  });

  test("creating a rule posts it and reloads the list", async () => {
    renderPage();
    await waitFor(() => expect(planning.getRecurring).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole("button", { name: /New rule/ }));
    await userEvent.type(screen.getByLabelText("Amount"), "100");
    await userEvent.click(screen.getByRole("button", { name: "Add rule" }));

    await waitFor(() => expect(planning.createRecurring).toHaveBeenCalled());
    await waitFor(() => expect(planning.getRecurring).toHaveBeenCalledTimes(2));
  });

  test("a failed create surfaces the error in the rules section", async () => {
    planning.createRecurring.mockRejectedValue({
      response: { data: { error: "Interval must be daily, weekly or monthly" } },
    });

    renderPage();
    await waitFor(() => expect(planning.getRecurring).toHaveBeenCalled());

    await userEvent.click(screen.getByRole("button", { name: /New rule/ }));
    await userEvent.type(screen.getByLabelText("Amount"), "100");
    await userEvent.click(screen.getByRole("button", { name: "Add rule" }));

    // The rules error feeds both RecurringSection and RemindersSection.
    await waitFor(() =>
      expect(
        screen.getAllByText("Interval must be daily, weekly or monthly").length,
      ).toBeGreaterThan(0),
    );
  });

  test("deleting a rule confirms first, then deletes and reloads", async () => {
    planning.getRecurring.mockResolvedValue([aRule]);
    renderPage();
    await screen.findByRole("button", { name: "Delete rule" });

    await userEvent.click(screen.getByRole("button", { name: "Delete rule" }));

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(planning.deleteRecurring).toHaveBeenCalledWith("r1"));
    await waitFor(() => expect(planning.getRecurring).toHaveBeenCalledTimes(2));
  });

  test("declining the rule confirm does not delete", async () => {
    window.confirm.mockReturnValue(false);
    planning.getRecurring.mockResolvedValue([aRule]);
    renderPage();
    await screen.findByRole("button", { name: "Delete rule" });

    await userEvent.click(screen.getByRole("button", { name: "Delete rule" }));

    expect(planning.deleteRecurring).not.toHaveBeenCalled();
  });

  test("deleting a goal names it in the confirm prompt", async () => {
    planning.getGoals.mockResolvedValue([aGoal]);
    renderPage();
    await screen.findByRole("button", { name: "Delete goal" });

    await userEvent.click(screen.getByRole("button", { name: "Delete goal" }));

    expect(window.confirm).toHaveBeenCalledWith('Delete the goal "Laptop"?');
    await waitFor(() => expect(planning.deleteGoal).toHaveBeenCalledWith("g1"));
  });

  test("contributing to a goal updates the absolute saved total", async () => {
    planning.getGoals.mockResolvedValue([aGoal]);
    renderPage();
    await screen.findByLabelText("Contribute to Laptop");

    await userEvent.type(screen.getByLabelText("Contribute to Laptop"), "100");
    await userEvent.click(screen.getByRole("button", { name: "Contribute" }));

    await waitFor(() => expect(planning.updateGoal).toHaveBeenCalledWith("g1", { saved: 400 }));
  });

  test("Run due now reports how many transactions were created", async () => {
    planning.runRecurringNow.mockResolvedValue({
      rulesProcessed: 2,
      transactionsCreated: 3,
    });

    planning.getRecurring.mockResolvedValue([aRule]);
    renderPage();
    await waitFor(() => expect(planning.getRecurring).toHaveBeenCalled());

    await userEvent.click(screen.getByRole("button", { name: /Run due now/ }));

    expect(
      await screen.findByText("Created 3 transactions from 2 rules."),
    ).toBeInTheDocument();
  });

  test("Run due now uses singular wording for a single transaction", async () => {
    planning.runRecurringNow.mockResolvedValue({
      rulesProcessed: 1,
      transactionsCreated: 1,
    });

    planning.getRecurring.mockResolvedValue([aRule]);
    renderPage();
    await waitFor(() => expect(planning.getRecurring).toHaveBeenCalled());

    await userEvent.click(screen.getByRole("button", { name: /Run due now/ }));

    expect(await screen.findByText("Created 1 transaction from 1 rule.")).toBeInTheDocument();
  });

  test("Run due now reports when nothing was due", async () => {
    planning.getRecurring.mockResolvedValue([aRule]);
    renderPage();
    await waitFor(() => expect(planning.getRecurring).toHaveBeenCalled());

    await userEvent.click(screen.getByRole("button", { name: /Run due now/ }));

    expect(
      await screen.findByText("Nothing was due — no transactions created."),
    ).toBeInTheDocument();
  });

  test("Run due now reloads the rules so the new nextRun shows", async () => {
    planning.runRecurringNow.mockResolvedValue({
      rulesProcessed: 1,
      transactionsCreated: 1,
    });

    renderPage();
    await waitFor(() => expect(planning.getRecurring).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole("button", { name: /Run due now/ }));

    await waitFor(() => expect(planning.getRecurring).toHaveBeenCalledTimes(2));
  });

  test("the run result is invisible while the rules list is empty", async () => {
    // Known gap: SectionCard suppresses its children in the empty state, and
    // the run-now status message lives among them. A first-time user gets no
    // feedback from "Run due now" until they have at least one rule.
    renderPage();
    await waitFor(() => expect(planning.getRecurring).toHaveBeenCalled());

    await userEvent.click(screen.getByRole("button", { name: /Run due now/ }));

    await waitFor(() => expect(planning.runRecurringNow).toHaveBeenCalled());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  test("a failed run shows the error message", async () => {
    planning.runRecurringNow.mockRejectedValue({
      response: { data: { error: "Server error" } },
    });
    planning.getRecurring.mockResolvedValue([aRule]);

    renderPage();
    await waitFor(() => expect(planning.getRecurring).toHaveBeenCalled());

    await userEvent.click(screen.getByRole("button", { name: /Run due now/ }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Server error");
  });
});
