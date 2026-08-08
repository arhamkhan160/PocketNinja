import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to login');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5] p-4">
      <div className="lm-card w-full max-w-md p-8 shadow-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="lm-badge-gold mb-4 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-[#1C1917]">Welcome back</h2>
          <p className="text-[#78716C] mt-1 text-sm">Log in to your PocketNinja account</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-[#FEE2E2] text-[#EF4444] rounded-lg text-sm font-medium text-center border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-[#1C1917] mb-1.5" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              required
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#E7E5E4] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488] transition-all text-[#1C1917]"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#1C1917] mb-1.5" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#E7E5E4] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488] transition-all text-[#1C1917]"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="w-full mt-2 py-2.5 px-4 bg-[#0D9488] hover:bg-[#0F766E] text-white font-semibold rounded-lg shadow-sm transition-all active:scale-[0.98]"
          >
            Log In
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-[#78716C]">
          Don't have an account?{' '}
          <Link to="/register" className="font-semibold text-[#0D9488] hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
