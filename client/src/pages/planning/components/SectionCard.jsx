import React from 'react';

/**
 * Card shell for every Planning section: title/subtitle, an optional header
 * action, and built-in loading / empty / error states.
 *
 * Deliberately the same shape as pages/dashboard/components/ChartCard.jsx so
 * the two slices read as one app — that file is chart-specific (fixed body
 * height for Recharts), this one flows to its content.
 */
const SectionCard = ({
  title,
  subtitle,
  action,
  isLoading,
  error,
  isEmpty,
  emptyMessage,
  children,
}) => {
  return (
    <section className="lm-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-[#1C1917]">{title}</h3>
          {subtitle && <p className="text-sm text-[#78716C]">{subtitle}</p>}
        </div>
        {action}
      </div>

      {isLoading && (
        <div className="space-y-3" aria-hidden="true">
          <div className="h-14 animate-pulse bg-[#F5F3F0] rounded-lg" />
          <div className="h-14 animate-pulse bg-[#F5F3F0] rounded-lg" />
        </div>
      )}

      {!isLoading && error && (
        <div className="flex flex-col items-center justify-center text-center gap-1 py-10">
          <p className="text-sm font-medium text-[#EF4444]">Couldn&apos;t load this section</p>
          <p className="text-xs text-[#78716C]">{error}</p>
        </div>
      )}

      {!isLoading && !error && isEmpty && (
        <div className="flex flex-col items-center justify-center text-center gap-1 py-10">
          <p className="text-sm font-medium text-[#1C1917]">Nothing here yet</p>
          <p className="text-xs text-[#78716C] max-w-xs">{emptyMessage}</p>
        </div>
      )}

      {!isLoading && !error && !isEmpty && children}
    </section>
  );
};

export default SectionCard;
