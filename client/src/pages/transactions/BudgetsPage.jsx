import React, { useCallback, useState } from "react";
import AppShell from "../../components/layout/AppShell";
import Card from "../../components/ui/Card";
import PageHeader from "../../components/ui/PageHeader";
import MonthSelector from "../dashboard/components/MonthSelector";
import BudgetForm, { EMPTY_BUDGET } from "./components/BudgetForm";
import BudgetList from "./components/BudgetList";
import useFetch from "../../hooks/useFetch";
import useCategories from "../../hooks/useCategories";
import { getBudgets, createBudget, deleteBudget } from "../../api/finance";
import { currentMonth, errorMessage } from "../../utils/format";

const BudgetsPage = () => {
  const [month, setMonth] = useState(currentMonth);
  const [draft, setDraft] = useState(EMPTY_BUDGET);
  const [actionError, setActionError] = useState(null);

  const fetchBudgets = useCallback(() => getBudgets(month), [month]);
  const { data, isLoading, error, reload } = useFetch(fetchBudgets, [
    fetchBudgets,
  ]);
  const { categories } = useCategories();

  const save = async (e) => {
    e.preventDefault();
    setActionError(null);

    const limit = Number(draft.limit);
    if (!Number.isFinite(limit) || limit < 0) {
      return setActionError("Limit must be a number of 0 or more");
    }

    try {
      // POST upserts server-side, so this doubles as "edit the limit".
      await createBudget({ categoryId: draft.categoryId || null, month, limit });
      setDraft(EMPTY_BUDGET);
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const remove = async (budget) => {
    if (!window.confirm("Remove this budget?")) return;
    setActionError(null);
    try {
      await deleteBudget(budget._id);
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  return (
    <AppShell
      title="Budgets"
      subtitle="Monthly limits per category, or one overall cap."
    >
      <div className="space-y-6">
        <PageHeader>
          <div className="ml-auto">
            <MonthSelector month={month} onChange={setMonth} />
          </div>
        </PageHeader>

        <Card className="p-4">
          <BudgetForm
            value={draft}
            onChange={setDraft}
            onSubmit={save}
            categories={categories}
          />
        </Card>

        {actionError && <p className="text-sm text-[#EF4444]">{actionError}</p>}

        <BudgetList
          budgets={data || []}
          categories={categories}
          isLoading={isLoading}
          error={error}
          onDelete={remove}
        />
      </div>
    </AppShell>
  );
};

export default BudgetsPage;
