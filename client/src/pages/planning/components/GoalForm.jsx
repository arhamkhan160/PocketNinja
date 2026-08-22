import React, { useState } from 'react';
import { toDateInputValue } from '../formatters';

const inputClasses =
  'w-full px-3 py-2 rounded-lg border border-[#E7E5E4] bg-white text-sm text-[#1C1917] ' +
  'placeholder:text-[#A8A29E] focus:outline-none focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488]';

const labelClasses = 'block text-xs font-medium text-[#78716C] mb-1.5';

const draftFrom = (goal) => ({
  title: goal?.title || '',
  target: goal ? String(goal.target ?? '') : '',
  saved: goal ? String(goal.saved ?? '0') : '0',
  deadline: toDateInputValue(goal?.deadline),
});

const GoalForm = ({ goal, onSubmit, onCancel, isSaving }) => {
  const [draft, setDraft] = useState(() => draftFrom(goal));
  const [validationError, setValidationError] = useState(null);

  const set = (field) => (e) => setDraft((d) => ({ ...d, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();

    // Mirrors goalController.parseGoalPayload.
    const title = draft.title.trim();
    if (!title) return setValidationError('Give the goal a name.');

    const target = Number(draft.target);
    if (!Number.isFinite(target) || target <= 0) {
      return setValidationError('Target must be a number greater than 0.');
    }

    const saved = Number(draft.saved || 0);
    if (!Number.isFinite(saved) || saved < 0) {
      return setValidationError('Saved must be 0 or more.');
    }

    setValidationError(null);
    onSubmit({
      title,
      target,
      saved,
      deadline: draft.deadline ? new Date(`${draft.deadline}T12:00:00.000Z`).toISOString() : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] p-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClasses} htmlFor="goal-title">
            Goal
          </label>
          <input
            id="goal-title"
            type="text"
            value={draft.title}
            onChange={set('title')}
            placeholder="New laptop"
            className={inputClasses}
            required
          />
        </div>

        <div>
          <label className={labelClasses} htmlFor="goal-target">
            Target amount
          </label>
          <input
            id="goal-target"
            type="number"
            min="0.01"
            step="0.01"
            value={draft.target}
            onChange={set('target')}
            placeholder="1200"
            className={inputClasses}
            required
          />
        </div>

        <div>
          <label className={labelClasses} htmlFor="goal-saved">
            Already saved
          </label>
          <input
            id="goal-saved"
            type="number"
            min="0"
            step="0.01"
            value={draft.saved}
            onChange={set('saved')}
            className={inputClasses}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClasses} htmlFor="goal-deadline">
            Deadline <span className="text-[#A8A29E]">(optional)</span>
          </label>
          <input
            id="goal-deadline"
            type="date"
            value={draft.deadline}
            onChange={set('deadline')}
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
          {isSaving ? 'Saving…' : goal ? 'Save changes' : 'Add goal'}
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

export default GoalForm;
