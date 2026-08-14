import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ChartCard from './ChartCard';
import { assignSliceColors } from '../chartColors';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { categoryName, total } = payload[0].payload;
  return (
    <div className="lm-card px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold text-[#1C1917]">{formatCurrency(total)}</p>
      <p className="text-[#78716C]">{categoryName}</p>
    </div>
  );
};

// Direct-label selectively: only slices carrying a meaningful share of the pie.
// Percent only (not the name) — keeps the label short enough to never clip
// against the card edge on narrow viewports; the legend carries the name.
const renderSliceLabel = ({ percent }) => (percent >= 0.08 ? `${(percent * 100).toFixed(0)}%` : '');

const CategoryPieChart = ({ isLoading, error, rows, month }) => {
  const data = assignSliceColors(rows);

  return (
    <ChartCard
      title="Spending by category"
      subtitle="Where this month's expenses went"
      isLoading={isLoading}
      error={error}
      isEmpty={!isLoading && !error && data.length === 0}
      emptyMessage="No expenses recorded for this month yet. Add a transaction to see the breakdown."
      height={300}
    >
      <ResponsiveContainer width="100%" height={300}>
        <PieChart margin={{ top: 16, right: 32, bottom: 8, left: 32 }}>
          <Pie
            data={data}
            dataKey="total"
            nameKey="categoryName"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={92}
            paddingAngle={2}
            label={renderSliceLabel}
            labelLine={false}
            isAnimationActive={false}
          >
            {data.map((entry) => (
              <Cell key={entry.categoryId} fill={entry.color} stroke="#FFFFFF" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => <span className="text-[#78716C] text-sm">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

export default CategoryPieChart;
