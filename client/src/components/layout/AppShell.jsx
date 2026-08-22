import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LogOut, LayoutDashboard, CalendarClock, Wallet, Tags, Target } from 'lucide-react';
import NotificationBell from './NotificationBell';
import PushOptInStrip from './PushOptInStrip';

/**
 * The app chrome — sidebar, header, push opt-in strip — shared by every
 * protected page. Lifted out of pages/Dashboard.jsx so the Planning slice
 * (§10.4) can sit on the same shell instead of duplicating it.
 */

// "Overview" is the analytics dashboard (§10.3) — there is no separate
// /analytics route, so it isn't listed twice.
const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/transactions', label: 'Transactions', icon: Wallet },
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/budgets', label: 'Budgets', icon: Target },
  { to: '/planning', label: 'Planning', icon: CalendarClock },
];

const navClasses = ({ isActive }) =>
  [
    'flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors',
    isActive
      ? 'bg-[#0D9488]/10 text-[#0D9488]'
      : 'text-[#78716C] hover:bg-[#FAF8F5] hover:text-[#1C1917]',
  ].join(' ');

const AppShell = ({ title, subtitle, children }) => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 md:min-h-screen bg-[#FFFFFF] border-b md:border-b-0 md:border-r border-[#E7E5E4] flex flex-col">
        <div className="p-6 border-b border-[#E7E5E4]">
          <h1 className="text-xl font-bold text-[#1C1917] flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-[#0D9488] flex items-center justify-center text-white text-sm">
              PN
            </span>
            PocketNinja
          </h1>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end, disabled }) =>
            disabled ? (
              // Slices that haven't shipped a route yet — visible but inert,
              // so the nav doesn't dead-end on a blank screen.
              <span
                key={label}
                aria-disabled="true"
                title="Coming soon"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-[#A8A29E] cursor-not-allowed"
              >
                <Icon size={20} />
                {label}
              </span>
            ) : (
              <NavLink key={label} to={to} end={end} className={navClasses}>
                <Icon size={20} />
                {label}
              </NavLink>
            )
          )}
        </nav>

        <div className="p-4 border-t border-[#E7E5E4]">
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1C1917] truncate">{user?.name}</p>
              <p className="text-xs text-[#78716C] truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-[#EF4444] bg-[#FEE2E2] hover:bg-[#fecaca] rounded-lg transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 min-w-0">
        <header className="flex justify-between items-start sm:items-center gap-4 mb-8">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-[#1C1917]">{title}</h2>
            {subtitle && <p className="text-[#78716C]">{subtitle}</p>}
          </div>

          <NotificationBell />
        </header>

        <PushOptInStrip />

        {children}
      </main>
    </div>
  );
};

export default AppShell;
