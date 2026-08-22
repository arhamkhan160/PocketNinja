import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("./api/axios", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

// Stub every page so this file tests routing and guards, not page internals.
vi.mock("./pages/Login", () => ({ default: () => <div>LOGIN PAGE</div> }));
vi.mock("./pages/Register", () => ({ default: () => <div>REGISTER PAGE</div> }));
vi.mock("./pages/Dashboard", () => ({ default: () => <div>DASHBOARD PAGE</div> }));
vi.mock("./pages/planning/PlanningPage", () => ({
  default: () => <div>PLANNING PAGE</div>,
}));
vi.mock("./pages/transactions/TransactionsPage", () => ({
  default: () => <div>TRANSACTIONS PAGE</div>,
}));
vi.mock("./pages/transactions/CategoriesPage", () => ({
  default: () => <div>CATEGORIES PAGE</div>,
}));
vi.mock("./pages/transactions/BudgetsPage", () => ({
  default: () => <div>BUDGETS PAGE</div>,
}));

const api = (await import("./api/axios")).default;
const App = (await import("./App")).default;

const TOKEN_KEY = "pocketninja_token";

const signedIn = () => {
  localStorage.setItem(TOKEN_KEY, "valid-token");
  api.get.mockResolvedValue({ data: { user: { name: "Ada", email: "a@b.c" } } });
};

const goTo = (path) => {
  window.history.pushState({}, "", path);
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  goTo("/");
});

describe("App — protected routing", () => {
  test("redirects an anonymous visitor from / to the login page", async () => {
    render(<App />);

    expect(await screen.findByText("LOGIN PAGE")).toBeInTheDocument();
    expect(screen.queryByText("DASHBOARD PAGE")).not.toBeInTheDocument();
  });

  test("every protected path redirects when signed out", async () => {
    for (const path of ["/transactions", "/categories", "/budgets", "/planning"]) {
      goTo(path);
      const { unmount } = render(<App />);

      expect(await screen.findByText("LOGIN PAGE")).toBeInTheDocument();
      unmount();
    }
  });

  test("renders the dashboard at / when signed in", async () => {
    signedIn();

    render(<App />);

    expect(await screen.findByText("DASHBOARD PAGE")).toBeInTheDocument();
  });

  test("routes each slice to its own page when signed in", async () => {
    const routes = [
      ["/transactions", "TRANSACTIONS PAGE"],
      ["/categories", "CATEGORIES PAGE"],
      ["/budgets", "BUDGETS PAGE"],
      ["/planning", "PLANNING PAGE"],
    ];

    for (const [path, expected] of routes) {
      signedIn();
      goTo(path);
      const { unmount } = render(<App />);

      expect(await screen.findByText(expected)).toBeInTheDocument();
      unmount();
      localStorage.clear();
    }
  });

  test("an unknown path falls back to the dashboard when signed in", async () => {
    signedIn();
    goTo("/does-not-exist");

    render(<App />);

    expect(await screen.findByText("DASHBOARD PAGE")).toBeInTheDocument();
  });

  test("an unknown path lands on login when signed out", async () => {
    goTo("/does-not-exist");

    render(<App />);

    expect(await screen.findByText("LOGIN PAGE")).toBeInTheDocument();
  });
});

describe("App — public routes", () => {
  test("shows login and register to an anonymous visitor", async () => {
    goTo("/login");
    const { unmount } = render(<App />);
    expect(await screen.findByText("LOGIN PAGE")).toBeInTheDocument();
    unmount();

    goTo("/register");
    render(<App />);
    expect(await screen.findByText("REGISTER PAGE")).toBeInTheDocument();
  });

  test("bounces a signed-in user away from /login", async () => {
    signedIn();
    goTo("/login");

    render(<App />);

    expect(await screen.findByText("DASHBOARD PAGE")).toBeInTheDocument();
    expect(screen.queryByText("LOGIN PAGE")).not.toBeInTheDocument();
  });

  test("bounces a signed-in user away from /register", async () => {
    signedIn();
    goTo("/register");

    render(<App />);

    expect(await screen.findByText("DASHBOARD PAGE")).toBeInTheDocument();
  });
});

describe("App — session restore", () => {
  test("shows neither login nor a page while /auth/me is in flight", () => {
    localStorage.setItem(TOKEN_KEY, "valid-token");
    api.get.mockReturnValue(new Promise(() => {}));

    render(<App />);

    // Redirecting mid-restore would bounce a logged-in user out on refresh.
    expect(screen.queryByText("LOGIN PAGE")).not.toBeInTheDocument();
    expect(screen.queryByText("DASHBOARD PAGE")).not.toBeInTheDocument();
  });

  test("falls back to login when the stored token is rejected", async () => {
    localStorage.setItem(TOKEN_KEY, "expired");
    api.get.mockRejectedValue({ response: { status: 401 } });
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(<App />);

    expect(await screen.findByText("LOGIN PAGE")).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem(TOKEN_KEY)).toBe(null));
  });

  test("verifies the stored token against /auth/me exactly once", async () => {
    signedIn();

    render(<App />);

    await screen.findByText("DASHBOARD PAGE");
    expect(api.get).toHaveBeenCalledWith("/auth/me");
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});
