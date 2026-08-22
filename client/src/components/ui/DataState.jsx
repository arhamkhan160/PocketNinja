import React from "react";

/**
 * Loading / error / empty gate for any list — the same job ChartCard does for
 * the dashboard charts. No list ever renders a bare blank box.
 */
const DataState = ({
  isLoading,
  error,
  isEmpty,
  emptyTitle = "Nothing here yet",
  emptyMessage,
  errorTitle = "Couldn't load this",
  skeletonHeight = 128,
  children,
}) => {
  if (isLoading) {
    return (
      <div
        className="m-4 animate-pulse bg-[#F5F3F0] rounded-lg"
        style={{ height: skeletonHeight }}
      />
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm font-medium text-[#EF4444]">{errorTitle}</p>
        <p className="text-xs text-[#78716C]">{error}</p>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm font-medium text-[#1C1917]">{emptyTitle}</p>
        {emptyMessage && (
          <p className="text-xs text-[#78716C]">{emptyMessage}</p>
        )}
      </div>
    );
  }

  return children;
};

export default DataState;
