import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ChartCard from './ChartCard';
import { INCOME_COLOR, EXPENSE_COLOR, GRID_COLOR, AXIS_TEXT_COLOR } from '../chartColors';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

const formatMonthTick = (period) => {
  const [year, mon] = period.split('-').map(Number);
  return new Date(Date.UTC(year, mon - 1, 1)).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="lm-card px-3 py-2 text-sm shadow-lg space-y-1">
      <p className="font-medium text-[#78716C]">{formatMonthTick(label)}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span className="w-2.5 h-0.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="font-semibold text-[#1C1917]">{formatCurrency(entry.value)}</span>
          <span className="text-[#78716C] capitalize">{entry.dataKey}</span>
        </div>
      ))}
    </div>
  );
};

const IncomeExpenseBarChart = ({ isLoading, error, rows }) => {
  const hasData = rows?.some((r) => r.income > 0 || r.expense > 0);

  return (
    <ChartCard
      title="Income vs. expense"
      subtitle="Monthly totals, one shared scale"
      isLoading={isLoading}
      error={error}
      isEmpty={!isLoading && !error && !hasData}
      emptyMessage="No transactions in this range yet."
      height={280}
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={rows} barGap={4} barCategoryGap="24%">
          <CartesianGrid vertical={false} stroke={GRID_COLOR} strokeDasharray="0" />
          <XAxis
            dataKey="period"
            tickFormatter={formatMonthTick}
            axisLine={{ stroke: GRID_COLOR }}
            tickLine={false}
            tick={{ fill: AXIS_TEXT_COLOR, fontSize: 12 }}
          />
          <YAxis
            tickFormatter={formatCurrency}
            axisLine={false}
            tickLine={false}
            tick={{ fill: AXIS_TEXT_COLOR, fontSize: 12 }}
            width={64}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#FAF8F5' }} />
          <Legend formatter={(value) => <span className="text-[#78716C] text-sm capitalize">{value}</span>} />
          <Bar dataKey="income" name="income" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="expense" name="expense" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

export default IncomeExpenseBarChart;
