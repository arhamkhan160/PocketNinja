import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("./axios", () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: [] })),
    post: vi.fn(() => Promise.resolve({ data: "POST_RESULT" })),
    put: vi.fn(() => Promise.resolve({ data: "PUT_RESULT" })),
    delete: vi.fn(() => Promise.resolve({ data: null })),
  },
}));

const api = (await import("./axios")).default;
const planning = await import("./planning");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("api/planning — recurring rules", () => {
  test("getRecurring unwraps data from /recurring", async () => {
    api.get.mockResolvedValueOnce({ data: [{ _id: "r1" }] });

    await expect(planning.getRecurring()).resolves.toEqual([{ _id: "r1" }]);
    expect(api.get).toHaveBeenCalledWith("/recurring");
  });

  test("create, update and delete hit the right paths", async () => {
    await planning.createRecurring({ interval: "daily" });
    expect(api.post).toHaveBeenCalledWith("/recurring", { interval: "daily" });

    await planning.updateRecurring("r1", { active: false });
    expect(api.put).toHaveBeenCalledWith("/recurring/r1", { active: false });

    await planning.deleteRecurring("r1");
    expect(api.delete).toHaveBeenCalledWith("/recurring/r1");
  });

  test("runRecurringNow posts to the manual trigger", async () => {
    api.post.mockResolvedValueOnce({ data: { rulesProcessed: 2, transactionsCreated: 3 } });

    await expect(planning.runRecurringNow()).resolves.toEqual({
      rulesProcessed: 2,
      transactionsCreated: 3,
    });
    expect(api.post).toHaveBeenCalledWith("/recurring/run-now");
  });
});

describe("api/planning — goals", () => {
  test("getGoals unwraps data from /goals", async () => {
    api.get.mockResolvedValueOnce({ data: [{ _id: "g1" }] });

    await expect(planning.getGoals()).resolves.toEqual([{ _id: "g1" }]);
    expect(api.get).toHaveBeenCalledWith("/goals");
  });

  test("create, update and delete hit the right paths", async () => {
    await planning.createGoal({ title: "Laptop", target: 10 });
    expect(api.post).toHaveBeenCalledWith("/goals", { title: "Laptop", target: 10 });

    await planning.updateGoal("g1", { saved: 50 });
    expect(api.put).toHaveBeenCalledWith("/goals/g1", { saved: 50 });

    await planning.deleteGoal("g1");
    expect(api.delete).toHaveBeenCalledWith("/goals/g1");
  });
});

describe("api/planning — getCategoriesSafe", () => {
  test("returns the category array on success", async () => {
    api.get.mockResolvedValueOnce({ data: [{ _id: "c1", name: "Food" }] });

    await expect(planning.getCategoriesSafe()).resolves.toEqual([
      { _id: "c1", name: "Food" },
    ]);
  });

  test("returns [] when the endpoint is missing (404)", async () => {
    // The whole point: the planning page must survive Ibrahim's slice being
    // absent rather than erroring the whole screen.
    api.get.mockRejectedValueOnce({ response: { status: 404 } });

    await expect(planning.getCategoriesSafe()).resolves.toEqual([]);
  });

  test("returns [] when the response body is not an array", async () => {
    api.get.mockResolvedValueOnce({ data: { unexpected: "shape" } });

    await expect(planning.getCategoriesSafe()).resolves.toEqual([]);
  });

  test("returns [] for a null body", async () => {
    api.get.mockResolvedValueOnce({ data: null });

    await expect(planning.getCategoriesSafe()).resolves.toEqual([]);
  });

  test("re-throws a 401 — an auth failure must not look like an empty list", async () => {
    const unauthorized = { response: { status: 401 } };
    api.get.mockRejectedValueOnce(unauthorized);

    await expect(planning.getCategoriesSafe()).rejects.toBe(unauthorized);
  });

  test("re-throws a 500 and a network error", async () => {
    const serverError = { response: { status: 500 } };
    api.get.mockRejectedValueOnce(serverError);
    await expect(planning.getCategoriesSafe()).rejects.toBe(serverError);

    const networkError = new Error("Network Error");
    api.get.mockRejectedValueOnce(networkError);
    await expect(planning.getCategoriesSafe()).rejects.toBe(networkError);
  });
});
