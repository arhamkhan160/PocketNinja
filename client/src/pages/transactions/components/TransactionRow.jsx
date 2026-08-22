import React from "react";
import { Pencil, Trash2 } from "lucide-react";
import Button from "../../../components/ui/Button";
import AmountText from "./AmountText";
import { formatDate } from "../../../utils/format";

const TransactionRow = ({ transaction, category, onEdit, onDelete }) => (
  <tr className="border-b border-[#E7E5E4] last:border-0 hover:bg-[#FAF8F5]">
    <td className="px-4 py-3 text-[#78716C] whitespace-nowrap">
      {formatDate(transaction.date)}
    </td>
    <td className="px-4 py-3 text-[#1C1917]">
      {category
        ? `${category.icon ? category.icon + " " : ""}${category.name}`
        : "Uncategorized"}
    </td>
    <td className="px-4 py-3 text-[#78716C]">{transaction.note || "-"}</td>
    <td className="px-4 py-3 text-right whitespace-nowrap">
      <AmountText amount={transaction.amount} type={transaction.type} />
    </td>
    <td className="px-4 py-3">
      <div className="flex justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(transaction)}
          aria-label="Edit transaction"
        >
          <Pencil size={16} />
        </Button>
        <Button
          variant="dangerGhost"
          size="icon"
          onClick={() => onDelete(transaction)}
          aria-label="Delete transaction"
        >
          <Trash2 size={16} />
        </Button>
      </div>
    </td>
  </tr>
);

export default TransactionRow;
