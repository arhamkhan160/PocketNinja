import { describe, test, expect, beforeEach } from "vitest";
import api from "./axios";

/**
 * The interceptor is the single place the JWT is attached. Rather than mock
 * axios, we run its real request-interceptor chain and inspect the config it
 * produces.
 */
const runInterceptor = async (config = { headers: {} }) => {
  const handler = api.interceptors.request.handlers.find(Boolean);
  return handler.fulfilled(config);
};

describe("api/axios", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("points at the API base path", () => {
    expect(api.defaults.baseURL).toMatch(/\/api$/);
  });

  test("attaches a Bearer token when one is stored", async () => {
    localStorage.setItem("pocketninja_token", "abc123");

    const config = await runInterceptor();

    expect(config.headers.Authorization).toBe("Bearer abc123");
  });

  test("sends no Authorization header when logged out", async () => {
    const config = await runInterceptor();

    expect(config.headers.Authorization).toBeUndefined();
  });

  test("reads the token fresh on every request", async () => {
    // Login must take effect without a page reload, so the value cannot be
    // captured once at module load.
    const before = await runInterceptor();
    expect(before.headers.Authorization).toBeUndefined();

    localStorage.setItem("pocketninja_token", "new-token");
    const after = await runInterceptor();

    expect(after.headers.Authorization).toBe("Bearer new-token");
  });

  test("uses the same storage key AuthContext writes", async () => {
    localStorage.setItem("pocketninja_token", "k");
    const config = await runInterceptor();

    expect(config.headers.Authorization).toBe("Bearer k");
  });

  test("preserves headers the caller already set", async () => {
    localStorage.setItem("pocketninja_token", "abc");

    const config = await runInterceptor({ headers: { "X-Custom": "value" } });

    expect(config.headers["X-Custom"]).toBe("value");
    expect(config.headers.Authorization).toBe("Bearer abc");
  });

  test("an empty stored token is treated as logged out", async () => {
    localStorage.setItem("pocketninja_token", "");

    const config = await runInterceptor();

    expect(config.headers.Authorization).toBeUndefined();
  });

  test("the rejection handler passes errors straight through", async () => {
    const handler = api.interceptors.request.handlers.find(Boolean);
    const boom = new Error("boom");

    await expect(handler.rejected(boom)).rejects.toBe(boom);
  });
});
