import React, { useEffect, useState } from "react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import Field from "../../../components/ui/Field";
import Input from "../../../components/ui/Input";
import Select from "../../../components/ui/Select";
import TypeToggle from "./TypeToggle";
import { createTransaction, updateTransaction } from "../../../api/finance";
import { toDateInput, errorMessage } from "../../../utils/format";

const emptyForm = () => ({
  amount: "",
  type: "expense",
  categoryId: "",
  date: toDateInput(new Date()),
  note: "",
});

const toForm = (transaction) => ({
  amount: String(transaction.amount),
  type: transaction.type,
  categoryId: transaction.categoryId || "",
  date: toDateInput(transaction.date),
  note: transaction.note || "",
});

const TransactionFormDialog = ({
  open,
  transaction,
  categories,
  onClose,
  onSaved,
}) => {
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(transaction ? toForm(transaction) : emptyForm());
  }, [open, transaction]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return setError("Amount must be a number greater than 0");
    }

    const payload = {
      amount,
      type: form.type,
      categoryId: form.categoryId || null,
      date: form.date,
      note: form.note,
    };

    setIsSaving(true);
    try {
      if (transaction) await updateTransaction(transaction._id, payload);
      else await createTransaction(payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  // Only categories matching the chosen type are selectable.
  const selectable = categories.filter((category) => category.type === form.type);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={transaction ? "Edit transaction" : "Add transaction"}
    >
      <form onSubmit={submit} className="space-y-4">
        <TypeToggle
          value={form.type}
          onChange={(type) => setForm((f) => ({ ...f, type, categoryId: "" }))}
        />

        <Field label="Amount">
          <Input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={form.amount}
            onChange={set("amount")}
          />
        </Field>

        <Field label="Category">
          <Select value={form.categoryId} onChange={set("categoryId")}>
            <option value="">Uncategorized</option>
            {selectable.map((category) => (
              <option key={category._id} value={category._id}>
                {category.icon ? `${category.icon} ` : ""}
                {category.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Date">
          <Input type="date" required value={form.date} onChange={set("date")} />
        </Field>

        <Field label="Note" error={error}>
          <Input
            type="text"
            value={form.note}
            onChange={set("note")}
            placeholder="Optional"
          />
        </Field>

        <div className="flex gap-2 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default TransactionFormDialog;
