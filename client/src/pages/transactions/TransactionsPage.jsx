import React, { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import PageHeader from "../../components/ui/PageHeader";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import DataState from "../../components/ui/DataState";
import TransactionFilterBar, {
  EMPTY_FILTERS,
} from "./components/TransactionFilterBar";
import TransactionTable from "./components/TransactionTable";
import TransactionFormDialog from "./components/TransactionFormDialog";
import useFetch from "../../hooks/useFetch";
import useCategories from "../../hooks/useCategories";
import { getTransactions, deleteTransaction } from "../../api/finance";
import { errorMessage } from "../../utils/format";

const TransactionsPage = () => {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [actionError, setActionError] = useState(null);

  const fetchTransactions = useCallback(() => getTransactions(filters), [filters]);
  const { data, isLoading, error, reload } = useFetch(fetchTransactions, [
    fetchTransactions,
  ]);
  const { categories } = useCategories();

  const transactions = data || [];

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (transaction) => {
    setEditing(transaction);
    setDialogOpen(true);
  };

  const remove = async (transaction) => {
    if (!window.confirm("Delete this transaction?")) return;
    setActionError(null);
    try {
      await deleteTransaction(transaction._id);
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  return (
    <AppShell
      title="Transactions"
      subtitle="Every income and expense you've recorded."
    >
      <div className="space-y-6">
        <PageHeader>
          <Button onClick={openAdd} className="ml-auto">
            <Plus size={16} />
            Add transaction
          </Button>
        </PageHeader>

        <TransactionFilterBar
          filters={filters}
          onChange={setFilters}
          categories={categories}
        />

        {actionError && <p className="text-sm text-[#EF4444]">{actionError}</p>}

        <Card className="overflow-hidden">
          <DataState
            isLoading={isLoading}
            error={error}
            isEmpty={transactions.length === 0}
            errorTitle="Couldn't load transactions"
            emptyTitle="No transactions yet"
            emptyMessage="Add one, or clear your filters."
            skeletonHeight={160}
          >
            <TransactionTable
              transactions={transactions}
              categories={categories}
              onEdit={openEdit}
              onDelete={remove}
            />
          </DataState>
        </Card>
      </div>

      <TransactionFormDialog
        open={dialogOpen}
        transaction={editing}
        categories={categories}
        onClose={() => setDialogOpen(false)}
        onSaved={reload}
      />
    </AppShell>
  );
};

export default TransactionsPage;
