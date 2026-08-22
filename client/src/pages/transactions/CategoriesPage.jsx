import React, { useState } from "react";
import { Plus } from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import Card from "../../components/ui/Card";
import CategoryForm, { EMPTY_CATEGORY } from "./components/CategoryForm";
import CategoryList from "./components/CategoryList";
import useCategories from "../../hooks/useCategories";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "../../api/finance";
import { errorMessage } from "../../utils/format";

const CategoriesPage = () => {
  const { categories, isLoading, error, reload } = useCategories();
  const [draft, setDraft] = useState(EMPTY_CATEGORY);
  const [actionError, setActionError] = useState(null);

  const add = async (e) => {
    e.preventDefault();
    setActionError(null);
    try {
      await createCategory(draft);
      setDraft(EMPTY_CATEGORY);
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  // Returns true so CategoryRow leaves edit mode only on success.
  const save = async (id, values) => {
    setActionError(null);
    try {
      await updateCategory(id, values);
      reload();
      return true;
    } catch (err) {
      setActionError(errorMessage(err));
      return false;
    }
  };

  const remove = async (category) => {
    if (
      !window.confirm(
        `Delete "${category.name}"? Its transactions become Uncategorized.`,
      )
    ) {
      return;
    }
    setActionError(null);
    try {
      await deleteCategory(category._id);
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  return (
    <AppShell
      title="Categories"
      subtitle="Buckets your transactions and charts group by."
    >
      <div className="space-y-6">
        <Card className="p-4">
          <CategoryForm
            value={draft}
            onChange={setDraft}
            onSubmit={add}
            submitIcon={<Plus size={16} />}
          />
        </Card>

        {actionError && <p className="text-sm text-[#EF4444]">{actionError}</p>}

        <CategoryList
          categories={categories}
          isLoading={isLoading}
          error={error}
          onSave={save}
          onDelete={remove}
        />
      </div>
    </AppShell>
  );
};

export default CategoriesPage;
