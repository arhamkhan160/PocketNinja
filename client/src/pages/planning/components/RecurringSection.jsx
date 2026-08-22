import React, { useState } from 'react';
import { Plus, Play, Pencil, Trash2, Pause, RotateCw } from 'lucide-react';
import SectionCard from './SectionCard';
import RecurringForm from './RecurringForm';
import { formatCurrency, formatDate, INTERVAL_LABELS } from '../formatters';

const RuleRow = ({ rule, categoryName, onEdit, onToggle, onDelete, isBusy }) => {
  const isIncome = rule.template?.type === 'income';

  return (
    <li className="flex flex-wrap items-center gap-3 py-3 border-b border-[#E7E5E4] last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-[#1C1917] truncate">
            {rule.template?.note || (isIncome ? 'Recurring income' : 'Recurring expense')}
          </span>
          {!rule.active && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#F5F3F0] text-[#78716C]">
              Paused
            </span>
          )}
        </div>
        <p className="text-xs text-[#78716C]">
          {INTERVAL_LABELS[rule.interval] || rule.interval} · {categoryName} · next {formatDate(rule.nextRun)}
        </p>
      </div>

      <span className={`text-sm font-semibold tabular-nums ${isIncome ? 'text-[#0D9488]' : 'text-[#1C1917]'}`}>
        {isIncome ? '+' : '−'}
        {formatCurrency(rule.template?.amount)}
      </span>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onToggle(rule)}
          disabled={isBusy}
          aria-label={rule.active ? 'Pause rule' : 'Resume rule'}
          title={rule.active ? 'Pause rule' : 'Resume rule'}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#78716C] hover:bg-[#FAF8F5] hover:text-[#1C1917] disabled:opacity-50 transition-colors"
        >
          {rule.active ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          type="button"
          onClick={() => onEdit(rule)}
          disabled={isBusy}
          aria-label="Edit rule"
          title="Edit rule"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#78716C] hover:bg-[#FAF8F5] hover:text-[#1C1917] disabled:opacity-50 transition-colors"
        >
          <Pencil size={16} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(rule)}
          disabled={isBusy}
          aria-label="Delete rule"
          title="Delete rule"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#78716C] hover:bg-[#FEE2E2] hover:text-[#EF4444] disabled:opacity-50 transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </li>
  );
};

const RecurringSection = ({
  rules,
  categories,
  isLoading,
  error,
  isSaving,
  onCreate,
  onUpdate,
  onDelete,
  onRunNow,
  runNowState,
}) => {
  const [formMode, setFormMode] = useState(null); // null | 'create' | rule object

  const categoryNameById = new Map(categories.map((c) => [String(c._id), c.name]));
  const nameFor = (rule) => {
    const id = rule.template?.categoryId;
    return (id && categoryNameById.get(String(id))) || 'Uncategorized';
  };

  const closeForm = () => setFormMode(null);

  const handleSubmit = async (payload) => {
    const saved =
      formMode === 'create' ? await onCreate(payload) : await onUpdate(formMode._id, payload);
    if (saved) closeForm();
  };

  return (
    <SectionCard
      title="Recurring rules"
      subtitle="Transactions PocketNinja creates for you automatically"
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRunNow}
            disabled={runNowState.isRunning || isLoading}
            title="Generate any transactions that are already due"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#78716C] hover:text-[#1C1917] border border-[#E7E5E4] rounded-lg hover:bg-[#FAF8F5] disabled:opacity-60 transition-colors"
          >
            <RotateCw size={15} className={runNowState.isRunning ? 'animate-spin' : undefined} />
            {runNowState.isRunning ? 'Running…' : 'Run due now'}
          </button>
          <button
            type="button"
            onClick={() => setFormMode('create')}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#0D9488] hover:bg-[#0F766E] text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={15} />
            New rule
          </button>
        </div>
      }
      isLoading={isLoading}
      error={error}
      // Suppress the empty state while the create form is open, otherwise the
      // very first rule is added against a "Nothing here yet" message.
      isEmpty={!formMode && rules.length === 0}
      emptyMessage="Add a rule for a bill or paycheck and it'll post itself on schedule."
    >
      <div className="space-y-4">
        {runNowState.message && (
          <p
            className={`text-sm ${runNowState.isError ? 'text-[#EF4444]' : 'text-[#0D9488]'}`}
            role="status"
          >
            {runNowState.message}
          </p>
        )}

        {formMode && (
          <RecurringForm
            rule={formMode === 'create' ? null : formMode}
            categories={categories}
            onSubmit={handleSubmit}
            onCancel={closeForm}
            isSaving={isSaving}
          />
        )}

        {rules.length > 0 && (
          <ul>
            {rules.map((rule) => (
              <RuleRow
                key={rule._id}
                rule={rule}
                categoryName={nameFor(rule)}
                isBusy={isSaving}
                onEdit={setFormMode}
                onToggle={(r) => onUpdate(r._id, { active: !r.active })}
                onDelete={onDelete}
              />
            ))}
          </ul>
        )}
      </div>
    </SectionCard>
  );
};

export default RecurringSection;
