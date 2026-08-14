import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getSummary, getByCategory, getTrend, getBudgetStatus } from '../../api/analytics';
import MonthSelector from './components/MonthSelector';
import OverLimitBanner from './components/OverLimitBanner';
import SummaryCards from './components/SummaryCards';
import CategoryPieChart from './components/CategoryPieChart';
import IncomeExpenseBarChart from './components/IncomeExpenseBarChart';
import TrendLineChart from './components/TrendLineChart';
import BudgetProgress from './components/BudgetProgress';

const currentMonth = () => new Date().toISOString().slice(0, 7);

const addMonths = (month, delta) => {
  const [year, mon] = month.split('-').map(Number);
  const d = new Date(Date.UTC(year, mon - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

const errorMessage = (err) => err?.response?.data?.error || 'Something went wrong. Try again.';

const initialSlice = { data: null, isLoading: true, error: null };

/**
 * The Analytics Dashboard — owner: Musabbereen (PROJECT_PLAN.md §10.3).
 * Renders against the live /api/analytics/* endpoints. Every chart carries
 * its own loading/empty/error state, so an empty database (before Ibrahim's
 * transaction CRUD has real data in it) just shows empty states, not blanks.
 */
const DashboardPage = () => {
  const [month, setMonth] = useState(currentMonth);
  const [summary, setSummary] = useState(initialSlice);
  const [byCategory, setByCategory] = useState(initialSlice);
  const [trend, setTrend] = useState(initialSlice);
  const [budgetStatus, setBudgetStatus] = useState(initialSlice);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const load = useCallback((targetMonth) => {
    setSummary((s) => ({ ...s, isLoading: true, error: null }));
    getSummary(targetMonth)
      .then((data) => setSummary({ data, isLoading: false, error: null }))
      .catch((err) => setSummary({ data: null, isLoading: false, error: errorMessage(err) }));

    setByCategory((s) => ({ ...s, isLoading: true, error: null }));
    getByCategory(targetMonth, 'expense')
      .then((data) => setByCategory({ data, isLoading: false, error: null }))
      .catch((err) => setByCategory({ data: null, isLoading: false, error: errorMessage(err) }));

    setBudgetStatus((s) => ({ ...s, isLoading: true, error: null }));
    getBudgetStatus(targetMonth)
      .then((data) => setBudgetStatus({ data, isLoading: false, error: null }))
      .catch((err) => setBudgetStatus({ data: null, isLoading: false, error: errorMessage(err) }));

    setTrend((s) => ({ ...s, isLoading: true, error: null }));
    getTrend(addMonths(targetMonth, -5), targetMonth)
      .then((data) => setTrend({ data, isLoading: false, error: null }))
      .catch((err) => setTrend({ data: null, isLoading: false, error: errorMessage(err) }));
  }, []);

  useEffect(() => {
    setBannerDismissed(false);
    load(month);
  }, [month, load]);

  const overLimitRows = useMemo(
    () => (budgetStatus.data || []).filter((row) => row.overLimit),
    [budgetStatus.data]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-bold text-[#1C1917]">Analytics</h3>
        <MonthSelector month={month} onChange={setMonth} />
      </div>

      {!bannerDismissed && (
        <OverLimitBanner overLimitRows={overLimitRows} onDismiss={() => setBannerDismissed(true)} />
      )}

      <SummaryCards isLoading={summary.isLoading} summary={summary.data} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryPieChart
          isLoading={byCategory.isLoading}
          error={byCategory.error}
          rows={byCategory.data}
          month={month}
        />
        <BudgetProgress isLoading={budgetStatus.isLoading} error={budgetStatus.error} rows={budgetStatus.data} />
        <IncomeExpenseBarChart isLoading={trend.isLoading} error={trend.error} rows={trend.data} />
        <TrendLineChart isLoading={trend.isLoading} error={trend.error} rows={trend.data} />
      </div>
    </div>
  );
};

export default DashboardPage;
