import { describe, test, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import RecurringForm from "./RecurringForm";
import RecurringSection from "./RecurringSection";

const DAY_MS = 24 * 60 * 60 * 1000;
const inDays = (n) => new Date(Date.now() + n * DAY_MS).toISOString();

const categories = [
  { _id: "c1", name: "Rent", type: "expense" },
  { _id: "c2", name: "Salary", type: "income" },
];

const rule = (overrides = {}) => ({
  _id: "r1",
  template: { amount: 950, type: "expense", categoryId: "c1", note: "Rent" },
  interval: "monthly",
  nextRun: inDays(5),
  active: true,
  ...overrides,
});

const submitForm = (container) =>
  container
    .querySelector("form")
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

describe("RecurringForm", () => {
  const renderForm = (props = {}) =>
    render(
      <RecurringForm
        rule={props.rule ?? null}
        categories={props.categories ?? categories}
        onSubmit={props.onSubmit || (() => {})}
        onCancel={props.onCancel || (() => {})}
        isSaving={props.isSaving || false}
      />,
    );

  test("starts with sensible defaults in create mode", () => {
    renderForm();

    expect(screen.getByLabelText("Amount")).toHaveValue(null);
    expect(screen.getByLabelText("Type")).toHaveValue("expense");
    expect(screen.getByLabelText("Repeats")).toHaveValue("monthly");
    expect(screen.getByLabelText("First run")).toHaveValue(
      new Date().toISOString().slice(0, 10),
    );
    expect(screen.getByRole("button", { name: "Add rule" })).toBeInTheDocument();
  });

  test("prefills from an existing rule and relabels the date field", () => {
    renderForm({ rule: rule({ nextRun: "2026-09-15T12:00:00.000Z" }) });

    expect(screen.getByLabelText("Amount")).toHaveValue(950);
    expect(screen.getByLabelText("Note")).toHaveValue("Rent");
    expect(screen.getByLabelText("Category")).toHaveValue("c1");
    expect(screen.getByLabelText("Next run")).toHaveValue("2026-09-15");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  test("only offers categories matching the chosen direction", async () => {
    renderForm();

    expect(screen.getByRole("option", { name: "Rent" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Salary" })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Type"), "income");

    expect(screen.getByRole("option", { name: "Salary" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Rent" })).not.toBeInTheDocument();
  });

  test("disables the category select and explains why when there are none", () => {
    renderForm({ categories: [] });

    expect(screen.getByLabelText("Category")).toBeDisabled();
    expect(screen.getByRole("option", { name: "No categories yet" })).toBeInTheDocument();
    expect(screen.getByText(/rules save uncategorized until then/)).toBeInTheDocument();
  });

  test("includes categories that carry no type at all", () => {
    renderForm({ categories: [{ _id: "c9", name: "Legacy" }] });

    expect(screen.getByRole("option", { name: "Legacy" })).toBeInTheDocument();
  });

  test("submits the nested template shape the API expects", async () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit });

    await userEvent.type(screen.getByLabelText("Amount"), "950");
    await userEvent.selectOptions(screen.getByLabelText("Category"), "c1");
    await userEvent.type(screen.getByLabelText("Note"), "  Rent  ");
    await userEvent.click(screen.getByRole("button", { name: "Add rule" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.template).toEqual({
      amount: 950,
      type: "expense",
      categoryId: "c1",
      note: "Rent",
    });
    expect(payload.interval).toBe("monthly");
  });

  test("sends nextRun at midday UTC so the date cannot shift a day", async () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit });

    await userEvent.type(screen.getByLabelText("Amount"), "10");
    await userEvent.clear(screen.getByLabelText("First run"));
    await userEvent.type(screen.getByLabelText("First run"), "2026-09-15");
    await userEvent.click(screen.getByRole("button", { name: "Add rule" }));

    expect(onSubmit.mock.calls[0][0].nextRun).toBe("2026-09-15T12:00:00.000Z");
  });

  test("sends a null categoryId when left uncategorized", async () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit });

    await userEvent.type(screen.getByLabelText("Amount"), "10");
    await userEvent.click(screen.getByRole("button", { name: "Add rule" }));

    expect(onSubmit.mock.calls[0][0].template.categoryId).toBe(null);
  });

  test("blocks a non-positive amount", async () => {
    const onSubmit = vi.fn();
    const { container } = renderForm({ onSubmit, rule: rule({ template: { amount: 0, type: "expense" } }) });

    submitForm(container);

    expect(
      await screen.findByText("Amount must be a number greater than 0."),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("blocks a missing run date", async () => {
    const onSubmit = vi.fn();
    const { container } = renderForm({ onSubmit });

    await userEvent.type(screen.getByLabelText("Amount"), "10");
    await userEvent.clear(screen.getByLabelText("First run"));
    submitForm(container);

    expect(await screen.findByText("Pick a first run date.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("offers exactly the three intervals the model allows", () => {
    renderForm();

    const options = Array.from(screen.getByLabelText("Repeats").options).map((o) => o.value);
    expect(options).toEqual(["daily", "weekly", "monthly"]);
  });

  test("Cancel fires onCancel without submitting", async () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn();
    renderForm({ onCancel, onSubmit });

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("isSaving disables and relabels the submit button", () => {
    renderForm({ isSaving: true });
    expect(screen.getByRole("button", { name: /Saving/ })).toBeDisabled();
  });
});

describe("RecurringSection", () => {
  const renderSection = (props = {}) =>
    render(
      <RecurringSection
        rules={props.rules || []}
        categories={props.categories || categories}
        isLoading={props.isLoading || false}
        error={props.error || null}
        isSaving={props.isSaving || false}
        onCreate={props.onCreate || (() => true)}
        onUpdate={props.onUpdate || (() => true)}
        onDelete={props.onDelete || (() => {})}
        onRunNow={props.onRunNow || (() => {})}
        runNowState={props.runNowState || { isRunning: false, message: null, isError: false }}
      />,
    );

  test("shows the empty state with no rules and no open form", () => {
    renderSection();

    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
    expect(screen.getByText(/Add a rule for a bill or paycheck/)).toBeInTheDocument();
  });

  test("New rule opens the form and replaces the empty state", async () => {
    renderSection();

    await userEvent.click(screen.getByRole("button", { name: /New rule/ }));

    expect(screen.getByLabelText("Amount")).toBeInTheDocument();
    expect(screen.queryByText("Nothing here yet")).not.toBeInTheDocument();
  });

  test("renders a row per rule with its interval, category and amount", () => {
    renderSection({ rules: [rule()] });

    expect(screen.getByText("Rent")).toBeInTheDocument();
    expect(screen.getByText(/Monthly/)).toBeInTheDocument();
    expect(screen.getByText(/Rent · next/)).toBeInTheDocument();
    expect(screen.getByText(/\$950/)).toBeInTheDocument();
  });

  test("labels an unresolvable category as Uncategorized", () => {
    renderSection({
      rules: [rule({ template: { amount: 10, type: "expense", categoryId: "gone", note: "X" } })],
    });

    expect(screen.getByText(/Uncategorized/)).toBeInTheDocument();
  });

  test("falls back to a generic name when the template has no note", () => {
    renderSection({ rules: [rule({ template: { amount: 10, type: "income" } })] });

    expect(screen.getByText("Recurring income")).toBeInTheDocument();
  });

  test("shows a Paused badge and a Resume control for an inactive rule", () => {
    renderSection({ rules: [rule({ active: false })] });

    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume rule" })).toBeInTheDocument();
  });

  test("an active rule offers a Pause control instead", () => {
    renderSection({ rules: [rule()] });

    expect(screen.getByRole("button", { name: "Pause rule" })).toBeInTheDocument();
    expect(screen.queryByText("Paused")).not.toBeInTheDocument();
  });

  test("toggling flips active through onUpdate", async () => {
    const onUpdate = vi.fn(() => Promise.resolve(true));
    renderSection({ rules: [rule()], onUpdate });

    await userEvent.click(screen.getByRole("button", { name: "Pause rule" }));

    expect(onUpdate).toHaveBeenCalledWith("r1", { active: false });
  });

  test("resuming a paused rule sets active back to true", async () => {
    const onUpdate = vi.fn(() => Promise.resolve(true));
    renderSection({ rules: [rule({ active: false })], onUpdate });

    await userEvent.click(screen.getByRole("button", { name: "Resume rule" }));

    expect(onUpdate).toHaveBeenCalledWith("r1", { active: true });
  });

  test("income rules render with a plus and expense rules with a minus", () => {
    const { unmount } = renderSection({
      rules: [rule({ template: { amount: 10, type: "income", note: "Pay" } })],
    });
    expect(screen.getByText(/\+/)).toBeInTheDocument();
    unmount();

    renderSection({ rules: [rule()] });
    expect(screen.getByText(/−/)).toBeInTheDocument();
  });

  test("creating calls onCreate and closes the form on success", async () => {
    const onCreate = vi.fn(() => Promise.resolve(true));
    renderSection({ onCreate });

    await userEvent.click(screen.getByRole("button", { name: /New rule/ }));
    await userEvent.type(screen.getByLabelText("Amount"), "100");
    await userEvent.click(screen.getByRole("button", { name: "Add rule" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByLabelText("Amount")).not.toBeInTheDocument());
  });

  test("keeps the form open when create fails", async () => {
    const onCreate = vi.fn(() => Promise.resolve(false));
    renderSection({ onCreate });

    await userEvent.click(screen.getByRole("button", { name: /New rule/ }));
    await userEvent.type(screen.getByLabelText("Amount"), "100");
    await userEvent.click(screen.getByRole("button", { name: "Add rule" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    expect(screen.getByLabelText("Amount")).toBeInTheDocument();
  });

  test("editing opens the form prefilled and updates by id", async () => {
    const onUpdate = vi.fn(() => Promise.resolve(true));
    renderSection({ rules: [rule()], onUpdate });

    await userEvent.click(screen.getByRole("button", { name: "Edit rule" }));
    expect(screen.getByLabelText("Amount")).toHaveValue(950);

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    expect(onUpdate.mock.calls[0][0]).toBe("r1");
  });

  test("deleting hands the rule to onDelete", async () => {
    const onDelete = vi.fn();
    renderSection({ rules: [rule()], onDelete });

    await userEvent.click(screen.getByRole("button", { name: "Delete rule" }));

    expect(onDelete).toHaveBeenCalled();
  });

  test("Run due now calls onRunNow", async () => {
    const onRunNow = vi.fn();
    renderSection({ onRunNow });

    await userEvent.click(screen.getByRole("button", { name: /Run due now/ }));

    expect(onRunNow).toHaveBeenCalled();
  });

  test("Run due now is disabled and relabelled while running", () => {
    renderSection({ runNowState: { isRunning: true, message: null, isError: false } });

    expect(screen.getByRole("button", { name: /Running/ })).toBeDisabled();
  });

  test("shows a success message from the run as a status", () => {
    renderSection({
      rules: [rule()],
      runNowState: { isRunning: false, message: "Created 2 transactions.", isError: false },
    });

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Created 2 transactions.");
    expect(status.className).toContain("#0D9488");
  });

  test("shows a failed run in the error color", () => {
    renderSection({
      rules: [rule()],
      runNowState: { isRunning: false, message: "Server error", isError: true },
    });

    expect(screen.getByRole("status").className).toContain("#EF4444");
  });

  test("isSaving disables every row control", () => {
    renderSection({ rules: [rule()], isSaving: true });

    expect(screen.getByRole("button", { name: "Edit rule" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete rule" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Pause rule" })).toBeDisabled();
  });

  test("passes loading and error through to the section shell", () => {
    const { unmount, container } = renderSection({ isLoading: true });
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    unmount();

    renderSection({ error: "boom" });
    expect(screen.getByText("boom")).toBeInTheDocument();
  });
});
