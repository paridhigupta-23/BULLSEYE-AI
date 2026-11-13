import React from 'react';
import { ArrowRight, BarChart3, BrainCircuit, CandlestickChart, ShieldAlert, Wallet } from 'lucide-react';
import { useAppContext } from '../context/AppContext.tsx';
import { formatINR, formatPct, formatVolume, type StockSummary } from '../types/index.ts';

interface LandingPageProps {
  stocks: StockSummary[];
  datasetStats: {
    combinedRows: number;
    featureRows: number;
    stocksCount: number;
    dateRange: { start: string; end: string };
  } | null;
  loading: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({ stocks, datasetStats, loading }) => {
  const { setPortal, setSelectedSymbol, t } = useAppContext();

  const featuredStocks = stocks.filter((s) => s.featured).slice(0, 4);

  const openStockInInvestor = (symbol: string) => {
    setSelectedSymbol(symbol);
    setPortal('investor');
  };

  const capabilities = [
    {
      num: '01.',
      title: 'Technical & OHLCV Clarity',
      icon: CandlestickChart,
      desc: 'Interactive candlestick charts with SMA 20/50, EMA 12/26, Bollinger Bands, RSI 14, MACD, and ATR 14 computed independently per NIFTY 50 equity.',
    },
    {
      num: '02.',
      title: 'Leak-Free Machine Learning & SHAP',
      icon: BrainCircuit,
      desc: 'Chronological train/test splitting trains Logistic Regression, Random Forest, and Gradient Boosted Trees while strictly excluding target leakage.',
    },
    {
      num: '03.',
      title: 'GARCH(1,1) Volatility & ATR Risk Sizing',
      icon: ShieldAlert,
      desc: 'Fits stationary conditional variance models and computes exact stop-loss levels and position sizes from your capital and risk fraction.',
    },
    {
      num: '04.',
      title: 'Chronological Backtesting & Paper Trading',
      icon: Wallet,
      desc: 'Test historical strategies with configurable brokerage and slippage, or practice order execution with ₹10,00,000 in virtual capital.',
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Historical Dataset Notice */}
      <div className="mb-8 rounded-xl border border-[#782F46]/25 bg-[#EAE4F5]/70 px-4 py-3 text-xs font-medium text-slate-800 dark:border-[#A78BFA]/30 dark:bg-[#1F2937] dark:text-slate-200">
        {t.historicalNotice}
      </div>

      {/* Hero Split */}
      <section className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-7 sm:p-10 lg:col-span-7 dark:border-slate-800 dark:bg-[#1F2937]">
          <div>
            <p className="text-xs font-semibold tracking-wider text-[#087F5B] dark:text-[#34D399]">
              BULLSEYE AI · {t.brandTagline}
            </p>
            <h1 className="text-balance mt-4 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
              {t.heroTitle}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
              {t.heroSubtitle}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setPortal('investor')}
              className="inline-flex items-center gap-2 rounded-lg bg-[#087F5B] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#06684A] dark:bg-[#34D399] dark:text-slate-950 dark:hover:bg-[#2bb986] whitespace-nowrap shrink-0"
            >
              <span>{t.heroCtaInvestor}</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setPortal('broker')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-[#111827] dark:text-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <BarChart3 className="h-4 w-4 text-[#782F46] dark:text-[#B76E85]" />
              <span>{t.heroCtaBroker}</span>
            </button>

            <button
              type="button"
              onClick={() => setPortal('practice')}
              className="inline-flex items-center gap-2 rounded-lg bg-[#EAE4F5] px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-[#dfd5f0] dark:bg-[#A78BFA]/20 dark:text-[#A78BFA] dark:hover:bg-[#A78BFA]/30 whitespace-nowrap shrink-0"
            >
              <span>{t.heroCtaPractice}</span>
            </button>
          </div>
        </div>

        {/* Right Hero Panel: Live-from-Dataset NIFTY 50 Snapshot */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 lg:col-span-5 dark:border-slate-800 dark:bg-[#1F2937]">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-700">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Primary Showcase Equities
              </h2>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                Latest: {datasetStats?.dateRange.end ?? '2025-09-30'}
              </span>
            </div>

            {loading ? (
              <div className="mt-4 space-y-3">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                ))}
              </div>
            ) : (
              <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                {featuredStocks.map((stock) => {
                  const pos = stock.dailyReturn >= 0;
                  return (
                    <button
                      key={stock.symbol}
                      type="button"
                      onClick={() => openStockInInvestor(stock.symbol)}
                      className="flex w-full items-center justify-between py-3.5 text-left transition-colors hover:bg-[#F8F6F0]/80 px-2 rounded-lg dark:hover:bg-slate-800/60"
                    >
                      <div>
                        <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                          {stock.symbol}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                          {stock.name}
                        </p>
                      </div>
                      <div className="text-right tabular-nums">
                        <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                          {formatINR(stock.latestClose)}
                        </p>
                        <p
                          className={`font-mono text-xs font-medium ${
                            pos
                              ? 'text-[#087F5B] dark:text-[#34D399]'
                              : 'text-[#782F46] dark:text-[#B76E85]'
                          }`}
                        >
                          {formatPct(stock.dailyReturn * 100)} · RSI {stock.rsi14.toFixed(1)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">OHLCV Rows</p>
              <p className="font-mono text-base font-bold tabular-nums text-slate-900 dark:text-white">
                {datasetStats ? datasetStats.combinedRows.toLocaleString('en-IN') : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">NIFTY Stocks</p>
              <p className="font-mono text-base font-bold tabular-nums text-slate-900 dark:text-white">
                {datasetStats ? datasetStats.stocksCount : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Feature Rows</p>
              <p className="font-mono text-base font-bold tabular-nums text-slate-900 dark:text-white">
                {datasetStats ? datasetStats.featureRows.toLocaleString('en-IN') : '—'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities Grid */}
      <section className="mt-12">
        <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              Three Integrated Portals. One Verified Dataset.
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Built to solve fragmented technical tools, unexplained black-box signals, and unmeasured trade risk.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {capabilities.map((cap) => {
            const Icon = cap.icon;
            return (
              <div
                key={cap.num}
                className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-[#782F46] dark:text-[#B76E85]">
                    {cap.num}
                  </span>
                  <Icon className="h-5 w-5 text-[#087F5B] dark:text-[#34D399]" />
                </div>
                <h3 className="mt-3 font-display text-lg font-bold text-slate-900 dark:text-white">
                  {cap.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {cap.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Featured Stocks Strip */}
      {featuredStocks.length > 0 && (
        <section className="mt-12">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Inspect Primary NIFTY 50 Equities
            </h2>
            <button
              type="button"
              onClick={() => setPortal('investor')}
              className="text-sm font-semibold text-[#087F5B] hover:underline dark:text-[#34D399]"
            >
              View all {stocks.length} stocks →
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featuredStocks.map((s) => (
              <button
                key={s.symbol}
                type="button"
                onClick={() => openStockInInvestor(s.symbol)}
                className="rounded-2xl border border-slate-200/90 bg-white p-5 text-left transition-colors hover:border-[#087F5B] dark:border-slate-800 dark:bg-[#1F2937] dark:hover:border-[#34D399]"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                    {s.symbol}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{s.latestDate}</span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-600 dark:text-slate-300">{s.name}</p>
                <p className="mt-4 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-white">
                  {formatINR(s.latestClose)}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs tabular-nums">
                  <span
                    className={
                      s.dailyReturn >= 0
                        ? 'font-semibold text-[#087F5B] dark:text-[#34D399]'
                        : 'font-semibold text-[#782F46] dark:text-[#B76E85]'
                    }
                  >
                    {formatPct(s.dailyReturn * 100)}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    Vol {formatVolume(s.latestVolume)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
