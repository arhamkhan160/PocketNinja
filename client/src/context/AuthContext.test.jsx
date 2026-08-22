import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../api/axios", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const api = (await import("../api/axios")).default;
const { AuthProvider, useAuth } = await import("./AuthContext");

const TOKEN_KEY = "pocketninja_token";

const Probe = () => {
  const { user, token, isLoading, login, register, logout } = useAuth();

  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="token">{token || "none"}</span>
      <span data-testid="user">{user ? user.name : "none"}</span>
      <button onClick={() => login("a@b.c", "pw").catch(() => {})}>login</button>
      <button onClick={() => register("Ada", "a@b.c", "pw").catch(() => {})}>register</button>
      <button onClick={logout}>logout</button>
    </div>
  );
};

const renderProbe = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("AuthContext — initial session restore", () => {
  test("finishes loading with no user when no token is stored", async () => {
    renderProbe();

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(api.get).not.toHaveBeenCalled();
  });

  test("restores the user from /auth/me when a token is stored", async () => {
    localStorage.setItem(TOKEN_KEY, "stored-token");
    api.get.mockResolvedValue({ data: { user: { name: "Ada", email: "a@b.c" } } });

    renderProbe();

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("Ada"));
    expect(api.get).toHaveBeenCalledWith("/auth/me");
    expect(screen.getByTestId("token")).toHaveTextContent("stored-token");
  });

  test("logs out and clears storage when the stored token is rejected", async () => {
    // An expired token must not leave the app in a half-authenticated state.
    localStorage.setItem(TOKEN_KEY, "expired");
    api.get.mockRejectedValue({ response: { status: 401 } });
    vi.spyOn(console, "error").mockImplementation(() => {});

    renderProbe();

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(screen.getByTestId("token")).toHaveTextContent("none");
    expect(localStorage.getItem(TOKEN_KEY)).toBe(null);
  });

  test("isLoading starts true so ProtectedRoute does not redirect prematurely", () => {
    localStorage.setItem(TOKEN_KEY, "t");
    api.get.mockReturnValue(new Promise(() => {}));

    renderProbe();

    expect(screen.getByTestId("loading")).toHaveTextContent("true");
  });
});

describe("AuthContext — login", () => {
  test("stores the token and sets the user", async () => {
    api.post.mockResolvedValue({
      data: { token: "new-token", user: { name: "Ada", email: "a@b.c" } },
    });
    api.get.mockResolvedValue({ data: { user: { name: "Ada" } } });

    renderProbe();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    await userEvent.click(screen.getByText("login"));

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("Ada"));
    expect(localStorage.getItem(TOKEN_KEY)).toBe("new-token");
    expect(api.post).toHaveBeenCalledWith("/auth/login", {
      email: "a@b.c",
      password: "pw",
    });
  });

  test("a failed login leaves the app logged out and stores nothing", async () => {
    api.post.mockRejectedValue({ response: { data: { error: "Invalid email or password" } } });

    renderProbe();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    await userEvent.click(screen.getByText("login"));

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("none"));
    expect(localStorage.getItem(TOKEN_KEY)).toBe(null);
  });

  test("login rejects so the page can render the server's message", async () => {
    const failure = { response: { data: { error: "Invalid email or password" } } };
    api.post.mockRejectedValue(failure);

    let auth;
    const Capture = () => {
      auth = useAuth();
      return null;
    };
    render(
      <AuthProvider>
        <Capture />
      </AuthProvider>,
    );

    await waitFor(() => expect(auth.isLoading).toBe(false));
    await expect(auth.login("a@b.c", "pw")).rejects.toBe(failure);
  });
});

describe("AuthContext — register", () => {
  test("stores the token and sets the user", async () => {
    api.post.mockResolvedValue({
      data: { token: "reg-token", user: { name: "Grace", email: "g@h.i" } },
    });
    api.get.mockResolvedValue({ data: { user: { name: "Grace" } } });

    renderProbe();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    await userEvent.click(screen.getByText("register"));

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("Grace"));
    expect(localStorage.getItem(TOKEN_KEY)).toBe("reg-token");
    expect(api.post).toHaveBeenCalledWith("/auth/register", {
      name: "Ada",
      email: "a@b.c",
      password: "pw",
    });
  });

  test("a failed registration stores nothing", async () => {
    api.post.mockRejectedValue({ response: { data: { error: "Email already registered" } } });

    renderProbe();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    await userEvent.click(screen.getByText("register"));

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("none"));
    expect(localStorage.getItem(TOKEN_KEY)).toBe(null);
  });
});

describe("AuthContext — logout", () => {
  test("clears the token, the user and localStorage", async () => {
    localStorage.setItem(TOKEN_KEY, "t");
    api.get.mockResolvedValue({ data: { user: { name: "Ada" } } });

    renderProbe();
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("Ada"));

    await userEvent.click(screen.getByText("logout"));

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("none"));
    expect(screen.getByTestId("token")).toHaveTextContent("none");
    expect(localStorage.getItem(TOKEN_KEY)).toBe(null);
  });

  test("logging out twice is safe", async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    await userEvent.click(screen.getByText("logout"));
    await userEvent.click(screen.getByText("logout"));

    expect(screen.getByTestId("token")).toHaveTextContent("none");
  });
});

describe("AuthContext — useAuth", () => {
  test("exposes the full context shape", async () => {
    let auth;
    const Capture = () => {
      auth = useAuth();
      return null;
    };
    render(
      <AuthProvider>
        <Capture />
      </AuthProvider>,
    );

    await waitFor(() => expect(auth.isLoading).toBe(false));
    expect(Object.keys(auth).sort()).toEqual([
      "isLoading",
      "login",
      "logout",
      "register",
      "token",
      "user",
    ]);
  });

  test("returns undefined outside a provider", () => {
    // Documents the sharp edge: there is no throw-on-missing-provider guard,
    // so a component rendered outside AuthProvider gets undefined.
    let auth = "unset";
    const Capture = () => {
      auth = useAuth();
      return null;
    };
    render(<Capture />);

    expect(auth).toBeUndefined();
  });
});
