import { describe, test, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import SectionCard from "./SectionCard";
import GoalCard from "./GoalCard";
import GoalForm from "./GoalForm";
import GoalsSection from "./GoalsSection";
import RemindersSection from "./RemindersSection";
import { STATUS_GOOD, STATUS_WARNING, STATUS_CRITICAL } from "../../dashboard/chartColors";

const DAY_MS = 24 * 60 * 60 * 1000;
const inDays = (n) => new Date(Date.now() + n * DAY_MS).toISOString();

const goal = (overrides = {}) => ({
  _id: "g1",
  title: "New laptop",
  target: 1200,
  saved: 300,
  deadline: null,
  ...overrides,
});

describe("SectionCard", () => {
  test("renders title, subtitle, action and children", () => {
    render(
      <SectionCard title="Goals" subtitle="Saving up" action={<button>New</button>}>
        <p>body</p>
      </SectionCard>,
    );

    expect(screen.getByText("Goals")).toBeInTheDocument();
    expect(screen.getByText("Saving up")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  test("shows skeletons and hides the body while loading", () => {
    const { container } = render(
      <SectionCard title="t" isLoading>
        <p>body</p>
      </SectionCard>,
    );

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(2);
    expect(screen.queryByText("body")).not.toBeInTheDocument();
  });

  test("shows the error state", () => {
    render(
      <SectionCard title="t" error="Server error">
        <p>body</p>
      </SectionCard>,
    );

    expect(screen.getByText(/Couldn't load this section/)).toBeInTheDocument();
    expect(screen.getByText("Server error")).toBeInTheDocument();
  });

  test("shows the empty state", () => {
    render(
      <SectionCard title="t" isEmpty emptyMessage="Nothing to see">
        <p>body</p>
      </SectionCard>,
    );

    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
    expect(screen.getByText("Nothing to see")).toBeInTheDocument();
  });

  test("loading beats error, error beats empty", () => {
    const { unmount } = render(
      <SectionCard title="t" isLoading error="boom" isEmpty emptyMessage="empty">
        <p>body</p>
      </SectionCard>,
    );
    expect(screen.queryByText("boom")).not.toBeInTheDocument();
    unmount();

    render(
      <SectionCard title="t" error="boom" isEmpty emptyMessage="empty">
        <p>body</p>
      </SectionCard>,
    );
    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(screen.queryByText("empty")).not.toBeInTheDocument();
  });

  test("keeps its action visible in the empty state", () => {
    render(
      <SectionCard title="t" action={<button>New</button>} isEmpty emptyMessage="none">
        <p>body</p>
      </SectionCard>,
    );

    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
  });
});

describe("GoalCard", () => {
  const renderCard = (g = goal(), handlers = {}) =>
    render(
      <GoalCard
        goal={g}
        isBusy={handlers.isBusy || false}
        onContribute={handlers.onContribute || (() => true)}
        onEdit={handlers.onEdit || (() => {})}
        onDelete={handlers.onDelete || (() => {})}
      />,
    );

  test("renders the title, saved, target and percentage", () => {
    renderCard();

    expect(screen.getByText("New laptop")).toBeInTheDocument();
    expect(screen.getByText("$300")).toBeInTheDocument();
    expect(screen.getByText(/\$1,200/)).toBeInTheDocument();
    expect(screen.getByText(/25%/)).toBeInTheDocument();
  });

  test("exposes the meter as a progressbar with its value", () => {
    renderCard();

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "25");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  test("caps the bar at 100% when over-funded", () => {
    const { container } = renderCard(goal({ saved: 5000 }));

    expect(container.querySelector('[style*="width"]')).toHaveStyle({ width: "100%" });
  });

  test("a completed goal shows the reached marker and hides the contribute form", () => {
    renderCard(goal({ saved: 1200 }));

    expect(screen.getByLabelText("Goal reached")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Contribute" })).not.toBeInTheDocument();
  });

  test("a zero target renders 0% instead of dividing by zero", () => {
    renderCard(goal({ target: 0, saved: 10 }));

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  test("meter stays teal with no deadline, whatever the progress", () => {
    // Goal semantics invert the budget meter: progress alone never turns coral.
    const { container } = renderCard(goal({ saved: 1, deadline: null }));

    expect(container.querySelector('[style*="width"]')).toHaveStyle({
      backgroundColor: STATUS_GOOD,
    });
  });

  test("meter turns amber when the deadline is within two weeks", () => {
    const { container } = renderCard(goal({ deadline: inDays(10) }));

    expect(container.querySelector('[style*="width"]')).toHaveStyle({
      backgroundColor: STATUS_WARNING,
    });
  });

  test("meter turns coral when the deadline has passed and the goal is short", () => {
    const { container } = renderCard(goal({ deadline: inDays(-2) }));

    expect(container.querySelector('[style*="width"]')).toHaveStyle({
      backgroundColor: STATUS_CRITICAL,
    });
  });

  test("a completed goal stays teal even past its deadline", () => {
    const { container } = renderCard(goal({ saved: 1200, deadline: inDays(-30) }));

    expect(container.querySelector('[style*="width"]')).toHaveStyle({
      backgroundColor: STATUS_GOOD,
    });
  });

  test("shows days left, days overdue and due today", () => {
    const { unmount } = renderCard(goal({ deadline: inDays(5) }));
    expect(screen.getByText("5d left")).toBeInTheDocument();
    unmount();

    const second = renderCard(goal({ deadline: inDays(-3) }));
    expect(screen.getByText("3d overdue")).toBeInTheDocument();
    second.unmount();

    renderCard(goal({ deadline: new Date().toISOString() }));
    expect(screen.getByText("Due today")).toBeInTheDocument();
  });

  test("shows no deadline note when there is no deadline", () => {
    renderCard();
    expect(screen.queryByText(/left|overdue|Due today/)).not.toBeInTheDocument();
  });

  test("contributing adds to the existing total, not replacing it", async () => {
    // The contribution is relative; the API stores an absolute saved figure.
    const onContribute = vi.fn(() => Promise.resolve(true));
    renderCard(goal({ saved: 300 }), { onContribute });

    await userEvent.type(screen.getByLabelText("Contribute to New laptop"), "50");
    await userEvent.click(screen.getByRole("button", { name: "Contribute" }));

    await waitFor(() => expect(onContribute).toHaveBeenCalledWith("g1", 350));
  });

  test("clears the contribute field on success", async () => {
    const onContribute = vi.fn(() => Promise.resolve(true));
    renderCard(goal(), { onContribute });

    const input = screen.getByLabelText("Contribute to New laptop");
    await userEvent.type(input, "50");
    await userEvent.click(screen.getByRole("button", { name: "Contribute" }));

    await waitFor(() => expect(input).toHaveValue(null));
  });

  test("keeps the typed amount when the contribution fails", async () => {
    const onContribute = vi.fn(() => Promise.resolve(false));
    renderCard(goal(), { onContribute });

    const input = screen.getByLabelText("Contribute to New laptop");
    await userEvent.type(input, "50");
    await userEvent.click(screen.getByRole("button", { name: "Contribute" }));

    await waitFor(() => expect(onContribute).toHaveBeenCalled());
    expect(input).toHaveValue(50);
  });

  test("rejects a non-positive contribution without calling the API", async () => {
    const onContribute = vi.fn();
    const { container } = renderCard(goal(), { onContribute });

    const form = container.querySelector("form");
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(await screen.findByText("Enter an amount greater than 0.")).toBeInTheDocument();
    expect(onContribute).not.toHaveBeenCalled();
  });

  test("edit and delete hand the whole goal back", async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const g = goal();
    renderCard(g, { onEdit, onDelete });

    await userEvent.click(screen.getByRole("button", { name: "Edit goal" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete goal" }));

    expect(onEdit).toHaveBeenCalledWith(g);
    expect(onDelete).toHaveBeenCalledWith(g);
  });

  test("isBusy disables every action", () => {
    renderCard(goal(), { isBusy: true });

    expect(screen.getByRole("button", { name: "Edit goal" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete goal" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Contribute" })).toBeDisabled();
  });
});

describe("GoalForm", () => {
  test("starts blank in create mode", () => {
    render(<GoalForm goal={null} onSubmit={() => {}} onCancel={() => {}} />);

    expect(screen.getByLabelText("Goal")).toHaveValue("");
    expect(screen.getByLabelText("Target amount")).toHaveValue(null);
    expect(screen.getByLabelText("Already saved")).toHaveValue(0);
    expect(screen.getByRole("button", { name: "Add goal" })).toBeInTheDocument();
  });

  test("prefills from an existing goal", () => {
    render(
      <GoalForm
        goal={goal({ deadline: "2026-12-31T00:00:00.000Z" })}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByLabelText("Goal")).toHaveValue("New laptop");
    expect(screen.getByLabelText("Target amount")).toHaveValue(1200);
    expect(screen.getByLabelText("Already saved")).toHaveValue(300);
    expect(screen.getByLabelText(/Deadline/)).toHaveValue("2026-12-31");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  test("submits a normalised payload", async () => {
    const onSubmit = vi.fn();
    render(<GoalForm goal={null} onSubmit={onSubmit} onCancel={() => {}} />);

    await userEvent.type(screen.getByLabelText("Goal"), "  Trip  ");
    await userEvent.type(screen.getByLabelText("Target amount"), "800");
    await userEvent.click(screen.getByRole("button", { name: "Add goal" }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: "Trip",
      target: 800,
      saved: 0,
      deadline: null,
    });
  });

  test("sends the deadline at midday UTC so it cannot shift a day", async () => {
    const onSubmit = vi.fn();
    render(<GoalForm goal={null} onSubmit={onSubmit} onCancel={() => {}} />);

    await userEvent.type(screen.getByLabelText("Goal"), "Trip");
    await userEvent.type(screen.getByLabelText("Target amount"), "800");
    await userEvent.type(screen.getByLabelText(/Deadline/), "2026-12-31");
    await userEvent.click(screen.getByRole("button", { name: "Add goal" }));

    expect(onSubmit.mock.calls[0][0].deadline).toBe("2026-12-31T12:00:00.000Z");
  });

  test("blocks an empty title", async () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <GoalForm goal={null} onSubmit={onSubmit} onCancel={() => {}} />,
    );

    container
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(await screen.findByText("Give the goal a name.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("blocks a non-positive target", async () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <GoalForm goal={goal({ target: 0 })} onSubmit={onSubmit} onCancel={() => {}} />,
    );

    container
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(
      await screen.findByText("Target must be a number greater than 0."),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("blocks a negative saved amount", async () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <GoalForm goal={goal({ saved: -5 })} onSubmit={onSubmit} onCancel={() => {}} />,
    );

    container
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(await screen.findByText("Saved must be 0 or more.")).toBeInTheDocument();
  });

  test("Cancel fires onCancel without submitting", async () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn();
    render(<GoalForm goal={null} onSubmit={onSubmit} onCancel={onCancel} />);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("isSaving disables and relabels the submit button", () => {
    render(<GoalForm goal={null} onSubmit={() => {}} onCancel={() => {}} isSaving />);

    expect(screen.getByRole("button", { name: /Saving/ })).toBeDisabled();
  });
});

describe("GoalsSection", () => {
  const renderSection = (props = {}) =>
    render(
      <GoalsSection
        goals={props.goals || []}
        isLoading={props.isLoading || false}
        error={props.error || null}
        isSaving={props.isSaving || false}
        onCreate={props.onCreate || (() => true)}
        onUpdate={props.onUpdate || (() => true)}
        onDelete={props.onDelete || (() => {})}
      />,
    );

  test("shows the empty state with no goals and no open form", () => {
    renderSection();

    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
    expect(screen.getByText(/Set a target and a deadline/)).toBeInTheDocument();
  });

  test("New goal opens a blank form, replacing the empty state", async () => {
    renderSection();

    await userEvent.click(screen.getByRole("button", { name: /New goal/ }));

    expect(screen.getByLabelText("Goal")).toHaveValue("");
    expect(screen.queryByText("Nothing here yet")).not.toBeInTheDocument();
  });

  test("renders one card per goal", () => {
    renderSection({ goals: [goal(), goal({ _id: "g2", title: "Trip" })] });

    expect(screen.getByText("New laptop")).toBeInTheDocument();
    expect(screen.getByText("Trip")).toBeInTheDocument();
  });

  test("creating calls onCreate and closes the form on success", async () => {
    const onCreate = vi.fn(() => Promise.resolve(true));
    renderSection({ onCreate });

    await userEvent.click(screen.getByRole("button", { name: /New goal/ }));
    await userEvent.type(screen.getByLabelText("Goal"), "Trip");
    await userEvent.type(screen.getByLabelText("Target amount"), "500");
    await userEvent.click(screen.getByRole("button", { name: "Add goal" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByLabelText("Goal")).not.toBeInTheDocument());
  });

  test("keeps the form open when create fails", async () => {
    const onCreate = vi.fn(() => Promise.resolve(false));
    renderSection({ onCreate });

    await userEvent.click(screen.getByRole("button", { name: /New goal/ }));
    await userEvent.type(screen.getByLabelText("Goal"), "Trip");
    await userEvent.type(screen.getByLabelText("Target amount"), "500");
    await userEvent.click(screen.getByRole("button", { name: "Add goal" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    expect(screen.getByLabelText("Goal")).toBeInTheDocument();
  });

  test("editing a card opens the form prefilled and updates by id", async () => {
    const onUpdate = vi.fn(() => Promise.resolve(true));
    renderSection({ goals: [goal()], onUpdate });

    await userEvent.click(screen.getByRole("button", { name: "Edit goal" }));
    expect(screen.getByLabelText("Goal")).toHaveValue("New laptop");

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    expect(onUpdate.mock.calls[0][0]).toBe("g1");
  });

  test("contributing routes through onUpdate with the absolute total", async () => {
    const onUpdate = vi.fn(() => Promise.resolve(true));
    renderSection({ goals: [goal({ saved: 100 })], onUpdate });

    await userEvent.type(screen.getByLabelText("Contribute to New laptop"), "25");
    await userEvent.click(screen.getByRole("button", { name: "Contribute" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("g1", { saved: 125 }));
  });

  test("deleting hands the goal to onDelete", async () => {
    const onDelete = vi.fn();
    renderSection({ goals: [goal()], onDelete });

    await userEvent.click(screen.getByRole("button", { name: "Delete goal" }));

    expect(onDelete).toHaveBeenCalled();
  });

  test("passes loading and error through to the section shell", () => {
    const { unmount, container } = renderSection({ isLoading: true });
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    unmount();

    renderSection({ error: "boom" });
    expect(screen.getByText("boom")).toBeInTheDocument();
  });
});

describe("RemindersSection", () => {
  const rule = (overrides = {}) => ({
    _id: "r1",
    template: { amount: 950, type: "expense", note: "Rent" },
    interval: "monthly",
    nextRun: inDays(2),
    active: true,
    ...overrides,
  });

  const renderSection = (rules = [], props = {}) =>
    render(
      <RemindersSection
        rules={rules}
        isLoading={props.isLoading || false}
        error={props.error || null}
      />,
    );

  test("shows the empty state when nothing is due this week", () => {
    renderSection();

    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
    expect(screen.getByText(/Nothing due this week/)).toBeInTheDocument();
  });

  test("lists a rule due inside the window", () => {
    renderSection([rule()]);

    expect(screen.getByText("Rent")).toBeInTheDocument();
    expect(screen.getByText("$950")).toBeInTheDocument();
    expect(screen.getByText("Due in 2 days")).toBeInTheDocument();
  });

  test("excludes rules beyond the seven-day window", () => {
    renderSection([rule({ nextRun: inDays(20) })]);

    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });

  test("includes day 7 and excludes day 8 — the window boundary", () => {
    const { unmount } = renderSection([rule({ nextRun: inDays(7) })]);
    expect(screen.getByText("Rent")).toBeInTheDocument();
    unmount();

    renderSection([rule({ _id: "r2", nextRun: inDays(8) })]);
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });

  test("includes overdue rules", () => {
    renderSection([rule({ nextRun: inDays(-2) })]);

    expect(screen.getByText("Overdue by 2d")).toBeInTheDocument();
  });

  test("excludes inactive rules", () => {
    renderSection([rule({ active: false })]);

    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });

  test("sorts soonest first", () => {
    renderSection([
      rule({ _id: "a", nextRun: inDays(5), template: { amount: 1, type: "expense", note: "Later" } }),
      rule({ _id: "b", nextRun: inDays(1), template: { amount: 2, type: "expense", note: "Sooner" } }),
    ]);

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Sooner");
    expect(items[1]).toHaveTextContent("Later");
  });

  test("falls back to a generic label when the template has no note", () => {
    renderSection([
      rule({ template: { amount: 10, type: "income" } }),
    ]);

    expect(screen.getByText("Recurring income")).toBeInTheDocument();
  });

  test("labels a note-less expense rule as a recurring expense", () => {
    renderSection([rule({ template: { amount: 10, type: "expense" } })]);

    expect(screen.getByText("Recurring expense")).toBeInTheDocument();
  });

  test("survives a rule with no template at all", () => {
    renderSection([rule({ template: undefined })]);

    expect(screen.getByText("Recurring expense")).toBeInTheDocument();
    expect(screen.getByText("$0")).toBeInTheDocument();
  });

  test("passes loading and error through", () => {
    const { unmount, container } = renderSection([], { isLoading: true });
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    unmount();

    renderSection([], { error: "boom" });
    expect(screen.getByText("boom")).toBeInTheDocument();
  });
});
