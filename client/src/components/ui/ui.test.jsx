import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Badge from "./Badge";
import Button from "./Button";
import Card from "./Card";
import DataState from "./DataState";
import Field from "./Field";
import Input from "./Input";
import Modal from "./Modal";
import PageHeader from "./PageHeader";
import Select from "./Select";
import { CONTROL_CLASS } from "./controlStyles";

describe("ui/Button", () => {
  test("renders its children", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  test("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  test("honours an explicit type=submit", () => {
    render(<Button type="submit">Go</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  test("fires onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);

    await userEvent.click(screen.getByRole("button"));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("does not fire onClick when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Click
      </Button>,
    );

    await userEvent.click(screen.getByRole("button"));

    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  test("applies the primary variant by default", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button").className).toContain("bg-[#0D9488]");
  });

  test("each variant produces a distinct class list", () => {
    const seen = new Set();
    for (const variant of ["primary", "secondary", "danger", "ghost", "dangerGhost"]) {
      const { unmount } = render(<Button variant={variant}>x</Button>);
      seen.add(screen.getByRole("button").className);
      unmount();
    }
    expect(seen.size).toBe(5);
  });

  test("size=icon uses tighter padding than the default", () => {
    render(<Button size="icon">x</Button>);
    expect(screen.getByRole("button").className).toContain("p-2");
  });

  test("a caller className overrides a conflicting default", () => {
    // twMerge in action: the page must be able to win.
    render(<Button className="px-8">x</Button>);
    const cls = screen.getByRole("button").className;

    expect(cls).toContain("px-8");
    expect(cls).not.toContain("px-4");
  });

  test("forwards arbitrary props such as aria-label", () => {
    render(<Button aria-label="Delete transaction" />);
    expect(screen.getByRole("button", { name: "Delete transaction" })).toBeInTheDocument();
  });
});

describe("ui/Card", () => {
  test("renders children inside the shared card shell", () => {
    render(<Card>content</Card>);
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  test("always carries the lm-card class", () => {
    const { container } = render(<Card />);
    expect(container.firstChild.className).toContain("lm-card");
  });

  test("merges an extra className without dropping lm-card", () => {
    const { container } = render(<Card className="p-6" />);
    expect(container.firstChild.className).toContain("lm-card");
    expect(container.firstChild.className).toContain("p-6");
  });

  test("forwards DOM props such as role and onClick", async () => {
    const onClick = vi.fn();
    render(<Card role="dialog" onClick={onClick} />);

    await userEvent.click(screen.getByRole("dialog"));

    expect(onClick).toHaveBeenCalled();
  });
});

describe("ui/Badge", () => {
  test("renders its label", () => {
    render(<Badge>expense</Badge>);
    expect(screen.getByText("expense")).toBeInTheDocument();
  });

  test("income and expense tones differ visually", () => {
    const { unmount } = render(<Badge tone="income">a</Badge>);
    const income = screen.getByText("a").className;
    unmount();

    render(<Badge tone="expense">b</Badge>);
    expect(screen.getByText("b").className).not.toBe(income);
  });

  test("falls back to the neutral tone for an unknown tone", () => {
    render(<Badge tone="banana">x</Badge>);
    expect(screen.getByText("x").className).toContain("text-[#78716C]");
  });

  test("defaults to the neutral tone", () => {
    render(<Badge>x</Badge>);
    expect(screen.getByText("x").className).toContain("bg-[#FAF8F5]");
  });
});

describe("ui/Field", () => {
  test("renders the label text and wraps its control", () => {
    render(
      <Field label="Amount">
        <input aria-label="amount-input" />
      </Field>,
    );

    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByLabelText("amount-input")).toBeInTheDocument();
  });

  test("associates the label with the control by wrapping it", () => {
    // Clicking the label focuses the input — the accessibility contract.
    render(
      <Field label="Amount">
        <input />
      </Field>,
    );

    expect(screen.getByLabelText("Amount")).toBeInTheDocument();
  });

  test("shows an error message when given one", () => {
    render(
      <Field label="Amount" error="Must be greater than 0">
        <input />
      </Field>,
    );

    expect(screen.getByText("Must be greater than 0")).toBeInTheDocument();
  });

  test("renders no error element when there is no error", () => {
    const { container } = render(
      <Field label="Amount">
        <input />
      </Field>,
    );

    expect(container.querySelector(".text-\\[\\#EF4444\\]")).toBe(null);
  });
});

describe("ui/Input and ui/Select", () => {
  test("Input carries the shared control styling", () => {
    render(<Input aria-label="x" />);
    expect(screen.getByLabelText("x").className).toContain("rounded-lg");
  });

  test("Input forwards type, value and onChange", async () => {
    const onChange = vi.fn();
    render(<Input aria-label="amount" type="number" value="5" onChange={onChange} />);

    const input = screen.getByLabelText("amount");
    expect(input).toHaveAttribute("type", "number");
    expect(input).toHaveValue(5);

    await userEvent.type(input, "9");
    expect(onChange).toHaveBeenCalled();
  });

  test("Input honours required and disabled", () => {
    render(<Input aria-label="x" required disabled />);
    const input = screen.getByLabelText("x");

    expect(input).toBeRequired();
    expect(input).toBeDisabled();
  });

  test("Select renders its options and reflects the value", () => {
    render(
      <Select aria-label="cat" value="b" onChange={() => {}}>
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </Select>,
    );

    expect(screen.getByLabelText("cat")).toHaveValue("b");
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  test("Select fires onChange with the chosen value", async () => {
    // Read the value inside the handler: this is a controlled select with no
    // state behind it, so React reverts the DOM before the assertion runs.
    let selected;
    const onChange = vi.fn((e) => {
      selected = e.target.value;
    });

    render(
      <Select aria-label="cat" value="a" onChange={onChange}>
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </Select>,
    );

    await userEvent.selectOptions(screen.getByLabelText("cat"), "b");

    expect(onChange).toHaveBeenCalled();
    expect(selected).toBe("b");
  });

  test("both share one control class constant", () => {
    expect(CONTROL_CLASS).toContain("border-[#E7E5E4]");
    expect(CONTROL_CLASS).toContain("focus:border-[#0D9488]");
  });
});

describe("ui/PageHeader", () => {
  test("renders a title and subtitle when given", () => {
    render(<PageHeader title="Transactions" subtitle="All of them" />);

    expect(screen.getByText("Transactions")).toBeInTheDocument();
    expect(screen.getByText("All of them")).toBeInTheDocument();
  });

  test("renders actions with no title — the common case under AppShell", () => {
    render(
      <PageHeader>
        <button>Add</button>
      </PageHeader>,
    );

    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  test("omits the subtitle element when not supplied", () => {
    render(<PageHeader title="Only title" />);
    expect(screen.getByText("Only title")).toBeInTheDocument();
    expect(screen.queryByText(/subtitle/i)).not.toBeInTheDocument();
  });
});

describe("ui/DataState", () => {
  const children = <div>Real content</div>;

  test("shows a skeleton while loading and hides the content", () => {
    const { container } = render(<DataState isLoading>{children}</DataState>);

    expect(screen.queryByText("Real content")).not.toBeInTheDocument();
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  test("loading wins over error and empty", () => {
    render(
      <DataState isLoading error="boom" isEmpty>
        {children}
      </DataState>,
    );

    expect(screen.queryByText("boom")).not.toBeInTheDocument();
  });

  test("shows the error title and message", () => {
    render(
      <DataState error="Server error" errorTitle="Couldn't load transactions">
        {children}
      </DataState>,
    );

    expect(screen.getByText("Couldn't load transactions")).toBeInTheDocument();
    expect(screen.getByText("Server error")).toBeInTheDocument();
    expect(screen.queryByText("Real content")).not.toBeInTheDocument();
  });

  test("error wins over empty", () => {
    render(
      <DataState error="boom" isEmpty emptyTitle="Nothing yet">
        {children}
      </DataState>,
    );

    expect(screen.queryByText("Nothing yet")).not.toBeInTheDocument();
  });

  test("shows the empty state with its title and message", () => {
    render(
      <DataState isEmpty emptyTitle="No transactions yet" emptyMessage="Add one.">
        {children}
      </DataState>,
    );

    expect(screen.getByText("No transactions yet")).toBeInTheDocument();
    expect(screen.getByText("Add one.")).toBeInTheDocument();
  });

  test("uses default titles when none are given", () => {
    render(<DataState isEmpty>{children}</DataState>);
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });

  test("renders children when there is data", () => {
    render(<DataState>{children}</DataState>);
    expect(screen.getByText("Real content")).toBeInTheDocument();
  });

  test("honours a custom skeleton height", () => {
    const { container } = render(
      <DataState isLoading skeletonHeight={300}>
        {children}
      </DataState>,
    );

    expect(container.querySelector(".animate-pulse")).toHaveStyle({ height: "300px" });
  });
});

describe("ui/Modal", () => {
  test("renders nothing when closed", () => {
    const { container } = render(
      <Modal open={false} title="Add" onClose={() => {}}>
        <p>Body</p>
      </Modal>,
    );

    expect(container.firstChild).toBe(null);
  });

  test("renders the title and body when open", () => {
    render(
      <Modal open title="Add transaction" onClose={() => {}}>
        <p>Body</p>
      </Modal>,
    );

    expect(screen.getByText("Add transaction")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  test("exposes a labelled modal dialog role", () => {
    render(
      <Modal open title="Add transaction" onClose={() => {}}>
        <p>Body</p>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Add transaction");
  });

  test("the close button calls onClose", async () => {
    const onClose = vi.fn();
    render(
      <Modal open title="t" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("clicking the backdrop calls onClose", async () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open title="t" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    );

    await userEvent.click(container.firstChild);

    expect(onClose).toHaveBeenCalled();
  });

  test("clicking inside the card does not close it", async () => {
    const onClose = vi.fn();
    render(
      <Modal open title="t" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    );

    await userEvent.click(screen.getByText("Body"));

    expect(onClose).not.toHaveBeenCalled();
  });

  test("Escape closes it", async () => {
    const onClose = vi.fn();
    render(
      <Modal open title="t" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    );

    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("Escape does nothing while closed", async () => {
    const onClose = vi.fn();
    render(
      <Modal open={false} title="t" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    );

    await userEvent.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
  });

  test("removes its key listener on unmount", async () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <Modal open title="t" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    );

    unmount();
    await userEvent.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
  });
});
