import React from 'react';
import { AlertTriangle } from 'lucide-react';
import ChartCard from './ChartCard';
import { STATUS_GOOD, STATUS_WARNING, STATUS_CRITICAL } from '../chartColors';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

const statusFor = (spent, limit) => {
  if (limit <= 0) return { color: STATUS_GOOD, label: 'good' };
  const ratio = spent / limit;
  if (ratio >= 1) return { color: STATUS_CRITICAL, label: 'critical' };
  if (ratio >= 0.8) return { color: STATUS_WARNING, label: 'warning' };
  return { color: STATUS_GOOD, label: 'good' };
};

const BudgetMeter = ({ row }) => {
  const { categoryName, spent, limit, overLimit } = row;
  const { color, label } = statusFor(spent, limit);
  const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm font-medium text-[#1C1917] flex items-center gap-1.5">
          {overLimit && <AlertTriangle size={14} className="text-[#EF4444]" aria-label="Over budget" />}
          {categoryName}
        </span>
        <span className="text-xs text-[#78716C]">
          {formatCurrency(spent)} <span aria-hidden="true">/</span>{' '}
          <span className="sr-only">of</span> {formatCurrency(limit)} · {label}
        </span>
      </div>
      <div className="h-2 rounded-full bg-[#F5F3F0] overflow-hidden">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
};

const BudgetProgress = ({ isLoading, error, rows }) => {
  return (
    <ChartCard
      title="Budget status"
      subtitle="Spent vs. limit this month"
      isLoading={isLoading}
      error={error}
      isEmpty={!isLoading && !error && (!rows || rows.length === 0)}
      emptyMessage="No budgets set for this month yet."
      height={rows?.length ? undefined : 220}
    >
      <div className="space-y-5 py-1">
        {rows?.map((row) => (
          <BudgetMeter key={row.categoryId || 'overall'} row={row} />
        ))}
      </div>
    </ChartCard>
  );
};

export default BudgetProgress;
