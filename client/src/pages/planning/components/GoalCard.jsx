import React, { useState } from 'react';
import { Pencil, Trash2, Check, CalendarClock } from 'lucide-react';
import { STATUS_GOOD, STATUS_WARNING, STATUS_CRITICAL } from '../../dashboard/chartColors';
import { formatCurrency, formatDate, daysUntil } from '../formatters';

/**
 * Meter color for a goal.
 *
 * Note this inverts the budget meter's semantics: on a budget a full bar is
 * bad, on a goal it's the win condition. So progress alone never turns the bar
 * coral — only a deadline that's near (amber) or blown (coral) while the goal
 * is still short does. Keeps "teal = good, coral = watch it" reading the same
 * way it does on the dashboard.
 */
const meterColor = (goal, isComplete) => {
  if (isComplete) return STATUS_GOOD;

  const days = daysUntil(goal.deadline);
  if (days === null) return STATUS_GOOD;
  if (days < 0) return STATUS_CRITICAL;
  if (days <= 14) return STATUS_WARNING;
  return STATUS_GOOD;
};

const deadlineNote = (goal, isComplete) => {
  if (!goal.deadline) return null;
  const days = daysUntil(goal.deadline);
  if (isComplete) return `Reached · due ${formatDate(goal.deadline)}`;
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  return `${days}d left`;
};

const GoalCard = ({ goal, onContribute, onEdit, onDelete, isBusy }) => {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState(null);

  const saved = Number(goal.saved) || 0;
  const target = Number(goal.target) || 0;
  const isComplete = target > 0 && saved >= target;
  const pct = target > 0 ? Math.min((saved / target) * 100, 100) : 0;
  const color = meterColor(goal, isComplete);
  const note = deadlineNote(goal, isComplete);

  const handleContribute = async (e) => {
    e.preventDefault();

    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      return setError('Enter an amount greater than 0.');
    }

    setError(null);
    // Contribution is relative; the API stores an absolute `saved` total.
    const ok = await onContribute(goal._id, saved + value);
    if (ok) setAmount('');
  };

  return (
    <div className="rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h4 className="font-medium text-[#1C1917] flex items-center gap-1.5 truncate">
            {isComplete && <Check size={15} className="text-[#0D9488] shrink-0" aria-label="Goal reached" />}
            {goal.title}
          </h4>
          {note && (
            <p className="text-xs text-[#78716C] flex items-center gap-1">
              <CalendarClock size={12} />
              {note}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onEdit(goal)}
            disabled={isBusy}
            aria-label="Edit goal"
            title="Edit goal"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#78716C] hover:bg-white hover:text-[#1C1917] disabled:opacity-50 transition-colors"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(goal)}
            disabled={isBusy}
            aria-label="Delete goal"
            title="Delete goal"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#78716C] hover:bg-[#FEE2E2] hover:text-[#EF4444] disabled:opacity-50 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Same meter markup as the dashboard's BudgetProgress, so goal bars and
          budget bars read as one system. */}
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm font-medium text-[#1C1917] tabular-nums">{formatCurrency(saved)}</span>
        <span className="text-xs text-[#78716C]">
          <span className="sr-only">of</span>
          <span aria-hidden="true">/ </span>
          {formatCurrency(target)} · {Math.round(pct)}%
        </span>
      </div>
      <div
        className="h-2 rounded-full bg-[#F5F3F0] overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${goal.title} progress`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>

      {!isComplete && (
        <form onSubmit={handleContribute} className="flex items-center gap-2 mt-3">
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Add amount"
            aria-label={`Contribute to ${goal.title}`}
            className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-[#E7E5E4] bg-white text-sm text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488]"
          />
          <button
            type="submit"
            disabled={isBusy}
            className="shrink-0 px-3 py-1.5 bg-[#0D9488] hover:bg-[#0F766E] disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Contribute
          </button>
        </form>
      )}

      {error && <p className="text-xs text-[#EF4444] mt-2">{error}</p>}
    </div>
  );
};

export default GoalCard;
