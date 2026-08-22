import api from './axios';

// Recurring rules (PROJECT_PLAN.md §6 — owner: Mustain)
export const getRecurring = () => api.get('/recurring').then((res) => res.data);

export const createRecurring = (rule) => api.post('/recurring', rule).then((res) => res.data);

export const updateRecurring = (id, patch) => api.put(`/recurring/${id}`, patch).then((res) => res.data);

export const deleteRecurring = (id) => api.delete(`/recurring/${id}`).then((res) => res.data);

/** Manual cron trigger, scoped server-side to the caller. → { rulesProcessed, transactionsCreated } */
export const runRecurringNow = () => api.post('/recurring/run-now').then((res) => res.data);

// Savings goals
export const getGoals = () => api.get('/goals').then((res) => res.data);

export const createGoal = (goal) => api.post('/goals', goal).then((res) => res.data);

export const updateGoal = (id, patch) => api.put(`/goals/${id}`, patch).then((res) => res.data);

export const deleteGoal = (id) => api.delete(`/goals/${id}`).then((res) => res.data);

/**
 * Categories belong to Ibrahim's slice (§10.2) and may not be merged yet.
 * A recurring rule's template wants a categoryId, so this resolves to [] when
 * the endpoint isn't there instead of blowing up the whole page — the picker
 * then renders its "no categories yet" state and the rule saves uncategorized.
 *
 * Delete this in favour of his api/categories.js once that lands.
 */
export const getCategoriesSafe = () =>
  api
    .get('/categories')
    .then((res) => (Array.isArray(res.data) ? res.data : []))
    .catch((err) => {
      if (err?.response?.status === 404) return [];
      throw err;
    });
