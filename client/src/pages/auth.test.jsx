import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const navigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("../context/AuthContext", () => ({ useAuth: vi.fn() }));

const { useAuth } = await import("../context/AuthContext");
const Login = (await import("./Login")).default;
const Register = (await import("./Register")).default;

const login = vi.fn();
const register = vi.fn();

const renderPage = (Page) =>
  render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<Page />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  login.mockResolvedValue(undefined);
  register.mockResolvedValue(undefined);
  useAuth.mockReturnValue({ login, register });
});

describe("Login", () => {
  test("renders the heading and both fields", () => {
    renderPage(Login);

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email Address")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log In" })).toBeInTheDocument();
  });

  test("uses the right input types — email keyboard and masked password", () => {
    renderPage(Login);

    expect(screen.getByLabelText("Email Address")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  test("both fields are required", () => {
    renderPage(Login);

    expect(screen.getByLabelText("Email Address")).toBeRequired();
    expect(screen.getByLabelText("Password")).toBeRequired();
  });

  test("submits the typed credentials", async () => {
    renderPage(Login);

    await userEvent.type(screen.getByLabelText("Email Address"), "ada@test.local");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Log In" }));

    await waitFor(() => expect(login).toHaveBeenCalledWith("ada@test.local", "secret123"));
  });

  test("navigates to the dashboard on success", async () => {
    renderPage(Login);

    await userEvent.type(screen.getByLabelText("Email Address"), "ada@test.local");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Log In" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
  });

  test("shows the server's message and stays put on failure", async () => {
    login.mockRejectedValue({
      response: { data: { error: "Invalid email or password" } },
    });

    renderPage(Login);

    await userEvent.type(screen.getByLabelText("Email Address"), "ada@test.local");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Log In" }));

    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  test("falls back to a generic message when the server sends none", async () => {
    login.mockRejectedValue(new Error("Network Error"));

    renderPage(Login);

    await userEvent.type(screen.getByLabelText("Email Address"), "a@b.c");
    await userEvent.type(screen.getByLabelText("Password"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Log In" }));

    expect(await screen.findByText("Failed to login")).toBeInTheDocument();
  });

  test("clears a previous error when the form is resubmitted", async () => {
    login.mockRejectedValueOnce({ response: { data: { error: "Invalid email or password" } } });

    renderPage(Login);

    await userEvent.type(screen.getByLabelText("Email Address"), "a@b.c");
    await userEvent.type(screen.getByLabelText("Password"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Log In" }));
    await screen.findByText("Invalid email or password");

    await userEvent.click(screen.getByRole("button", { name: "Log In" }));

    await waitFor(() =>
      expect(screen.queryByText("Invalid email or password")).not.toBeInTheDocument(),
    );
  });

  test("does not echo the password back into the DOM as text", async () => {
    const { container } = renderPage(Login);

    await userEvent.type(screen.getByLabelText("Password"), "secret123");

    expect(container.textContent).not.toContain("secret123");
  });

  test("links to the register page", () => {
    renderPage(Login);

    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/register");
  });
});

describe("Register", () => {
  test("renders the heading and all three fields", () => {
    renderPage(Register);

    expect(screen.getByRole("heading", { name: "Create an account" })).toBeInTheDocument();
    expect(screen.getByLabelText("Full Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email Address")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign Up" })).toBeInTheDocument();
  });

  test("hints the password minimum in the placeholder", () => {
    renderPage(Register);

    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "placeholder",
      "At least 6 characters",
    );
  });

  test("submits name, email and password in that order", async () => {
    renderPage(Register);

    await userEvent.type(screen.getByLabelText("Full Name"), "Ada Lovelace");
    await userEvent.type(screen.getByLabelText("Email Address"), "ada@test.local");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith("Ada Lovelace", "ada@test.local", "secret123"),
    );
  });

  test("navigates to the dashboard on success", async () => {
    renderPage(Register);

    await userEvent.type(screen.getByLabelText("Full Name"), "Ada");
    await userEvent.type(screen.getByLabelText("Email Address"), "a@b.c");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
  });

  test("surfaces a duplicate-email rejection", async () => {
    register.mockRejectedValue({
      response: { data: { error: "Email already registered" } },
    });

    renderPage(Register);

    await userEvent.type(screen.getByLabelText("Full Name"), "Ada");
    await userEvent.type(screen.getByLabelText("Email Address"), "a@b.c");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    expect(await screen.findByText("Email already registered")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  test("surfaces the short-password rejection from the server", async () => {
    register.mockRejectedValue({
      response: { data: { error: "Password must be at least 6 characters" } },
    });

    renderPage(Register);

    await userEvent.type(screen.getByLabelText("Full Name"), "Ada");
    await userEvent.type(screen.getByLabelText("Email Address"), "a@b.c");
    await userEvent.type(screen.getByLabelText("Password"), "12345");
    await userEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    expect(
      await screen.findByText("Password must be at least 6 characters"),
    ).toBeInTheDocument();
  });

  test("falls back to a generic message when the server sends none", async () => {
    register.mockRejectedValue(new Error("Network Error"));

    renderPage(Register);

    await userEvent.type(screen.getByLabelText("Full Name"), "Ada");
    await userEvent.type(screen.getByLabelText("Email Address"), "a@b.c");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    expect(await screen.findByText("Failed to create account")).toBeInTheDocument();
  });

  test("links back to the login page", () => {
    renderPage(Register);

    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
  });

  test("all three fields are required", () => {
    renderPage(Register);

    expect(screen.getByLabelText("Full Name")).toBeRequired();
    expect(screen.getByLabelText("Email Address")).toBeRequired();
    expect(screen.getByLabelText("Password")).toBeRequired();
  });
});
