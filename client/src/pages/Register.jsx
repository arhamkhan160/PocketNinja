import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      await register(name, email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create account');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5] p-4">
      <div className="lm-card w-full max-w-md p-8 shadow-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="lm-badge-gold mb-4 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm10 2v6m-3-3h6" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-[#1C1917]">Create an account</h2>
          <p className="text-[#78716C] mt-1 text-sm">Join PocketNinja today</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-[#FEE2E2] text-[#EF4444] rounded-lg text-sm font-medium text-center border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-[#1C1917] mb-1.5" htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              required
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#E7E5E4] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488] transition-all text-[#1C1917]"
              placeholder="Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

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
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="w-full mt-2 py-2.5 px-4 bg-[#0D9488] hover:bg-[#0F766E] text-white font-semibold rounded-lg shadow-sm transition-all active:scale-[0.98]"
          >
            Sign Up
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-[#78716C]">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-[#0D9488] hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
