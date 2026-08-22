import React, { useMemo } from "react";
import Card from "../../../components/ui/Card";
import DataState from "../../../components/ui/DataState";
import BudgetRow from "./BudgetRow";

const BudgetList = ({ budgets, categories, isLoading, error, onDelete }) => {
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category._id, category])),
    [categories],
  );

  // A null categoryId is the overall monthly cap (PROJECT_PLAN.md §5).
  const nameFor = (categoryId) =>
    categoryId ? categoryById.get(categoryId)?.name || "Uncategorized" : "Overall";

  return (
    <Card className="divide-y divide-[#E7E5E4]">
      <DataState
        isLoading={isLoading}
        error={error}
        isEmpty={budgets.length === 0}
        errorTitle="Couldn't load budgets"
        emptyTitle="No budgets for this month"
        emptyMessage="Set one above - the dashboard picks it up right away."
      >
        <>
          {budgets.map((budget) => (
            <BudgetRow
              key={budget._id}
              budget={budget}
              categoryName={nameFor(budget.categoryId)}
              onDelete={onDelete}
            />
          ))}
        </>
      </DataState>
    </Card>
  );
};

export default BudgetList;
