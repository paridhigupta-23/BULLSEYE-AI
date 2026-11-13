import React, { useState } from 'react';
import { ArrowRight, LogOut, ShieldCheck, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext.tsx';
import { api } from '../services/api.ts';
import type { PortalId, UserProfile } from '../types/index.ts';

export const AuthModal: React.FC = () => {
  const { authOpen, setAuthOpen, user, completeAuthSession, logoutUser, setPortal, t } =
    useAppContext();

  const [selectedPortalRole, setSelectedPortalRole] = useState<UserProfile['role']>('Investor');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!authOpen) return null;

  const routeForRole = (r: UserProfile['role']): PortalId => {
    if (r === 'Broker / Quant') return 'broker';
    if (r === 'Practice Trader') return 'practice';
    return 'investor';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login({
        userId,
        password,
        expectedRole: selectedPortalRole,
      });
      completeAuthSession(res.user, res.token);
      setPortal(routeForRole(res.user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const fillRoleDemo = (role: UserProfile['role']) => {
    setSelectedPortalRole(role);
    if (role === 'Investor') {
      setUserId('INV-DEMO-01');
      setPassword('Investor@2026');
    } else if (role === 'Broker / Quant') {
      setUserId('BRK-QUANT-01');
      setPassword('Quant@2026');
    } else {
      setUserId('PRC-TRADE-01');
      setPassword('Trade@2026');
    }
    setError('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-[#1F2937]">
        <div className="flex items-center justify-between">
          <h2 id="auth-modal-title" className="font-display text-xl font-bold text-slate-900 dark:text-white">
            {user ? 'Authenticated Session' : 'Portal Sign In'}
          </h2>
          <button
            type="button"
            onClick={() => setAuthOpen(false)}
            aria-label="Close authentication modal"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {user ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-[#F8F6F0] p-4 dark:border-slate-700 dark:bg-[#111827]">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{user.name}</p>
                <span className="font-mono text-xs font-semibold text-[#087F5B] dark:text-[#34D399]">
                  {user.userCode}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">{user.email}</p>
              <p className="mt-2 text-xs font-medium text-[#087F5B] dark:text-[#34D399]">
                Authorized Role: {user.role}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setPortal(routeForRole(user.role));
                setAuthOpen(false);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#087F5B] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#06684A] dark:bg-[#34D399] dark:text-slate-950"
            >
              <span>Open {user.role} Dashboard</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => logoutUser()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#782F46]/40 px-4 py-2.5 text-sm font-semibold text-[#782F46] hover:bg-[#782F46]/10 dark:border-[#B76E85]/40 dark:text-[#B76E85]"
            >
              <LogOut className="h-4 w-4" />
              <span>{t.signOut}</span>
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Select your target portal role and sign in with your backend-verified credentials, or open any portal directly from the navigation bar for its dedicated login page.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label htmlFor="modal-role" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Target Portal Role
                </label>
                <select
                  id="modal-role"
                  value={selectedPortalRole}
                  onChange={(e) => setSelectedPortalRole(e.target.value as UserProfile['role'])}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-[#111827] dark:text-white"
                >
                  <option value="Investor">Investor Portal</option>
                  <option value="Broker / Quant">Broker / Quant Portal</option>
                  <option value="Practice Trader">Practice Trading Portal</option>
                </select>
              </div>

              <div>
                <label htmlFor="modal-userid" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  User ID or Email
                </label>
                <input
                  id="modal-userid"
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="INV-DEMO-01"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 dark:border-slate-600 dark:bg-[#111827] dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="modal-password" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <input
                  id="modal-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-[#111827] dark:text-white"
                />
              </div>

              {error && (
                <p className="text-xs font-medium text-[#782F46] dark:text-[#B76E85]">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#087F5B] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#06684A] disabled:opacity-60 dark:bg-[#34D399] dark:text-slate-950"
              >
                {loading ? 'Authenticating...' : 'Authenticate & Enter Portal'}
              </button>
            </form>

            <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Fill Seeded Demo Credentials</span>
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => fillRoleDemo('Investor')}
                  className="rounded-lg border border-slate-200 px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Investor ID
                </button>
                <button
                  type="button"
                  onClick={() => fillRoleDemo('Broker / Quant')}
                  className="rounded-lg border border-slate-200 px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Broker ID
                </button>
                <button
                  type="button"
                  onClick={() => fillRoleDemo('Practice Trader')}
                  className="rounded-lg border border-slate-200 px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Practice ID
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
