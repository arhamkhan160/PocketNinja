import React from "react";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Field from "../../../components/ui/Field";
import Input from "../../../components/ui/Input";
import Select from "../../../components/ui/Select";
import TypeToggle from "./TypeToggle";

export const EMPTY_FILTERS = { category: "", type: "", from: "", to: "" };

const TYPE_OPTIONS = [
  { value: "", label: "All" },
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
];

const TransactionFilterBar = ({ filters, onChange, categories }) => {
  const set = (key) => (e) => onChange({ ...filters, [key]: e.target.value });

  return (
    <Card className="p-4 flex flex-wrap items-end gap-3">
      <Field label="Category" className="flex-1 min-w-[160px]">
        <Select value={filters.category} onChange={set("category")}>
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category._id} value={category._id}>
              {category.name}
            </option>
          ))}
        </Select>
      </Field>

      <div>
        <span className="text-xs font-medium text-[#78716C]">Type</span>
        <TypeToggle
          className="mt-1"
          options={TYPE_OPTIONS}
          value={filters.type}
          onChange={(type) => onChange({ ...filters, type })}
        />
      </div>

      <Field label="From" className="w-auto">
        <Input type="date" value={filters.from} onChange={set("from")} />
      </Field>

      <Field label="To" className="w-auto">
        <Input type="date" value={filters.to} onChange={set("to")} />
      </Field>

      <Button variant="ghost" onClick={() => onChange(EMPTY_FILTERS)}>
        Clear
      </Button>
    </Card>
  );
};

export default TransactionFilterBar;
