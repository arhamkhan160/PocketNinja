import React, { useMemo } from "react";
import TransactionRow from "./TransactionRow";

const COLUMNS = ["Date", "Category", "Note", "Amount", "Actions"];
const RIGHT_ALIGNED = ["Amount", "Actions"];

/**
 * The list endpoint returns raw categoryIds (API contract §6) — names are
 * resolved here from the categories the page already loaded for its dropdown,
 * so the backend contract stays untouched.
 */
const TransactionTable = ({ transactions, categories, onEdit, onDelete }) => {
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category._id, category])),
    [categories],
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[#78716C] border-b border-[#E7E5E4]">
            {COLUMNS.map((column) => (
              <th
                key={column}
                className={`px-4 py-3 font-medium ${
                  RIGHT_ALIGNED.includes(column) ? "text-right" : ""
                }`}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <TransactionRow
              key={transaction._id}
              transaction={transaction}
              category={categoryById.get(transaction.categoryId)}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TransactionTable;
