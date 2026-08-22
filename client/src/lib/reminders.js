import { daysUntil } from "../pages/planning/formatters";

/**
 * How far ahead a recurring rule counts as "upcoming".
 *
 * Shared by the planning page's reminders list and the header bell so the two
 * can never disagree about what is due. Mirrors the server's
 * REMINDER_LEAD_DAYS default, which decides what actually gets pushed.
 */
export const REMINDER_WINDOW_DAYS = 7;

/**
 * Active rules due within the window (overdue ones included), soonest first.
 */
export const upcomingReminders = (rules) =>
  (rules || [])
    .filter((rule) => {
      if (!rule || !rule.active) return false;
      const days = daysUntil(rule.nextRun);
      return days !== null && days <= REMINDER_WINDOW_DAYS;
    })
    .sort((a, b) => new Date(a.nextRun) - new Date(b.nextRun));
