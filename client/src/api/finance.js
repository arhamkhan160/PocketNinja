import api from "./axios";

// Drop empty filter values so an unset dropdown doesn't send `?category=`.
const clean = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== "" && v != null),
  );

// --- Categories (PROJECT_PLAN.md §6 — owner: Ibrahim) ---
export const getCategories = () => api.get("/categories").then((res) => res.data);

export const createCategory = (payload) =>
  api.post("/categories", payload).then((res) => res.data);

export const updateCategory = (id, payload) =>
  api.put(`/categories/${id}`, payload).then((res) => res.data);

export const deleteCategory = (id) => api.delete(`/categories/${id}`);

// --- Transactions ---  filters: { category, type, from, to }
export const getTransactions = (filters = {}) =>
  api.get("/transactions", { params: clean(filters) }).then((res) => res.data);

export const createTransaction = (payload) =>
  api.post("/transactions", payload).then((res) => res.data);

export const updateTransaction = (id, payload) =>
  api.put(`/transactions/${id}`, payload).then((res) => res.data);

export const deleteTransaction = (id) => api.delete(`/transactions/${id}`);

// --- Budgets ---
export const getBudgets = (month) =>
  api.get("/budgets", { params: clean({ month }) }).then((res) => res.data);

export const createBudget = (payload) =>
  api.post("/budgets", payload).then((res) => res.data);

export const updateBudget = (id, payload) =>
  api.put(`/budgets/${id}`, payload).then((res) => res.data);

export const deleteBudget = (id) => api.delete(`/budgets/${id}`);
