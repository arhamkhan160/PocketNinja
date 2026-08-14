import React from 'react';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value || 0);

const StatTile = ({ label, value, icon, accentClass, iconBgClass }) => (
  <div className="lm-card p-6 flex items-center gap-4">
    <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${iconBgClass}`}>{icon}</div>
    <div className="min-w-0">
      <p className="text-sm text-[#78716C]">{label}</p>
      <p className={`text-2xl font-bold truncate ${accentClass}`}>{formatCurrency(value)}</p>
    </div>
  </div>
);

/** The dashboard's KPI row — stat tiles, not a chart (see dataviz skill: choosing-a-form.md). */
const SummaryCards = ({ isLoading, summary }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="lm-card p-6 h-[84px] animate-pulse bg-[#F5F3F0]" />
        ))}
      </div>
    );
  }

  const { totalIncome = 0, totalExpense = 0, balance = 0 } = summary || {};

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatTile
        label="Income"
        value={totalIncome}
        icon={<TrendingUp size={20} className="text-[#0D9488]" />}
        iconBgClass="bg-[#0D9488]/10"
        accentClass="text-[#1C1917]"
      />
      <StatTile
        label="Expense"
        value={totalExpense}
        icon={<TrendingDown size={20} className="text-[#EF4444]" />}
        iconBgClass="bg-[#EF4444]/10"
        accentClass="text-[#1C1917]"
      />
      <StatTile
        label="Balance"
        value={balance}
        icon={<Wallet size={20} className="text-[#D97706]" />}
        iconBgClass="bg-[#FEF3C7]"
        accentClass={balance < 0 ? 'text-[#EF4444]' : 'text-[#1C1917]'}
      />
    </div>
  );
};

export default SummaryCards;
