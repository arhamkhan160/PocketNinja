import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("./axios", () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: "GET_RESULT" })),
    post: vi.fn(() => Promise.resolve({ data: "POST_RESULT" })),
    put: vi.fn(() => Promise.resolve({ data: "PUT_RESULT" })),
    delete: vi.fn(() => Promise.resolve({ status: 204 })),
  },
}));

const api = (await import("./axios")).default;
const finance = await import("./finance");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("api/finance — categories", () => {
  test("getCategories hits /categories and unwraps data", async () => {
    await expect(finance.getCategories()).resolves.toBe("GET_RESULT");
    expect(api.get).toHaveBeenCalledWith("/categories");
  });

  test("createCategory posts the payload", async () => {
    const payload = { name: "Food", type: "expense" };

    await expect(finance.createCategory(payload)).resolves.toBe("POST_RESULT");
    expect(api.post).toHaveBeenCalledWith("/categories", payload);
  });

  test("updateCategory puts to the id path", async () => {
    await finance.updateCategory("abc", { name: "New" });
    expect(api.put).toHaveBeenCalledWith("/categories/abc", { name: "New" });
  });

  test("deleteCategory deletes the id path", async () => {
    await finance.deleteCategory("abc");
    expect(api.delete).toHaveBeenCalledWith("/categories/abc");
  });
});

describe("api/finance — transactions", () => {
  test("getTransactions with no filters sends an empty params object", async () => {
    await finance.getTransactions();
    expect(api.get).toHaveBeenCalledWith("/transactions", { params: {} });
  });

  test("passes through populated filters", async () => {
    await finance.getTransactions({
      category: "c1",
      type: "expense",
      from: "2026-08-01",
      to: "2026-08-31",
    });

    expect(api.get).toHaveBeenCalledWith("/transactions", {
      params: { category: "c1", type: "expense", from: "2026-08-01", to: "2026-08-31" },
    });
  });

  test("strips empty-string filters so the server sees no filter at all", async () => {
    // `?category=` would otherwise reach the API as a real (invalid) filter.
    await finance.getTransactions({ category: "", type: "expense", from: "", to: "" });

    expect(api.get).toHaveBeenCalledWith("/transactions", {
      params: { type: "expense" },
    });
  });

  test("strips null and undefined filters", async () => {
    await finance.getTransactions({ category: null, type: undefined, from: "2026-01-01" });

    expect(api.get).toHaveBeenCalledWith("/transactions", {
      params: { from: "2026-01-01" },
    });
  });

  test("keeps a zero value — 0 is a legitimate filter value, not empty", () => {
    return finance.getTransactions({ amount: 0 }).then(() => {
      expect(api.get).toHaveBeenCalledWith("/transactions", { params: { amount: 0 } });
    });
  });

  test("create, update and delete hit the right paths", async () => {
    await finance.createTransaction({ amount: 1, type: "expense" });
    expect(api.post).toHaveBeenCalledWith("/transactions", { amount: 1, type: "expense" });

    await finance.updateTransaction("t1", { amount: 2 });
    expect(api.put).toHaveBeenCalledWith("/transactions/t1", { amount: 2 });

    await finance.deleteTransaction("t1");
    expect(api.delete).toHaveBeenCalledWith("/transactions/t1");
  });
});

describe("api/finance — budgets", () => {
  test("getBudgets sends the month when given", async () => {
    await finance.getBudgets("2026-08");
    expect(api.get).toHaveBeenCalledWith("/budgets", { params: { month: "2026-08" } });
  });

  test("getBudgets omits an undefined or empty month", async () => {
    await finance.getBudgets();
    expect(api.get).toHaveBeenCalledWith("/budgets", { params: {} });

    await finance.getBudgets("");
    expect(api.get).toHaveBeenLastCalledWith("/budgets", { params: {} });
  });

  test("create, update and delete hit the right paths", async () => {
    await finance.createBudget({ month: "2026-08", limit: 100 });
    expect(api.post).toHaveBeenCalledWith("/budgets", { month: "2026-08", limit: 100 });

    await finance.updateBudget("b1", { limit: 200 });
    expect(api.put).toHaveBeenCalledWith("/budgets/b1", { limit: 200 });

    await finance.deleteBudget("b1");
    expect(api.delete).toHaveBeenCalledWith("/budgets/b1");
  });
});

describe("api/finance — error propagation", () => {
  test("a rejected request propagates to the caller", async () => {
    const boom = new Error("network");
    api.get.mockRejectedValueOnce(boom);

    await expect(finance.getCategories()).rejects.toBe(boom);
  });
});
