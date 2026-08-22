import React, { useState } from "react";
import { Pencil, Trash2, Check } from "lucide-react";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import CategoryForm from "./CategoryForm";

const toDraft = (category) => ({
  name: category.name,
  type: category.type,
  icon: category.icon || "",
  color: category.color || "#0D9488",
});

const CategoryRow = ({ category, onSave, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(() => toDraft(category));

  const startEdit = () => {
    setDraft(toDraft(category));
    setIsEditing(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    // Leave edit mode only if the save actually succeeded.
    const ok = await onSave(category._id, draft);
    if (ok) setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="p-4">
        <CategoryForm
          value={draft}
          onChange={setDraft}
          onSubmit={submit}
          onCancel={() => setIsEditing(false)}
          submitLabel="Save"
          submitIcon={<Check size={16} />}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <span
        className="w-3 h-3 rounded-full shrink-0"
        style={{ backgroundColor: category.color || "#A8A29E" }}
        aria-hidden="true"
      />
      <span className="font-medium text-[#1C1917]">
        {category.icon ? `${category.icon} ` : ""}
        {category.name}
      </span>
      <Badge tone={category.type}>{category.type}</Badge>

      <div className="ml-auto flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={startEdit}
          aria-label="Edit category"
        >
          <Pencil size={16} />
        </Button>
        <Button
          variant="dangerGhost"
          size="icon"
          onClick={() => onDelete(category)}
          aria-label="Delete category"
        >
          <Trash2 size={16} />
        </Button>
      </div>
    </div>
  );
};

export default CategoryRow;
