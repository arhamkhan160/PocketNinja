import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

vi.mock("../api/finance", () => ({ getCategories: vi.fn() }));

const { getCategories } = await import("../api/finance");
const useCategories = (await import("./useCategories")).default;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hooks/useCategories", () => {
  test("returns the fetched categories", async () => {
    getCategories.mockResolvedValue([{ _id: "c1", name: "Food" }]);

    const { result } = renderHook(() => useCategories());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.categories).toEqual([{ _id: "c1", name: "Food" }]);
  });

  test("returns an array, never null, while loading", () => {
    getCategories.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useCategories());

    // Callers do categories.map(...) unconditionally, so null would crash them.
    expect(Array.isArray(result.current.categories)).toBe(true);
    expect(result.current.categories).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  test("returns an empty array on error, and surfaces the message", async () => {
    getCategories.mockRejectedValue({ response: { data: { error: "Nope" } } });

    const { result } = renderHook(() => useCategories());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.categories).toEqual([]);
    expect(result.current.error).toBe("Nope");
  });

  test("calls the endpoint exactly once on mount", async () => {
    getCategories.mockResolvedValue([]);

    const { result } = renderHook(() => useCategories());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getCategories).toHaveBeenCalledTimes(1);
  });

  test("reload re-fetches", async () => {
    getCategories.mockResolvedValue([]);

    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    getCategories.mockResolvedValue([{ _id: "new" }]);
    await act(async () => {
      result.current.reload();
    });

    await waitFor(() => expect(result.current.categories).toHaveLength(1));
    expect(getCategories).toHaveBeenCalledTimes(2);
  });

  test("exposes the full slice shape", async () => {
    getCategories.mockResolvedValue([]);

    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(Object.keys(result.current).sort()).toEqual([
      "categories",
      "error",
      "isLoading",
      "reload",
    ]);
  });
});
