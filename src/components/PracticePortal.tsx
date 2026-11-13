import React, { useEffect, useState } from 'react';
import { Activity, Bot, BrainCircuit, LogOut, RotateCcw, ShieldAlert, XCircle } from 'lucide-react';
import { useAppContext } from '../context/AppContext.tsx';
import { api } from '../services/api.ts';
import {
  formatINR,
  formatPct,
  type PortfolioSnapshot,
  type StockSummary,
} from '../types/index.ts';
import { AllocationPieChart } from './charts/IndicatorCharts.tsx';
import { PracticeIntelligenceView } from './practice/PracticeIntelligenceView.tsx';

interface PracticePortalProps {
  stocks: StockSummary[];
}

export const PracticePortal: React.FC<PracticePortalProps> = ({ stocks }) => {
  const { selectedSymbol, setSelectedSymbol, t, openAiWithContext, user, logoutUser } =
    useAppContext();

  const [subPortalTab, setSubPortalTab] = useState<'home' | 'intelligence'>(() => {
    const params = new URLSearchParams(window.location.search);
    const tParam = params.get('tab');
    return tParam === 'intelligence' ? 'intelligence' : 'home';
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    if (subPortalTab === 'home') {
      url.searchParams.delete('tab');
    } else {
      url.searchParams.set('tab', 'intelligence');
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, [subPortalTab]);

  const [portfolio, setPortfolio] = useState<PortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [quantity, setQuantity] = useState<number>(10);
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'holdings' | 'orders' | 'trades'>('holdings');

  const currentStock = stocks.find((s) => s.symbol === selectedSymbol) ?? stocks[0];

  const loadPortfolio = async () => {
    setLoading(true);
    try {
      const snap = await api.getPortfolio();
      setPortfolio(snap);
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Failed to load portfolio' });
      setPortfolio((prev) => prev ?? {
        startingCapital: 1000000,
        cashBalance: 1000000,
        holdingsMarketValue: 0,
        totalPortfolioValue: 1000000,
        realizedPnl: 0,
        unrealizedPnl: 0,
        totalPnl: 0,
        totalReturnPct: 0,
        holdings: [],
        orders: [],
        trades: [],
        equityHistory: [{ timestamp: new Date().toISOString(), portfolioValue: 1000000, cashBalance: 1000000 }],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortfolio();
  }, []);

  useEffect(() => {
    if (currentStock) {
      setLimitPrice(currentStock.latestClose.toFixed(2));
    }
  }, [currentStock?.symbol]);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStock) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await api.placeOrder({
        symbol: currentStock.symbol,
        side: orderSide,
        orderType,
        quantity,
        limitPrice: orderType === 'LIMIT' ? Number(limitPrice) : undefined,
      });
      setPortfolio(res.portfolio);
      setFeedback({
        type: 'ok',
        text: `Simulated ${orderSide} ${orderType} order for ${quantity} ${currentStock.symbol} recorded against ${currentStock.latestDate} dataset close.`,
      });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Order rejected' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      const res = await api.cancelOrder(orderId);
      setPortfolio(res.portfolio);
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Cancel failed' });
    }
  };

  const handleReset = async () => {
    setFeedback(null);
    const res = await api.resetPortfolio();
    setPortfolio(res.portfolio);
    setFeedback({ type: 'ok', text: 'Virtual wallet reset to ₹10,00,000.00.' });
  };

  const estimatedOrderValue = currentStock
    ? quantity * (orderType === 'LIMIT' && Number(limitPrice) > 0 ? Number(limitPrice) : currentStock.latestClose)
    : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between dark:border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-[#5B3E96] dark:text-[#A78BFA]">
              {user?.userCode} · {user?.role}
            </span>
            <button
              type="button"
              onClick={() => logoutUser()}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <LogOut className="h-3 w-3" />
              <span>Sign Out</span>
            </button>
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
            {t.practiceHeading}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t.practiceSubheading}</p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#1F2937] dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>{t.resetPortfolioBtn}</span>
        </button>
      </div>

      {/* Sub-Portal Navigation: Home vs Practice Intelligence */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSubPortalTab('home')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              subPortalTab === 'home'
                ? 'bg-[#087F5B] text-white shadow-sm dark:bg-[#34D399] dark:text-slate-950'
                : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-[#1F2937] dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Trading Terminal (Home)</span>
          </button>
          <button
            type="button"
            onClick={() => setSubPortalTab('intelligence')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              subPortalTab === 'intelligence'
                ? 'bg-[#087F5B] text-white shadow-sm dark:bg-[#34D399] dark:text-slate-950'
                : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-[#1F2937] dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <BrainCircuit className="h-3.5 w-3.5" />
            <span>Practice Intelligence (5 Simulators)</span>
          </button>
        </div>

        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
          Virtual Capital: ₹10,00,000.00 · Mode: {subPortalTab === 'home' ? 'Execution' : 'Intelligence'}
        </span>
      </div>

      {subPortalTab === 'intelligence' && portfolio ? (
        <PracticeIntelligenceView
          stocks={stocks}
          portfolio={portfolio}
          onRefreshPortfolio={loadPortfolio}
          user={user}
        />
      ) : (
        <>
          {/* Simulated Notice */}
          <div className="rounded-xl border border-[#087F5B]/30 bg-[#087F5B]/10 px-4 py-3 text-xs font-medium text-slate-900 dark:border-[#34D399]/30 dark:bg-[#34D399]/10 dark:text-slate-100">
            {t.simulatedBanner} Reference prices come from the historical dataset close ({currentStock?.latestDate ?? '2025-09-30'}).
          </div>

      {/* Wallet KPIs */}
      {loading || !portfolio ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white dark:bg-[#1F2937]" />
          ))}
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 tabular-nums">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 dark:border-slate-800 dark:bg-[#1F2937]">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.portfolioValue}</p>
            <p className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-white" data-testid="portfolio-total-value">
              {formatINR(portfolio.totalPortfolioValue)}
            </p>
            <p
              className={`mt-1 font-mono text-xs font-semibold ${
                portfolio.totalReturnPct >= 0
                  ? 'text-[#087F5B] dark:text-[#34D399]'
                  : 'text-[#782F46] dark:text-[#B76E85]'
              }`}
            >
              {formatPct(portfolio.totalReturnPct)} vs ₹10L
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 dark:border-slate-800 dark:bg-[#1F2937]">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.availableBalance}</p>
            <p className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-white" data-testid="portfolio-cash">
              {formatINR(portfolio.cashBalance)}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t.virtualWallet}</p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 dark:border-slate-800 dark:bg-[#1F2937]">
            <p className="text-xs text-slate-500 dark:text-slate-400">Holdings Value</p>
            <p className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-white">
              {formatINR(portfolio.holdingsMarketValue)}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {portfolio.holdings.length} active positions
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 dark:border-slate-800 dark:bg-[#1F2937]">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.unrealizedPnl}</p>
            <p
              className={`mt-1 font-mono text-xl font-bold ${
                portfolio.unrealizedPnl >= 0
                  ? 'text-[#087F5B] dark:text-[#34D399]'
                  : 'text-[#782F46] dark:text-[#B76E85]'
              }`}
            >
              {formatINR(portfolio.unrealizedPnl)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 dark:border-slate-800 dark:bg-[#1F2937]">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.realizedPnl}</p>
            <p
              className={`mt-1 font-mono text-xl font-bold ${
                portfolio.realizedPnl >= 0
                  ? 'text-[#087F5B] dark:text-[#34D399]'
                  : 'text-[#782F46] dark:text-[#B76E85]'
              }`}
            >
              {formatINR(portfolio.realizedPnl)}
            </p>
          </div>
        </section>
      )}

      {/* Main Trading Ticket + Allocation/Risk Grid */}
      {portfolio && (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Simulated Order Ticket */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-5 dark:border-slate-800 dark:bg-[#1F2937]">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Simulated Order Ticket
              </h2>
              <button
                type="button"
                onClick={() =>
                  openAiWithContext(
                    {
                      title: `Practice Order · ${currentStock?.symbol}`,
                      symbol: currentStock?.symbol,
                      data: {
                        side: orderSide,
                        orderType,
                        quantity,
                        referencePrice: currentStock?.latestClose,
                        latestDate: currentStock?.latestDate,
                        atr14: currentStock?.atr14,
                        cashBalance: portfolio.cashBalance,
                      },
                    },
                    `Evaluate the risk of placing a simulated ${orderSide} order for ${quantity} shares of ${currentStock?.symbol} at ₹${currentStock?.latestClose}.`,
                  )
                }
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#087F5B] hover:underline dark:text-[#34D399]"
              >
                <Bot className="h-3.5 w-3.5" />
                <span>{t.explainThis}</span>
              </button>
            </div>

            <form onSubmit={handleSubmitOrder} className="mt-4 space-y-4">
              <div>
                <label htmlFor="practice-stock-select" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Select NIFTY 50 Equity
                </label>
                <select
                  id="practice-stock-select"
                  value={selectedSymbol}
                  onChange={(e) => setSelectedSymbol(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                >
                  {stocks.map((s) => (
                    <option key={s.symbol} value={s.symbol}>
                      {s.symbol} — {formatINR(s.latestClose)} ({s.latestDate})
                    </option>
                  ))}
                </select>
              </div>

              {currentStock && (
                <div className="flex items-center justify-between rounded-xl bg-[#F8F6F0] px-4 py-3 text-xs dark:bg-[#111827] tabular-nums">
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Dataset Close ({currentStock.latestDate})</p>
                    <p className="font-mono text-base font-bold text-slate-900 dark:text-white">
                      {formatINR(currentStock.latestClose)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-500 dark:text-slate-400">ATR(14) Risk</p>
                    <p className="font-mono font-semibold text-slate-900 dark:text-white">
                      {formatINR(currentStock.atr14)} ({currentStock.riskCategory})
                    </p>
                  </div>
                </div>
              )}

              {/* BUY / SELL Toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOrderSide('BUY')}
                  className={`rounded-lg py-2.5 text-sm font-bold transition-colors ${
                    orderSide === 'BUY'
                      ? 'bg-[#087F5B] text-white dark:bg-[#34D399] dark:text-slate-950'
                      : 'border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  BUY
                </button>
                <button
                  type="button"
                  onClick={() => setOrderSide('SELL')}
                  className={`rounded-lg py-2.5 text-sm font-bold transition-colors ${
                    orderSide === 'SELL'
                      ? 'bg-[#782F46] text-white dark:bg-[#B76E85] dark:text-slate-950'
                      : 'border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  SELL
                </button>
              </div>

              {/* Order Type + Quantity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="order-type" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Order Type
                  </label>
                  <select
                    id="order-type"
                    value={orderType}
                    onChange={(e) => setOrderType(e.target.value as 'MARKET' | 'LIMIT')}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                  >
                    <option value="MARKET">MARKET</option>
                    <option value="LIMIT">LIMIT</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="order-qty" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Quantity (Shares)
                  </label>
                  <input
                    id="order-qty"
                    type="number"
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value))))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                  />
                </div>
              </div>

              {orderType === 'LIMIT' && (
                <div>
                  <label htmlFor="order-limit-price" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Limit Price (₹)
                  </label>
                  <input
                    id="order-limit-price"
                    type="number"
                    step="0.05"
                    min="0.05"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                  />
                </div>
              )}

              <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-slate-800 tabular-nums">
                <span className="text-slate-500 dark:text-slate-400">Estimated Order Value</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {formatINR(estimatedOrderValue)}
                </span>
              </div>

              {feedback && (
                <div
                  role="status"
                  className={`rounded-lg px-3 py-2.5 text-xs font-medium ${
                    feedback.type === 'ok'
                      ? 'bg-[#087F5B]/10 text-[#087F5B] dark:bg-[#34D399]/15 dark:text-[#34D399]'
                      : 'bg-[#782F46]/10 text-[#782F46] dark:bg-[#B76E85]/15 dark:text-[#B76E85]'
                  }`}
                >
                  {feedback.text}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className={`w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
                  orderSide === 'BUY'
                    ? 'bg-[#087F5B] hover:bg-[#06684A] dark:bg-[#34D399] dark:text-slate-950'
                    : 'bg-[#782F46] hover:bg-[#5e2336] dark:bg-[#B76E85] dark:text-slate-950'
                }`}
              >
                {submitting ? 'Simulating Order...' : `${t.placeOrderBtn} (${orderSide})`}
              </button>
            </form>
          </div>

          {/* Portfolio Allocation + Risk Overview */}
          <div className="grid grid-cols-1 gap-6 lg:col-span-7">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Portfolio Allocation &amp; Risk Overview
              </h2>
              <div className="mt-3 grid grid-cols-1 items-center gap-6 md:grid-cols-2">
                <AllocationPieChart
                  holdings={portfolio.holdings}
                  cashBalance={portfolio.cashBalance}
                />
                <div className="space-y-3 text-xs">
                  <div className="rounded-xl bg-[#F8F6F0] p-3.5 dark:bg-[#111827] tabular-nums">
                    <p className="text-slate-500 dark:text-slate-400">Cash Reserve Ratio</p>
                    <p className="mt-1 font-mono text-base font-bold text-slate-900 dark:text-white">
                      {((portfolio.cashBalance / portfolio.totalPortfolioValue) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#F8F6F0] p-3.5 dark:bg-[#111827] tabular-nums">
                    <p className="text-slate-500 dark:text-slate-400">Equity Exposure</p>
                    <p className="mt-1 font-mono text-base font-bold text-slate-900 dark:text-white">
                      {((portfolio.holdingsMarketValue / portfolio.totalPortfolioValue) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#782F46] dark:text-[#B76E85]" />
                    <p>
                      Each holding displays its 1.5× ATR(14) stop-loss reference to encourage disciplined position sizing.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Holdings / Orders / Trades Tabs */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
                <div className="flex gap-2">
                  {(
                    [
                      ['holdings', `Holdings (${portfolio.holdings.length})`],
                      ['orders', `Orders (${portfolio.orders.length})`],
                      ['trades', `Trades (${portfolio.trades.length})`],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveTab(key)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
                        activeTab === key
                          ? 'bg-[#087F5B] text-white dark:bg-[#34D399] dark:text-slate-950'
                          : 'bg-slate-100 text-slate-700 dark:bg-[#111827] dark:text-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                {activeTab === 'holdings' && (
                  portfolio.holdings.length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                      No open positions yet. Place a simulated BUY order to build your virtual portfolio.
                    </p>
                  ) : (
                    <table className="w-full text-left text-xs tabular-nums">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                          <th className="py-2 pr-3 font-medium">Symbol</th>
                          <th className="py-2 px-3 text-right font-medium">Qty</th>
                          <th className="py-2 px-3 text-right font-medium">Avg Buy</th>
                          <th className="py-2 px-3 text-right font-medium">Dataset Close</th>
                          <th className="py-2 px-3 text-right font-medium">1.5×ATR Stop</th>
                          <th className="py-2 pl-3 text-right font-medium">Unrealized P&amp;L</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {portfolio.holdings.map((h) => (
                          <tr key={h.symbol}>
                            <td className="py-2.5 pr-3 font-mono font-bold text-slate-900 dark:text-white">
                              {h.symbol}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">{h.quantity}</td>
                            <td className="py-2.5 px-3 text-right font-mono">{formatINR(h.avgBuyPrice)}</td>
                            <td className="py-2.5 px-3 text-right font-mono">{formatINR(h.currentPrice)}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-[#782F46] dark:text-[#B76E85]">
                              {formatINR(h.suggestedStopLoss)}
                            </td>
                            <td
                              className={`py-2.5 pl-3 text-right font-mono font-semibold ${
                                h.unrealizedPnl >= 0
                                  ? 'text-[#087F5B] dark:text-[#34D399]'
                                  : 'text-[#782F46] dark:text-[#B76E85]'
                              }`}
                            >
                              {formatINR(h.unrealizedPnl)} ({formatPct(h.unrealizedPnlPct)})
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}

                {activeTab === 'orders' && (
                  portfolio.orders.length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                      No simulated orders placed yet.
                    </p>
                  ) : (
                    <table className="w-full text-left text-xs tabular-nums">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                          <th className="py-2 pr-3 font-medium">Symbol</th>
                          <th className="py-2 px-3 font-medium">Side / Type</th>
                          <th className="py-2 px-3 text-right font-medium">Qty</th>
                          <th className="py-2 px-3 text-right font-medium">Price</th>
                          <th className="py-2 px-3 font-medium">Status</th>
                          <th className="py-2 pl-3 text-right font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {portfolio.orders.map((o) => (
                          <tr key={o.id}>
                            <td className="py-2.5 pr-3 font-mono font-bold text-slate-900 dark:text-white">
                              {o.symbol}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={
                                  o.side === 'BUY'
                                    ? 'font-semibold text-[#087F5B] dark:text-[#34D399]'
                                    : 'font-semibold text-[#782F46] dark:text-[#B76E85]'
                                }
                              >
                                {o.side}
                              </span>{' '}
                              · {o.orderType}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">{o.quantity}</td>
                            <td className="py-2.5 px-3 text-right font-mono">
                              {formatINR(o.executedPrice > 0 ? o.executedPrice : o.requestedPrice)}
                            </td>
                            <td className="py-2.5 px-3 font-mono">{o.status}</td>
                            <td className="py-2.5 pl-3 text-right">
                              {o.status === 'PENDING' && (
                                <button
                                  type="button"
                                  onClick={() => handleCancelOrder(o.id)}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-[#782F46] hover:underline dark:text-[#B76E85]"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  <span>Cancel</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}

                {activeTab === 'trades' && (
                  portfolio.trades.length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                      No executed trades yet.
                    </p>
                  ) : (
                    <table className="w-full text-left text-xs tabular-nums">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                          <th className="py-2 pr-3 font-medium">Symbol</th>
                          <th className="py-2 px-3 font-medium">Side</th>
                          <th className="py-2 px-3 text-right font-medium">Qty</th>
                          <th className="py-2 px-3 text-right font-medium">Price</th>
                          <th className="py-2 px-3 text-right font-medium">Total</th>
                          <th className="py-2 pl-3 text-right font-medium">Realized P&amp;L</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {portfolio.trades.map((tr) => (
                          <tr key={tr.id}>
                            <td className="py-2.5 pr-3 font-mono font-bold text-slate-900 dark:text-white">
                              {tr.symbol}
                            </td>
                            <td
                              className={`py-2.5 px-3 font-semibold ${
                                tr.side === 'BUY'
                                  ? 'text-[#087F5B] dark:text-[#34D399]'
                                  : 'text-[#782F46] dark:text-[#B76E85]'
                              }`}
                            >
                              {tr.side}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">{tr.quantity}</td>
                            <td className="py-2.5 px-3 text-right font-mono">{formatINR(tr.price)}</td>
                            <td className="py-2.5 px-3 text-right font-mono">{formatINR(tr.totalValue)}</td>
                            <td className="py-2.5 pl-3 text-right font-mono">
                              {tr.side === 'SELL' ? formatINR(tr.realizedPnl) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}
              </div>
            </div>
          </div>
        </section>
      )}
        </>
      )}
    </div>
  );
};
