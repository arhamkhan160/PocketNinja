import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = () => {
  const { user, token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#78716C] animate-pulse font-medium">Loading PocketNinja...</div>
      </div>
    );
  }

  // If no token exists, the user is definitely unauthenticated.
  // If there's a token but no user, the AuthContext is still fetching /me.
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
