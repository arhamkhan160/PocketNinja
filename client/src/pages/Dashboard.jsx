import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, LayoutDashboard, Wallet, PieChart, Settings, Bell } from 'lucide-react';

const Dashboard = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-[#FFFFFF] border-r border-[#E7E5E4] flex flex-col">
        <div className="p-6 border-b border-[#E7E5E4]">
          <h1 className="text-xl font-bold text-[#1C1917] flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-[#0D9488] flex items-center justify-center text-white text-sm">
              PN
            </span>
            PocketNinja
          </h1>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 bg-[#0D9488]/10 text-[#0D9488] rounded-lg font-medium">
            <LayoutDashboard size={20} />
            Overview
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-[#78716C] hover:bg-[#FAF8F5] hover:text-[#1C1917] rounded-lg font-medium transition-colors">
            <Wallet size={20} />
            Transactions
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-[#78716C] hover:bg-[#FAF8F5] hover:text-[#1C1917] rounded-lg font-medium transition-colors">
            <PieChart size={20} />
            Analytics
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-[#78716C] hover:bg-[#FAF8F5] hover:text-[#1C1917] rounded-lg font-medium transition-colors">
            <Settings size={20} />
            Settings
          </a>
        </nav>

        <div className="p-4 border-t border-[#E7E5E4]">
          <div className="flex items-center justify-between mb-4 px-2">
            <div>
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
      <main className="flex-1 p-6 md:p-10">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-[#1C1917]">Welcome back, {user?.name.split(' ')[0]}!</h2>
            <p className="text-[#78716C]">Here is your financial overview.</p>
          </div>
          
          <button className="w-10 h-10 rounded-full bg-white border border-[#E7E5E4] flex items-center justify-center text-[#78716C] hover:text-[#1C1917] hover:border-[#1C1917] transition-all relative">
            <Bell size={20} />
            <span className="absolute top-2 right-2.5 w-2 h-2 bg-[#EF4444] rounded-full"></span>
          </button>
        </header>

        {/* Dashboard Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main overview panel */}
          <div className="lg:col-span-2 space-y-6">
            <div className="lm-card p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="lm-badge-gold">
                  <Wallet size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-[#1C1917]">Net Worth</h3>
                  <p className="text-sm text-[#78716C]">Total balance across all accounts</p>
                </div>
              </div>
              <p className="text-4xl font-bold text-[#1C1917]">$0.00</p>
            </div>
            
            <div className="lm-card p-6 min-h-[300px] flex items-center justify-center">
              <p className="text-[#78716C] text-center">
                Transaction history and charts<br/>will appear here.
              </p>
            </div>
          </div>

          {/* Sidebar widgets */}
          <div className="space-y-6">
            <div className="lm-card p-6 border-t-4 border-t-[#0D9488]">
              <h3 className="font-bold text-[#1C1917] mb-2">Enable Push Notifications</h3>
              <p className="text-sm text-[#78716C] mb-4">Get alerted instantly about new recurring bills and budget limits.</p>
              <button className="w-full py-2 bg-[#0D9488] hover:bg-[#0F766E] text-white text-sm font-medium rounded-lg transition-colors">
                Setup Notifications
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
