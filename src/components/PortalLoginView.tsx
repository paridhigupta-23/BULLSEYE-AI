import React, { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  KeyRound,
  Lock,
  ShieldAlert,
  TrendingUp,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext.tsx';
import { api } from '../services/api.ts';
import type { PortalId, UserProfile } from '../types/index.ts';

interface PortalLoginViewProps {
  targetPortal: Exclude<PortalId, 'landing'>;
}

interface PortalLoginConfig {
  role: UserProfile['role'];
  title: string;
  subtitle: string;
  badge: string;
  demoUserId: string;
  demoEmail: string;
  demoPassword: string;
  accentBg: string;
  accentText: string;
  accentBorder: string;
  capabilities: string[];
  icon: React.ComponentType<{ className?: string }>;
}

const PORTAL_CONFIGS: Record<Exclude<PortalId, 'landing'>, PortalLoginConfig> = {
  investor: {
    role: 'Investor',
    title: 'Investor Portal Sign In',
    subtitle:
      'Authenticate with your Investor User ID to access NIFTY 50 OHLCV charts, technical indicators, explainable ML predictions, ATR risk sizing, and your persistent watchlist & portfolio.',
    badge: 'Protected Investor Workspace',
    demoUserId: 'INV-DEMO-01',
    demoEmail: 'investor@bullseye.ai',
    demoPassword: 'Investor@2026',
    accentBg: 'bg-[#087F5B] hover:bg-[#06684A] dark:bg-[#34D399] dark:text-slate-950',
    accentText: 'text-[#087F5B] dark:text-[#34D399]',
    accentBorder: 'border-[#087F5B]/30 dark:border-[#34D399]/30',
    capabilities: [
      'Interactive TradingView Candlestick, SMA 20/50, EMA 12/26 & Bollinger Bands',
      'RSI(14), MACD, Explainable AI feature attributions & GARCH(1,1) volatility',
      'SQLite-persisted Investor Watchlist & Long-Term Equity Holdings Tracker',
    ],
    icon: TrendingUp,
  },
  broker: {
    role: 'Broker / Quant',
    title: 'Broker & Quant Workbench Sign In',
    subtitle:
      'Role-restricted quantitative workspace for 9-stage dataset validation, chronological ML training, evaluation metrics, GARCH(1,1) volatility, backtesting, and SQLite audit monitoring.',
    badge: 'Restricted Quantitative Desk',
    demoUserId: 'BRK-QUANT-01',
    demoEmail: 'quant@bullseye.ai',
    demoPassword: 'Quant@2026',
    accentBg: 'bg-[#782F46] hover:bg-[#612438] dark:bg-[#B76E85] dark:text-slate-950',
    accentText: 'text-[#782F46] dark:text-[#B76E85]',
    accentBorder: 'border-[#782F46]/30 dark:border-[#B76E85]/30',
    capabilities: [
      '9-stage dataset ingestion, validation & leak-free chronological splitting',
      'Train & evaluate Logistic Regression, Random Forest, and Gradient Boosting',
      'Chronological backtesting (0.05% brokerage + 0.02% slippage) & SQLite run logs',
    ],
    icon: BarChart3,
  },
  practice: {
    role: 'Practice Trader',
    title: 'Practice Trading Simulator Sign In',
    subtitle:
      'Enter your paper-trading account with ₹10,00,000 in virtual capital to execute Market and Limit orders, manage stop-losses, and track realized/unrealized P&L in SQLite.',
    badge: 'Protected Paper Trading Terminal',
    demoUserId: 'PRC-TRADE-01',
    demoEmail: 'trader@bullseye.ai',
    demoPassword: 'Trade@2026',
    accentBg: 'bg-[#5B3E96] hover:bg-[#4A317C] dark:bg-[#A78BFA] dark:text-slate-950',
    accentText: 'text-[#5B3E96] dark:text-[#A78BFA]',
    accentBorder: 'border-[#5B3E96]/30 dark:border-[#A78BFA]/30',
    capabilities: [
      'Dedicated ₹10,00,000 virtual wallet isolated per Practice Trader account',
      'Real-time balance, holdings validation, Market & Limit order simulation',
      'SQLite-backed order log, trade ledger, allocation breakdown & reset controls',
    ],
    icon: Wallet,
  },
};

export const PortalLoginView: React.FC<PortalLoginViewProps> = ({ targetPortal }) => {
  const { user, completeAuthSession, logoutUser, setPortal } = useAppContext();
  const cfg = PORTAL_CONFIGS[targetPortal];
  const Icon = cfg.icon;

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [userId, setUserId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login({
        userId,
        password,
        expectedRole: cfg.role,
      });
      completeAuthSession(res.user, res.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.register({
        userId,
        name,
        email,
        password,
        role: cfg.role,
      });
      completeAuthSession(res.user, res.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setMode('login');
    setUserId(cfg.demoUserId);
    setPassword(cfg.demoPassword);
    setError(null);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      {user && user.role !== cfg.role && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-[#782F46]/30 bg-[#782F46]/10 p-4 text-sm text-slate-800 sm:flex-row sm:items-center sm:justify-between dark:border-[#B76E85]/30 dark:bg-[#B76E85]/15 dark:text-slate-100">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#782F46] dark:text-[#B76E85]" />
            <div>
              <p className="font-semibold">
                Signed in as {user.userCode} ({user.role})
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Role-based access control restricts this dashboard to authenticated{' '}
                <strong>{cfg.role}</strong> credentials. Sign in below with a {cfg.role} account to switch.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() =>
                setPortal(
                  user.role === 'Broker / Quant'
                    ? 'broker'
                    : user.role === 'Practice Trader'
                      ? 'practice'
                      : 'investor',
                )
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-[#1F2937] dark:text-slate-100"
            >
              Return to {user.role}
            </button>
            <button
              type="button"
              onClick={() => logoutUser()}
              className="rounded-lg border border-[#782F46]/40 px-3 py-1.5 text-xs font-semibold text-[#782F46] hover:bg-[#782F46]/10 dark:border-[#B76E85]/40 dark:text-[#B76E85]"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Portal Context Card */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-7 sm:p-8 lg:col-span-6 dark:border-slate-800 dark:bg-[#1F2937]">
          <div>
            <div className="flex items-center gap-2.5">
              <div className={`rounded-xl border p-2.5 ${cfg.accentBorder} bg-[#F8F6F0] dark:bg-[#111827]`}>
                <Icon className={`h-5 w-5 ${cfg.accentText}`} />
              </div>
              <span className={`font-mono text-xs font-semibold tracking-wide ${cfg.accentText}`}>
                {cfg.badge}
              </span>
            </div>

            <h1 className="mt-5 font-display text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
              {cfg.title}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {cfg.subtitle}
            </p>

            <div className="mt-6 space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Authorized Capabilities
              </p>
              {cfg.capabilities.map((cap) => (
                <div
                  key={cap}
                  className="flex items-start gap-2.5 rounded-xl bg-[#F8F6F0] px-3.5 py-2.5 text-xs text-slate-700 dark:bg-[#111827] dark:text-slate-200"
                >
                  <Briefcase className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${cfg.accentText}`} />
                  <span>{cap}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Demo Account Reference Box */}
          <div className={`mt-6 rounded-xl border p-4 ${cfg.accentBorder} bg-[#F8F6F0]/70 dark:bg-[#111827]`}>
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100">
                <KeyRound className={`h-3.5 w-3.5 ${cfg.accentText}`} />
                <span>Seeded Demo Credentials ({cfg.role})</span>
              </p>
              <button
                type="button"
                onClick={fillDemoCredentials}
                className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${cfg.accentBorder} ${cfg.accentText} bg-white hover:bg-slate-50 dark:bg-[#1F2937]`}
              >
                Fill Demo ID
              </button>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2 font-mono text-xs">
              <div>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400">User ID</span>
                <span className="font-semibold text-slate-900 dark:text-white">{cfg.demoUserId}</span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400">Password</span>
                <span className="font-semibold text-slate-900 dark:text-white">{cfg.demoPassword}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Authentication Form */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-7 sm:p-8 lg:col-span-6 dark:border-slate-800 dark:bg-[#1F2937]">
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-[#111827]">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-semibold ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-[#1F2937] dark:text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Lock className="h-3.5 w-3.5" />
              <span>{cfg.role} Login</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-semibold ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-[#1F2937] dark:text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>New {cfg.role} ID</span>
            </button>
          </div>

          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor={`portal-userid-${targetPortal}`}
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  {cfg.role} User ID or Email
                </label>
                <input
                  id={`portal-userid-${targetPortal}`}
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder={cfg.demoUserId}
                  required
                  autoComplete="username"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 dark:border-slate-600 dark:bg-[#111827] dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor={`portal-password-${targetPortal}`}
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Password
                </label>
                <input
                  id={`portal-password-${targetPortal}`}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter portal password"
                  required
                  autoComplete="current-password"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-[#111827] dark:text-white"
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-[#782F46]/30 bg-[#782F46]/10 px-3.5 py-2.5 text-xs font-medium text-[#782F46] dark:border-[#B76E85]/40 dark:text-[#B76E85]"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60 ${cfg.accentBg}`}
              >
                <span>{loading ? 'Verifying Credentials...' : `Sign In to ${cfg.role} Portal`}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="mt-6 space-y-3.5">
              <div>
                <label
                  htmlFor={`reg-userid-${targetPortal}`}
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Choose {cfg.role} User ID
                </label>
                <input
                  id={`reg-userid-${targetPortal}`}
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder={`${cfg.demoUserId.split('-')[0]}-USER-02`}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 dark:border-slate-600 dark:bg-[#111827] dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor={`reg-name-${targetPortal}`}
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Full Name
                </label>
                <input
                  id={`reg-name-${targetPortal}`}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Paridhi Gupta"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-[#111827] dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor={`reg-email-${targetPortal}`}
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Email Address
                </label>
                <input
                  id={`reg-email-${targetPortal}`}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@bullseye.ai"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-[#111827] dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor={`reg-password-${targetPortal}`}
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Password (min 6 characters)
                </label>
                <input
                  id={`reg-password-${targetPortal}`}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-[#111827] dark:text-white"
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-[#782F46]/30 bg-[#782F46]/10 px-3.5 py-2.5 text-xs font-medium text-[#782F46] dark:border-[#B76E85]/40 dark:text-[#B76E85]"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60 ${cfg.accentBg}`}
              >
                <span>{loading ? 'Creating Account...' : `Create ${cfg.role} Account & Enter`}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
