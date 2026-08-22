import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../../api/finance", () => ({
  createTransaction: vi.fn(() => Promise.resolve({})),
  updateTransaction: vi.fn(() => Promise.resolve({})),
}));

const { createTransaction, updateTransaction } = await import("../../../api/finance");
const TransactionFormDialog = (await import("./TransactionFormDialog")).default;
const TransactionFilterBar = await import("./TransactionFilterBar");
const CategoryForm = await import("./CategoryForm");
const CategoryRow = (await import("./CategoryRow")).default;
const BudgetForm = await import("./BudgetForm");

const categories = [
  { _id: "c1", name: "Food", type: "expense", icon: "F", color: "#111" },
  { _id: "c2", name: "Salary", type: "income", icon: "", color: "#222" },
  { _id: "c3", name: "Transport", type: "expense", icon: "", color: "" },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TransactionFormDialog — add mode", () => {
  const renderDialog = (props = {}) =>
    render(
      <TransactionFormDialog
        open
        transaction={null}
        categories={categories}
        onClose={props.onClose || (() => {})}
        onSaved={props.onSaved || (() => {})}
      />,
    );

  test("renders nothing when closed", () => {
    const { container } = render(
      <TransactionFormDialog
        open={false}
        transaction={null}
        categories={categories}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );

    expect(container.firstChild).toBe(null);
  });

  test("titles itself Add transaction", () => {
    renderDialog();
    expect(screen.getByText("Add transaction")).toBeInTheDocument();
  });

  test("defaults to the expense type and today's date", () => {
    renderDialog();

    expect(screen.getByRole("button", { name: "Expense" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Date")).toHaveValue(
      new Date().toISOString().slice(0, 10),
    );
  });

  test("only offers categories matching the selected type", async () => {
    renderDialog();

    // Expense selected: Food and Transport, plus Uncategorized. Not Salary.
    expect(screen.getByRole("option", { name: /Food/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Transport" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Salary" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Income" }));

    expect(screen.getByRole("option", { name: "Salary" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Food/ })).not.toBeInTheDocument();
  });

  test("switching type clears a category that no longer applies", async () => {
    renderDialog();

    await userEvent.selectOptions(screen.getByLabelText("Category"), "c1");
    expect(screen.getByLabelText("Category")).toHaveValue("c1");

    await userEvent.click(screen.getByRole("button", { name: "Income" }));

    expect(screen.getByLabelText("Category")).toHaveValue("");
  });

  test("submits the typed values and calls onSaved then onClose", async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();
    renderDialog({ onSaved, onClose });

    await userEvent.type(screen.getByLabelText("Amount"), "42.5");
    await userEvent.selectOptions(screen.getByLabelText("Category"), "c1");
    await userEvent.type(screen.getByLabelText("Note"), "Lunch");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createTransaction).toHaveBeenCalled());
    expect(createTransaction.mock.calls[0][0]).toMatchObject({
      amount: 42.5,
      type: "expense",
      categoryId: "c1",
      note: "Lunch",
    });
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  test("sends a null categoryId when left as Uncategorized", async () => {
    renderDialog();

    await userEvent.type(screen.getByLabelText("Amount"), "10");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createTransaction).toHaveBeenCalled());
    expect(createTransaction.mock.calls[0][0].categoryId).toBe(null);
  });

  test("native validation blocks a zero amount before any request is made", async () => {
    // The input carries min=0.01 and required, so the browser refuses to submit.
    renderDialog();

    await userEvent.type(screen.getByLabelText("Amount"), "0");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(createTransaction).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Amount")).toHaveAttribute("min", "0.01");
    expect(screen.getByLabelText("Amount")).toBeRequired();
  });

  test("the JS guard catches a bad amount that bypasses native validation", async () => {
    // Submitting the form directly skips constraint validation, which is what a
    // scripted submit or a browser with validation disabled would do.
    const { container } = renderDialog();

    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "0" } });
    fireEvent.submit(container.querySelector("form"));

    expect(
      await screen.findByText("Amount must be a number greater than 0"),
    ).toBeInTheDocument();
    expect(createTransaction).not.toHaveBeenCalled();
  });

  test("the JS guard also rejects a negative and a non-numeric amount", async () => {
    const { container } = renderDialog();
    const amount = screen.getByLabelText("Amount");

    fireEvent.change(amount, { target: { value: "-5" } });
    fireEvent.submit(container.querySelector("form"));
    expect(
      await screen.findByText("Amount must be a number greater than 0"),
    ).toBeInTheDocument();

    fireEvent.change(amount, { target: { value: "" } });
    fireEvent.submit(container.querySelector("form"));
    expect(
      await screen.findByText("Amount must be a number greater than 0"),
    ).toBeInTheDocument();

    expect(createTransaction).not.toHaveBeenCalled();
  });

  test("surfaces the server's error message and keeps the dialog open", async () => {
    createTransaction.mockRejectedValueOnce({
      response: { data: { error: "Category not found" } },
    });
    const onClose = vi.fn();
    renderDialog({ onClose });

    await userEvent.type(screen.getByLabelText("Amount"), "10");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Category not found")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  test("falls back to a generic message on a network failure", async () => {
    createTransaction.mockRejectedValueOnce(new Error("Network Error"));
    renderDialog();

    await userEvent.type(screen.getByLabelText("Amount"), "10");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Something went wrong. Try again.")).toBeInTheDocument();
  });

  test("Cancel closes without saving", async () => {
    const onClose = vi.fn();
    renderDialog({ onClose });

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(createTransaction).not.toHaveBeenCalled();
  });

  test("disables Save while the request is in flight", async () => {
    let resolve;
    createTransaction.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    renderDialog();

    await userEvent.type(screen.getByLabelText("Amount"), "10");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("button", { name: "Saving..." })).toBeDisabled();
    resolve({});
  });
});

describe("TransactionFormDialog — edit mode", () => {
  const existing = {
    _id: "t1",
    amount: 99.5,
    type: "income",
    categoryId: "c2",
    date: "2026-03-09T00:00:00.000Z",
    note: "Bonus",
  };

  const renderDialog = (props = {}) =>
    render(
      <TransactionFormDialog
        open
        transaction={existing}
        categories={categories}
        onClose={props.onClose || (() => {})}
        onSaved={props.onSaved || (() => {})}
      />,
    );

  test("prefills every field from the transaction", () => {
    renderDialog();

    expect(screen.getByLabelText("Amount")).toHaveValue(99.5);
    expect(screen.getByLabelText("Note")).toHaveValue("Bonus");
    expect(screen.getByLabelText("Date")).toHaveValue("2026-03-09");
    expect(screen.getByLabelText("Category")).toHaveValue("c2");
    expect(screen.getByRole("button", { name: "Income" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("titles itself Edit transaction", () => {
    renderDialog();
    expect(screen.getByText("Edit transaction")).toBeInTheDocument();
  });

  test("calls updateTransaction with the id, not createTransaction", async () => {
    renderDialog();

    await userEvent.clear(screen.getByLabelText("Amount"));
    await userEvent.type(screen.getByLabelText("Amount"), "150");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateTransaction).toHaveBeenCalled());
    expect(updateTransaction.mock.calls[0][0]).toBe("t1");
    expect(updateTransaction.mock.calls[0][1].amount).toBe(150);
    expect(createTransaction).not.toHaveBeenCalled();
  });

  test("re-prefills when the dialog is reopened for a different transaction", () => {
    const { rerender } = renderDialog();

    rerender(
      <TransactionFormDialog
        open
        transaction={{ ...existing, _id: "t2", amount: 5, note: "Other" }}
        categories={categories}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );

    expect(screen.getByLabelText("Amount")).toHaveValue(5);
    expect(screen.getByLabelText("Note")).toHaveValue("Other");
  });
});

describe("TransactionFilterBar", () => {
  const FilterBar = TransactionFilterBar.default;
  const { EMPTY_FILTERS } = TransactionFilterBar;

  const renderBar = (filters = EMPTY_FILTERS, onChange = () => {}) =>
    render(
      <FilterBar filters={filters} onChange={onChange} categories={categories} />,
    );

  test("EMPTY_FILTERS has every key blank", () => {
    expect(EMPTY_FILTERS).toEqual({ category: "", type: "", from: "", to: "" });
  });

  test("lists every category plus an All option", () => {
    renderBar();

    expect(screen.getByRole("option", { name: "All categories" })).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(categories.length + 1);
  });

  test("does not filter the category dropdown by type", () => {
    // Unlike the form, the filter bar offers income and expense categories.
    renderBar();
    expect(screen.getByRole("option", { name: "Salary" })).toBeInTheDocument();
  });

  test("changing the category calls onChange with the merged filters", async () => {
    const onChange = vi.fn();
    renderBar(EMPTY_FILTERS, onChange);

    await userEvent.selectOptions(screen.getByLabelText("Category"), "c1");

    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, category: "c1" });
  });

  test("the type toggle merges into the filters", async () => {
    const onChange = vi.fn();
    renderBar(EMPTY_FILTERS, onChange);

    await userEvent.click(screen.getByRole("button", { name: "Income" }));

    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, type: "income" });
  });

  test("From and To are native date inputs", () => {
    renderBar();

    expect(screen.getByLabelText("From")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("To")).toHaveAttribute("type", "date");
  });

  test("Clear resets every filter at once", async () => {
    const onChange = vi.fn();
    renderBar({ category: "c1", type: "income", from: "2026-01-01", to: "2026-12-31" }, onChange);

    await userEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(onChange).toHaveBeenCalledWith(EMPTY_FILTERS);
  });

  test("reflects the filters it is given", () => {
    renderBar({ category: "c1", type: "expense", from: "2026-01-01", to: "2026-12-31" });

    expect(screen.getByLabelText("Category")).toHaveValue("c1");
    expect(screen.getByLabelText("From")).toHaveValue("2026-01-01");
    expect(screen.getByLabelText("To")).toHaveValue("2026-12-31");
  });

  test("survives an empty categories list", () => {
    render(<FilterBar filters={EMPTY_FILTERS} onChange={() => {}} categories={[]} />);
    expect(screen.getByRole("option", { name: "All categories" })).toBeInTheDocument();
  });
});

describe("CategoryForm", () => {
  const Form = CategoryForm.default;
  const { EMPTY_CATEGORY } = CategoryForm;

  test("EMPTY_CATEGORY defaults to an expense with the brand color", () => {
    expect(EMPTY_CATEGORY).toEqual({
      name: "",
      type: "expense",
      icon: "",
      color: "#0D9488",
    });
  });

  test("renders all four fields", () => {
    render(<Form value={EMPTY_CATEGORY} onChange={() => {}} onSubmit={() => {}} />);

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Type")).toBeInTheDocument();
    expect(screen.getByLabelText("Icon")).toBeInTheDocument();
    expect(screen.getByLabelText("Color")).toBeInTheDocument();
  });

  test("typing the name calls onChange with the merged value", async () => {
    const onChange = vi.fn();
    render(<Form value={EMPTY_CATEGORY} onChange={onChange} onSubmit={() => {}} />);

    await userEvent.type(screen.getByLabelText("Name"), "F");

    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_CATEGORY, name: "F" });
  });

  test("caps the icon at two characters", () => {
    render(<Form value={EMPTY_CATEGORY} onChange={() => {}} onSubmit={() => {}} />);
    expect(screen.getByLabelText("Icon")).toHaveAttribute("maxLength", "2");
  });

  test("the name is required", () => {
    render(<Form value={EMPTY_CATEGORY} onChange={() => {}} onSubmit={() => {}} />);
    expect(screen.getByLabelText("Name")).toBeRequired();
  });

  test("submitting fires onSubmit", async () => {
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(
      <Form
        value={{ ...EMPTY_CATEGORY, name: "Food" }}
        onChange={() => {}}
        onSubmit={onSubmit}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(onSubmit).toHaveBeenCalled();
  });

  test("uses a custom submit label and shows Cancel only when onCancel is given", () => {
    const { unmount } = render(
      <Form value={EMPTY_CATEGORY} onChange={() => {}} onSubmit={() => {}} />,
    );
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    unmount();

    render(
      <Form
        value={EMPTY_CATEGORY}
        onChange={() => {}}
        onSubmit={() => {}}
        onCancel={() => {}}
        submitLabel="Save"
      />,
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  test("Cancel fires onCancel", async () => {
    const onCancel = vi.fn();
    render(
      <Form
        value={EMPTY_CATEGORY}
        onChange={() => {}}
        onSubmit={() => {}}
        onCancel={onCancel}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalled();
  });
});

describe("CategoryRow", () => {
  const category = categories[0];

  test("shows the name, icon and type badge in display mode", () => {
    render(<CategoryRow category={category} onSave={() => {}} onDelete={() => {}} />);

    expect(screen.getByText("F Food")).toBeInTheDocument();
    expect(screen.getByText("expense")).toBeInTheDocument();
  });

  test("clicking Edit swaps the row for the form, prefilled", async () => {
    render(<CategoryRow category={category} onSave={() => {}} onDelete={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "Edit category" }));

    expect(screen.getByLabelText("Name")).toHaveValue("Food");
    expect(screen.getByLabelText("Type")).toHaveValue("expense");
  });

  test("saving calls onSave with the id and the edited draft", async () => {
    const onSave = vi.fn(() => Promise.resolve(true));
    render(<CategoryRow category={category} onSave={onSave} onDelete={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "Edit category" }));
    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "Groceries");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]).toBe("c1");
    expect(onSave.mock.calls[0][1].name).toBe("Groceries");
  });

  test("leaves edit mode only when onSave resolves true", async () => {
    const onSave = vi.fn(() => Promise.resolve(true));
    render(<CategoryRow category={category} onSave={onSave} onDelete={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "Edit category" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit category" })).toBeInTheDocument(),
    );
  });

  test("stays in edit mode when onSave resolves false, so input is not lost", async () => {
    const onSave = vi.fn(() => Promise.resolve(false));
    render(<CategoryRow category={category} onSave={onSave} onDelete={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "Edit category" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  test("Cancel discards the edit and restores the display row", async () => {
    render(<CategoryRow category={category} onSave={() => {}} onDelete={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "Edit category" }));
    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "Discarded");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("F Food")).toBeInTheDocument();
  });

  test("re-editing after a cancel starts from the original values again", async () => {
    render(<CategoryRow category={category} onSave={() => {}} onDelete={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "Edit category" }));
    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "Temp");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit category" }));

    expect(screen.getByLabelText("Name")).toHaveValue("Food");
  });

  test("falls back to the brand color when the category has none", async () => {
    render(<CategoryRow category={categories[2]} onSave={() => {}} onDelete={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "Edit category" }));

    expect(screen.getByLabelText("Color")).toHaveValue("#0d9488");
  });

  test("delete passes the category back", async () => {
    const onDelete = vi.fn();
    render(<CategoryRow category={category} onSave={() => {}} onDelete={onDelete} />);

    await userEvent.click(screen.getByRole("button", { name: "Delete category" }));

    expect(onDelete).toHaveBeenCalledWith(category);
  });
});

describe("BudgetForm", () => {
  const Form = BudgetForm.default;
  const { EMPTY_BUDGET } = BudgetForm;

  test("EMPTY_BUDGET starts blank", () => {
    expect(EMPTY_BUDGET).toEqual({ categoryId: "", limit: "" });
  });

  test("offers only expense categories, plus Overall", () => {
    render(
      <Form
        value={EMPTY_BUDGET}
        onChange={() => {}}
        onSubmit={() => {}}
        categories={categories}
      />,
    );

    expect(screen.getByRole("option", { name: /Overall/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Food" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Salary" })).not.toBeInTheDocument();
  });

  test("the limit input is numeric, required and non-negative", () => {
    render(
      <Form value={EMPTY_BUDGET} onChange={() => {}} onSubmit={() => {}} categories={[]} />,
    );

    const limit = screen.getByLabelText("Limit");
    expect(limit).toHaveAttribute("type", "number");
    expect(limit).toHaveAttribute("min", "0");
    expect(limit).toBeRequired();
  });

  test("changing a field calls onChange with the merged value", async () => {
    const onChange = vi.fn();
    render(
      <Form
        value={EMPTY_BUDGET}
        onChange={onChange}
        onSubmit={() => {}}
        categories={categories}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("Category"), "c1");

    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_BUDGET, categoryId: "c1" });
  });

  test("submitting fires onSubmit", async () => {
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(
      <Form
        value={{ categoryId: "", limit: "100" }}
        onChange={() => {}}
        onSubmit={onSubmit}
        categories={categories}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Set budget/ }));

    expect(onSubmit).toHaveBeenCalled();
  });
});
