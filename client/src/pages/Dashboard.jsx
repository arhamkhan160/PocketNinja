import React from 'react';
import { useAuth } from '../context/AuthContext';
import AppShell from '../components/layout/AppShell';
import DashboardPage from './dashboard/DashboardPage';

const Dashboard = () => {
  const { user } = useAuth();

  return (
    <AppShell
      title={`Welcome back, ${user?.name?.split(' ')[0] || 'there'}!`}
      subtitle="Here is your financial overview."
    >
      {/* Analytics Dashboard (owner: Musabbereen — see PROJECT_PLAN.md §10.3) */}
      <DashboardPage />
    </AppShell>
  );
};

export default Dashboard;
