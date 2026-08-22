import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bell, AlertTriangle, BellRing } from "lucide-react";
import { Link } from "react-router-dom";
import useFetch from "../../hooks/useFetch";
import { getRecurring } from "../../api/planning";
import { upcomingReminders, REMINDER_WINDOW_DAYS } from "../../lib/reminders";
import { formatCurrency, formatDate, dueLabel } from "../../pages/planning/formatters";

/**
 * The header bell — the in-app half of the reminders story (§10.4), so the
 * user still sees what's due when push is off or unsupported.
 *
 * Derived from the recurring rules already exposed by /api/recurring; no new
 * endpoint, so the §6 contract is untouched.
 */
const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const { data, isLoading, error } = useFetch(getRecurring, []);
  const items = useMemo(() => upcomingReminders(data), [data]);
  const count = items.length;

  // Close on Escape or a click elsewhere — a dropdown that traps the page is
  // worse than no dropdown.
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    const onClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [isOpen]);

  const label = count > 0 ? `Notifications, ${count} due soon` : "Notifications";

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={label}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="w-10 h-10 rounded-full bg-white border border-[#E7E5E4] flex items-center justify-center text-[#78716C] hover:text-[#1C1917] hover:border-[#1C1917] transition-all relative"
      >
        <Bell size={20} />
        {count > 0 && (
          <span
            className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center"
            aria-hidden="true"
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] lm-card p-0 z-40 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-[#E7E5E4]">
            <p className="font-semibold text-[#1C1917] text-sm">Notifications</p>
            <p className="text-xs text-[#78716C]">
              Due within {REMINDER_WINDOW_DAYS} days
            </p>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {isLoading && <div className="m-4 h-16 animate-pulse bg-[#F5F3F0] rounded-lg" />}

            {!isLoading && error && (
              <div className="px-4 py-6 text-center">
                <p className="text-sm font-medium text-[#EF4444]">
                  Couldn&apos;t load notifications
                </p>
                <p className="text-xs text-[#78716C]">{error}</p>
              </div>
            )}

            {!isLoading && !error && count === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-medium text-[#1C1917]">You&apos;re all caught up</p>
                <p className="text-xs text-[#78716C]">
                  Nothing due in the next {REMINDER_WINDOW_DAYS} days.
                </p>
              </div>
            )}

            {!isLoading && !error && count > 0 && (
              <ul>
                {items.map((rule) => {
                  const { text, severity } = dueLabel(rule.nextRun);
                  const isOverdue = severity === "overdue";

                  return (
                    <li
                      key={rule._id}
                      className="flex items-center gap-3 px-4 py-3 border-b border-[#E7E5E4] last:border-b-0"
                    >
                      <span
                        className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${
                          isOverdue
                            ? "bg-[#FEE2E2] text-[#EF4444]"
                            : "bg-[#FEF3C7] text-[#D97706]"
                        }`}
                      >
                        {isOverdue ? <AlertTriangle size={15} /> : <BellRing size={15} />}
                      </span>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1C1917] truncate">
                          {rule.template?.note ||
                            (rule.template?.type === "income"
                              ? "Recurring income"
                              : "Recurring expense")}
                        </p>
                        <p className="text-xs text-[#78716C]">
                          {formatDate(rule.nextRun)} · {text}
                        </p>
                      </div>

                      <span className="text-sm font-semibold text-[#1C1917] tabular-nums shrink-0">
                        {formatCurrency(rule.template?.amount)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <Link
            to="/planning"
            onClick={() => setIsOpen(false)}
            className="block px-4 py-3 border-t border-[#E7E5E4] text-sm font-medium text-[#0D9488] hover:bg-[#FAF8F5] text-center"
          >
            Manage in Planning
          </Link>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
