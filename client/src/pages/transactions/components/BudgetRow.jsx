import React from "react";
import { Trash2 } from "lucide-react";
import Button from "../../../components/ui/Button";
import { formatCurrency } from "../../../utils/format";

const BudgetRow = ({ budget, categoryName, onDelete }) => (
  <div className="flex items-center gap-3 p-4">
    <span className="font-medium text-[#1C1917]">{categoryName}</span>
    <span className="ml-auto text-[#78716C]">{formatCurrency(budget.limit)}</span>
    <Button
      variant="dangerGhost"
      size="icon"
      onClick={() => onDelete(budget)}
      aria-label="Delete budget"
    >
      <Trash2 size={16} />
    </Button>
  </div>
);

export default BudgetRow;
