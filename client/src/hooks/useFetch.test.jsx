import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import useFetch from "./useFetch";

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("hooks/useFetch", () => {
  test("starts in the loading state with no data", () => {
    const { result } = renderHook(() => useFetch(() => new Promise(() => {}), []));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(null);
  });

  test("resolves to data and clears loading", async () => {
    const { result } = renderHook(() => useFetch(() => Promise.resolve([1, 2]), []));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual([1, 2]);
    expect(result.current.error).toBe(null);
  });

  test("maps a server error to its message and leaves data null", async () => {
    const fetcher = () =>
      Promise.reject({ response: { data: { error: "Category not found" } } });

    const { result } = renderHook(() => useFetch(fetcher, []));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe("Category not found");
    expect(result.current.data).toBe(null);
  });

  test("falls back to a generic message for a network failure", async () => {
    const { result } = renderHook(() =>
      useFetch(() => Promise.reject(new Error("Network Error")), []),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe("Something went wrong. Try again.");
  });

  test("runs the fetcher exactly once on mount", async () => {
    const fetcher = vi.fn(() => Promise.resolve("x"));
    const { result } = renderHook(() => useFetch(fetcher, []));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test("reload re-runs the fetcher and refreshes the data", async () => {
    let call = 0;
    const fetcher = vi.fn(() => Promise.resolve(++call));

    const { result } = renderHook(() => useFetch(fetcher, []));
    await waitFor(() => expect(result.current.data).toBe(1));

    await act(async () => {
      result.current.reload();
    });

    await waitFor(() => expect(result.current.data).toBe(2));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test("reload clears a previous error on success", async () => {
    let shouldFail = true;
    const fetcher = () =>
      shouldFail ? Promise.reject(new Error("boom")) : Promise.resolve("ok");

    const { result } = renderHook(() => useFetch(fetcher, []));
    await waitFor(() => expect(result.current.error).toBeTruthy());

    shouldFail = false;
    await act(async () => {
      result.current.reload();
    });

    await waitFor(() => expect(result.current.data).toBe("ok"));
    expect(result.current.error).toBe(null);
  });

  test("re-fetches when a dependency changes", async () => {
    const fetcher = vi.fn((id) => Promise.resolve(`data-${id}`));

    const { result, rerender } = renderHook(({ id }) => useFetch(() => fetcher(id), [id]), {
      initialProps: { id: 1 },
    });

    await waitFor(() => expect(result.current.data).toBe("data-1"));

    rerender({ id: 2 });

    await waitFor(() => expect(result.current.data).toBe("data-2"));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test("does not re-fetch when dependencies are unchanged", async () => {
    const fetcher = vi.fn(() => Promise.resolve("x"));

    const { result, rerender } = renderHook(() => useFetch(fetcher, [1]));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender();
    rerender();

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test("ignores a stale response that a newer request superseded", async () => {
    // The race the requestId guard exists for: filter A is slow, filter B is
    // fast, and A must not overwrite B's result when it finally lands.
    const slow = deferred();
    const fast = deferred();
    let call = 0;
    const fetcher = () => (++call === 1 ? slow.promise : fast.promise);

    const { result, rerender } = renderHook(({ id }) => useFetch(fetcher, [id]), {
      initialProps: { id: 1 },
    });

    rerender({ id: 2 });

    await act(async () => {
      fast.resolve("SECOND");
      await fast.promise;
    });
    await waitFor(() => expect(result.current.data).toBe("SECOND"));

    await act(async () => {
      slow.resolve("FIRST");
      await slow.promise;
    });

    expect(result.current.data).toBe("SECOND");
  });

  test("a stale rejection does not clobber a newer success", async () => {
    const slow = deferred();
    const fast = deferred();
    let call = 0;
    const fetcher = () => (++call === 1 ? slow.promise : fast.promise);

    const { result, rerender } = renderHook(({ id }) => useFetch(fetcher, [id]), {
      initialProps: { id: 1 },
    });

    rerender({ id: 2 });

    await act(async () => {
      fast.resolve("GOOD");
      await fast.promise;
    });
    await waitFor(() => expect(result.current.data).toBe("GOOD"));

    await act(async () => {
      slow.reject(new Error("stale failure"));
      await slow.promise.catch(() => {});
    });

    expect(result.current.data).toBe("GOOD");
    expect(result.current.error).toBe(null);
  });

  test("handles a fetcher that throws synchronously", async () => {
    const { result } = renderHook(() =>
      useFetch(() => {
        throw new Error("sync boom");
      }, []),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe("Something went wrong. Try again.");
  });

  test("preserves falsy-but-valid payloads like an empty array", async () => {
    const { result } = renderHook(() => useFetch(() => Promise.resolve([]), []));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual([]);
  });

  test("exposes a stable reload identity across renders with equal deps", async () => {
    const { result, rerender } = renderHook(() => useFetch(() => Promise.resolve(1), [1]));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const first = result.current.reload;
    rerender();

    expect(result.current.reload).toBe(first);
  });
});
