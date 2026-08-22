import React from "react";
import Card from "../../../components/ui/Card";
import DataState from "../../../components/ui/DataState";
import CategoryRow from "./CategoryRow";

const CategoryList = ({ categories, isLoading, error, onSave, onDelete }) => (
  <Card className="divide-y divide-[#E7E5E4]">
    <DataState
      isLoading={isLoading}
      error={error}
      isEmpty={categories.length === 0}
      errorTitle="Couldn't load categories"
      emptyTitle="No categories yet"
      emptyMessage="Add one above to start grouping transactions."
    >
      <>
        {categories.map((category) => (
          <CategoryRow
            key={category._id}
            category={category}
            onSave={onSave}
            onDelete={onDelete}
          />
        ))}
      </>
    </DataState>
  </Card>
);

export default CategoryList;
