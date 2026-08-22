import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../api/finance", () => ({
  getCategories: vi.fn(() => Promise.resolve([])),
  createCategory: vi.fn(() => Promise.resolve({})),
  updateCategory: vi.fn(() => Promise.resolve({})),
  deleteCategory: vi.fn(() => Promise.resolve()),
  getTransactions: vi.fn(() => Promise.resolve([])),
  createTransaction: vi.fn(() => Promise.resolve({})),
  updateTransaction: vi.fn(() => Promise.resolve({})),
  deleteTransaction: vi.fn(() => Promise.resolve()),
  getBudgets: vi.fn(() => Promise.resolve([])),
  createBudget: vi.fn(() => Promise.resolve({})),
  deleteBudget: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../components/layout/NotificationBell", () => ({
  default: () => <div>NOTIFICATION BELL</div>,
}));
vi.mock("../../components/layout/PushOptInStrip", () => ({ default: () => null }));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: { name: "Ada Lovelace", email: "ada@test.local" },
    logout: vi.fn(),
  }),
}));

const finance = await import("../../api/finance");
const TransactionsPage = (await import("./TransactionsPage")).default;
const CategoriesPage = (await import("./CategoriesPage")).default;
const BudgetsPage = (await import("./BudgetsPage")).default;

const categories = [
  { _id: "c1", name: "Food", type: "expense", icon: "", color: "#111" },
  { _id: "c2", name: "Salary", type: "income", icon: "", color: "#222" },
];

const transactions = [
  {
    _id: "t1",
    amount: 42.5,
    type: "expense",
    categoryId: "c1",
    date: "2026-08-15T00:00:00.000Z",
    note: "Lunch",
  },
  {
    _id: "t2",
    amount: 2800,
    type: "income",
    categoryId: "c2",
    date: "2026-08-01T00:00:00.000Z",
    note: "",
  },
];

const renderPage = (Page) => render(<MemoryRouter><Page /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  finance.getCategories.mockResolvedValue(categories);
  finance.getTransactions.mockResolvedValue([]);
  finance.getBudgets.mockResolvedValue([]);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("TransactionsPage", () => {
  test("renders inside the app shell with its title", async () => {
    renderPage(TransactionsPage);

    expect(
      await screen.findByRole("heading", { name: "Transactions" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Every income and expense you've recorded.")).toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  test("shows a skeleton first, then the rows", async () => {
    finance.getTransactions.mockResolvedValue(transactions);
    const { container } = renderPage(TransactionsPage);

    expect(container.querySelector(".animate-pulse")).toBeTruthy();

    expect(await screen.findByText("Lunch")).toBeInTheDocument();
    expect(screen.getByText(/\$42\.50/)).toBeInTheDocument();
  });

  test("shows the empty state when there are no transactions", async () => {
    renderPage(TransactionsPage);

    expect(await screen.findByText("No transactions yet")).toBeInTheDocument();
    expect(screen.getByText("Add one, or clear your filters.")).toBeInTheDocument();
  });

  test("shows the error state when the list request fails", async () => {
    finance.getTransactions.mockRejectedValue({
      response: { data: { error: "Server error" } },
    });

    renderPage(TransactionsPage);

    expect(await screen.findByText("Couldn't load transactions")).toBeInTheDocument();
    expect(screen.getByText("Server error")).toBeInTheDocument();
  });

  test("loads transactions and categories on mount", async () => {
    renderPage(TransactionsPage);

    await waitFor(() => expect(finance.getTransactions).toHaveBeenCalled());
    expect(finance.getCategories).toHaveBeenCalled();
  });

  test("changing a filter re-queries with the new filter", async () => {
    renderPage(TransactionsPage);
    await waitFor(() => expect(finance.getTransactions).toHaveBeenCalledTimes(1));

    await userEvent.selectOptions(await screen.findByLabelText("Category"), "c1");

    await waitFor(() => expect(finance.getTransactions).toHaveBeenCalledTimes(2));
    expect(finance.getTransactions.mock.calls[1][0]).toMatchObject({ category: "c1" });
  });

  test("the type toggle re-queries", async () => {
    renderPage(TransactionsPage);
    await waitFor(() => expect(finance.getTransactions).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole("button", { name: "Income" }));

    await waitFor(() =>
      expect(finance.getTransactions.mock.calls.at(-1)[0]).toMatchObject({ type: "income" }),
    );
  });

  test("Clear resets the filters and re-queries with none", async () => {
    renderPage(TransactionsPage);
    await waitFor(() => expect(finance.getTransactions).toHaveBeenCalled());

    await userEvent.selectOptions(await screen.findByLabelText("Category"), "c1");
    await waitFor(() => expect(finance.getTransactions).toHaveBeenCalledTimes(2));

    await userEvent.click(screen.getByRole("button", { name: "Clear" }));

    await waitFor(() =>
      expect(finance.getTransactions.mock.calls.at(-1)[0]).toEqual({
        category: "",
        type: "",
        from: "",
        to: "",
      }),
    );
  });

  test("Add transaction opens the dialog in add mode", async () => {
    renderPage(TransactionsPage);

    await userEvent.click(await screen.findByRole("button", { name: /Add transaction/ }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Add transaction", { selector: "h3" })).toBeInTheDocument();
  });

  test("saving from the dialog refreshes the list", async () => {
    finance.getTransactions.mockResolvedValue(transactions);
    renderPage(TransactionsPage);
    await waitFor(() => expect(finance.getTransactions).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole("button", { name: /Add transaction/ }));
    await userEvent.type(await screen.findByLabelText("Amount"), "15");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(finance.createTransaction).toHaveBeenCalled());
    await waitFor(() => expect(finance.getTransactions).toHaveBeenCalledTimes(2));
  });

  test("Edit opens the dialog prefilled from that row", async () => {
    finance.getTransactions.mockResolvedValue(transactions);
    renderPage(TransactionsPage);
    await screen.findByText("Lunch");

    await userEvent.click(screen.getAllByRole("button", { name: "Edit transaction" })[0]);

    expect(await screen.findByLabelText("Amount")).toHaveValue(42.5);
    expect(screen.getByLabelText("Note")).toHaveValue("Lunch");
  });

  test("Delete confirms, calls the API and refreshes", async () => {
    finance.getTransactions.mockResolvedValue(transactions);
    renderPage(TransactionsPage);
    await screen.findByText("Lunch");

    await userEvent.click(screen.getAllByRole("button", { name: "Delete transaction" })[0]);

    expect(window.confirm).toHaveBeenCalledWith("Delete this transaction?");
    await waitFor(() => expect(finance.deleteTransaction).toHaveBeenCalledWith("t1"));
    await waitFor(() => expect(finance.getTransactions).toHaveBeenCalledTimes(2));
  });

  test("declining the confirm does not delete", async () => {
    window.confirm.mockReturnValue(false);
    finance.getTransactions.mockResolvedValue(transactions);
    renderPage(TransactionsPage);
    await screen.findByText("Lunch");

    await userEvent.click(screen.getAllByRole("button", { name: "Delete transaction" })[0]);

    expect(finance.deleteTransaction).not.toHaveBeenCalled();
  });

  test("a failed delete surfaces the server message and keeps the row", async () => {
    finance.getTransactions.mockResolvedValue(transactions);
    finance.deleteTransaction.mockRejectedValue({
      response: { data: { error: "Transaction not found" } },
    });

    renderPage(TransactionsPage);
    await screen.findByText("Lunch");

    await userEvent.click(screen.getAllByRole("button", { name: "Delete transaction" })[0]);

    expect(await screen.findByText("Transaction not found")).toBeInTheDocument();
    expect(screen.getByText("Lunch")).toBeInTheDocument();
  });

  test("survives the categories request failing — the list still renders", async () => {
    finance.getCategories.mockRejectedValue(new Error("nope"));
    finance.getTransactions.mockResolvedValue(transactions);

    renderPage(TransactionsPage);

    expect(await screen.findByText("Lunch")).toBeInTheDocument();
    expect(screen.getAllByText("Uncategorized").length).toBeGreaterThan(0);
  });
});

describe("CategoriesPage", () => {
  test("renders its title and the add form", async () => {
    renderPage(CategoriesPage);

    expect(
      await screen.findByRole("heading", { name: "Categories" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add/ })).toBeInTheDocument();
  });

  test("lists the loaded categories", async () => {
    renderPage(CategoriesPage);

    expect(await screen.findByText("Food")).toBeInTheDocument();
    expect(screen.getByText("Salary")).toBeInTheDocument();
  });

  test("shows the empty state when there are none", async () => {
    finance.getCategories.mockResolvedValue([]);
    renderPage(CategoriesPage);

    expect(await screen.findByText("No categories yet")).toBeInTheDocument();
  });

  test("shows the error state", async () => {
    finance.getCategories.mockRejectedValue({
      response: { data: { error: "Server error" } },
    });

    renderPage(CategoriesPage);

    expect(await screen.findByText("Couldn't load categories")).toBeInTheDocument();
  });

  test("adding posts the draft, clears the form and refreshes", async () => {
    renderPage(CategoriesPage);
    await screen.findByText("Food");

    await userEvent.type(screen.getByLabelText("Name"), "Groceries");
    await userEvent.click(screen.getByRole("button", { name: /Add/ }));

    await waitFor(() => expect(finance.createCategory).toHaveBeenCalled());
    expect(finance.createCategory.mock.calls[0][0]).toMatchObject({
      name: "Groceries",
      type: "expense",
    });
    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue(""));
    expect(finance.getCategories).toHaveBeenCalledTimes(2);
  });

  test("a failed add shows the server message and keeps the typed name", async () => {
    finance.createCategory.mockRejectedValue({
      response: { data: { error: "Name is required" } },
    });

    renderPage(CategoriesPage);
    await screen.findByText("Food");

    await userEvent.type(screen.getByLabelText("Name"), "X");
    await userEvent.click(screen.getByRole("button", { name: /Add/ }));

    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("X");
  });

  test("editing a row saves and refreshes", async () => {
    renderPage(CategoriesPage);
    await screen.findByText("Food");

    await userEvent.click(screen.getAllByRole("button", { name: "Edit category" })[0]);
    const nameInputs = screen.getAllByLabelText("Name");
    const rowInput = nameInputs[nameInputs.length - 1];
    await userEvent.clear(rowInput);
    await userEvent.type(rowInput, "Dining");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(finance.updateCategory).toHaveBeenCalled());
    expect(finance.updateCategory.mock.calls[0][0]).toBe("c1");
    expect(finance.updateCategory.mock.calls[0][1].name).toBe("Dining");
  });

  test("a failed edit keeps the row in edit mode and shows the message", async () => {
    finance.updateCategory.mockRejectedValue({
      response: { data: { error: "Name cannot be empty" } },
    });

    renderPage(CategoriesPage);
    await screen.findByText("Food");

    await userEvent.click(screen.getAllByRole("button", { name: "Edit category" })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Name cannot be empty")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  test("deleting warns about the cascade, then deletes and refreshes", async () => {
    renderPage(CategoriesPage);
    await screen.findByText("Food");

    await userEvent.click(screen.getAllByRole("button", { name: "Delete category" })[0]);

    expect(window.confirm).toHaveBeenCalledWith(
      'Delete "Food"? Its transactions become Uncategorized.',
    );
    await waitFor(() => expect(finance.deleteCategory).toHaveBeenCalledWith("c1"));
    expect(finance.getCategories).toHaveBeenCalledTimes(2);
  });

  test("declining the confirm does not delete", async () => {
    window.confirm.mockReturnValue(false);
    renderPage(CategoriesPage);
    await screen.findByText("Food");

    await userEvent.click(screen.getAllByRole("button", { name: "Delete category" })[0]);

    expect(finance.deleteCategory).not.toHaveBeenCalled();
  });
});

describe("BudgetsPage", () => {
  test("renders its title, month selector and form", async () => {
    renderPage(BudgetsPage);

    expect(await screen.findByRole("heading", { name: "Budgets" })).toBeInTheDocument();
    // MonthSelector's label wraps both an sr-only span and the visible month,
    // so target its controls rather than the composite label text.
    expect(screen.getByRole("button", { name: "Previous month" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next month" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Set budget/ })).toBeInTheDocument();
  });

  test("loads budgets for the current month", async () => {
    renderPage(BudgetsPage);

    await waitFor(() => expect(finance.getBudgets).toHaveBeenCalled());
    expect(finance.getBudgets.mock.calls[0][0]).toBe(new Date().toISOString().slice(0, 7));
  });

  test("shows the empty state", async () => {
    renderPage(BudgetsPage);

    expect(await screen.findByText("No budgets for this month")).toBeInTheDocument();
  });

  test("lists budgets with resolved names", async () => {
    finance.getBudgets.mockResolvedValue([
      { _id: "b1", categoryId: "c1", month: "2026-08", limit: 300 },
      { _id: "b2", categoryId: null, month: "2026-08", limit: 900 },
    ]);

    renderPage(BudgetsPage);

    // "Food" also appears as an <option> in the form, so assert on the row's
    // own content instead of the bare name.
    expect(await screen.findByText("$300.00")).toBeInTheDocument();
    expect(screen.getByText("$900.00")).toBeInTheDocument();
    expect(screen.getByText("Overall")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Delete budget" })).toHaveLength(2);
  });

  test("shows the error state", async () => {
    finance.getBudgets.mockRejectedValue({
      response: { data: { error: "Server error" } },
    });

    renderPage(BudgetsPage);

    expect(await screen.findByText("Couldn't load budgets")).toBeInTheDocument();
  });

  test("changing the month re-queries", async () => {
    renderPage(BudgetsPage);
    await waitFor(() => expect(finance.getBudgets).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));

    await waitFor(() => expect(finance.getBudgets).toHaveBeenCalledTimes(2));
    expect(finance.getBudgets.mock.calls[1][0]).not.toBe(finance.getBudgets.mock.calls[0][0]);
  });

  test("setting a budget posts the month with it and refreshes", async () => {
    renderPage(BudgetsPage);
    await waitFor(() => expect(finance.getBudgets).toHaveBeenCalled());

    await userEvent.type(screen.getByLabelText("Limit"), "300");
    await userEvent.click(screen.getByRole("button", { name: /Set budget/ }));

    await waitFor(() => expect(finance.createBudget).toHaveBeenCalled());
    expect(finance.createBudget.mock.calls[0][0]).toMatchObject({
      categoryId: null,
      limit: 300,
      month: new Date().toISOString().slice(0, 7),
    });
    expect(finance.getBudgets).toHaveBeenCalledTimes(2);
  });

  test("sends the selected category id when one is chosen", async () => {
    renderPage(BudgetsPage);
    await waitFor(() => expect(finance.getCategories).toHaveBeenCalled());

    await userEvent.selectOptions(await screen.findByLabelText("Category"), "c1");
    await userEvent.type(screen.getByLabelText("Limit"), "150");
    await userEvent.click(screen.getByRole("button", { name: /Set budget/ }));

    await waitFor(() =>
      expect(finance.createBudget.mock.calls[0][0].categoryId).toBe("c1"),
    );
  });

  test("blocks a negative limit before hitting the API", async () => {
    const { container } = renderPage(BudgetsPage);
    await waitFor(() => expect(finance.getBudgets).toHaveBeenCalled());

    const limit = screen.getByLabelText("Limit");
    limit.value = "-5";
    await userEvent.click(screen.getByRole("button", { name: /Set budget/ }));

    expect(finance.createBudget).not.toHaveBeenCalled();
  });

  test("a failed save shows the server message", async () => {
    finance.createBudget.mockRejectedValue({
      response: { data: { error: "Limit must be a number of 0 or more" } },
    });

    renderPage(BudgetsPage);
    await waitFor(() => expect(finance.getBudgets).toHaveBeenCalled());

    await userEvent.type(screen.getByLabelText("Limit"), "10");
    await userEvent.click(screen.getByRole("button", { name: /Set budget/ }));

    expect(
      await screen.findByText("Limit must be a number of 0 or more"),
    ).toBeInTheDocument();
  });

  test("deleting confirms, calls the API and refreshes", async () => {
    finance.getBudgets.mockResolvedValue([
      { _id: "b1", categoryId: "c1", month: "2026-08", limit: 300 },
    ]);

    renderPage(BudgetsPage);

    await userEvent.click(
      await screen.findByRole("button", { name: "Delete budget" }),
    );

    expect(window.confirm).toHaveBeenCalledWith("Remove this budget?");
    await waitFor(() => expect(finance.deleteBudget).toHaveBeenCalledWith("b1"));
  });

  test("declining the confirm does not delete", async () => {
    window.confirm.mockReturnValue(false);
    finance.getBudgets.mockResolvedValue([
      { _id: "b1", categoryId: "c1", month: "2026-08", limit: 300 },
    ]);

    renderPage(BudgetsPage);

    await userEvent.click(
      await screen.findByRole("button", { name: "Delete budget" }),
    );

    expect(finance.deleteBudget).not.toHaveBeenCalled();
  });
});
