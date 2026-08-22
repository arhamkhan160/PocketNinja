import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("../context/AuthContext", () => ({ useAuth: vi.fn() }));

const { useAuth } = await import("../context/AuthContext");
const ProtectedRoute = (await import("./ProtectedRoute")).default;

const renderAt = (path = "/secret") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/secret" element={<div>Secret content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProtectedRoute", () => {
  test("renders the child route when a token and user are present", () => {
    useAuth.mockReturnValue({ token: "t", user: { name: "Ada" }, isLoading: false });

    renderAt();

    expect(screen.getByText("Secret content")).toBeInTheDocument();
  });

  test("redirects to /login when there is no token", () => {
    useAuth.mockReturnValue({ token: null, user: null, isLoading: false });

    renderAt();

    expect(screen.getByText("Login page")).toBeInTheDocument();
    expect(screen.queryByText("Secret content")).not.toBeInTheDocument();
  });

  test("shows a loading state instead of redirecting while the session restores", () => {
    // The important one: redirecting during the /auth/me round-trip would bounce
    // an authenticated user to the login screen on every refresh.
    useAuth.mockReturnValue({ token: "t", user: null, isLoading: true });

    renderAt();

    expect(screen.getByText(/Loading PocketNinja/i)).toBeInTheDocument();
    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
    expect(screen.queryByText("Secret content")).not.toBeInTheDocument();
  });

  test("redirects when a token exists but the user failed to load", () => {
    useAuth.mockReturnValue({ token: "t", user: null, isLoading: false });

    renderAt();

    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  test("redirects when a user exists but the token was cleared", () => {
    useAuth.mockReturnValue({ token: null, user: { name: "Ada" }, isLoading: false });

    renderAt();

    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  test("does not leak protected content in the DOM while redirecting", () => {
    useAuth.mockReturnValue({ token: null, user: null, isLoading: false });

    const { container } = renderAt();

    expect(container.textContent).not.toContain("Secret");
  });
});
