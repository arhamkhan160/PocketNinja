import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const shiftMonth = (month, delta) => {
  const [year, mon] = month.split('-').map(Number);
  const d = new Date(Date.UTC(year, mon - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

const formatMonthLabel = (month) => {
  const [year, mon] = month.split('-').map(Number);
  return new Date(Date.UTC(year, mon - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

/**
 * The one filter row that scopes every chart on the dashboard — never a
 * per-chart control (see dataviz skill: interaction.md).
 */
const MonthSelector = ({ month, onChange }) => {
  return (
    <div className="flex items-center gap-2 lm-card px-2 py-2 w-fit">
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, -1))}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-[#78716C] hover:bg-[#FAF8F5] hover:text-[#1C1917] transition-colors"
        aria-label="Previous month"
      >
        <ChevronLeft size={18} />
      </button>

      <label className="relative">
        <span className="sr-only">Select month</span>
        <span className="px-2 text-sm font-medium text-[#1C1917] min-w-[140px] inline-block text-center">
          {formatMonthLabel(month)}
        </span>
        <input
          type="month"
          value={month}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </label>

      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, 1))}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-[#78716C] hover:bg-[#FAF8F5] hover:text-[#1C1917] transition-colors"
        aria-label="Next month"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
};

export default MonthSelector;
