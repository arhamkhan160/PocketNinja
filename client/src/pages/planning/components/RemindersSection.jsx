import React, { useMemo } from 'react';
import { BellRing, AlertTriangle } from 'lucide-react';
import SectionCard from './SectionCard';
import { formatCurrency, formatDate, daysUntil, dueLabel } from '../formatters';

const REMINDER_WINDOW_DAYS = 7;

const BADGE_STYLES = {
  overdue: 'bg-[#FEE2E2] text-[#EF4444]',
  today: 'bg-[#FEF3C7] text-[#D97706]',
  soon: 'bg-[#FEF3C7] text-[#D97706]',
  later: 'bg-[#F5F3F0] text-[#78716C]',
  neutral: 'bg-[#F5F3F0] text-[#78716C]',
};

/**
 * The in-app complement to push reminders (§10.4).
 *
 * Derived entirely from the recurring rules the page already fetched — no
 * extra endpoint, so the §6 API contract is untouched. The server's cron sends
 * the push version of this same list on its daily tick.
 */
const RemindersSection = ({ rules, isLoading, error }) => {
  const upcoming = useMemo(() => {
    return rules
      .filter((rule) => {
        if (!rule.active) return false;
        const days = daysUntil(rule.nextRun);
        return days !== null && days <= REMINDER_WINDOW_DAYS;
      })
      .sort((a, b) => new Date(a.nextRun) - new Date(b.nextRun));
  }, [rules]);

  return (
    <SectionCard
      title="Upcoming reminders"
      subtitle={`Due within ${REMINDER_WINDOW_DAYS} days`}
      isLoading={isLoading}
      error={error}
      isEmpty={upcoming.length === 0}
      emptyMessage="Nothing due this week. Active rules show up here as their date approaches."
    >
      <ul className="space-y-2">
        {upcoming.map((rule) => {
          const { text, severity } = dueLabel(rule.nextRun);
          const isOverdue = severity === 'overdue';

          return (
            <li
              key={rule._id}
              className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-[#FAF8F5] border border-[#E7E5E4]"
            >
              <span
                className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${
                  isOverdue ? 'bg-[#FEE2E2] text-[#EF4444]' : 'bg-[#FEF3C7] text-[#D97706]'
                }`}
              >
                {isOverdue ? <AlertTriangle size={17} /> : <BellRing size={17} />}
              </span>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#1C1917] truncate">
                  {rule.template?.note ||
                    (rule.template?.type === 'income' ? 'Recurring income' : 'Recurring expense')}
                </p>
                <p className="text-xs text-[#78716C]">{formatDate(rule.nextRun)}</p>
              </div>

              <span className="text-sm font-semibold text-[#1C1917] tabular-nums">
                {formatCurrency(rule.template?.amount)}
              </span>

              <span className={`text-[11px] font-medium px-2 py-1 rounded-full ${BADGE_STYLES[severity]}`}>
                {text}
              </span>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
};

export default RemindersSection;
