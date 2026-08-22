import React from "react";

/**
 * Section header row. AppShell already renders the page title, so pages
 * usually pass only actions (children) and leave title/subtitle unset.
 */
const PageHeader = ({ title, subtitle, children }) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="min-w-0">
      {title && <h3 className="font-bold text-[#1C1917]">{title}</h3>}
      {subtitle && <p className="text-sm text-[#78716C]">{subtitle}</p>}
    </div>
    {children}
  </div>
);

export default PageHeader;
