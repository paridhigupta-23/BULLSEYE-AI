import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Brain,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  LogOut,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  formatINR,
  formatPct,
  type BrokerClientDetail,
  type BrokerClientSummary,
  type BrokerConversationSummary,
  type BrokerMessageItem,
  type BrokerPortfoliosResponse,
  type ClientRequestItem,
  type ClientRequestStatus,
  type ExpertAdviceItem,
  type StockSummary,
  type UserProfile,
} from '../../types/index.ts';

/* ==================== PAGE 2: MY CLIENTS ==================== */
interface BrokerClientsPageProps {
  clients: BrokerClientSummary[];
  selectedClientDetail: BrokerClientDetail | null;
  loading: boolean;
  loadingDetail: boolean;
  onSelectClient: (clientId: string) => Promise<void>;
  onLinkClient: (identifier: string) => Promise<void>;
  onOpenAdviceForClient: (clientId: string) => void;
  onOpenMessagesForClient: (clientId: string) => void;
}

export const BrokerClientsPage: React.FC<BrokerClientsPageProps> = ({
  clients,
  selectedClientDetail,
  loading,
  loadingDetail,
  onSelectClient,
  onLinkClient,
  onOpenAdviceForClient,
  onOpenMessagesForClient,
}) => {
  const [linkInput, setLinkInput] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkMsg, setLinkMsg] = useState<string | null>(null);
  const [linkErr, setLinkErr] = useState<string | null>(null);

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkInput.trim()) return;
    setLinking(true);
    setLinkMsg(null);
    setLinkErr(null);
    try {
      await onLinkClient(linkInput.trim());
      setLinkMsg(`Linked Investor "${linkInput.trim()}" to your Broker client roster.`);
      setLinkInput('');
    } catch (err) {
      setLinkErr(err instanceof Error ? err.message : 'Unable to link investor');
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            My Registered Investor Clients
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Showing only real Investor accounts linked to your Broker / Quant ID · Historical Close through 30 Sep 2025
          </p>
        </div>

        <form onSubmit={handleLinkSubmit} className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            aria-label="Investor User ID or Email to link"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            placeholder="Link Investor ID / email..."
            className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
          />
          <button
            type="submit"
            disabled={linking || !linkInput.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#087F5B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#06684A] disabled:opacity-50 dark:bg-[#34D399] dark:text-slate-950"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>{linking ? 'Linking...' : 'Link Investor'}</span>
          </button>
        </form>
      </div>

      {linkMsg && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-[#087F5B] dark:text-[#34D399]">
          <CheckCircle2 className="h-4 w-4" />
          <span>{linkMsg}</span>
        </p>
      )}
      {linkErr && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-[#782F46] dark:text-[#B76E85]">
          <AlertCircle className="h-4 w-4" />
          <span>{linkErr}</span>
        </p>
      )}

      {/* Clients Table */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]">
        {loading ? (
          <div className="h-36 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        ) : clients.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
            No registered Investor clients are currently linked to your Broker account. Use the form above to link an Investor ID.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="py-2 pr-3">Client ID</th>
                  <th className="py-2 pr-3">Client Name</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Registered</th>
                  <th className="py-2 pr-3">Invested</th>
                  <th className="py-2 pr-3">Current Value</th>
                  <th className="py-2 pr-3">Total P&amp;L</th>
                  <th className="py-2 pr-3">Stocks</th>
                  <th className="py-2 pr-3">Pending Req</th>
                  <th className="py-2 pr-3">Performance</th>
                  <th className="py-2 text-right">Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {clients.map((c) => {
                  const selected = selectedClientDetail?.client.clientId === c.clientId;
                  const positive = c.totalPnl >= 0;
                  return (
                    <tr
                      key={c.clientId}
                      className={selected ? 'bg-[#087F5B]/5 dark:bg-[#34D399]/10' : ''}
                    >
                      <td className="py-3 pr-3 font-mono font-bold text-slate-900 dark:text-white">
                        {c.userCode}
                      </td>
                      <td className="py-3 pr-3 font-semibold text-slate-900 dark:text-white">{c.name}</td>
                      <td className="py-3 pr-3 font-mono text-slate-600 dark:text-slate-300">{c.email}</td>
                      <td className="py-3 pr-3 font-mono text-slate-500 dark:text-slate-400">
                        {c.registrationDate.slice(0, 10)}
                      </td>
                      <td className="py-3 pr-3 font-mono">{formatINR(c.totalInvested)}</td>
                      <td className="py-3 pr-3 font-mono font-semibold text-slate-900 dark:text-white">
                        {formatINR(c.currentPortfolioValue)}
                      </td>
                      <td
                        className={`py-3 pr-3 font-mono font-semibold ${
                          positive ? 'text-[#087F5B] dark:text-[#34D399]' : 'text-[#782F46] dark:text-[#B76E85]'
                        }`}
                      >
                        {formatINR(c.totalPnl)} ({formatPct(c.totalPnlPct)})
                      </td>
                      <td className="py-3 pr-3 font-mono">{c.stocksHeldCount}</td>
                      <td className="py-3 pr-3 font-mono font-semibold">{c.pendingRequestsCount}</td>
                      <td className="py-3 pr-3">
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {c.portfolioPerformanceLabel}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onSelectClient(c.clientId)}
                          className="rounded-lg bg-[#087F5B] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#06684A] dark:bg-[#34D399] dark:text-slate-950"
                        >
                          {selected ? 'Viewing' : 'Inspect Client'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Detailed Client Profile Panel */}
      {loadingDetail && <div className="h-48 animate-pulse rounded-2xl bg-white dark:bg-[#1F2937]" />}

      {selectedClientDetail && !loadingDetail && (
        <section className="rounded-2xl border border-[#087F5B]/30 bg-white p-6 dark:border-[#34D399]/30 dark:bg-[#1F2937]">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-[#087F5B] dark:text-[#34D399]">
                  {selectedClientDetail.client.userCode}
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedClientDetail.client.valuationDateLabel}
                </span>
              </div>
              <h3 className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-white">
                {selectedClientDetail.client.name} — Client Investment Dossier
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedClientDetail.client.email} · Preferred Language:{' '}
                <span className="font-mono uppercase">{selectedClientDetail.client.preferredLanguage}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenAdviceForClient(selectedClientDetail.client.clientId)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#782F46] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#612438] dark:bg-[#B76E85] dark:text-slate-950"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Generate Advice</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenMessagesForClient(selectedClientDetail.client.clientId)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Message Client</span>
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Holdings */}
            <div className="lg:col-span-7">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Verified Equity Holdings ({selectedClientDetail.holdings.length})
              </h4>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-xs tabular-nums">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                      <th className="py-1.5 pr-2">Symbol</th>
                      <th className="py-1.5 pr-2">Qty</th>
                      <th className="py-1.5 pr-2">Avg Buy</th>
                      <th className="py-1.5 pr-2">Close (30 Sep 2025)</th>
                      <th className="py-1.5 pr-2">Value</th>
                      <th className="py-1.5 pr-2">P&amp;L</th>
                      <th className="py-1.5 text-right">Alloc</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedClientDetail.holdings.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-4 text-slate-500">
                          Client holds no recorded positions yet.
                        </td>
                      </tr>
                    ) : (
                      selectedClientDetail.holdings.map((h) => (
                        <tr key={h.symbol}>
                          <td className="py-2 pr-2 font-mono font-bold text-slate-900 dark:text-white">
                            {h.symbol}
                          </td>
                          <td className="py-2 pr-2 font-mono">{h.quantity}</td>
                          <td className="py-2 pr-2 font-mono">{formatINR(h.avgPurchasePrice)}</td>
                          <td className="py-2 pr-2 font-mono">{formatINR(h.latestMarketPrice)}</td>
                          <td className="py-2 pr-2 font-mono font-semibold">
                            {formatINR(h.currentHoldingValue)}
                          </td>
                          <td
                            className={`py-2 pr-2 font-mono font-semibold ${
                              h.pnlRupees >= 0
                                ? 'text-[#087F5B] dark:text-[#34D399]'
                                : 'text-[#782F46] dark:text-[#B76E85]'
                            }`}
                          >
                            {formatINR(h.pnlRupees)} ({formatPct(h.pnlPct)})
                          </td>
                          <td className="py-2 text-right font-mono">{h.allocationPct.toFixed(1)}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Watchlist & Orders Summary */}
            <div className="space-y-4 lg:col-span-5">
              <div className="rounded-xl bg-[#F8F6F0] p-4 dark:bg-[#111827]">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Watchlist ({selectedClientDetail.watchlist.length})
                </h4>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedClientDetail.watchlist.length === 0 ? (
                    <span className="text-xs text-slate-500">Empty watchlist</span>
                  ) : (
                    selectedClientDetail.watchlist.map((w) => (
                      <span
                        key={w.symbol}
                        className="rounded-md border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-800 dark:border-slate-700 dark:bg-[#1F2937] dark:text-slate-200"
                      >
                        {w.symbol} · {formatINR(w.latestClose)}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-[#F8F6F0] p-4 dark:bg-[#111827]">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Recent Orders ({selectedClientDetail.orders.length})
                </h4>
                <div className="mt-2 space-y-1.5 text-xs">
                  {selectedClientDetail.orders.slice(0, 4).map((o) => (
                    <div key={o.id} className="flex items-center justify-between font-mono text-[11px]">
                      <span>
                        {o.side} {o.quantity} {o.symbol} @ {formatINR(o.price)}
                      </span>
                      <span className="text-slate-500">{o.status}</span>
                    </div>
                  ))}
                  {selectedClientDetail.orders.length === 0 && (
                    <p className="text-xs text-slate-500">No investor orders logged.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

/* ==================== PAGE 3: CLIENT PORTFOLIOS ==================== */
interface BrokerPortfoliosPageProps {
  data: BrokerPortfoliosResponse | null;
  loading: boolean;
  onRefresh: () => void;
}

export const BrokerPortfoliosPage: React.FC<BrokerPortfoliosPageProps> = ({
  data,
  loading,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [pnlFilter, setPnlFilter] = useState<'all' | 'profit' | 'loss'>('all');
  const [clientFilter, setClientFilter] = useState<string>('ALL');

  const filteredHoldings = (data?.holdings ?? []).filter((h) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesQ =
      !q ||
      h.clientName.toLowerCase().includes(q) ||
      h.clientUserCode.toLowerCase().includes(q) ||
      h.symbol.toLowerCase().includes(q) ||
      h.stockName.toLowerCase().includes(q);
    const matchesClient = clientFilter === 'ALL' || h.clientId === clientFilter;
    const matchesPnl =
      pnlFilter === 'all' || (pnlFilter === 'profit' ? h.pnlRupees >= 0 : h.pnlRupees < 0);
    return matchesQ && matchesClient && matchesPnl;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Client Investment Portfolios
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {data?.valuationLabel ?? 'Historical Close (through 30 Sep 2025)'} · Not live 2026 market prices
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#1F2937] dark:text-slate-200"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh Valuations</span>
        </button>
      </div>

      {loading && <div className="h-40 animate-pulse rounded-2xl bg-white dark:bg-[#1F2937]" />}

      {data && !loading && (
        <>
          {/* Overall Summary Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5 tabular-nums">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 dark:border-slate-800 dark:bg-[#1F2937]">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Linked Clients</p>
              <p className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-white">
                {data.clientsCount}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 dark:border-slate-800 dark:bg-[#1F2937]">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Total Invested</p>
              <p className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-white">
                {formatINR(data.overallInvested)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 dark:border-slate-800 dark:bg-[#1F2937]">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Historical Valuation</p>
              <p className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-white">
                {formatINR(data.overallCurrentValue)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 dark:border-slate-800 dark:bg-[#1F2937]">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Aggregate P&amp;L</p>
              <p
                className={`mt-1 font-mono text-xl font-bold ${
                  data.overallPnl >= 0
                    ? 'text-[#087F5B] dark:text-[#34D399]'
                    : 'text-[#782F46] dark:text-[#B76E85]'
                }`}
              >
                {formatINR(data.overallPnl)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 dark:border-slate-800 dark:bg-[#1F2937]">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Return % (30 Sep 2025)</p>
              <p
                className={`mt-1 font-mono text-xl font-bold ${
                  data.overallPnlPct >= 0
                    ? 'text-[#087F5B] dark:text-[#34D399]'
                    : 'text-[#782F46] dark:text-[#B76E85]'
                }`}
              >
                {formatPct(data.overallPnlPct)}
              </p>
            </div>
          </div>

          {/* Search & Filters */}
          <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    aria-label="Search client name or stock"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search client or stock symbol..."
                    className="w-60 rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                  />
                </div>

                <select
                  aria-label="Filter by individual client"
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                >
                  <option value="ALL">All Clients ({data.clientsCount})</option>
                  {data.clientSummaries.map((c) => (
                    <option key={c.clientId} value={c.clientId}>
                      {c.name} ({c.userCode})
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by profit or loss"
                  value={pnlFilter}
                  onChange={(e) => setPnlFilter(e.target.value as 'all' | 'profit' | 'loss')}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                >
                  <option value="all">All P&amp;L</option>
                  <option value="profit">Profit Only</option>
                  <option value="loss">Loss Only</option>
                </select>
              </div>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                {filteredHoldings.length} positions shown
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <th className="py-2 pr-3">Client</th>
                    <th className="py-2 pr-3">Stock &amp; Symbol</th>
                    <th className="py-2 pr-3">Qty</th>
                    <th className="py-2 pr-3">Avg Buy</th>
                    <th className="py-2 pr-3">Invested</th>
                    <th className="py-2 pr-3">Hist. Close (30 Sep 2025)</th>
                    <th className="py-2 pr-3">Current Value</th>
                    <th className="py-2 pr-3">P&amp;L (₹)</th>
                    <th className="py-2 pr-3">P&amp;L %</th>
                    <th className="py-2 text-right">Allocation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredHoldings.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-6 text-center text-slate-500 dark:text-slate-400">
                        No holdings match your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredHoldings.map((h) => (
                      <tr key={`${h.clientId}-${h.symbol}`}>
                        <td className="py-2.5 pr-3">
                          <span className="block font-semibold text-slate-900 dark:text-white">
                            {h.clientName}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500">{h.clientUserCode}</span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {h.symbol}
                          </span>
                          <span className="block text-[11px] text-slate-500">{h.stockName}</span>
                        </td>
                        <td className="py-2.5 pr-3 font-mono">{h.quantity}</td>
                        <td className="py-2.5 pr-3 font-mono">{formatINR(h.avgPurchasePrice)}</td>
                        <td className="py-2.5 pr-3 font-mono">{formatINR(h.totalInvested)}</td>
                        <td className="py-2.5 pr-3 font-mono">
                          {formatINR(h.latestMarketPrice)}
                          <span className="block text-[10px] text-slate-400">{h.latestPriceDate}</span>
                        </td>
                        <td className="py-2.5 pr-3 font-mono font-semibold text-slate-900 dark:text-white">
                          {formatINR(h.currentHoldingValue)}
                        </td>
                        <td
                          className={`py-2.5 pr-3 font-mono font-semibold ${
                            h.pnlRupees >= 0
                              ? 'text-[#087F5B] dark:text-[#34D399]'
                              : 'text-[#782F46] dark:text-[#B76E85]'
                          }`}
                        >
                          {formatINR(h.pnlRupees)}
                        </td>
                        <td
                          className={`py-2.5 pr-3 font-mono font-semibold ${
                            h.pnlPct >= 0
                              ? 'text-[#087F5B] dark:text-[#34D399]'
                              : 'text-[#782F46] dark:text-[#B76E85]'
                          }`}
                        >
                          {formatPct(h.pnlPct)}
                        </td>
                        <td className="py-2.5 text-right font-mono">{h.allocationPct.toFixed(1)}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Stock-Wise & Client-Wise Breakdowns */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Stock-Wise Exposure Across Clients
              </h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs tabular-nums">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                      <th className="py-2 pr-2">Stock</th>
                      <th className="py-2 pr-2">Clients</th>
                      <th className="py-2 pr-2">Total Qty</th>
                      <th className="py-2 pr-2">Value</th>
                      <th className="py-2 text-right">Net P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.stockBreakdown.map((sb) => (
                      <tr key={sb.symbol}>
                        <td className="py-2 pr-2 font-mono font-bold">{sb.symbol}</td>
                        <td className="py-2 pr-2 font-mono">{sb.clientsCount}</td>
                        <td className="py-2 pr-2 font-mono">{sb.totalQuantity}</td>
                        <td className="py-2 pr-2 font-mono">{formatINR(sb.currentValue)}</td>
                        <td
                          className={`py-2 text-right font-mono font-semibold ${
                            sb.totalPnl >= 0
                              ? 'text-[#087F5B] dark:text-[#34D399]'
                              : 'text-[#782F46] dark:text-[#B76E85]'
                          }`}
                        >
                          {formatINR(sb.totalPnl)} ({formatPct(sb.totalPnlPct)})
                        </td>
                      </tr>
                    ))}
                    {data.stockBreakdown.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-4 text-slate-500">
                          No stock holdings across linked clients.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Client-Wise Portfolio Performance
              </h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs tabular-nums">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                      <th className="py-2 pr-2">Client</th>
                      <th className="py-2 pr-2">Holdings</th>
                      <th className="py-2 pr-2">Invested</th>
                      <th className="py-2 pr-2">Value</th>
                      <th className="py-2 text-right">Return</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.clientSummaries.map((c) => (
                      <tr key={c.clientId}>
                        <td className="py-2 pr-2">
                          <span className="font-semibold">{c.name}</span>
                          <span className="block font-mono text-[10px] text-slate-500">{c.userCode}</span>
                        </td>
                        <td className="py-2 pr-2 font-mono">{c.stocksHeldCount}</td>
                        <td className="py-2 pr-2 font-mono">{formatINR(c.totalInvested)}</td>
                        <td className="py-2 pr-2 font-mono">{formatINR(c.currentPortfolioValue)}</td>
                        <td
                          className={`py-2 text-right font-mono font-semibold ${
                            c.totalPnlPct >= 0
                              ? 'text-[#087F5B] dark:text-[#34D399]'
                              : 'text-[#782F46] dark:text-[#B76E85]'
                          }`}
                        >
                          {formatPct(c.totalPnlPct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
};

/* ==================== PAGE 4: CLIENT REQUESTS ==================== */
interface BrokerRequestsPageProps {
  requests: ClientRequestItem[];
  loading: boolean;
  onUpdateStatus: (requestId: string, status: ClientRequestStatus) => Promise<void>;
  onRespond: (requestId: string, responseText: string) => Promise<void>;
  onGenerateAdviceFromRequest: (req: ClientRequestItem) => void;
}

export const BrokerRequestsPage: React.FC<BrokerRequestsPageProps> = ({
  requests,
  loading,
  onUpdateStatus,
  onRespond,
  onGenerateAdviceFromRequest,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | ClientRequestStatus>('ALL');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const visible = requests.filter((r) => statusFilter === 'ALL' || r.status === statusFilter);

  const handleSendReply = async (requestId: string) => {
    const text = (replyDrafts[requestId] ?? '').trim();
    if (!text) return;
    setSubmittingId(requestId);
    setFeedback(null);
    try {
      await onRespond(requestId, text);
      setReplyDrafts((prev) => ({ ...prev, [requestId]: '' }));
      setFeedback(`Response posted to request ${requestId}.`);
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Client Advisory Requests Queue
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Review investor stock inquiries with full SQLite portfolio context and respond or generate AI advice
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(['ALL', 'Pending', 'Under Review', 'Responded', 'Closed'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                statusFilter === st
                  ? 'border-[#087F5B] bg-[#087F5B] text-white dark:border-[#34D399] dark:bg-[#34D399] dark:text-slate-950'
                  : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-[#1F2937] dark:text-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {feedback && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-[#087F5B] dark:text-[#34D399]">
          <CheckCircle2 className="h-4 w-4" />
          <span>{feedback}</span>
        </p>
      )}

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-white dark:bg-[#1F2937]" />
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-[#1F2937] dark:text-slate-400">
          No client requests match this filter.
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((req) => (
            <article
              key={req.id}
              className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#782F46] dark:text-[#B76E85]">
                      {req.id}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {req.category}
                    </span>
                    {req.symbol && (
                      <span className="rounded bg-[#087F5B]/10 px-2 py-0.5 font-mono text-[11px] font-bold text-[#087F5B] dark:bg-[#34D399]/15 dark:text-[#34D399]">
                        {req.symbol}
                      </span>
                    )}
                    <span className="text-[11px] text-slate-500">{req.createdAt.slice(0, 10)}</span>
                  </div>
                  <h3 className="mt-1.5 text-sm font-bold text-slate-900 dark:text-white">
                    {req.clientName} ({req.clientUserCode})
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                    {req.message}
                  </p>
                  <p className="mt-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    Portfolio Context: Invested {formatINR(req.clientTotalInvested ?? 0)} · Current{' '}
                    {formatINR(req.clientPortfolioValue ?? 0)} ({formatPct(req.clientPnlPct ?? 0)})
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <select
                    aria-label={`Status for ${req.id}`}
                    value={req.status}
                    onChange={(e) => onUpdateStatus(req.id, e.target.value as ClientRequestStatus)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Responded">Responded</option>
                    <option value="Closed">Closed</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => onGenerateAdviceFromRequest(req)}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#782F46] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#612438] dark:bg-[#B76E85] dark:text-slate-950"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Draft AI Advice</span>
                  </button>
                </div>
              </div>

              {req.responses.length > 0 && (
                <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  {req.responses.map((resp) => (
                    <div
                      key={resp.id}
                      className="rounded-xl bg-[#F8F6F0] px-3.5 py-2.5 text-xs dark:bg-[#111827]"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-semibold text-[#087F5B] dark:text-[#34D399]">
                          {resp.brokerName}
                        </span>
                        <span className="font-mono">{resp.createdAt.slice(0, 16).replace('T', ' ')}</span>
                      </div>
                      <p className="mt-1 text-slate-800 dark:text-slate-200">{resp.responseText}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <input
                  type="text"
                  aria-label={`Reply to ${req.id}`}
                  value={replyDrafts[req.id] ?? ''}
                  onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [req.id]: e.target.value }))}
                  placeholder="Write direct broker response to this request..."
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                />
                <button
                  type="button"
                  disabled={submittingId === req.id || !(replyDrafts[req.id] ?? '').trim()}
                  onClick={() => handleSendReply(req.id)}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#087F5B] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#06684A] disabled:opacity-50 dark:bg-[#34D399] dark:text-slate-950"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{submittingId === req.id ? 'Sending...' : 'Reply'}</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

/* ==================== PAGE 5: EXPERT ADVICE WORKBENCH ==================== */
interface BrokerAdvicePageProps {
  clients: BrokerClientSummary[];
  stocks: StockSummary[];
  adviceList: ExpertAdviceItem[];
  preselectedClientId?: string;
  preselectedSymbol?: string;
  preselectedRequestId?: string | null;
  onGenerate: (payload: {
    clientId: string;
    symbol?: string | null;
    requestId?: string | null;
    category?: string;
  }) => Promise<ExpertAdviceItem>;
  onUpdateDraft: (adviceId: string, analysis: string, recommendation: string) => Promise<void>;
  onSendAdvice: (adviceId: string) => Promise<void>;
}

export const BrokerAdvicePage: React.FC<BrokerAdvicePageProps> = ({
  clients,
  stocks,
  adviceList,
  preselectedClientId,
  preselectedSymbol,
  preselectedRequestId,
  onGenerate,
  onUpdateDraft,
  onSendAdvice,
}) => {
  const [clientId, setClientId] = useState(preselectedClientId || clients[0]?.clientId || '');
  const [symbol, setSymbol] = useState(preselectedSymbol || 'RELIANCE');
  const [category, setCategory] = useState('Portfolio & Risk Review');
  const [generating, setGenerating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAnalysis, setEditAnalysis] = useState('');
  const [editRec, setEditRec] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (preselectedClientId) setClientId(preselectedClientId);
    else if (!clientId && clients.length > 0) setClientId(clients[0].clientId);
  }, [preselectedClientId, clients]);

  useEffect(() => {
    if (preselectedSymbol) setSymbol(preselectedSymbol);
  }, [preselectedSymbol]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return;
    setGenerating(true);
    setFeedback(null);
    setErrMsg(null);
    try {
      const created = await onGenerate({
        clientId,
        symbol,
        requestId: preselectedRequestId ?? null,
        category,
      });
      setFeedback(`Generated Expert Advice Draft ${created.id} for ${created.clientName}.`);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Unable to generate expert advice');
    } finally {
      setGenerating(false);
    }
  };

  const startEdit = (a: ExpertAdviceItem) => {
    setEditingId(a.id);
    setEditAnalysis(a.analysis);
    setEditRec(a.recommendation);
  };

  const saveEdit = async (adviceId: string) => {
    await onUpdateDraft(adviceId, editAnalysis, editRec);
    setEditingId(null);
    setFeedback(`Updated draft ${adviceId}.`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
          AI Broker Expert Advice Engine
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Synthesizes client holdings, ML model state, RSI/SMA/MACD indicators, ATR/GARCH volatility, and concentration risk
        </p>
      </div>

      {/* Generator Card */}
      <form
        onSubmit={handleGenerate}
        className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label htmlFor="adv-client" className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              Target Client
            </label>
            <select
              id="adv-client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
            >
              {clients.map((c) => (
                <option key={c.clientId} value={c.clientId}>
                  {c.name} ({c.userCode})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="adv-symbol" className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              Focus Equity
            </label>
            <select
              id="adv-symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
            >
              {stocks.map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol} ({formatINR(s.latestClose)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="adv-cat" className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              Advisory Category
            </label>
            <select
              id="adv-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
            >
              <option value="Portfolio & Risk Review">Portfolio &amp; Risk Review</option>
              <option value="Stock Allocation Signal">Stock Allocation Signal</option>
              <option value="ATR Stop-Loss & Volatility Check">ATR Stop-Loss &amp; Volatility Check</option>
              <option value="Request Advisory">Request Advisory</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={generating || !clientId}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#782F46] py-2 text-xs font-semibold text-white hover:bg-[#612438] disabled:opacity-50 dark:bg-[#B76E85] dark:text-slate-950"
            >
              <Brain className="h-4 w-4" />
              <span>{generating ? 'Synthesizing Advice...' : 'Generate AI Expert Advice'}</span>
            </button>
          </div>
        </div>

        {preselectedRequestId && (
          <p className="mt-3 font-mono text-[11px] text-[#782F46] dark:text-[#B76E85]">
            Linked to Client Request: {preselectedRequestId}
          </p>
        )}
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
      </form>

      {/* Advice List */}
      <div className="space-y-4">
        {adviceList.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-[#1F2937] dark:text-slate-400">
            No expert advice records created yet. Generate an AI advice draft above to review and send to a client.
          </div>
        ) : (
          adviceList.map((adv) => (
            <article
              key={adv.id}
              className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#782F46] dark:text-[#B76E85]">
                      {adv.id}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {adv.category}
                    </span>
                    {adv.symbol && (
                      <span className="rounded bg-[#087F5B]/10 px-2 py-0.5 font-mono text-[11px] font-bold text-[#087F5B] dark:bg-[#34D399]/15 dark:text-[#34D399]">
                        {adv.symbol}
                      </span>
                    )}
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-[11px] font-bold ${
                        adv.status === 'Draft'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                          : adv.status === 'Sent'
                            ? 'bg-[#087F5B]/15 text-[#087F5B] dark:bg-[#34D399]/20 dark:text-[#34D399]'
                            : 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100'
                      }`}
                    >
                      {adv.status}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      Risk: {adv.riskLevel}
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-sm font-bold text-slate-900 dark:text-white">
                    For {adv.clientName} ({adv.clientUserCode})
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {adv.status === 'Draft' && editingId !== adv.id && (
                    <button
                      type="button"
                      onClick={() => startEdit(adv)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                    >
                      Edit Draft
                    </button>
                  )}
                  {adv.status === 'Draft' && (
                    <button
                      type="button"
                      onClick={async () => {
                        await onSendAdvice(adv.id);
                        setFeedback(`Sent Expert Advice ${adv.id} to ${adv.clientName}.`);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#087F5B] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#06684A] dark:bg-[#34D399] dark:text-slate-950"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Send to Investor</span>
                    </button>
                  )}
                </div>
              </div>

              {editingId === adv.id ? (
                <div className="mt-4 space-y-3">
                  <textarea
                    rows={3}
                    value={editAnalysis}
                    onChange={(e) => setEditAnalysis(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                  />
                  <textarea
                    rows={2}
                    value={editRec}
                    onChange={(e) => setEditRec(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveEdit(adv.id)}
                      className="rounded-lg bg-[#087F5B] px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Save Draft
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-3 text-xs leading-relaxed">
                  <p className="text-slate-700 dark:text-slate-200">{adv.analysis}</p>
                  <div className="rounded-xl bg-[#087F5B]/10 p-3.5 dark:bg-[#34D399]/10">
                    <p className="font-semibold text-[#087F5B] dark:text-[#34D399]">Recommendation</p>
                    <p className="mt-1 text-slate-800 dark:text-slate-100">{adv.recommendation}</p>
                  </div>
                </div>
              )}

              {/* Quantitative Metrics Strip */}
              <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-[#F8F6F0] p-3 text-[11px] sm:grid-cols-6 dark:bg-[#111827] tabular-nums">
                <div>
                  <span className="block text-slate-500">Close ({adv.supportingMetrics.valuationDate})</span>
                  <span className="font-mono font-bold">
                    {adv.supportingMetrics.latestClose !== null
                      ? formatINR(adv.supportingMetrics.latestClose)
                      : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500">RSI (14)</span>
                  <span className="font-mono font-bold">
                    {adv.supportingMetrics.rsi14 !== null
                      ? adv.supportingMetrics.rsi14.toFixed(1)
                      : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500">ATR (14)</span>
                  <span className="font-mono font-bold">
                    {adv.supportingMetrics.atr14 !== null
                      ? formatINR(adv.supportingMetrics.atr14)
                      : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500">GARCH Vol</span>
                  <span className="font-mono font-bold">
                    {adv.supportingMetrics.garchAnnualVolPct !== null
                      ? `${adv.supportingMetrics.garchAnnualVolPct.toFixed(1)}%`
                      : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500">ML Signal</span>
                  <span className="font-mono font-bold">
                    {adv.supportingMetrics.mlModelTrained
                      ? `${adv.supportingMetrics.mlSignal} (${((adv.supportingMetrics.mlBuyProbability ?? 0) * 100).toFixed(0)}%)`
                      : 'Untrained'}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500">Client Alloc</span>
                  <span className="font-mono font-bold">
                    {adv.supportingMetrics.holdingAllocationPct !== null
                      ? `${adv.supportingMetrics.holdingAllocationPct.toFixed(1)}%`
                      : '0%'}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span>{adv.disclaimer}</span>
                <span className="font-mono">
                  Generated {adv.generatedAt.slice(0, 16).replace('T', ' ')}
                  {adv.sentAt ? ` · Sent ${adv.sentAt.slice(0, 16).replace('T', ' ')}` : ''}
                  {adv.readAt ? ` · Read ${adv.readAt.slice(0, 16).replace('T', ' ')}` : ''}
                </span>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
};

/* ==================== PAGE 6: MESSAGES ==================== */
interface BrokerMessagesPageProps {
  conversations: BrokerConversationSummary[];
  activeClientId: string;
  messages: BrokerMessageItem[];
  brokerId: string;
  onSelectConversation: (clientId: string) => Promise<void>;
  onSendMessage: (clientId: string, text: string) => Promise<void>;
}

export const BrokerMessagesPage: React.FC<BrokerMessagesPageProps> = ({
  conversations,
  activeClientId,
  messages,
  brokerId,
  onSelectConversation,
  onSendMessage,
}) => {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeClientId]);

  const activeConv = conversations.find((c) => c.clientId === activeClientId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClientId || !draft.trim() || sending) return;
    setSending(true);
    try {
      await onSendMessage(activeClientId, draft.trim());
      setDraft('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Conversations List */}
      <aside className="rounded-2xl border border-slate-200/90 bg-white p-4 lg:col-span-4 dark:border-slate-800 dark:bg-[#1F2937]">
        <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
          Client Conversations ({conversations.length})
        </h2>
        <div className="mt-3 space-y-1.5">
          {conversations.length === 0 ? (
            <p className="py-4 text-xs text-slate-500">No linked clients available.</p>
          ) : (
            conversations.map((c) => {
              const active = c.clientId === activeClientId;
              return (
                <button
                  key={c.clientId}
                  type="button"
                  onClick={() => onSelectConversation(c.clientId)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    active
                      ? 'border-[#087F5B] bg-[#087F5B]/10 dark:border-[#34D399] dark:bg-[#34D399]/10'
                      : 'border-slate-200 bg-[#F8F6F0]/60 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#111827]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {c.clientName}
                    </span>
                    {c.unreadCount > 0 && (
                      <span className="rounded-full bg-[#782F46] px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                        {c.unreadCount} new
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-[10px] text-slate-500">{c.clientUserCode}</p>
                  <p className="mt-1 truncate text-[11px] text-slate-600 dark:text-slate-300">
                    {c.lastMessage ?? 'No messages yet'}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Active Message Thread */}
      <section className="flex h-[540px] flex-col rounded-2xl border border-slate-200/90 bg-white lg:col-span-8 dark:border-slate-800 dark:bg-[#1F2937]">
        <div className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            {activeConv ? `${activeConv.clientName} (${activeConv.clientUserCode})` : 'Select a client thread'}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Persistent SQLite two-way advisory messaging
          </p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5 text-xs">
          {messages.length === 0 ? (
            <p className="py-10 text-center text-slate-500">
              No messages yet with this client. Send a greeting or portfolio update below.
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.senderId === brokerId;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${
                      mine
                        ? 'bg-[#087F5B] text-white dark:bg-[#34D399] dark:text-slate-950'
                        : 'bg-[#F8F6F0] text-slate-800 dark:bg-[#111827] dark:text-slate-100'
                    }`}
                  >
                    <p className="text-[10px] font-semibold opacity-80">
                      {m.senderName} · {m.createdAt.slice(0, 16).replace('T', ' ')}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{m.messageText}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2 border-t border-slate-200 p-4 dark:border-slate-800">
          <input
            type="text"
            aria-label="Broker message text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a message to your investor client..."
            disabled={!activeClientId}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
          />
          <button
            type="submit"
            disabled={!activeClientId || sending || !draft.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#087F5B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#06684A] disabled:opacity-50 dark:bg-[#34D399] dark:text-slate-950"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{sending ? 'Sending...' : 'Send'}</span>
          </button>
        </form>
      </section>
    </div>
  );
};

/* ==================== PAGE 7: BROKER PROFILE ==================== */
interface BrokerProfilePageProps {
  user: UserProfile | null;
  clientsCount?: number;
  pendingRequestsCount?: number;
  adviceCount?: number;
  researchStats?: {
    trainedModelsCount: number;
    backtestsCount: number;
    experimentsCount: number;
    datasetStatus: string;
    totalStocks: number;
  };
  onLogout: () => Promise<void>;
}

export const BrokerProfilePage: React.FC<BrokerProfilePageProps> = ({
  user,
  researchStats,
  onLogout,
}) => {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <section className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-7 dark:border-slate-800 dark:bg-[#1F2937]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#087F5B]/10 text-[#087F5B] dark:bg-[#34D399]/15 dark:text-[#34D399]">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Broker &amp; Quant Account Profile
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Role-restricted quantitative research terminal credentials
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onLogout()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#782F46]/40 px-3.5 py-2 text-xs font-semibold text-[#782F46] hover:bg-[#782F46]/10 dark:border-[#B76E85]/40 dark:text-[#B76E85]"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out of Broker Portal</span>
          </button>
        </div>

        {user && (
          <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-[#F8F6F0] p-4 dark:bg-[#111827]">
              <dt className="text-[11px] text-slate-500 dark:text-slate-400">Broker User ID</dt>
              <dd className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                {user.userCode}
              </dd>
            </div>
            <div className="rounded-xl bg-[#F8F6F0] p-4 dark:bg-[#111827]">
              <dt className="text-[11px] text-slate-500 dark:text-slate-400">Name</dt>
              <dd className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{user.name}</dd>
            </div>
            <div className="rounded-xl bg-[#F8F6F0] p-4 dark:bg-[#111827]">
              <dt className="text-[11px] text-slate-500 dark:text-slate-400">Email</dt>
              <dd className="mt-1 font-mono text-sm text-slate-900 dark:text-white">{user.email}</dd>
            </div>
            <div className="rounded-xl bg-[#F8F6F0] p-4 dark:bg-[#111827]">
              <dt className="text-[11px] text-slate-500 dark:text-slate-400">Authorized Role</dt>
              <dd className="mt-1 font-mono text-sm font-bold text-[#087F5B] dark:text-[#34D399]">
                {user.role}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-5 dark:border-slate-800 dark:bg-[#1F2937]">
        <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
          Research Terminal Status
        </h3>
        <div className="mt-4 space-y-3 text-xs tabular-nums">
          <div className="flex items-center justify-between rounded-xl bg-[#F8F6F0] p-3.5 dark:bg-[#111827]">
            <span className="text-slate-600 dark:text-slate-300">Dataset Engine</span>
            <span className="font-mono font-bold text-[#087F5B] dark:text-[#34D399]">
              {researchStats?.datasetStatus ?? 'Loaded & Validated'} ({researchStats?.totalStocks ?? 50} NSE)
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-[#F8F6F0] p-3.5 dark:bg-[#111827]">
            <span className="text-slate-600 dark:text-slate-300">Trained Models Active</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              {researchStats?.trainedModelsCount ?? 0}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-[#F8F6F0] p-3.5 dark:bg-[#111827]">
            <span className="text-slate-600 dark:text-slate-300">Saved Experiments (SQLite)</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              {researchStats?.experimentsCount ?? 0}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-[#F8F6F0] p-3.5 dark:bg-[#111827]">
            <span className="text-slate-600 dark:text-slate-300">Logged Backtests (SQLite)</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              {researchStats?.backtestsCount ?? 0}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#087F5B] dark:text-[#34D399]" />
            <span>
              Zero-Leakage Chronological Splits &amp; Walk-Forward Backtesting Enforced Across All Sessions.
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};
