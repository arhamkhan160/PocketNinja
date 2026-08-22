// Shared formatting helpers for the Planning slice (§10.4).
// Currency formatting mirrors pages/dashboard/components/BudgetProgress.jsx so
// amounts read identically across the dashboard and these screens.

export const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

export const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

/** ISO date (yyyy-mm-dd) for <input type="date"> round-tripping, in UTC. */
export const toDateInputValue = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

export const todayInputValue = () => new Date().toISOString().slice(0, 10);

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole days from today (UTC midnight) to `value`. Negative = in the past.
 * Both sides are floored to midnight so "later today" reads as 0, not -1.
 */
export const daysUntil = (value) => {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;

  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const targetUTC = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());

  return Math.round((targetUTC - todayUTC) / DAY_MS);
};

/** Human due label + a severity used to pick badge colors. */
export const dueLabel = (value) => {
  const days = daysUntil(value);
  if (days === null) return { text: 'No date', severity: 'neutral' };
  if (days < 0) return { text: `Overdue by ${Math.abs(days)}d`, severity: 'overdue' };
  if (days === 0) return { text: 'Due today', severity: 'today' };
  if (days === 1) return { text: 'Due tomorrow', severity: 'soon' };
  if (days <= 7) return { text: `Due in ${days} days`, severity: 'soon' };
  return { text: `Due in ${days} days`, severity: 'later' };
};

export const INTERVAL_LABELS = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

/** Reads the server's `{ error }` shape, same convention as DashboardPage. */
export const errorMessage = (err) =>
  err?.response?.data?.error || 'Something went wrong. Try again.';
