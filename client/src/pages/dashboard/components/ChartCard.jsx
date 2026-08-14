import React from 'react';

/**
 * Shared card shell for every dashboard chart: title/subtitle, a fixed-height
 * body, and built-in loading / empty / error states so no chart ever renders
 * a bare blank box.
 */
const ChartCard = ({ title, subtitle, isLoading, isEmpty, emptyMessage, error, height = 300, children }) => {
  return (
    <div className="lm-card p-6">
      <div className="mb-4">
        <h3 className="font-semibold text-[#1C1917]">{title}</h3>
        {subtitle && <p className="text-sm text-[#78716C]">{subtitle}</p>}
      </div>

      <div style={{ minHeight: height }} className="relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full h-full animate-pulse bg-[#F5F3F0] rounded-lg" />
          </div>
        )}

        {!isLoading && error && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-1 py-10">
            <p className="text-sm font-medium text-[#EF4444]">Couldn't load this chart</p>
            <p className="text-xs text-[#78716C]">{error}</p>
          </div>
        )}

        {!isLoading && !error && isEmpty && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-1 py-10">
            <p className="text-sm font-medium text-[#1C1917]">Nothing here yet</p>
            <p className="text-xs text-[#78716C] max-w-xs">{emptyMessage}</p>
          </div>
        )}

        {!isLoading && !error && !isEmpty && children}
      </div>
    </div>
  );
};

export default ChartCard;
