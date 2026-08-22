import React, { useCallback, useEffect, useState } from 'react';
import AppShell from '../../components/layout/AppShell';
import RecurringSection from './components/RecurringSection';
import RemindersSection from './components/RemindersSection';
import GoalsSection from './components/GoalsSection';
import { errorMessage } from './formatters';
import {
  getRecurring,
  createRecurring,
  updateRecurring,
  deleteRecurring,
  runRecurringNow,
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  getCategoriesSafe,
} from '../../api/planning';

const initialSlice = { data: [], isLoading: true, error: null };
const initialRunNow = { isRunning: false, message: null, isError: false };

/**
 * Recurring + Reminders + Goals (owner: Mustain, PROJECT_PLAN.md §10.4).
 *
 * Follows the same state convention as the analytics DashboardPage: one
 * { data, isLoading, error } slice per resource and a load() re-run after
 * every mutation, so each section owns its own loading/empty/error states.
 */
const PlanningPage = () => {
  const [rules, setRules] = useState(initialSlice);
  const [goals, setGoals] = useState(initialSlice);
  const [categories, setCategories] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [runNowState, setRunNowState] = useState(initialRunNow);

  const loadRules = useCallback(() => {
    setRules((s) => ({ ...s, isLoading: true, error: null }));
    return getRecurring()
      .then((data) => setRules({ data, isLoading: false, error: null }))
      .catch((err) => setRules({ data: [], isLoading: false, error: errorMessage(err) }));
  }, []);

  const loadGoals = useCallback(() => {
    setGoals((s) => ({ ...s, isLoading: true, error: null }));
    return getGoals()
      .then((data) => setGoals({ data, isLoading: false, error: null }))
      .catch((err) => setGoals({ data: [], isLoading: false, error: errorMessage(err) }));
  }, []);

  useEffect(() => {
    loadRules();
    loadGoals();
    // Categories belong to another slice and may 404 — getCategoriesSafe
    // resolves to [] in that case, so a missing endpoint is not an error here.
    getCategoriesSafe()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [loadRules, loadGoals]);

  /**
   * Runs a mutation, refreshes the affected list, and surfaces failures in
   * that list's error slot. Resolves true on success so the forms know
   * whether to close.
   */
  const mutate = async (action, reload, setSlice) => {
    setIsSaving(true);
    try {
      await action();
      await reload();
      return true;
    } catch (err) {
      setSlice((s) => ({ ...s, error: errorMessage(err) }));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRule = (rule) => {
    if (!window.confirm(`Delete this recurring rule? Transactions it already created are kept.`)) return;
    mutate(() => deleteRecurring(rule._id), loadRules, setRules);
  };

  const handleDeleteGoal = (goal) => {
    if (!window.confirm(`Delete the goal "${goal.title}"?`)) return;
    mutate(() => deleteGoal(goal._id), loadGoals, setGoals);
  };

  const handleRunNow = async () => {
    setRunNowState({ isRunning: true, message: null, isError: false });
    try {
      const { transactionsCreated, rulesProcessed } = await runRecurringNow();
      setRunNowState({
        isRunning: false,
        isError: false,
        message:
          transactionsCreated > 0
            ? `Created ${transactionsCreated} transaction${transactionsCreated === 1 ? '' : 's'} from ${rulesProcessed} rule${rulesProcessed === 1 ? '' : 's'}.`
            : 'Nothing was due — no transactions created.',
      });
      await loadRules();
    } catch (err) {
      setRunNowState({ isRunning: false, isError: true, message: errorMessage(err) });
    }
  };

  return (
    <AppShell title="Planning" subtitle="Recurring bills, reminders and savings goals.">
      <div className="space-y-6">
        <RecurringSection
          rules={rules.data}
          categories={categories}
          isLoading={rules.isLoading}
          error={rules.error}
          isSaving={isSaving}
          onCreate={(payload) => mutate(() => createRecurring(payload), loadRules, setRules)}
          onUpdate={(id, patch) => mutate(() => updateRecurring(id, patch), loadRules, setRules)}
          onDelete={handleDeleteRule}
          onRunNow={handleRunNow}
          runNowState={runNowState}
        />

        <RemindersSection rules={rules.data} isLoading={rules.isLoading} error={rules.error} />

        <GoalsSection
          goals={goals.data}
          isLoading={goals.isLoading}
          error={goals.error}
          isSaving={isSaving}
          onCreate={(payload) => mutate(() => createGoal(payload), loadGoals, setGoals)}
          onUpdate={(id, patch) => mutate(() => updateGoal(id, patch), loadGoals, setGoals)}
          onDelete={handleDeleteGoal}
        />
      </div>
    </AppShell>
  );
};

export default PlanningPage;
