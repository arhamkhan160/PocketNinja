import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import PlanningPage from './pages/planning/PlanningPage';
import TransactionsPage from './pages/transactions/TransactionsPage';
import CategoriesPage from './pages/transactions/CategoriesPage';
import BudgetsPage from './pages/transactions/BudgetsPage';

// A simple wrapper to redirect authenticated users away from Login/Register pages
const PublicRoute = ({ children }) => {
  const { user, token, isLoading } = useAuth();
  
  if (isLoading) return <div className="min-h-screen bg-[#FAF8F5]"></div>;
  if (user && token) return <Navigate to="/" replace />;
  
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route 
        path="/login" 
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        } 
      />
      
      <Route 
        path="/register" 
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        } 
      />
      
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/planning" element={<PlanningPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/budgets" element={<BudgetsPage />} />
      </Route>
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
