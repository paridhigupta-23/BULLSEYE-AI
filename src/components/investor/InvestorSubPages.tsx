import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Bookmark,
  CheckCircle2,
  ClipboardList,
  FileText,
  Globe,
  Landmark,
  LogOut,
  MessageSquare,
  Newspaper,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext.tsx';
import {
  formatINR,
  formatPct,
  formatVolume,
  type BrokerMessageItem,
  type ClientRequestItem,
  type ExpertAdviceItem,
  type InvestorBrokerConnection,
  type InvestorNewsResponse,
  type InvestorOrder,
  type InvestorPortfolioSnapshot,
  type IpoSnapshotResponse,
  type LanguageCode,
  type StockSummary,
  type UserProfile,
} from '../../types/index.ts';
import {
  InvestorBrokerLinkCard,
  InvestorExpertAdviceSection,
  InvestorMessagesSection,
  InvestorRequestsSection,
} from './InvestorAdvisorySections.tsx';

export type InvestorTabId = 'home' | 'ipo' | 'stocks' | 'orders' | 'news' | 'profile';
export type ProfileSectionId = 'account' | 'requests' | 'advice' | 'messages';

interface HomeTabProps {
  user: UserProfile | null;
  stocks: StockSummary[];
  selectedSymbol: string;
  investorPortfolio: InvestorPortfolioSnapshot | null;
  orders: InvestorOrder[];
  adviceList: ExpertAdviceItem[];
  requests: ClientRequestItem[];
  messages: BrokerMessageItem[];
  onSelectStockAndOpen: (symbol: string) => void;
  onNavigateTab: (tab: InvestorTabId) => void;
  onNavigateProfileSection: (section: ProfileSectionId) => void;
  onRemoveWatchlist: (symbol: string) => Promise<void>;
  onRemoveHolding: (symbol: string) => Promise<void>;
}

export const InvestorHomeTab: React.FC<HomeTabProps> = ({
  user,
  stocks,
  selectedSymbol,
  investorPortfolio,
  orders,
  adviceList,
  requests,
  messages,
  onSelectStockAndOpen,
  onNavigateTab,
  onNavigateProfileSection,
  onRemoveWatchlist,
  onRemoveHolding,
}) => {
  const { inv } = useAppContext();
  const featuredStocks = stocks.filter((s) => s.featured);
  const latestAdvice = adviceList[0] ?? null;
  const openRequestsCount = requests.filter((r) => r.status !== 'Closed').length;
  const latestMessage = messages[messages.length - 1] ?? null;

  const signalColorClass = (sig: string | null) => {
    if (sig === 'BUY') return 'text-[#087F5B] dark:text-[#34D399]';
    if (sig === 'SELL') return 'text-[#782F46] dark:text-[#B76E85]';
    return 'text-slate-700 dark:text-slate-300';
  };

  return (
    <div className="space-y-8">
      {/* KPI Summary Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 tabular-nums">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 dark:border-slate-800 dark:bg-[#1F2937]">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {inv.home.trackedValue}
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-900 dark:text-white">
            {formatINR(investorPortfolio?.totalMarketValue ?? 0)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {inv.home.invested}: {formatINR(investorPortfolio?.totalInvested ?? 0)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 dark:border-slate-800 dark:bg-[#1F2937]">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {inv.home.unrealizedPnl}
          </p>
          <p
            className={`mt-2 font-mono text-2xl font-bold ${
              (investorPortfolio?.totalUnrealizedPnl ?? 0) >= 0
                ? 'text-[#087F5B] dark:text-[#34D399]'
                : 'text-[#782F46] dark:text-[#B76E85]'
            }`}
          >
            {formatINR(investorPortfolio?.totalUnrealizedPnl ?? 0)}
          </p>
          <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
            {formatPct(investorPortfolio?.totalUnrealizedPnlPct ?? 0)} ({investorPortfolio?.holdings.length ?? 0}{' '}
            {inv.home.acrossHoldings})
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 dark:border-slate-800 dark:bg-[#1F2937]">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {inv.home.watchlistTitle} ({user?.userCode})
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-900 dark:text-white">
            {investorPortfolio?.watchlist.length ?? 0} {inv.stocks.stocksUnit}
          </p>
          <button
            type="button"
            onClick={() => onNavigateTab('stocks')}
            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#087F5B] hover:underline dark:text-[#34D399]"
          >
            <span>{inv.home.exploreNifty}</span>
            <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 dark:border-slate-800 dark:bg-[#1F2937]">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {inv.home.recordedOrders}
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-900 dark:text-white">
            {orders.length}
          </p>
          <button
            type="button"
            onClick={() => onNavigateTab('orders')}
            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#087F5B] hover:underline dark:text-[#34D399]"
          >
            <span>{inv.home.openOrdersLedger}</span>
            <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
      </section>

      {/* Advisory Summary Cards: Latest Broker Advice, Requests Status, Recent Messages */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 dark:border-slate-800 dark:bg-[#1F2937]">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 font-display text-sm font-bold text-slate-900 dark:text-white">
                <Sparkles className="h-4 w-4 text-[#782F46] dark:text-[#B76E85]" />
                <span>{inv.home.latestAdviceCardTitle}</span>
              </h3>
              <span className="font-mono text-xs font-bold text-[#087F5B] dark:text-[#34D399]">
                {adviceList.length}
              </span>
            </div>
            {latestAdvice ? (
              <div className="mt-3 space-y-1 text-xs">
                <p className="font-mono font-bold text-slate-800 dark:text-slate-100">
                  {latestAdvice.symbol ?? latestAdvice.category} ·{' '}
                  {inv.statuses[latestAdvice.riskLevel] ?? latestAdvice.riskLevel}
                </p>
                <p className="line-clamp-2 text-slate-600 dark:text-slate-300">
                  {latestAdvice.recommendation}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                {inv.home.noAdviceYet}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onNavigateProfileSection('advice')}
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#087F5B] hover:underline dark:text-[#34D399]"
          >
            <span>{inv.home.viewAllAdvice}</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 dark:border-slate-800 dark:bg-[#1F2937]">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 font-display text-sm font-bold text-slate-900 dark:text-white">
                <ClipboardList className="h-4 w-4 text-[#087F5B] dark:text-[#34D399]" />
                <span>{inv.home.pendingRequestsCardTitle}</span>
              </h3>
              <span className="font-mono text-xs font-bold text-[#782F46] dark:text-[#B76E85]">
                {openRequestsCount}
              </span>
            </div>
            {requests[0] ? (
              <div className="mt-3 space-y-1 text-xs">
                <p className="font-mono font-bold text-slate-800 dark:text-slate-100">
                  {requests[0].symbol ?? requests[0].category} ·{' '}
                  {inv.statuses[requests[0].status] ?? requests[0].status}
                </p>
                <p className="line-clamp-2 text-slate-600 dark:text-slate-300">
                  {requests[0].message}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                {inv.home.noRequestsYet}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onNavigateProfileSection('requests')}
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#087F5B] hover:underline dark:text-[#34D399]"
          >
            <span>{inv.home.viewAllRequests}</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 dark:border-slate-800 dark:bg-[#1F2937]">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 font-display text-sm font-bold text-slate-900 dark:text-white">
                <MessageSquare className="h-4 w-4 text-[#087F5B] dark:text-[#34D399]" />
                <span>{inv.home.recentMessagesCardTitle}</span>
              </h3>
              <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200">
                {messages.length}
              </span>
            </div>
            {latestMessage ? (
              <div className="mt-3 space-y-1 text-xs">
                <p className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {latestMessage.senderName} · {latestMessage.createdAt.slice(0, 10)}
                </p>
                <p className="line-clamp-2 text-slate-700 dark:text-slate-200">
                  {latestMessage.messageText}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                {inv.home.noMessagesYet}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onNavigateProfileSection('messages')}
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#087F5B] hover:underline dark:text-[#34D399]"
          >
            <span>{inv.home.openMessages}</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>

      {/* Featured 4 NIFTY Showcase Stocks */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {inv.home.primaryEquitiesTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {inv.home.primaryEquitiesSubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('stocks')}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#1F2937] dark:text-slate-200"
          >
            {inv.home.openStocksTerminal}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featuredStocks.map((s) => {
            const active = s.symbol === selectedSymbol;
            const pos = s.dailyReturn >= 0;
            return (
              <button
                key={s.symbol}
                type="button"
                onClick={() => onSelectStockAndOpen(s.symbol)}
                className={`rounded-2xl border p-5 text-left transition-colors ${
                  active
                    ? 'border-[#087F5B] bg-white ring-1 ring-[#087F5B] dark:border-[#34D399] dark:bg-[#1F2937] dark:ring-[#34D399]'
                    : 'border-slate-200/90 bg-white hover:border-slate-400 dark:border-slate-800 dark:bg-[#1F2937] dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                    {s.symbol}
                  </span>
                  <span className={`font-mono text-xs font-bold ${signalColorClass(s.signal)}`}>
                    {s.modelTrained && s.signal ? (inv.statuses[s.signal] ?? s.signal) : inv.home.untrained}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{s.name}</p>
                <p className="mt-3 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-white">
                  {formatINR(s.latestClose)}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs tabular-nums text-slate-600 dark:text-slate-300">
                  <span
                    className={
                      pos
                        ? 'font-semibold text-[#087F5B] dark:text-[#34D399]'
                        : 'font-semibold text-[#782F46] dark:text-[#B76E85]'
                    }
                  >
                    {formatPct(s.dailyReturn * 100)}
                  </span>
                  <span>
                    {inv.common.volume} {formatVolume(s.latestVolume)}
                  </span>
                </div>
                <div className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  {s.latestDate} · {inv.common.risk}: {inv.statuses[s.riskCategory] ?? s.riskCategory}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Watchlist & Holdings Overview Grid */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-5 dark:border-slate-800 dark:bg-[#1F2937]">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {inv.home.savedWatchlist}
            </h3>
            <Bookmark className="h-4 w-4 text-[#087F5B] dark:text-[#34D399]" />
          </div>
          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {!investorPortfolio || investorPortfolio.watchlist.length === 0 ? (
              <p className="py-4 text-xs text-slate-500 dark:text-slate-400">
                {inv.home.emptyWatchlist}
              </p>
            ) : (
              investorPortfolio.watchlist.map((item) => (
                <div key={item.symbol} className="flex items-center justify-between py-2.5 text-xs">
                  <button
                    type="button"
                    onClick={() => onSelectStockAndOpen(item.symbol)}
                    className="text-left hover:underline"
                  >
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {item.symbol}
                    </span>
                    <span className="ml-2 text-slate-500 dark:text-slate-400">
                      RSI {item.rsi14.toFixed(1)}
                    </span>
                    {item.note && (
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                        {item.note}
                      </span>
                    )}
                  </button>
                  <div className="flex items-center gap-3 tabular-nums">
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      {formatINR(item.latestClose)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveWatchlist(item.symbol)}
                      aria-label={`${inv.common.deleteLabel} ${item.symbol}`}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-[#782F46] dark:hover:bg-slate-800"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-7 dark:border-slate-800 dark:bg-[#1F2937]">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {inv.home.holdingsSummary}
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('stocks')}
              className="text-xs font-semibold text-[#087F5B] hover:underline dark:text-[#34D399]"
            >
              {inv.home.addEditHoldings} →
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="py-2 pr-3">{inv.common.symbol}</th>
                  <th className="py-2 pr-3">{inv.common.qty}</th>
                  <th className="py-2 pr-3">{inv.home.avgBuy}</th>
                  <th className="py-2 pr-3">{inv.home.latestClose}</th>
                  <th className="py-2 pr-3">{inv.home.unrealizedPnl}</th>
                  <th className="py-2 text-right">{inv.common.action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {!investorPortfolio || investorPortfolio.holdings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-500 dark:text-slate-400">
                      {inv.home.noHoldings}
                    </td>
                  </tr>
                ) : (
                  investorPortfolio.holdings.map((h) => (
                    <tr key={h.symbol}>
                      <td className="py-2.5 pr-3 font-mono font-bold text-slate-900 dark:text-white">
                        <button
                          type="button"
                          onClick={() => onSelectStockAndOpen(h.symbol)}
                          className="hover:underline"
                        >
                          {h.symbol}
                        </button>
                      </td>
                      <td className="py-2.5 pr-3 font-mono">{h.quantity}</td>
                      <td className="py-2.5 pr-3 font-mono">{formatINR(h.avgBuyPrice)}</td>
                      <td className="py-2.5 pr-3 font-mono">{formatINR(h.currentPrice)}</td>
                      <td
                        className={`py-2.5 pr-3 font-mono font-semibold ${
                          h.unrealizedPnl >= 0
                            ? 'text-[#087F5B] dark:text-[#34D399]'
                            : 'text-[#782F46] dark:text-[#B76E85]'
                        }`}
                      >
                        {formatINR(h.unrealizedPnl)} ({formatPct(h.unrealizedPnlPct)})
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => onRemoveHolding(h.symbol)}
                          aria-label={`${inv.common.deleteLabel} ${h.symbol}`}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-[#782F46] dark:hover:bg-slate-800"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

/* ==================== IPO TAB ==================== */
interface IpoTabProps {
  ipoData: IpoSnapshotResponse | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export const InvestorIpoTab: React.FC<IpoTabProps> = ({ ipoData, loading, error, onRefresh }) => {
  const { inv } = useAppContext();
  const [filter, setFilter] = useState('');

  const filteredListings = (ipoData?.smeListings ?? []).filter(
    (row) =>
      row.symbol.toLowerCase().includes(filter.toLowerCase()) ||
      row.security.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            {inv.ipo.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{inv.ipo.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#1F2937] dark:text-slate-200"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>{inv.ipo.refreshBtn}</span>
        </button>
      </div>

      {loading && <div className="h-40 animate-pulse rounded-2xl bg-white dark:bg-[#1F2937]" />}

      {error && !loading && (
        <div className="flex items-center gap-3 rounded-xl border border-[#782F46]/40 bg-white p-5 text-sm text-[#782F46] dark:bg-[#1F2937] dark:text-[#B76E85]">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {ipoData && !loading && (
        <>
          <div className="rounded-2xl border border-amber-300/70 bg-amber-50/70 p-5 dark:border-amber-700/60 dark:bg-amber-950/20">
            <div className="flex items-start gap-3">
              <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />
              <div>
                <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  {inv.ipo.liveStatusLabel}:{' '}
                  {ipoData.liveIpoFeedAvailable ? inv.ipo.connected : inv.ipo.unavailableOffline}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                  {ipoData.liveIpoFeedAvailable ? ipoData.statusMessage : inv.ipo.statusBannerText}
                </p>
                <p className="mt-2 font-mono text-[11px] text-amber-700 dark:text-amber-400">
                  {inv.ipo.verifiedSource}: {ipoData.sourceFile} · {inv.ipo.snapshotDate}:{' '}
                  {ipoData.sourceDate} · {inv.ipo.totalSme}: {ipoData.smeListingsCount}
                </p>
              </div>
            </div>
          </div>

          <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                {inv.ipo.tableTitle} ({filteredListings.length} {inv.ipo.shown})
              </h3>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  aria-label={inv.ipo.filterPlaceholder}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder={inv.ipo.filterPlaceholder}
                  className="w-60 rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <th className="py-2 pr-3">{inv.common.symbol}</th>
                    <th className="py-2 pr-3">{inv.ipo.colCompany}</th>
                    <th className="py-2 pr-3">{inv.ipo.colPrevClose}</th>
                    <th className="py-2 pr-3">{inv.ipo.colClose}</th>
                    <th className="py-2 pr-3">{inv.ipo.colHigh52}</th>
                    <th className="py-2 pr-3">{inv.ipo.colLow52}</th>
                    <th className="py-2 text-right">{inv.ipo.colTradedQty}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredListings.map((row) => (
                    <tr key={row.symbol}>
                      <td className="py-2 pr-3 font-mono font-bold text-slate-900 dark:text-white">
                        {row.symbol}
                      </td>
                      <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{row.security}</td>
                      <td className="py-2 pr-3 font-mono">{formatINR(row.prevClose)}</td>
                      <td className="py-2 pr-3 font-mono font-semibold text-slate-900 dark:text-white">
                        {formatINR(row.closePrice)}
                      </td>
                      <td className="py-2 pr-3 font-mono text-[#087F5B] dark:text-[#34D399]">
                        {formatINR(row.high52Week)}
                      </td>
                      <td className="py-2 pr-3 font-mono text-[#782F46] dark:text-[#B76E85]">
                        {formatINR(row.low52Week)}
                      </td>
                      <td className="py-2 text-right font-mono">
                        {row.tradedQty.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

/* ==================== ORDERS TAB ==================== */
interface OrdersTabProps {
  stocks: StockSummary[];
  orders: InvestorOrder[];
  loading: boolean;
  onCreateOrder: (payload: {
    symbol: string;
    side: 'BUY' | 'SELL';
    orderType: 'MARKET' | 'LIMIT';
    quantity: number;
    price?: number;
    notes?: string;
  }) => Promise<void>;
  onCancelOrder: (id: string) => Promise<void>;
}

export const InvestorOrdersTab: React.FC<OrdersTabProps> = ({
  stocks,
  orders,
  loading,
  onCreateOrder,
  onCancelOrder,
}) => {
  const { inv } = useAppContext();
  const [symbol, setSymbol] = useState('RELIANCE');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [quantity, setQuantity] = useState(5);
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const selectedMeta = stocks.find((s) => s.symbol === symbol);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    setErrMsg(null);
    try {
      await onCreateOrder({
        symbol,
        side,
        orderType,
        quantity,
        price: price.trim() ? Number(price) : undefined,
        notes: notes.trim(),
      });
      setFeedback(`${inv.orders.orderSaved} (${symbol} · ${quantity})`);
      setNotes('');
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : inv.common.noData);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            {inv.orders.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{inv.orders.subtitle}</p>
        </div>
        <span className="font-mono text-xs font-semibold text-[#087F5B] dark:text-[#34D399]">
          {orders.length} {inv.orders.totalRecords}
        </span>
      </div>

      {/* Create Investor Order Form */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]">
        <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
          {inv.orders.newOrderTitle}
        </h3>
        <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-6">
          <div>
            <label htmlFor="inv-ord-symbol" className="block text-[11px] text-slate-500 dark:text-slate-400">
              {inv.orders.niftyStock}
            </label>
            <select
              id="inv-ord-symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
            >
              {stocks.map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol} ({formatINR(s.latestClose)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="inv-ord-side" className="block text-[11px] text-slate-500 dark:text-slate-400">
              {inv.orders.side}
            </label>
            <select
              id="inv-ord-side"
              value={side}
              onChange={(e) => setSide(e.target.value as 'BUY' | 'SELL')}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
            >
              <option value="BUY">{inv.statuses.BUY}</option>
              <option value="SELL">{inv.statuses.SELL}</option>
            </select>
          </div>

          <div>
            <label htmlFor="inv-ord-type" className="block text-[11px] text-slate-500 dark:text-slate-400">
              {inv.orders.orderType}
            </label>
            <select
              id="inv-ord-type"
              value={orderType}
              onChange={(e) => setOrderType(e.target.value as 'MARKET' | 'LIMIT')}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
            >
              <option value="MARKET">{inv.orders.marketExecuted}</option>
              <option value="LIMIT">{inv.orders.limitPlanned}</option>
            </select>
          </div>

          <div>
            <label htmlFor="inv-ord-qty" className="block text-[11px] text-slate-500 dark:text-slate-400">
              {inv.orders.quantity}
            </label>
            <input
              id="inv-ord-qty"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="inv-ord-price" className="block text-[11px] text-slate-500 dark:text-slate-400">
              {inv.orders.priceLabel} ({orderType === 'LIMIT' ? inv.orders.required : inv.orders.optional})
            </label>
            <input
              id="inv-ord-price"
              type="number"
              step="0.05"
              placeholder={selectedMeta ? String(selectedMeta.latestClose.toFixed(2)) : '0'}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#087F5B] py-2 text-xs font-semibold text-white hover:bg-[#06684A] disabled:opacity-60 dark:bg-[#34D399] dark:text-slate-950"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{submitting ? inv.orders.savingBtn : inv.orders.submitBtn}</span>
            </button>
          </div>

          <div className="sm:col-span-6">
            <input
              type="text"
              aria-label={inv.orders.notesPlaceholder}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={inv.orders.notesPlaceholder}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
            />
          </div>
        </form>

        {feedback && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#087F5B] dark:text-[#34D399]">
            <CheckCircle2 className="h-4 w-4" />
            <span>{feedback}</span>
          </p>
        )}
        {errMsg && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#782F46] dark:text-[#B76E85]">
            <AlertCircle className="h-4 w-4" />
            <span>{errMsg}</span>
          </p>
        )}
      </section>

      {/* Persisted Orders Table */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]">
        {loading ? (
          <div className="h-32 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="py-2 pr-3">{inv.orders.colOrderId}</th>
                  <th className="py-2 pr-3">{inv.common.symbol}</th>
                  <th className="py-2 pr-3">{inv.orders.side}</th>
                  <th className="py-2 pr-3">{inv.orders.colType}</th>
                  <th className="py-2 pr-3">{inv.common.qty}</th>
                  <th className="py-2 pr-3">{inv.common.price}</th>
                  <th className="py-2 pr-3">{inv.orders.colTotalValue}</th>
                  <th className="py-2 pr-3">{inv.common.status}</th>
                  <th className="py-2 pr-3">{inv.common.notes}</th>
                  <th className="py-2 text-right">{inv.common.action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-6 text-center text-slate-500 dark:text-slate-400">
                      {inv.orders.emptyOrders}
                    </td>
                  </tr>
                ) : (
                  orders.map((ord) => (
                    <tr key={ord.id}>
                      <td className="py-2.5 pr-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        {ord.id}
                      </td>
                      <td className="py-2.5 pr-3 font-mono font-bold text-slate-900 dark:text-white">
                        {ord.symbol}
                      </td>
                      <td
                        className={`py-2.5 pr-3 font-mono font-bold ${
                          ord.side === 'BUY'
                            ? 'text-[#087F5B] dark:text-[#34D399]'
                            : 'text-[#782F46] dark:text-[#B76E85]'
                        }`}
                      >
                        {inv.statuses[ord.side] ?? ord.side}
                      </td>
                      <td className="py-2.5 pr-3 font-mono">{ord.orderType}</td>
                      <td className="py-2.5 pr-3 font-mono">{ord.quantity}</td>
                      <td className="py-2.5 pr-3 font-mono">{formatINR(ord.price)}</td>
                      <td className="py-2.5 pr-3 font-mono font-semibold">
                        {formatINR(ord.totalValue)}
                      </td>
                      <td className="py-2.5 pr-3 font-mono font-semibold">
                        <span
                          className={
                            ord.status === 'EXECUTED'
                              ? 'text-[#087F5B] dark:text-[#34D399]'
                              : ord.status === 'PLANNED'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-400'
                          }
                        >
                          {inv.statuses[ord.status] ?? ord.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600 dark:text-slate-300">{ord.notes}</td>
                      <td className="py-2.5 text-right">
                        {ord.status !== 'CANCELLED' ? (
                          <button
                            type="button"
                            onClick={() => onCancelOrder(ord.id)}
                            aria-label={`${inv.common.cancel} ${ord.id}`}
                            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-[#782F46] hover:bg-slate-100 dark:border-slate-700 dark:text-[#B76E85] dark:hover:bg-slate-800"
                          >
                            <XCircle className="h-3 w-3" />
                            <span>{inv.common.cancel}</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">{inv.orders.closed}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

/* ==================== NEWS TAB ==================== */
interface NewsTabProps {
  newsData: InvestorNewsResponse | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export const InvestorNewsTab: React.FC<NewsTabProps> = ({
  newsData,
  loading,
  error,
  onRefresh,
}) => {
  const { inv, language } = useAppContext();
  const [category, setCategory] = useState<
    'ALL' | 'Announcement' | 'Board Meeting' | 'Corporate Action'
  >('ALL');
  const [query, setQuery] = useState('');

  const categoryLabel = (cat: 'ALL' | 'Announcement' | 'Board Meeting' | 'Corporate Action') => {
    if (cat === 'ALL') return `${inv.news.allTab} (${newsData?.items.length ?? 0})`;
    if (cat === 'Announcement') return inv.news.catAnnouncement;
    if (cat === 'Board Meeting') return inv.news.catBoardMeeting;
    return inv.news.catCorporateAction;
  };

  const items = (newsData?.items ?? []).filter((item) => {
    const matchesCat = category === 'ALL' || item.category === category;
    const q = query.trim().toLowerCase();
    const matchesQ =
      !q ||
      item.symbol.toLowerCase().includes(q) ||
      item.company.toLowerCase().includes(q) ||
      item.headline.toLowerCase().includes(q) ||
      (item.originalHeadline || '').toLowerCase().includes(q);
    return matchesCat && matchesQ;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            {inv.news.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{inv.news.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#1F2937] dark:text-slate-200"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>{inv.news.refreshBtn}</span>
        </button>
      </div>

      {loading && !newsData && <div className="h-40 animate-pulse rounded-2xl bg-white dark:bg-[#1F2937]" />}

      {error && !loading && (
        <div className="flex items-center gap-3 rounded-xl border border-[#782F46]/40 bg-white p-5 text-sm text-[#782F46] dark:bg-[#1F2937] dark:text-[#B76E85]">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {newsData && (
        <>
          <div className="rounded-2xl border border-amber-300/70 bg-amber-50/70 p-5 dark:border-amber-700/60 dark:bg-amber-950/20">
            <div className="flex items-start gap-3">
              <Newspaper className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />
              <div>
                <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  {inv.news.liveWireLabel}:{' '}
                  {newsData.liveNewsFeedAvailable ? inv.news.connected : inv.news.unavailableArchive}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                  {newsData.statusMessage}
                </p>
                <p className="mt-2 font-mono text-[11px] text-amber-700 dark:text-amber-400">
                  {inv.news.sourcesLabel}: {newsData.sourceFiles.join(' · ')}
                </p>
              </div>
            </div>
          </div>

          <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-1.5">
                {(['ALL', 'Announcement', 'Board Meeting', 'Corporate Action'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      category === cat
                        ? 'border-[#087F5B] bg-[#087F5B]/10 text-[#087F5B] dark:border-[#34D399] dark:text-[#34D399]'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#111827] dark:text-slate-300'
                    }`}
                  >
                    {categoryLabel(cat)}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  aria-label={inv.news.searchPlaceholder}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={inv.news.searchPlaceholder}
                  className="w-60 rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                />
              </div>
            </div>

            {items.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                {inv.news.emptyNews}
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((item, idx) => (
                  <div
                    key={`${item.symbol}-${idx}`}
                    className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                          {item.symbol}
                        </span>
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {item.company}
                        </span>
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {categoryLabel(item.category)}
                        </span>
                        {(item.translationProvider !== 'original' || item.originalHeadline !== item.headline) &&
                          language !== 'en' && (
                          <span className="rounded bg-[#087F5B]/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#087F5B] dark:bg-[#34D399]/15 dark:text-[#34D399]">
                            {inv.news.translatedBadge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {item.headline}
                      </p>
                      {item.summary && (
                        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                          {item.summary}
                        </p>
                      )}
                      {item.originalHeadline && item.originalHeadline !== item.headline && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {inv.news.originalTitleLabel}: {item.originalHeadline}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-400">
                        {inv.news.sourceLabel}: {item.source} · {inv.news.articleNote}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {item.dateNote}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

/* ==================== PROFILE & ADVISOR HUB TAB ==================== */
interface ProfileTabProps {
  user: UserProfile | null;
  stocks: StockSummary[];
  selectedSymbol: string;
  portfolio: InvestorPortfolioSnapshot | null;
  orders: InvestorOrder[];
  loading: boolean;
  activeSection: ProfileSectionId;
  onChangeSection: (section: ProfileSectionId) => void;
  brokerConnection: InvestorBrokerConnection | null;
  requests: ClientRequestItem[];
  adviceList: ExpertAdviceItem[];
  messages: BrokerMessageItem[];
  onLinkBroker: (brokerCode: string) => Promise<void>;
  onCreateRequest: (payload: {
    category: string;
    symbol?: string | null;
    message: string;
  }) => Promise<void>;
  onMarkAdviceRead: (adviceId: string) => Promise<void>;
  onSendMessage: (messageText: string) => Promise<void>;
  onLogout: () => Promise<void>;
}

export const InvestorProfileTab: React.FC<ProfileTabProps> = ({
  user,
  stocks,
  selectedSymbol,
  portfolio,
  orders,
  loading,
  activeSection,
  onChangeSection,
  brokerConnection,
  requests,
  adviceList,
  messages,
  onLinkBroker,
  onCreateRequest,
  onMarkAdviceRead,
  onSendMessage,
  onLogout,
}) => {
  const { inv, language, setLanguage } = useAppContext();

  const unreadAdviceCount = adviceList.filter((a) => a.status === 'Sent').length;

  return (
    <div className="space-y-6">
      {/* Sub-Navigation inside Profile & Advisor Hub */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        {(
          [
            ['account', inv.profile.sectionAccount, UserCheck, 0],
            ['requests', inv.profile.sectionRequests, ClipboardList, requests.length],
            ['advice', inv.profile.sectionAdvice, Sparkles, unreadAdviceCount || adviceList.length],
            ['messages', inv.profile.sectionMessages, MessageSquare, messages.length],
          ] as const
        ).map(([id, label, Icon, count]) => (
          <button
            key={id}
            type="button"
            onClick={() => onChangeSection(id)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors ${
              activeSection === id
                ? 'border-[#087F5B] bg-[#087F5B] text-white dark:border-[#34D399] dark:bg-[#34D399] dark:text-slate-950'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#1F2937] dark:text-slate-200'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
            {count > 0 && (
              <span
                className={`rounded-full px-1.5 font-mono text-[10px] font-bold ${
                  activeSection === id
                    ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-950'
                    : 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeSection === 'account' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <section className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-7 dark:border-slate-800 dark:bg-[#1F2937]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#087F5B]/10 text-[#087F5B] dark:bg-[#34D399]/10 dark:text-[#34D399]">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                      {inv.profile.title}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {inv.profile.subtitle}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onLogout()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#782F46]/40 px-3.5 py-2 text-xs font-semibold text-[#782F46] hover:bg-[#782F46]/10 dark:border-[#B76E85]/40 dark:text-[#B76E85]"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>{inv.profile.signOutPortal}</span>
                </button>
              </div>

              {loading && (
                <div className="mt-5 h-28 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              )}

              {user && !loading && (
                <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-xl bg-[#F8F6F0] p-4 dark:bg-[#111827]">
                    <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {inv.profile.investorId}
                    </dt>
                    <dd className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                      {user.userCode}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-[#F8F6F0] p-4 dark:bg-[#111827]">
                    <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {inv.profile.fullName}
                    </dt>
                    <dd className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                      {user.name}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-[#F8F6F0] p-4 dark:bg-[#111827]">
                    <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {inv.profile.emailAddress}
                    </dt>
                    <dd className="mt-1 font-mono text-sm text-slate-900 dark:text-white">
                      {user.email}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-[#F8F6F0] p-4 dark:bg-[#111827]">
                    <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {inv.profile.authorizedRole}
                    </dt>
                    <dd className="mt-1 font-mono text-sm font-bold text-[#087F5B] dark:text-[#34D399]">
                      {user.role}
                    </dd>
                  </div>
                  {user.createdAt && (
                    <div className="rounded-xl bg-[#F8F6F0] p-4 sm:col-span-2 dark:bg-[#111827]">
                      <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {inv.profile.createdTimestamp}
                      </dt>
                      <dd className="mt-1 font-mono text-xs text-slate-700 dark:text-slate-300">
                        {user.createdAt}
                      </dd>
                    </div>
                  )}
                </dl>
              )}
            </section>

            {/* Language Preference + SQLite Activity */}
            <div className="space-y-6 lg:col-span-5">
              <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-[#087F5B] dark:text-[#34D399]" />
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    {inv.profile.languagePreference}
                  </h3>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(
                    [
                      ['en', 'English (EN)'],
                      ['hi', 'हिन्दी (HI)'],
                      ['te', 'తెలుగు (TE)'],
                    ] as Array<[LanguageCode, string]>
                  ).map(([code, label]) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setLanguage(code)}
                      className={`rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors ${
                        language === code
                          ? 'border-[#087F5B] bg-[#087F5B] text-white dark:border-[#34D399] dark:bg-[#34D399] dark:text-slate-950'
                          : 'border-slate-200 bg-[#F8F6F0] text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-[#111827] dark:text-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {inv.profile.languageSavedNote}
                </p>
              </section>

              <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]">
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {inv.profile.sqliteActivity}
                </h3>
                <div className="mt-4 space-y-3 text-xs tabular-nums">
                  <div className="flex items-center justify-between rounded-xl bg-[#F8F6F0] p-3.5 dark:bg-[#111827]">
                    <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <Bookmark className="h-4 w-4 text-[#087F5B] dark:text-[#34D399]" />
                      <span>{inv.profile.watchlistStocks}</span>
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {portfolio?.watchlist.length ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-[#F8F6F0] p-3.5 dark:bg-[#111827]">
                    <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <FileText className="h-4 w-4 text-[#087F5B] dark:text-[#34D399]" />
                      <span>{inv.profile.holdingsTracked}</span>
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {portfolio?.holdings.length ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-[#F8F6F0] p-3.5 dark:bg-[#111827]">
                    <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <ClipboardList className="h-4 w-4 text-[#087F5B] dark:text-[#34D399]" />
                      <span>{inv.profile.ordersLogged}</span>
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {orders.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-[#F8F6F0] p-3.5 dark:bg-[#111827]">
                    <span className="text-slate-600 dark:text-slate-300">
                      {inv.profile.totalInvested}
                    </span>
                    <span className="font-mono font-bold text-[#087F5B] dark:text-[#34D399]">
                      {formatINR(portfolio?.totalMarketValue ?? 0)}
                    </span>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <InvestorBrokerLinkCard connection={brokerConnection} onLinkBroker={onLinkBroker} />
        </div>
      )}

      {activeSection === 'requests' && (
        <InvestorRequestsSection
          stocks={stocks}
          requests={requests}
          defaultSymbol={selectedSymbol}
          onCreateRequest={onCreateRequest}
        />
      )}

      {activeSection === 'advice' && (
        <InvestorExpertAdviceSection adviceList={adviceList} onMarkRead={onMarkAdviceRead} />
      )}

      {activeSection === 'messages' && (
        <InvestorMessagesSection
          linked={Boolean(brokerConnection?.linked)}
          connection={brokerConnection}
          messages={messages}
          currentUserId={user?.id || ''}
          onSendMessage={onSendMessage}
        />
      )}
    </div>
  );
};
