import React from "react";
import { cn } from "../../lib/cn";

// Label + control + optional error, so every form row lines up identically.
const Field = ({ label, error, className, children }) => (
  <label className={cn("block", className)}>
    <span className="text-xs font-medium text-[#78716C]">{label}</span>
    {children}
    {error && <span className="mt-1 block text-xs text-[#EF4444]">{error}</span>}
  </label>
);

export default Field;
