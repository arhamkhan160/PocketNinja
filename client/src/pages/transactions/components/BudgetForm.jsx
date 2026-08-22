import React from "react";
import { Plus } from "lucide-react";
import Field from "../../../components/ui/Field";
import Input from "../../../components/ui/Input";
import Select from "../../../components/ui/Select";
import Button from "../../../components/ui/Button";

export const EMPTY_BUDGET = { categoryId: "", limit: "" };

const BudgetForm = ({ value, onChange, onSubmit, categories }) => {
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <Field label="Category" className="flex-1 min-w-[180px]">
        <Select value={value.categoryId} onChange={set("categoryId")}>
          <option value="">Overall (all spending)</option>
          {categories
            .filter((category) => category.type === "expense")
            .map((category) => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
        </Select>
      </Field>

      <Field label="Limit" className="w-40">
        <Input
          type="number"
          step="0.01"
          min="0"
          required
          value={value.limit}
          onChange={set("limit")}
        />
      </Field>

      <Button type="submit">
        <Plus size={16} />
        Set budget
      </Button>
    </form>
  );
};

export default BudgetForm;
