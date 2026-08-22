import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));

// The bell and the opt-in strip own their own data and browser APIs; this file
// tests the shell around them, and they have their own suite.
vi.mock("./NotificationBell", () => ({ default: () => <div>NOTIFICATION BELL</div> }));
vi.mock("./PushOptInStrip", () => ({ default: () => <div>PUSH OPT-IN STRIP</div> }));

const { useAuth } = await import("../../context/AuthContext");
const AppShell = (await import("./AppShell")).default;

const logout = vi.fn();

const renderShell = (props = {}, path = "/") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell title={props.title || "Overview"} subtitle={props.subtitle}>
        {props.children || <p>page body</p>}
      </AppShell>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({
    user: { name: "Ada Lovelace", email: "ada@test.local" },
    logout,
  });
});

describe("AppShell", () => {
  test("renders the brand, title, subtitle and page body", () => {
    renderShell({ title: "Transactions", subtitle: "All of them" });

    expect(screen.getByText("PocketNinja")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Transactions" })).toBeInTheDocument();
    expect(screen.getByText("All of them")).toBeInTheDocument();
    expect(screen.getByText("page body")).toBeInTheDocument();
  });

  test("omits the subtitle when not given", () => {
    renderShell({ title: "Overview" });
    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
  });

  test("shows the signed-in user's name and email", () => {
    renderShell();

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@test.local")).toBeInTheDocument();
  });

  test("links to every slice, and every link is live", () => {
    renderShell();

    const expected = [
      ["Overview", "/"],
      ["Transactions", "/transactions"],
      ["Categories", "/categories"],
      ["Budgets", "/budgets"],
      ["Planning", "/planning"],
    ];

    for (const [label, href] of expected) {
      const link = screen.getByRole("link", { name: label });
      expect(link).toHaveAttribute("href", href);
    }
  });

  test("has no dead or disabled nav entries", () => {
    // Regression guard: Transactions and Analytics used to be inert
    // aria-disabled spans that dead-ended on a blank screen.
    const { container } = renderShell();

    expect(container.querySelectorAll('[aria-disabled="true"]')).toHaveLength(0);
    expect(container.querySelectorAll('a[href="#"]')).toHaveLength(0);
  });

  test("does not list a separate Analytics route — Overview is the dashboard", () => {
    renderShell();
    expect(screen.queryByRole("link", { name: "Analytics" })).not.toBeInTheDocument();
  });

  test("marks the active route", () => {
    renderShell({}, "/transactions");

    expect(screen.getByRole("link", { name: "Transactions" }).className).toContain(
      "text-[#0D9488]",
    );
    expect(screen.getByRole("link", { name: "Planning" }).className).not.toContain(
      "text-[#0D9488]",
    );
  });

  test("Overview is only active on the exact root path", () => {
    // `end` on the root NavLink — without it every route highlights Overview.
    renderShell({}, "/transactions");

    expect(screen.getByRole("link", { name: "Overview" }).className).not.toContain(
      "text-[#0D9488]",
    );
  });

  test("Sign Out calls logout", async () => {
    renderShell();

    await userEvent.click(screen.getByRole("button", { name: /Sign Out/ }));

    expect(logout).toHaveBeenCalledTimes(1);
  });

  test("mounts the notification bell in the header", () => {
    renderShell();
    expect(screen.getByText("NOTIFICATION BELL")).toBeInTheDocument();
  });

  test("mounts the push opt-in strip above the page body", () => {
    renderShell();
    expect(screen.getByText("PUSH OPT-IN STRIP")).toBeInTheDocument();
  });

  test("has no dead notification controls left in the shell itself", () => {
    // Regression guard: the bell and the "Setup Notifications" button used to
    // be inert markup with no handler at all.
    renderShell();

    const buttons = screen.getAllByRole("button").map((b) => b.textContent);
    expect(buttons).toEqual(expect.arrayContaining([expect.stringContaining("Sign Out")]));
    expect(buttons.some((t) => t.includes("Setup Notifications"))).toBe(false);
  });

  test("survives a null user without crashing", () => {
    useAuth.mockReturnValue({ user: null, logout });

    renderShell();

    expect(screen.getByText("PocketNinja")).toBeInTheDocument();
  });

  test("exposes a navigation landmark and a main region", () => {
    const { container } = renderShell();

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(container.querySelector("main")).toBeTruthy();
  });
});
