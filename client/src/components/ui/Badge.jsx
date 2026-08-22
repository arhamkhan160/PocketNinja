import React from "react";
import { cn } from "../../lib/cn";

const TONES = {
  neutral: "bg-[#FAF8F5] text-[#78716C]",
  income: "bg-[#0D9488]/10 text-[#0D9488]",
  expense: "bg-[#FEE2E2] text-[#EF4444]",
};

const Badge = ({ tone = "neutral", className, children }) => (
  <span
    className={cn(
      "text-xs px-2 py-0.5 rounded-full capitalize",
      TONES[tone] || TONES.neutral,
      className,
    )}
  >
    {children}
  </span>
);

export default Badge;
