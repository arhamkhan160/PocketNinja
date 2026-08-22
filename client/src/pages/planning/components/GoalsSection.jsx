import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import SectionCard from './SectionCard';
import GoalForm from './GoalForm';
import GoalCard from './GoalCard';

const GoalsSection = ({ goals, isLoading, error, isSaving, onCreate, onUpdate, onDelete }) => {
  const [formMode, setFormMode] = useState(null); // null | 'create' | goal object

  const closeForm = () => setFormMode(null);

  const handleSubmit = async (payload) => {
    const saved =
      formMode === 'create' ? await onCreate(payload) : await onUpdate(formMode._id, payload);
    if (saved) closeForm();
  };

  return (
    <SectionCard
      title="Savings goals"
      subtitle="What you're putting money aside for"
      action={
        <button
          type="button"
          onClick={() => setFormMode('create')}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#0D9488] hover:bg-[#0F766E] text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={15} />
          New goal
        </button>
      }
      isLoading={isLoading}
      error={error}
      isEmpty={!formMode && goals.length === 0}
      emptyMessage="Set a target and a deadline, then chip away at it."
    >
      <div className="space-y-4">
        {formMode && (
          <GoalForm
            goal={formMode === 'create' ? null : formMode}
            onSubmit={handleSubmit}
            onCancel={closeForm}
            isSaving={isSaving}
          />
        )}

        {goals.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {goals.map((goal) => (
              <GoalCard
                key={goal._id}
                goal={goal}
                isBusy={isSaving}
                onContribute={(id, nextSaved) => onUpdate(id, { saved: nextSaved })}
                onEdit={setFormMode}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
};

export default GoalsSection;
