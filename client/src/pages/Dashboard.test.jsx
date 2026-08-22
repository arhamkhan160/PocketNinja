import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../components/layout/NotificationBell", () => ({
  default: () => <div>NOTIFICATION BELL</div>,
}));
vi.mock("../components/layout/PushOptInStrip", () => ({ default: () => null }));

vi.mock("../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("./dashboard/DashboardPage", () => ({
  default: () => <div>ANALYTICS DASHBOARD</div>,
}));

const { useAuth } = await import("../context/AuthContext");
const Dashboard = (await import("./Dashboard")).default;

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({
    user: { name: "Ada Lovelace", email: "ada@test.local" },
    logout: vi.fn(),
  });
});

describe("Dashboard", () => {
  test("greets the user by first name only", () => {
    renderDashboard();

    expect(
      screen.getByRole("heading", { name: "Welcome back, Ada!" }),
    ).toBeInTheDocument();
  });

  test("renders the analytics dashboard inside the shell", () => {
    renderDashboard();

    expect(screen.getByText("ANALYTICS DASHBOARD")).toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  test("shows the financial-overview subtitle", () => {
    renderDashboard();
    expect(screen.getByText("Here is your financial overview.")).toBeInTheDocument();
  });

  test("falls back gracefully when the user has a single-word name", () => {
    useAuth.mockReturnValue({ user: { name: "Ada", email: "a@b.c" }, logout: vi.fn() });

    renderDashboard();

    expect(screen.getByRole("heading", { name: "Welcome back, Ada!" })).toBeInTheDocument();
  });

  test("does not crash when the user is still null", () => {
    // Optional chaining on user?.name?.split — a missing name must not throw.
    useAuth.mockReturnValue({ user: null, logout: vi.fn() });

    renderDashboard();

    expect(screen.getByText("ANALYTICS DASHBOARD")).toBeInTheDocument();
  });

  test("does not crash when the user has no name field", () => {
    useAuth.mockReturnValue({ user: { email: "a@b.c" }, logout: vi.fn() });

    renderDashboard();

    expect(screen.getByText("ANALYTICS DASHBOARD")).toBeInTheDocument();
  });
});
