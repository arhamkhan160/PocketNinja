import React, { useState } from 'react';
import { toDateInputValue, todayInputValue } from '../formatters';

const inputClasses =
  'w-full px-3 py-2 rounded-lg border border-[#E7E5E4] bg-white text-sm text-[#1C1917] ' +
  'placeholder:text-[#A8A29E] focus:outline-none focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488]';

const labelClasses = 'block text-xs font-medium text-[#78716C] mb-1.5';

const emptyDraft = () => ({
  amount: '',
  type: 'expense',
  categoryId: '',
  note: '',
  interval: 'monthly',
  nextRun: todayInputValue(),
});

const draftFromRule = (rule) => ({
  amount: String(rule.template?.amount ?? ''),
  type: rule.template?.type || 'expense',
  categoryId: rule.template?.categoryId || '',
  note: rule.template?.note || '',
  interval: rule.interval || 'monthly',
  nextRun: toDateInputValue(rule.nextRun),
});

/**
 * Create / edit form for a recurring rule.
 *
 * `categories` comes from getCategoriesSafe() and is [] until Ibrahim's
 * /api/categories ships — the select then renders a disabled empty state and
 * the rule saves with a null categoryId, which the server accepts.
 */
const RecurringForm = ({ rule, categories, onSubmit, onCancel, isSaving }) => {
  const [draft, setDraft] = useState(() => (rule ? draftFromRule(rule) : emptyDraft()));
  const [validationError, setValidationError] = useState(null);

  const set = (field) => (e) => setDraft((d) => ({ ...d, [field]: e.target.value }));

  // Only offer categories matching the rule's direction — an expense rule
  // shouldn't be filed under "Salary".
  const relevantCategories = categories.filter((c) => !c.type || c.type === draft.type);

  const handleSubmit = (e) => {
    e.preventDefault();

    // Mirrors the server-side validation in recurringController.parseRulePayload.
    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return setValidationError('Amount must be a number greater than 0.');
    }
    if (!draft.nextRun) {
      return setValidationError('Pick a first run date.');
    }

    setValidationError(null);
    onSubmit({
      template: {
        amount,
        type: draft.type,
        categoryId: draft.categoryId || null,
        note: draft.note.trim(),
      },
      interval: draft.interval,
      // Midday UTC keeps the date stable regardless of the viewer's timezone.
      nextRun: new Date(`${draft.nextRun}T12:00:00.000Z`).toISOString(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] p-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClasses} htmlFor="rule-amount">
            Amount
          </label>
          <input
            id="rule-amount"
            type="number"
            min="0.01"
            step="0.01"
            value={draft.amount}
            onChange={set('amount')}
            placeholder="950"
            className={inputClasses}
            required
          />
        </div>

        <div>
          <label className={labelClasses} htmlFor="rule-type">
            Type
          </label>
          <select id="rule-type" value={draft.type} onChange={set('type')} className={inputClasses}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>

        <div>
          <label className={labelClasses} htmlFor="rule-category">
            Category
          </label>
          <select
            id="rule-category"
            value={draft.categoryId}
            onChange={set('categoryId')}
            className={inputClasses}
            disabled={relevantCategories.length === 0}
          >
            {relevantCategories.length === 0 ? (
              <option value="">No categories yet</option>
            ) : (
              <>
                <option value="">Uncategorized</option>
                {relevantCategories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </>
            )}
          </select>
          {relevantCategories.length === 0 && (
            <p className="text-xs text-[#A8A29E] mt-1">
              Add categories first — rules save uncategorized until then.
            </p>
          )}
        </div>

        <div>
          <label className={labelClasses} htmlFor="rule-interval">
            Repeats
          </label>
          <select id="rule-interval" value={draft.interval} onChange={set('interval')} className={inputClasses}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        <div>
          <label className={labelClasses} htmlFor="rule-next-run">
            {rule ? 'Next run' : 'First run'}
          </label>
          <input
            id="rule-next-run"
            type="date"
            value={draft.nextRun}
            onChange={set('nextRun')}
            className={inputClasses}
            required
          />
        </div>

        <div>
          <label className={labelClasses} htmlFor="rule-note">
            Note
          </label>
          <input
            id="rule-note"
            type="text"
            value={draft.note}
            onChange={set('note')}
            placeholder="Rent"
            className={inputClasses}
          />
        </div>
      </div>

      {validationError && <p className="text-sm text-[#EF4444]">{validationError}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isSaving}
          className="px-4 py-2 bg-[#0D9488] hover:bg-[#0F766E] disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {isSaving ? 'Saving…' : rule ? 'Save changes' : 'Add rule'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-[#78716C] hover:text-[#1C1917] rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default RecurringForm;
