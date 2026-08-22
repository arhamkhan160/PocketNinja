import React from "react";
import { cn } from "../../../lib/cn";
import { formatCurrency } from "../../../utils/format";

const AmountText = ({ amount, type, className }) => (
  <span
    className={cn(
      "font-semibold",
      type === "income" ? "text-[#0D9488]" : "text-[#EF4444]",
      className,
    )}
  >
    {type === "income" ? "+" : "-"} {formatCurrency(amount)}
  </span>
);

export default AmountText;
