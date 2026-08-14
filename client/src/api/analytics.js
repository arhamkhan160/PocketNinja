import api from './axios';

export const getSummary = (month) =>
  api.get('/analytics/summary', { params: { month } }).then((res) => res.data);

export const getByCategory = (month, type = 'expense') =>
  api.get('/analytics/by-category', { params: { month, type } }).then((res) => res.data);

export const getTrend = (from, to) =>
  api.get('/analytics/trend', { params: { from, to, groupBy: 'month' } }).then((res) => res.data);

export const getBudgetStatus = (month) =>
  api.get('/analytics/budget-status', { params: { month } }).then((res) => res.data);
