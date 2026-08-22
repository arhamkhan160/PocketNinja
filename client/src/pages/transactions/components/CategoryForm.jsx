import React from "react";
import Field from "../../../components/ui/Field";
import Input from "../../../components/ui/Input";
import Select from "../../../components/ui/Select";
import Button from "../../../components/ui/Button";

export const EMPTY_CATEGORY = {
  name: "",
  type: "expense",
  icon: "",
  color: "#0D9488",
};

/**
 * One controlled form for both "add a category" and "edit this row", so the
 * two never drift apart.
 */
const CategoryForm = ({
  value,
  onChange,
  onSubmit,
  onCancel,
  submitLabel = "Add",
  submitIcon,
}) => {
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3 w-full">
      <Field label="Name" className="flex-1 min-w-[140px]">
        <Input
          type="text"
          required
          value={value.name}
          onChange={set("name")}
          placeholder="Groceries"
        />
      </Field>

      <Field label="Type" className="w-32">
        <Select value={value.type} onChange={set("type")}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </Select>
      </Field>

      <Field label="Icon" className="w-20">
        <Input
          type="text"
          maxLength={2}
          value={value.icon}
          onChange={set("icon")}
          placeholder="$"
          className="text-center"
        />
      </Field>

      <Field label="Color" className="w-16">
        <Input
          type="color"
          value={value.color}
          onChange={set("color")}
          className="h-[38px] p-1"
        />
      </Field>

      <Button type="submit">
        {submitIcon}
        {submitLabel}
      </Button>

      {onCancel && (
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      )}
    </form>
  );
};

export default CategoryForm;
