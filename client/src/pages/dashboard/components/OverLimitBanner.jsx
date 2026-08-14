import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

/** Surfaces over-limit budgets as a dismissible banner above the dashboard grid. */
const OverLimitBanner = ({ overLimitRows, onDismiss }) => {
  if (!overLimitRows || overLimitRows.length === 0) return null;

  const names = overLimitRows.map((r) => r.categoryName).join(', ');

  return (
    <div className="lm-card border-l-4 border-l-[#EF4444] bg-[#FEE2E2]/40 p-4 flex items-start gap-3">
      <AlertTriangle size={20} className="text-[#EF4444] shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#1C1917]">
          {overLimitRows.length === 1 ? 'Over budget' : `Over budget on ${overLimitRows.length} categories`}
        </p>
        <p className="text-sm text-[#78716C] truncate">{names}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-[#78716C] hover:text-[#1C1917] shrink-0"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

export default OverLimitBanner;
