import React from "react";
import { cn } from "../../../lib/cn";

const DEFAUL_OPTIONS = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
];

const TypeToggle = ({
  value,
  onChange,
  options = DEFAUL_OPTIONS,
  className,
}) => (
  <div
    className={cn(
      "flex rounded-lg border border-[#E7E5E4] overflow-hidden",
      className,
    )}
    role="group"
  >
    {options.map((option) => (
      <button
        key={option.label}
        type="button"
        aria-pressed={value === option.value}
        onClick={() => onChange(option.value)}
        className={cn(
          "flex-1 px-3 py-2 text-sm font-medium transition-colors",
          value === option.value
            ? "bg-[#0D9488] text-white"
            : "bg-white text-[#78716C] hover:text-[#1C1917]",
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
);

export default TypeToggle;
