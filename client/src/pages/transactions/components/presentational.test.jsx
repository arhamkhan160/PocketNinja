import { describe, test, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AmountText from "./AmountText";
import TypeToggle from "./TypeToggle";
import TransactionRow from "./TransactionRow";
import TransactionTable from "./TransactionTable";
import BudgetRow from "./BudgetRow";
import BudgetList from "./BudgetList";
import CategoryList from "./CategoryList";

const txn = (overrides = {}) => ({
  _id: "t1",
  amount: 42.5,
  type: "expense",
  categoryId: "c1",
  date: "2026-08-15T00:00:00.000Z",
  note: "Lunch",
  ...overrides,
});

const categories = [
  { _id: "c1", name: "Food", type: "expense", icon: "F" },
  { _id: "c2", name: "Salary", type: "income", icon: "" },
];

const renderRow = (transaction, category, handlers = {}) =>
  render(
    <table>
      <tbody>
        <TransactionRow
          transaction={transaction}
          category={category}
          onEdit={handlers.onEdit || (() => {})}
          onDelete={handlers.onDelete || (() => {})}
        />
      </tbody>
    </table>,
  );

describe("AmountText", () => {
  test("prefixes income with + and expense with -", () => {
    const { unmount } = render(<AmountText amount={10} type="income" />);
    expect(screen.getByText(/\+/)).toBeInTheDocument();
    unmount();

    render(<AmountText amount={10} type="expense" />);
    expect(screen.getByText(/-/)).toBeInTheDocument();
  });

  test("colors income teal and expense coral", () => {
    const { container: income } = render(<AmountText amount={1} type="income" />);
    const { container: expense } = render(<AmountText amount={1} type="expense" />);

    expect(income.firstChild.className).toContain("#0D9488");
    expect(expense.firstChild.className).toContain("#EF4444");
  });

  test("formats the amount as currency", () => {
    render(<AmountText amount={1234.5} type="expense" />);
    expect(screen.getByText(/\$1,234\.50/)).toBeInTheDocument();
  });

  test("renders $0.00 for a junk amount rather than NaN", () => {
    render(<AmountText amount={undefined} type="expense" />);
    expect(screen.getByText(/\$0\.00/)).toBeInTheDocument();
  });

  test("merges an extra className", () => {
    const { container } = render(<AmountText amount={1} type="income" className="text-lg" />);
    expect(container.firstChild.className).toContain("text-lg");
  });
});

describe("TypeToggle", () => {
  test("renders Expense and Income by default", () => {
    render(<TypeToggle value="expense" onChange={() => {}} />);

    expect(screen.getByRole("button", { name: "Expense" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Income" })).toBeInTheDocument();
  });

  test("marks the active option with aria-pressed", () => {
    render(<TypeToggle value="income" onChange={() => {}} />);

    expect(screen.getByRole("button", { name: "Income" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Expense" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("calls onChange with the clicked option's value", async () => {
    const onChange = vi.fn();
    render(<TypeToggle value="expense" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Income" }));

    expect(onChange).toHaveBeenCalledWith("income");
  });

  test("clicking the already-active option still fires onChange", async () => {
    const onChange = vi.fn();
    render(<TypeToggle value="expense" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Expense" }));

    expect(onChange).toHaveBeenCalledWith("expense");
  });

  test("accepts custom options, including the filter bar's All", () => {
    const options = [
      { value: "", label: "All" },
      { value: "income", label: "Income" },
      { value: "expense", label: "Expense" },
    ];
    render(<TypeToggle value="" onChange={() => {}} options={options} />);

    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("every button is type=button so it cannot submit its form", () => {
    render(<TypeToggle value="expense" onChange={() => {}} />);

    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveAttribute("type", "button");
    }
  });

  test("exposes a group role", () => {
    render(<TypeToggle value="expense" onChange={() => {}} />);
    expect(screen.getByRole("group")).toBeInTheDocument();
  });
});

describe("TransactionRow", () => {
  test("renders the date, category, note and amount", () => {
    renderRow(txn(), categories[0]);

    expect(screen.getByText("Aug 15, 2026")).toBeInTheDocument();
    expect(screen.getByText(/Food/)).toBeInTheDocument();
    expect(screen.getByText("Lunch")).toBeInTheDocument();
    expect(screen.getByText(/\$42\.50/)).toBeInTheDocument();
  });

  test("prefixes the category with its icon when it has one", () => {
    renderRow(txn(), categories[0]);
    expect(screen.getByText("F Food")).toBeInTheDocument();
  });

  test("falls back to Uncategorized when the category is unknown", () => {
    renderRow(txn({ categoryId: null }), undefined);
    expect(screen.getByText("Uncategorized")).toBeInTheDocument();
  });

  test("shows a dash for an empty note", () => {
    renderRow(txn({ note: "" }), categories[0]);
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  test("edit and delete pass the whole transaction back", async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const transaction = txn();
    renderRow(transaction, categories[0], { onEdit, onDelete });

    await userEvent.click(screen.getByRole("button", { name: "Edit transaction" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete transaction" }));

    expect(onEdit).toHaveBeenCalledWith(transaction);
    expect(onDelete).toHaveBeenCalledWith(transaction);
  });

  test("action buttons carry accessible labels", () => {
    renderRow(txn(), categories[0]);

    expect(screen.getByRole("button", { name: "Edit transaction" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete transaction" })).toBeInTheDocument();
  });
});

describe("TransactionTable", () => {
  const renderTable = (transactions, handlers = {}) =>
    render(
      <TransactionTable
        transactions={transactions}
        categories={categories}
        onEdit={handlers.onEdit || (() => {})}
        onDelete={handlers.onDelete || (() => {})}
      />,
    );

  test("renders all five column headers", () => {
    renderTable([]);

    for (const header of ["Date", "Category", "Note", "Amount", "Actions"]) {
      expect(screen.getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
  });

  test("renders one row per transaction", () => {
    renderTable([txn({ _id: "a" }), txn({ _id: "b" }), txn({ _id: "c" })]);

    expect(screen.getAllByRole("row")).toHaveLength(4); // 3 + header
  });

  test("resolves category ids to names client-side", () => {
    renderTable([txn({ _id: "a", categoryId: "c2" })]);
    expect(screen.getByText("Salary")).toBeInTheDocument();
  });

  test("shows Uncategorized for an id with no matching category", () => {
    renderTable([txn({ _id: "a", categoryId: "missing" })]);
    expect(screen.getByText("Uncategorized")).toBeInTheDocument();
  });

  test("renders an empty tbody without crashing", () => {
    renderTable([]);
    expect(screen.getAllByRole("row")).toHaveLength(1);
  });

  test("right-aligns the Amount and Actions headers", () => {
    renderTable([]);
    expect(screen.getByRole("columnheader", { name: "Amount" }).className).toContain(
      "text-right",
    );
    expect(screen.getByRole("columnheader", { name: "Date" }).className).not.toContain(
      "text-right",
    );
  });

  test("survives an empty categories list", () => {
    render(
      <TransactionTable
        transactions={[txn()]}
        categories={[]}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );

    expect(screen.getByText("Uncategorized")).toBeInTheDocument();
  });
});

describe("BudgetRow", () => {
  test("renders the category name and formatted limit", () => {
    render(
      <BudgetRow budget={{ _id: "b1", limit: 300 }} categoryName="Food" onDelete={() => {}} />,
    );

    expect(screen.getByText("Food")).toBeInTheDocument();
    expect(screen.getByText("$300.00")).toBeInTheDocument();
  });

  test("delete passes the whole budget back", async () => {
    const onDelete = vi.fn();
    const budget = { _id: "b1", limit: 300 };
    render(<BudgetRow budget={budget} categoryName="Food" onDelete={onDelete} />);

    await userEvent.click(screen.getByRole("button", { name: "Delete budget" }));

    expect(onDelete).toHaveBeenCalledWith(budget);
  });

  test("renders a zero limit as $0.00", () => {
    render(<BudgetRow budget={{ _id: "b", limit: 0 }} categoryName="Food" onDelete={() => {}} />);
    expect(screen.getByText("$0.00")).toBeInTheDocument();
  });
});

describe("BudgetList", () => {
  const renderList = (props = {}) =>
    render(
      <BudgetList
        budgets={props.budgets || []}
        categories={categories}
        isLoading={props.isLoading || false}
        error={props.error || null}
        onDelete={props.onDelete || (() => {})}
      />,
    );

  test("shows the empty state when there are no budgets", () => {
    renderList();
    expect(screen.getByText("No budgets for this month")).toBeInTheDocument();
  });

  test("shows a skeleton while loading", () => {
    const { container } = renderList({ isLoading: true });
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  test("shows the error state", () => {
    renderList({ error: "Server error" });

    expect(screen.getByText("Couldn't load budgets")).toBeInTheDocument();
    expect(screen.getByText("Server error")).toBeInTheDocument();
  });

  test("resolves a category id to its name", () => {
    renderList({ budgets: [{ _id: "b1", categoryId: "c1", limit: 100 }] });
    expect(screen.getByText("Food")).toBeInTheDocument();
  });

  test("labels a null categoryId as the Overall budget", () => {
    renderList({ budgets: [{ _id: "b1", categoryId: null, limit: 900 }] });
    expect(screen.getByText("Overall")).toBeInTheDocument();
  });

  test("labels an unresolvable category id as Uncategorized", () => {
    renderList({ budgets: [{ _id: "b1", categoryId: "gone", limit: 50 }] });
    expect(screen.getByText("Uncategorized")).toBeInTheDocument();
  });

  test("renders one row per budget", () => {
    renderList({
      budgets: [
        { _id: "b1", categoryId: "c1", limit: 100 },
        { _id: "b2", categoryId: null, limit: 900 },
      ],
    });

    expect(screen.getAllByRole("button", { name: "Delete budget" })).toHaveLength(2);
  });
});

describe("CategoryList", () => {
  const renderList = (props = {}) =>
    render(
      <CategoryList
        categories={props.categories || []}
        isLoading={props.isLoading || false}
        error={props.error || null}
        onSave={props.onSave || (() => true)}
        onDelete={props.onDelete || (() => {})}
      />,
    );

  test("shows the empty state", () => {
    renderList();
    expect(screen.getByText("No categories yet")).toBeInTheDocument();
  });

  test("shows a skeleton while loading", () => {
    const { container } = renderList({ isLoading: true });
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  test("shows the error state", () => {
    renderList({ error: "Nope" });

    expect(screen.getByText("Couldn't load categories")).toBeInTheDocument();
    expect(screen.getByText("Nope")).toBeInTheDocument();
  });

  test("renders one row per category", () => {
    renderList({ categories });

    expect(screen.getAllByRole("button", { name: "Edit category" })).toHaveLength(2);
  });

  test("passes the category through to delete", async () => {
    const onDelete = vi.fn();
    renderList({ categories: [categories[0]], onDelete });

    await userEvent.click(screen.getByRole("button", { name: "Delete category" }));

    expect(onDelete).toHaveBeenCalledWith(categories[0]);
  });
});
