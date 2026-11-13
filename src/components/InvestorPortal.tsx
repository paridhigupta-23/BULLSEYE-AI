import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Bookmark,
  Bot,
  Brain,
  CheckCircle2,
  ClipboardList,
  Home,
  Landmark,
  LineChart,
  LogOut,
  MessageSquare,
  Newspaper,
  Plus,
  Search,
  Send,
  ShieldAlert,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext.tsx';
import { api } from '../services/api.ts';
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
  type RiskMetrics,
  type StockDetailResponse,
  type StockSummary,
  type TimeRangeKey,
  type UserProfile,
} from '../types/index.ts';
import { CandlestickChart } from './charts/CandlestickChart.tsx';
import { ContributionChart, MacdChart, RsiChart } from './charts/IndicatorCharts.tsx';
import {
  InvestorHomeTab,
  InvestorIpoTab,
  InvestorNewsTab,
  InvestorOrdersTab,
  InvestorProfileTab,
  type InvestorTabId,
  type ProfileSectionId,
} from './investor/InvestorSubPages.tsx';

interface InvestorPortalProps {
  stocks: StockSummary[];
  onRefreshStocks: () => void;
}

export const InvestorPortal: React.FC<InvestorPortalProps> = ({ stocks }) => {
  const {
    selectedSymbol,
    setSelectedSymbol,
    t,
    inv,
    language,
    openAiWithContext,
    setPortal,
    user,
    logoutUser,
  } = useAppContext();

  const [activeTab, setActiveTab] = useState<InvestorTabId>(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab === 'ipo' || tab === 'stocks' || tab === 'orders' || tab === 'news' || tab === 'profile') {
      return tab;
    }
    return 'home';
  });
  const [profileSection, setProfileSection] = useState<ProfileSectionId>('account');

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', activeTab);
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, [activeTab]);

  const [searchQuery, setSearchQuery] = useState('');
  const [range, setRange] = useState<TimeRangeKey>('6M');
  const [detail, setDetail] = useState<StockDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Chart overlay toggles
  const [showSma20, setShowSma20] = useState(true);
  const [showSma50, setShowSma50] = useState(true);
  const [showEma, setShowEma] = useState(false);
  const [showBollinger, setShowBollinger] = useState(false);

  // Interactive Risk Calculator State
  const [entryPrice, setEntryPrice] = useState<number>(0);
  const [availableCapital, setAvailableCapital] = useState<number>(100000);
  const [riskPercentage, setRiskPercentage] = useState<number>(1.5);
  const [atrMultiplier, setAtrMultiplier] = useState<number>(1.5);
  const [riskRewardMultiple, setRiskRewardMultiple] = useState<number>(2);
  const [riskResult, setRiskResult] = useState<RiskMetrics | null>(null);

  // SQLite-backed Investor Watchlist & Portfolio Holdings State
  const [investorPortfolio, setInvestorPortfolio] = useState<InvestorPortfolioSnapshot | null>(null);
  const [watchNote, setWatchNote] = useState('');
  const [holdingQty, setHoldingQty] = useState<number>(10);
  const [holdingBuyPrice, setHoldingBuyPrice] = useState<string>('');
  const [holdingTarget, setHoldingTarget] = useState<string>('');
  const [holdingStop, setHoldingStop] = useState<string>('');
  const [holdingFeedback, setHoldingFeedback] = useState<string | null>(null);

  // Stocks tab "Ask Your Broker" quick request form
  const [askCategory, setAskCategory] = useState<string>('stockAnalysis');
  const [askMessage, setAskMessage] = useState<string>('');
  const [submittingAsk, setSubmittingAsk] = useState<boolean>(false);
  const [askFeedback, setAskFeedback] = useState<string | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

  // Sub-pages data state
  const [orders, setOrders] = useState<InvestorOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ipoData, setIpoData] = useState<IpoSnapshotResponse | null>(null);
  const [loadingIpo, setLoadingIpo] = useState(false);
  const [ipoError, setIpoError] = useState<string | null>(null);
  const [newsData, setNewsData] = useState<InvestorNewsResponse | null>(null);
  const [loadingNews, setLoadingNews] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [profileUser, setProfileUser] = useState<UserProfile | null>(user);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Broker Advisory Hub state
  const [brokerConnection, setBrokerConnection] = useState<InvestorBrokerConnection | null>(null);
  const [requests, setRequests] = useState<ClientRequestItem[]>([]);
  const [adviceList, setAdviceList] = useState<ExpertAdviceItem[]>([]);
  const [messages, setMessages] = useState<BrokerMessageItem[]>([]);

  const INVESTOR_TABS: Array<{
    id: InvestorTabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'home', label: inv.tabs.home, icon: Home },
    { id: 'ipo', label: inv.tabs.ipo, icon: Landmark },
    { id: 'stocks', label: inv.tabs.stocks, icon: LineChart },
    { id: 'orders', label: inv.tabs.orders, icon: ClipboardList },
    { id: 'news', label: inv.tabs.news, icon: Newspaper },
    { id: 'profile', label: inv.tabs.profile, icon: UserCheck },
  ];

  const latestLanguageRef = React.useRef(language);
  latestLanguageRef.current = language;

  const loadInvestorPortfolio = async () => {
    try {
      const snap = await api.getInvestorPortfolio();
      setInvestorPortfolio(snap);
    } catch {
      // handled by auth guard
    }
  };

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await api.getInvestorOrders();
      setOrders(res.orders);
    } catch {
      // handled gracefully
    } finally {
      setLoadingOrders(false);
    }
  };

  const loadAdvisoryHub = async (targetLang = latestLanguageRef.current) => {
    try {
      const [brkRes, reqRes, advRes, msgRes] = await Promise.all([
        api.getInvestorBroker(),
        api.getInvestorRequests(),
        api.getInvestorAdvice(targetLang),
        api.getInvestorMessages(),
      ]);
      setBrokerConnection(brkRes);
      setRequests(reqRes.requests);
      if (latestLanguageRef.current === targetLang) {
        setAdviceList(advRes.advice);
      }
      setMessages(msgRes.messages);
    } catch {
      // handled gracefully
    }
  };

  const loadIpo = async () => {
    setLoadingIpo(true);
    setIpoError(null);
    try {
      const res = await api.getInvestorIpo();
      setIpoData(res);
    } catch (err) {
      setIpoError(err instanceof Error ? err.message : inv.common.noData);
    } finally {
      setLoadingIpo(false);
    }
  };

  const loadNews = async (targetLang = latestLanguageRef.current) => {
    setLoadingNews(true);
    setNewsError(null);
    try {
      const res = await api.getInvestorNews(targetLang);
      if (latestLanguageRef.current === targetLang) {
        setNewsData(res);
      }
    } catch (err) {
      setNewsError(err instanceof Error ? err.message : inv.common.noData);
    } finally {
      setLoadingNews(false);
    }
  };

  const loadProfile = async () => {
    setLoadingProfile(true);
    try {
      const [meRes, portRes, ordRes] = await Promise.all([
        api.getMe(),
        api.getInvestorPortfolio(),
        api.getInvestorOrders(),
      ]);
      setProfileUser(meRes.user);
      setInvestorPortfolio(portRes);
      setOrders(ordRes.orders);
      await loadAdvisoryHub(latestLanguageRef.current);
    } catch {
      setProfileUser(user);
    } finally {
      setLoadingProfile(false);
    }
  };

  const loadStock = async (symbol: string, selectedRange: TimeRangeKey) => {
    setLoadingDetail(true);
    setDetailError(null);
    try {
      const res = await api.getStockDetail(symbol, selectedRange);
      setDetail(res);
      setEntryPrice(Number(res.latestOhlcv.close.toFixed(2)));
      setHoldingBuyPrice(res.latestOhlcv.close.toFixed(2));
      setRiskResult(res.risk);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : inv.common.noData);
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    loadInvestorPortfolio();
    loadOrders();
    loadAdvisoryHub(latestLanguageRef.current);
  }, []);

  useEffect(() => {
    loadStock(selectedSymbol, range);
  }, [selectedSymbol, range]);

  // Re-fetch translated feeds whenever language changes
  useEffect(() => {
    const lang = language;
    api
      .getInvestorAdvice(lang)
      .then((res) => {
        if (latestLanguageRef.current === lang) {
          setAdviceList(res.advice);
        }
      })
      .catch(() => {});
    if (activeTab === 'news') {
      loadNews(lang);
    }
  }, [language]);

  // Fetch backend data when switching to sub-pages
  useEffect(() => {
    if (activeTab === 'home') {
      loadInvestorPortfolio();
      loadOrders();
      loadAdvisoryHub();
    } else if (activeTab === 'ipo') {
      loadIpo();
    } else if (activeTab === 'orders') {
      loadOrders();
    } else if (activeTab === 'news') {
      loadNews();
    } else if (activeTab === 'profile') {
      loadProfile();
    }
  }, [activeTab]);

  // Dynamic risk calculation update
  useEffect(() => {
    if (!detail || entryPrice <= 0) return;
    const timer = setTimeout(() => {
      api
        .calculateRisk({
          symbol: detail.meta.symbol,
          entryPrice,
          atrMultiplier,
          availableCapital,
          riskPercentage,
          riskRewardMultiple,
        })
        .then(setRiskResult)
        .catch(() => {});
    }, 150);
    return () => clearTimeout(timer);
  }, [detail, entryPrice, atrMultiplier, availableCapital, riskPercentage, riskRewardMultiple]);

  const isInWatchlist = Boolean(
    investorPortfolio?.watchlist.some((w) => w.symbol === selectedSymbol),
  );

  const handleToggleWatchlist = async () => {
    setHoldingFeedback(null);
    try {
      const updated = isInWatchlist
        ? await api.removeFromWatchlist(selectedSymbol)
        : await api.addToWatchlist(selectedSymbol, watchNote || 'Added from Investor Explorer');
      setInvestorPortfolio(updated);
      setWatchNote('');
      setHoldingFeedback(
        isInWatchlist
          ? `${inv.stocks.watchlistRemoved} (${selectedSymbol})`
          : `${inv.stocks.watchlistAdded} (${selectedSymbol})`,
      );
    } catch (err) {
      setHoldingFeedback(err instanceof Error ? err.message : inv.common.noData);
    }
  };

  const handleSaveHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    setHoldingFeedback(null);
    try {
      const updated = await api.upsertInvestorHolding({
        symbol: selectedSymbol,
        quantity: holdingQty,
        avgBuyPrice: Number(holdingBuyPrice),
        targetPrice: holdingTarget ? Number(holdingTarget) : null,
        stopLoss: holdingStop ? Number(holdingStop) : null,
        notes: 'Logged via Investor Portal',
      });
      setInvestorPortfolio(updated);
      setHoldingFeedback(`${inv.stocks.holdingSaved} (${holdingQty} ${selectedSymbol})`);
    } catch (err) {
      setHoldingFeedback(err instanceof Error ? err.message : inv.common.noData);
    }
  };

  const handleRemoveHolding = async (symbol: string) => {
    try {
      const updated = await api.removeInvestorHolding(symbol);
      setInvestorPortfolio(updated);
      setHoldingFeedback(`${inv.stocks.holdingRemoved} (${symbol})`);
    } catch (err) {
      setHoldingFeedback(err instanceof Error ? err.message : inv.common.noData);
    }
  };

  const handleRemoveWatchlist = async (symbol: string) => {
    const updated = await api.removeFromWatchlist(symbol);
    setInvestorPortfolio(updated);
    setHoldingFeedback(`${inv.stocks.watchlistRemoved} (${symbol})`);
  };

  const handleCreateOrder = async (payload: {
    symbol: string;
    side: 'BUY' | 'SELL';
    orderType: 'MARKET' | 'LIMIT';
    quantity: number;
    price?: number;
    notes?: string;
  }) => {
    const res = await api.createInvestorOrder(payload);
    setOrders(res.orders);
  };

  const handleCancelOrder = async (id: string) => {
    const res = await api.cancelInvestorOrder(id);
    setOrders(res.orders);
  };

  const handleLinkBroker = async (brokerCode: string) => {
    const conn = await api.linkInvestorBroker(brokerCode);
    setBrokerConnection(conn);
    await loadAdvisoryHub();
  };

  const handleCreateRequest = async (payload: {
    category: string;
    symbol?: string | null;
    message: string;
  }) => {
    const res = await api.createInvestorRequest(payload);
    setRequests(res.requests);
  };

  const handleStockAskBroker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!askMessage.trim()) return;
    setSubmittingAsk(true);
    setAskFeedback(null);
    setAskError(null);
    try {
      const catLabel =
        inv.stocks.categories[askCategory as keyof typeof inv.stocks.categories] ||
        inv.stocks.categories.stockAnalysis;
      await handleCreateRequest({
        category: catLabel,
        symbol: selectedSymbol,
        message: askMessage.trim(),
      });
      setAskMessage('');
      setAskFeedback(inv.stocks.requestSuccess);
    } catch (err) {
      setAskError(err instanceof Error ? err.message : inv.common.noData);
    } finally {
      setSubmittingAsk(false);
    }
  };

  const handleMarkAdviceRead = async (adviceId: string) => {
    await api.markInvestorAdviceRead(adviceId);
    const res = await api.getInvestorAdvice(language);
    setAdviceList(res.advice);
  };

  const handleSendMessage = async (messageText: string) => {
    const res = await api.sendInvestorMessage(messageText);
    setMessages(res.messages);
  };

  const featuredStocks = stocks.filter((s) => s.featured);
  const filteredStocks = stocks.filter(
    (s) =>
      s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const signalColorClass = (sig: string | null) => {
    if (sig === 'BUY') return 'text-[#087F5B] dark:text-[#34D399]';
    if (sig === 'SELL') return 'text-[#782F46] dark:text-[#B76E85]';
    return 'text-slate-700 dark:text-slate-300';
  };

  const unreadAdviceCount = adviceList.filter((a) => a.status === 'Sent').length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header + Authenticated Investor Identity + Sign Out */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between dark:border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-[#087F5B] dark:text-[#34D399]">
              {user?.userCode} · {user?.role}
            </span>
            <button
              type="button"
              onClick={() => logoutUser()}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <LogOut className="h-3 w-3" />
              <span>{inv.common.signOut}</span>
            </button>
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
            {t.investorHeading}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t.investorSubheading}</p>
        </div>

        {/* Investor Sub-Page Navigation Bar: Home, IPO, Stocks, My Orders, News, Profile */}
        <nav aria-label={t.investorHeading} className="flex flex-wrap items-center gap-1.5">
          {INVESTOR_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            const badge = tab.id === 'profile' && unreadAdviceCount > 0 ? unreadAdviceCount : 0;
            return (
              <button
                key={tab.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'border-[#087F5B] bg-[#087F5B] text-white dark:border-[#34D399] dark:bg-[#34D399] dark:text-slate-950'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#1F2937] dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
                {badge > 0 && (
                  <span
                    className={`rounded-full px-1.5 font-mono text-[10px] font-bold ${
                      active
                        ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-950'
                        : 'bg-[#782F46] text-white dark:bg-[#B76E85] dark:text-slate-950'
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab 1: Home */}
      {activeTab === 'home' && (
        <InvestorHomeTab
          user={user}
          stocks={stocks}
          selectedSymbol={selectedSymbol}
          investorPortfolio={investorPortfolio}
          orders={orders}
          adviceList={adviceList}
          requests={requests}
          messages={messages}
          onSelectStockAndOpen={(sym) => {
            setSelectedSymbol(sym);
            setActiveTab('stocks');
          }}
          onNavigateTab={(tab) => setActiveTab(tab)}
          onNavigateProfileSection={(section) => {
            setProfileSection(section);
            setActiveTab('profile');
          }}
          onRemoveWatchlist={handleRemoveWatchlist}
          onRemoveHolding={handleRemoveHolding}
        />
      )}

      {/* Tab 2: IPO */}
      {activeTab === 'ipo' && (
        <InvestorIpoTab
          ipoData={ipoData}
          loading={loadingIpo}
          error={ipoError}
          onRefresh={loadIpo}
        />
      )}

      {/* Tab 3: Stocks */}
      {activeTab === 'stocks' && (
        <div className="space-y-8">
          {/* Stock Search & Watchlist Selector Bar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-[#1F2937]">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  aria-label={inv.stocks.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={inv.stocks.searchPlaceholder}
                  className="w-56 rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                />
              </div>
              <label htmlFor="investor-stock-select" className="sr-only">
                {inv.common.symbol}
              </label>
              <select
                id="investor-stock-select"
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
              >
                {filteredStocks.map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.symbol} — {s.name}
                  </option>
                ))}
              </select>
              {searchQuery.trim() && filteredStocks.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  {filteredStocks.slice(0, 5).map((match) => (
                    <button
                      key={match.symbol}
                      type="button"
                      onClick={() => setSelectedSymbol(match.symbol)}
                      className={`rounded-md border px-2 py-1 font-mono text-[11px] font-semibold ${
                        match.symbol === selectedSymbol
                          ? 'border-[#087F5B] bg-[#087F5B]/10 text-[#087F5B] dark:border-[#34D399] dark:text-[#34D399]'
                          : 'border-slate-200 bg-[#F8F6F0] text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-[#111827] dark:text-slate-200'
                      }`}
                    >
                      {match.symbol}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleToggleWatchlist}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                isInWatchlist
                  ? 'border-[#087F5B] bg-[#087F5B]/10 text-[#087F5B] dark:border-[#34D399] dark:text-[#34D399]'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#111827] dark:text-slate-200'
              }`}
            >
              <Bookmark className="h-3.5 w-3.5" />
              <span>
                {isInWatchlist
                  ? `${inv.stocks.watchingStock} ${selectedSymbol}`
                  : `${inv.stocks.watchStock} ${selectedSymbol}`}
              </span>
            </button>
          </div>

          {/* Primary Stock Explorer Cards (4 Featured Stocks) */}
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                {t.stockExplorer}
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {inv.stocks.clickCardHint}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {featuredStocks.map((s) => {
                const active = s.symbol === selectedSymbol;
                const pos = s.dailyReturn >= 0;
                return (
                  <button
                    key={s.symbol}
                    type="button"
                    onClick={() => setSelectedSymbol(s.symbol)}
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

          {/* Detailed Stock Analysis */}
          {loadingDetail && (
            <div className="space-y-4">
              <div className="h-28 animate-pulse rounded-2xl bg-white dark:bg-[#1F2937]" />
              <div className="h-96 animate-pulse rounded-2xl bg-white dark:bg-[#1F2937]" />
            </div>
          )}

          {detailError && !loadingDetail && (
            <div className="flex items-center gap-3 rounded-xl border border-[#782F46]/40 bg-white p-5 text-sm text-[#782F46] dark:border-[#B76E85]/40 dark:bg-[#1F2937] dark:text-[#B76E85]">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{detailError}</span>
            </div>
          )}

          {detail && !loadingDetail && (
            <>
              {/* Selected Stock Overview Header */}
              <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>{detail.meta.sector}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {inv.stocks.nseClosePrefix}: {detail.latestDate}
                      </span>
                    </div>
                    <h2 className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-white">
                      {detail.meta.name}{' '}
                      <span className="font-mono text-lg text-slate-500 dark:text-slate-400">
                        ({detail.meta.symbol})
                      </span>
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 tabular-nums">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {inv.stocks.latestHistoricalClose}
                      </p>
                      <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
                        {formatINR(detail.latestOhlcv.close)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {inv.stocks.dailyReturn}
                      </p>
                      <p
                        className={`flex items-center gap-1 font-mono text-lg font-bold ${
                          detail.latestDailyReturn >= 0
                            ? 'text-[#087F5B] dark:text-[#34D399]'
                            : 'text-[#782F46] dark:text-[#B76E85]'
                        }`}
                      >
                        {detail.latestDailyReturn >= 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        <span>{formatPct(detail.latestDailyReturn * 100)}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPortal('practice')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#087F5B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#06684A] dark:bg-[#34D399] dark:text-slate-950 whitespace-nowrap shrink-0"
                    >
                      <span>{inv.stocks.simulateTrade}</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* OHLCV Strip */}
                <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-6 dark:border-slate-800 tabular-nums">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{inv.common.open}</p>
                    <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                      {formatINR(detail.latestOhlcv.open)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{inv.common.high}</p>
                    <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                      {formatINR(detail.latestOhlcv.high)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{inv.common.low}</p>
                    <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                      {formatINR(detail.latestOhlcv.low)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{inv.common.volume}</p>
                    <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                      {formatVolume(detail.latestOhlcv.volume)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">RSI (14)</p>
                    <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                      {Number(detail.latestFeatures.rsi_14).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">ATR (14)</p>
                    <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                      {formatINR(Number(detail.latestFeatures.atr_14))}
                    </p>
                  </div>
                </div>
              </section>

              {/* Ask Your Broker / Request AI Expert Advice Section */}
              <section className="rounded-2xl border border-[#087F5B]/30 bg-white p-6 dark:border-[#34D399]/30 dark:bg-[#1F2937]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900 dark:text-white">
                      <MessageSquare className="h-4 w-4 text-[#087F5B] dark:text-[#34D399]" />
                      <span>
                        {inv.stocks.askBrokerTitle} ({detail.meta.symbol})
                      </span>
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {inv.stocks.askBrokerSubtitle}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileSection('requests');
                      setActiveTab('profile');
                    }}
                    className="text-xs font-semibold text-[#087F5B] hover:underline dark:text-[#34D399] whitespace-nowrap"
                  >
                    {inv.home.viewAllRequests} →
                  </button>
                </div>

                <form onSubmit={handleStockAskBroker} className="mt-4 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <div>
                      <label
                        htmlFor="stocks-ask-cat"
                        className="block text-[11px] font-medium text-slate-500 dark:text-slate-400"
                      >
                        {inv.stocks.requestCategoryLabel}
                      </label>
                      <select
                        id="stocks-ask-cat"
                        value={askCategory}
                        onChange={(e) => setAskCategory(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                      >
                        <option value="stockAnalysis">{inv.stocks.categories.stockAnalysis}</option>
                        <option value="recommendation">{inv.stocks.categories.recommendation}</option>
                        <option value="portfolioReview">{inv.stocks.categories.portfolioReview}</option>
                        <option value="riskCheck">{inv.stocks.categories.riskCheck}</option>
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <label
                        htmlFor="stocks-ask-msg"
                        className="block text-[11px] font-medium text-slate-500 dark:text-slate-400"
                      >
                        {inv.stocks.requestQuestionLabel}
                      </label>
                      <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                        <input
                          id="stocks-ask-msg"
                          type="text"
                          value={askMessage}
                          onChange={(e) => setAskMessage(e.target.value)}
                          placeholder={inv.stocks.requestPlaceholder}
                          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                        />
                        <button
                          type="submit"
                          disabled={submittingAsk || !askMessage.trim()}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#087F5B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#06684A] disabled:opacity-50 dark:bg-[#34D399] dark:text-slate-950 whitespace-nowrap"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>
                            {submittingAsk
                              ? inv.stocks.submittingRequest
                              : inv.stocks.submitRequestBtn}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {inv.stocks.presets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAskMessage(`${detail.meta.symbol}: ${preset}`)}
                        className="rounded-md border border-slate-200 bg-[#F8F6F0] px-2.5 py-1 text-[11px] text-slate-700 hover:border-[#087F5B] dark:border-slate-700 dark:bg-[#111827] dark:text-slate-300"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </form>

                {askFeedback && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#087F5B] dark:text-[#34D399]">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{askFeedback}</span>
                  </p>
                )}
                {askError && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#782F46] dark:text-[#B76E85]">
                    <AlertCircle className="h-4 w-4" />
                    <span>{askError}</span>
                  </p>
                )}
              </section>

              {/* Candlestick Chart + Time Filters + Overlays */}
              <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                      {t.detailedAnalysis}
                    </h3>
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      {detail.series.length} {inv.common.sessions}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-[#111827]">
                      {(['1M', '3M', '6M', '1Y', 'ALL'] as TimeRangeKey[]).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRange(r)}
                          className={`rounded-md px-2.5 py-1 font-mono text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                            range === r
                              ? 'bg-white text-slate-900 shadow-xs dark:bg-[#1F2937] dark:text-white'
                              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        openAiWithContext(
                          {
                            title: `${detail.meta.symbol} (${range})`,
                            symbol: detail.meta.symbol,
                            data: {
                              latestDate: detail.latestDate,
                              latestClose: detail.latestOhlcv.close,
                              dailyReturnPct: (detail.latestDailyReturn * 100).toFixed(2),
                              sma20: detail.latestFeatures.sma_20,
                              sma50: detail.latestFeatures.sma_50,
                              bbUpper: detail.latestFeatures.bb_upper,
                              bbLower: detail.latestFeatures.bb_lower,
                              sessionsShown: detail.series.length,
                            },
                          },
                          `Explain the ${detail.meta.symbol} chart trend over the ${range} period using its closing price, SMA 20, SMA 50, and Bollinger Bands.`,
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                    >
                      <Bot className="h-3.5 w-3.5 text-[#087F5B] dark:text-[#34D399]" />
                      <span>{t.explainThis}</span>
                    </button>
                  </div>
                </div>

                {/* Overlay Toggles */}
                <div className="mb-4 flex flex-wrap items-center gap-3 text-xs">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={showSma20}
                      onChange={(e) => setShowSma20(e.target.checked)}
                      className="accent-[#6D28D9]"
                    />
                    <span>SMA 20</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={showSma50}
                      onChange={(e) => setShowSma50(e.target.checked)}
                      className="accent-[#D97706]"
                    />
                    <span>SMA 50</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={showEma}
                      onChange={(e) => setShowEma(e.target.checked)}
                      className="accent-[#0284C7]"
                    />
                    <span>{inv.stocks.emaOverlay}</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={showBollinger}
                      onChange={(e) => setShowBollinger(e.target.checked)}
                      className="accent-[#A78BFA]"
                    />
                    <span>{inv.stocks.bollingerBands}</span>
                  </label>
                </div>

                <CandlestickChart
                  symbol={detail.meta.symbol}
                  series={detail.series}
                  showSma20={showSma20}
                  showSma50={showSma50}
                  showEma={showEma}
                  showBollinger={showBollinger}
                  height={390}
                />

                {/* RSI & MACD Subcharts */}
                <div className="mt-6 grid grid-cols-1 gap-6 border-t border-slate-100 pt-6 lg:grid-cols-2 dark:border-slate-800">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {inv.stocks.currentRsi}: {Number(detail.latestFeatures.rsi_14).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          openAiWithContext(
                            {
                              title: `${detail.meta.symbol} RSI (14)`,
                              symbol: detail.meta.symbol,
                              data: {
                                rsi14: detail.latestFeatures.rsi_14,
                                latestDate: detail.featureLatestDate,
                                close: detail.latestOhlcv.close,
                              },
                            },
                            `Explain ${detail.meta.symbol}'s current RSI(14) value of ${Number(detail.latestFeatures.rsi_14).toFixed(2)} in simple words.`,
                          )
                        }
                        className="text-xs font-medium text-[#087F5B] hover:underline dark:text-[#34D399]"
                      >
                        {t.explainThis}
                      </button>
                    </div>
                    <RsiChart series={detail.series} />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {inv.stocks.macdVsSignal}: {Number(detail.latestFeatures.macd).toFixed(2)} /{' '}
                        {Number(detail.latestFeatures.macd_signal).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          openAiWithContext(
                            {
                              title: `${detail.meta.symbol} MACD`,
                              symbol: detail.meta.symbol,
                              data: {
                                macd: detail.latestFeatures.macd,
                                macdSignal: detail.latestFeatures.macd_signal,
                                latestDate: detail.featureLatestDate,
                              },
                            },
                            `What does ${detail.meta.symbol}'s MACD (${Number(detail.latestFeatures.macd).toFixed(2)}) vs Signal (${Number(detail.latestFeatures.macd_signal).toFixed(2)}) indicate?`,
                          )
                        }
                        className="text-xs font-medium text-[#087F5B] hover:underline dark:text-[#34D399]"
                      >
                        {t.explainThis}
                      </button>
                    </div>
                    <MacdChart series={detail.series} />
                  </div>
                </div>

                {/* Complete Indicator Summary Table */}
                <div className="mt-6 grid grid-cols-2 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-4 lg:grid-cols-7 dark:border-slate-800 tabular-nums">
                  {[
                    ['SMA 20', formatINR(Number(detail.latestFeatures.sma_20))],
                    ['SMA 50', formatINR(Number(detail.latestFeatures.sma_50))],
                    ['EMA 12', formatINR(Number(detail.latestFeatures.ema_12))],
                    ['EMA 26', formatINR(Number(detail.latestFeatures.ema_26))],
                    ['BB Upper', formatINR(Number(detail.latestFeatures.bb_upper))],
                    ['BB Lower', formatINR(Number(detail.latestFeatures.bb_lower))],
                    [inv.stocks.volRatio, `${Number(detail.latestFeatures.volume_ratio).toFixed(2)}x`],
                  ].map(([label, val]) => (
                    <div key={label} className="rounded-lg bg-[#F8F6F0] px-3 py-2 dark:bg-[#111827]">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
                      <p className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                        {val}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* AI Prediction + Explainable AI Grid */}
              <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-5 dark:border-slate-800 dark:bg-[#1F2937]">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                      {t.aiPredictionPanel}
                    </h3>
                    <Brain className="h-5 w-5 text-[#087F5B] dark:text-[#34D399]" />
                  </div>

                  {!detail.prediction.modelTrained ? (
                    <div className="mt-5 rounded-xl border border-slate-200 bg-[#F8F6F0] p-5 dark:border-slate-700 dark:bg-[#111827]">
                      <p className="text-sm font-semibold text-[#782F46] dark:text-[#B76E85]">
                        {t.modelNotTrainedMsg}
                      </p>
                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                        {inv.stocks.untrainedDetail}
                      </p>
                      <button
                        type="button"
                        onClick={() => setPortal('broker')}
                        className="mt-4 rounded-lg bg-[#782F46] px-4 py-2 text-xs font-semibold text-white hover:bg-[#612438] dark:bg-[#B76E85] dark:text-slate-950"
                      >
                        {inv.stocks.openBrokerLogin}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-4">
                      <div className="flex items-baseline justify-between rounded-xl bg-[#F8F6F0] p-4 dark:bg-[#111827]">
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {inv.stocks.signalLabel} ({inv.stocks.thresholdLabel}{' '}
                            {(detail.prediction.threshold * 100).toFixed(0)}%)
                          </p>
                          <p
                            className={`mt-1 font-mono text-3xl font-bold ${signalColorClass(
                              detail.prediction.signal,
                            )}`}
                          >
                            {detail.prediction.signal
                              ? inv.statuses[detail.prediction.signal] ?? detail.prediction.signal
                              : '—'}
                          </p>
                        </div>
                        <div className="text-right tabular-nums">
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {inv.stocks.riskCategoryLabel}
                          </p>
                          <p className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-white">
                            {inv.statuses[detail.risk.volatilityCategory] ??
                              detail.risk.volatilityCategory}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 tabular-nums">
                        <div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-600 dark:text-slate-300">
                              {inv.stocks.buyProbLabel}
                            </span>
                            <span className="font-mono font-semibold text-[#087F5B] dark:text-[#34D399]">
                              {((detail.prediction.buyProbability ?? 0) * 100).toFixed(2)}%
                            </span>
                          </div>
                          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div
                              className="h-full bg-[#087F5B] dark:bg-[#34D399]"
                              style={{
                                width: `${((detail.prediction.buyProbability ?? 0) * 100).toFixed(1)}%`,
                              }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-600 dark:text-slate-300">
                              {inv.stocks.sellProbLabel}
                            </span>
                            <span className="font-mono font-semibold text-[#782F46] dark:text-[#B76E85]">
                              {((detail.prediction.sellProbability ?? 0) * 100).toFixed(2)}%
                            </span>
                          </div>
                          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div
                              className="h-full bg-[#782F46] dark:bg-[#B76E85]"
                              style={{
                                width: `${((detail.prediction.sellProbability ?? 0) * 100).toFixed(1)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                        <p>
                          <span className="font-semibold">{inv.stocks.modelLabel}:</span>{' '}
                          {detail.prediction.modelName}
                        </p>
                        <p>
                          <span className="font-semibold">{inv.stocks.featureDateLabel}:</span>{' '}
                          {detail.prediction.predictionDate} · {inv.stocks.latencyLabel}:{' '}
                          <span className="font-mono">{detail.prediction.inferenceLatencyMs} ms</span>
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          openAiWithContext(
                            {
                              title: `${detail.meta.symbol} AI`,
                              symbol: detail.meta.symbol,
                              data: {
                                signal: detail.prediction.signal,
                                buyProbability: detail.prediction.buyProbability,
                                sellProbability: detail.prediction.sellProbability,
                                modelName: detail.prediction.modelName,
                                predictionDate: detail.prediction.predictionDate,
                                topContributions: detail.prediction.contributions.slice(0, 5),
                              },
                            },
                            `Why did the ${detail.prediction.modelName} produce a ${detail.prediction.signal} classification for ${detail.meta.symbol} with ${((detail.prediction.buyProbability ?? 0) * 100).toFixed(1)}% BUY probability?`,
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                      >
                        <Bot className="h-3.5 w-3.5 text-[#087F5B] dark:text-[#34D399]" />
                        <span>{t.askBullseyeAi}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Explainable AI Panel */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-7 dark:border-slate-800 dark:bg-[#1F2937]">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                      {t.explainableAi}
                    </h3>
                    {detail.prediction.explanationMethod && (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {detail.prediction.explanationMethod}
                      </span>
                    )}
                  </div>

                  {detail.prediction.modelTrained && detail.prediction.contributions.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {inv.stocks.modelAttributionTitle}
                      </p>
                      <ContributionChart contributions={detail.prediction.contributions} />
                    </div>
                  )}

                  <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <p className="mb-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {inv.stocks.technicalRulesTitle}
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {detail.ruleExplanations.map((rule) => (
                        <div
                          key={rule.indicator}
                          className="rounded-xl bg-[#F8F6F0] p-3.5 dark:bg-[#111827]"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-900 dark:text-white">
                              {rule.indicator}
                            </span>
                            <span
                              className={`font-mono text-xs font-bold ${
                                rule.bias === 'Bullish'
                                  ? 'text-[#087F5B] dark:text-[#34D399]'
                                  : rule.bias === 'Bearish'
                                    ? 'text-[#782F46] dark:text-[#B76E85]'
                                    : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {rule.bias === 'Bullish'
                                ? inv.stocks.bullish
                                : rule.bias === 'Bearish'
                                  ? inv.stocks.bearish
                                  : inv.stocks.neutral}
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                            {rule.summary}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Risk Analysis Calculator + GARCH Summary */}
              <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-8 dark:border-slate-800 dark:bg-[#1F2937]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5 text-[#782F46] dark:text-[#B76E85]" />
                      <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                        {t.riskAnalysis}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        openAiWithContext(
                          {
                            title: `${detail.meta.symbol} ATR Risk`,
                            symbol: detail.meta.symbol,
                            data: riskResult as unknown as Record<string, unknown>,
                          },
                          `How was the ${detail.meta.symbol} stop-loss and position size calculated using ATR(14) = ₹${detail.latestFeatures.atr_14}?`,
                        )
                      }
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#087F5B] hover:underline dark:text-[#34D399]"
                    >
                      <Bot className="h-3.5 w-3.5" />
                      <span>{t.explainThis}</span>
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <div>
                      <label htmlFor="risk-entry" className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {inv.stocks.entryPrice}
                      </label>
                      <input
                        id="risk-entry"
                        type="number"
                        step="0.5"
                        value={entryPrice}
                        onChange={(e) => setEntryPrice(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="risk-cap" className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {inv.stocks.capital}
                      </label>
                      <input
                        id="risk-cap"
                        type="number"
                        step="5000"
                        value={availableCapital}
                        onChange={(e) => setAvailableCapital(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="risk-pct" className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {inv.stocks.riskPct}
                      </label>
                      <input
                        id="risk-pct"
                        type="number"
                        step="0.25"
                        min="0.1"
                        max="10"
                        value={riskPercentage}
                        onChange={(e) => setRiskPercentage(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="risk-k" className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {inv.stocks.atrMult}
                      </label>
                      <input
                        id="risk-k"
                        type="number"
                        step="0.25"
                        min="0.5"
                        max="5"
                        value={atrMultiplier}
                        onChange={(e) => setAtrMultiplier(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="risk-rr" className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {inv.stocks.targetRR}
                      </label>
                      <input
                        id="risk-rr"
                        type="number"
                        step="0.5"
                        min="1"
                        max="5"
                        value={riskRewardMultiple}
                        onChange={(e) => setRiskRewardMultiple(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                      />
                    </div>
                  </div>

                  {riskResult && (
                    <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 tabular-nums">
                      <div className="rounded-xl bg-[#F8F6F0] p-3 dark:bg-[#111827]">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {inv.stocks.stopLoss}
                        </p>
                        <p className="mt-1 font-mono text-sm font-bold text-[#782F46] dark:text-[#B76E85]">
                          {formatINR(riskResult.stopLoss)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-[#F8F6F0] p-3 dark:bg-[#111827]">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {inv.stocks.suggestedTarget}
                        </p>
                        <p className="mt-1 font-mono text-sm font-bold text-[#087F5B] dark:text-[#34D399]">
                          {formatINR(riskResult.targetPrice)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-[#F8F6F0] p-3 dark:bg-[#111827]">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {inv.stocks.positionSize}
                        </p>
                        <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                          {riskResult.positionSizeShares} {inv.stocks.sharesUnit}
                        </p>
                      </div>
                      <div className="rounded-xl bg-[#F8F6F0] p-3 dark:bg-[#111827]">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {inv.stocks.capitalAlloc}
                        </p>
                        <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                          {formatINR(riskResult.suggestedCapitalAllocation, 0)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-[#F8F6F0] p-3 dark:bg-[#111827]">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {inv.stocks.riskReward}
                        </p>
                        <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                          1 : {riskResult.riskRewardRatio.toFixed(1)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-[#F8F6F0] p-3 dark:bg-[#111827]">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {inv.stocks.atrPctVol}
                        </p>
                        <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                          {riskResult.atrPctOfPrice.toFixed(2)}% (
                          {inv.statuses[riskResult.volatilityCategory] ?? riskResult.volatilityCategory})
                        </p>
                      </div>
                    </div>
                  )}

                  <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                    {inv.stocks.riskFormulasPrefix}
                  </p>
                  <p className="mt-1.5 text-xs font-medium text-[#782F46] dark:text-[#B76E85]">
                    {t.stopLossDisclaimer}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-4 dark:border-slate-800 dark:bg-[#1F2937]">
                  <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    {t.fundamentalsNews}
                  </h3>
                  <div className="mt-4 rounded-xl border border-slate-200 bg-[#F8F6F0] p-4 dark:border-slate-700 dark:bg-[#111827]">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">
                      {inv.stocks.extFundUnavailable}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      {inv.stocks.extFundNote}{' '}
                      <button
                        type="button"
                        onClick={() => setActiveTab('news')}
                        className="font-semibold text-[#087F5B] underline dark:text-[#34D399]"
                      >
                        {inv.stocks.openNewsTab}
                      </button>
                    </p>
                  </div>
                  {detail.garch.fitted && (
                    <div className="mt-4 border-t border-slate-100 pt-4 text-xs dark:border-slate-800 tabular-nums">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {inv.stocks.garchVolSummary} ({detail.meta.symbol})
                      </p>
                      <div className="mt-2 flex justify-between text-slate-600 dark:text-slate-300">
                        <span>{inv.stocks.nextDayVol}:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {detail.garch.nextDayForecastAnnualVolPct.toFixed(2)}%
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between text-slate-600 dark:text-slate-300">
                        <span>{inv.stocks.longRunVol}:</span>
                        <span className="font-mono font-semibold">
                          {detail.garch.longRunAnnualVolPct.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Persistent SQLite Watchlist & Investor Portfolio */}
              <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-5 dark:border-slate-800 dark:bg-[#1F2937]">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                        {inv.stocks.investorWatchlist}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {inv.stocks.savedInSqliteFor} {user?.userCode}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-semibold text-[#087F5B] dark:text-[#34D399]">
                      {investorPortfolio?.watchlist.length ?? 0} {inv.stocks.stocksUnit}
                    </span>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <input
                      type="text"
                      aria-label={inv.stocks.notePlaceholder}
                      value={watchNote}
                      onChange={(e) => setWatchNote(e.target.value)}
                      placeholder={`${inv.stocks.notePlaceholder} (${selectedSymbol})`}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleToggleWatchlist}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#087F5B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#06684A] dark:bg-[#34D399] dark:text-slate-950 whitespace-nowrap"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>{isInWatchlist ? inv.stocks.updateNote : inv.stocks.addWatch}</span>
                    </button>
                  </div>

                  {holdingFeedback && (
                    <p className="mt-2 text-xs font-medium text-[#087F5B] dark:text-[#34D399]">
                      {holdingFeedback}
                    </p>
                  )}

                  <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                    {!investorPortfolio || investorPortfolio.watchlist.length === 0 ? (
                      <p className="py-4 text-xs text-slate-500 dark:text-slate-400">
                        {inv.stocks.emptyWatchlistHint}
                      </p>
                    ) : (
                      investorPortfolio.watchlist.map((item) => (
                        <div key={item.symbol} className="flex items-center justify-between py-2.5 text-xs">
                          <button
                            type="button"
                            onClick={() => setSelectedSymbol(item.symbol)}
                            className="text-left hover:underline"
                          >
                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                              {item.symbol}
                            </span>
                            <span className="ml-2 text-slate-500 dark:text-slate-400">
                              RSI {item.rsi14.toFixed(1)} ·{' '}
                              {item.signal ? (inv.statuses[item.signal] ?? item.signal) : inv.home.untrained}
                            </span>
                            {item.note && (
                              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                                {item.note}
                              </span>
                            )}
                          </button>
                          <div className="flex items-center gap-3 tabular-nums">
                            <div className="text-right">
                              <span className="block font-mono font-semibold text-slate-900 dark:text-white">
                                {formatINR(item.latestClose)}
                              </span>
                              <span
                                className={`font-mono text-[11px] ${
                                  item.dailyReturn >= 0
                                    ? 'text-[#087F5B] dark:text-[#34D399]'
                                    : 'text-[#782F46] dark:text-[#B76E85]'
                                }`}
                              >
                                {formatPct(item.dailyReturn * 100)}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveWatchlist(item.symbol)}
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

                {/* Long-Term Investor Portfolio Holdings Tracker */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-7 dark:border-slate-800 dark:bg-[#1F2937]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                        {inv.stocks.portfolioTracker}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {inv.stocks.valuedAgainstClose} ({detail.latestDate})
                      </p>
                    </div>
                    {investorPortfolio && (
                      <div className="flex gap-4 text-right text-xs tabular-nums">
                        <div>
                          <span className="block text-slate-500 dark:text-slate-400">
                            {inv.stocks.marketValue}
                          </span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {formatINR(investorPortfolio.totalMarketValue)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-slate-500 dark:text-slate-400">
                            {inv.home.unrealizedPnl}
                          </span>
                          <span
                            className={`font-mono font-bold ${
                              investorPortfolio.totalUnrealizedPnl >= 0
                                ? 'text-[#087F5B] dark:text-[#34D399]'
                                : 'text-[#782F46] dark:text-[#B76E85]'
                            }`}
                          >
                            {formatINR(investorPortfolio.totalUnrealizedPnl)} (
                            {formatPct(investorPortfolio.totalUnrealizedPnlPct)})
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleSaveHolding} className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <div>
                      <label htmlFor="inv-qty" className="block text-[11px] text-slate-500 dark:text-slate-400">
                        {selectedSymbol} {inv.common.qty}
                      </label>
                      <input
                        id="inv-qty"
                        type="number"
                        min="1"
                        value={holdingQty}
                        onChange={(e) => setHoldingQty(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="inv-avg" className="block text-[11px] text-slate-500 dark:text-slate-400">
                        {inv.stocks.avgBuyField}
                      </label>
                      <input
                        id="inv-avg"
                        type="number"
                        step="0.05"
                        value={holdingBuyPrice}
                        onChange={(e) => setHoldingBuyPrice(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="inv-tgt" className="block text-[11px] text-slate-500 dark:text-slate-400">
                        {inv.stocks.targetField}
                      </label>
                      <input
                        id="inv-tgt"
                        type="number"
                        step="0.05"
                        placeholder={inv.stocks.optional}
                        value={holdingTarget}
                        onChange={(e) => setHoldingTarget(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="inv-sl" className="block text-[11px] text-slate-500 dark:text-slate-400">
                        {inv.stocks.stopLossField}
                      </label>
                      <input
                        id="inv-sl"
                        type="number"
                        step="0.05"
                        placeholder={inv.stocks.optional}
                        value={holdingStop}
                        onChange={(e) => setHoldingStop(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        className="w-full rounded-lg bg-[#087F5B] py-1.5 text-xs font-semibold text-white hover:bg-[#06684A] dark:bg-[#34D399] dark:text-slate-950"
                      >
                        {inv.stocks.saveHoldingBtn}
                      </button>
                    </div>
                  </form>

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
                              {inv.stocks.noTrackedHoldings}
                            </td>
                          </tr>
                        ) : (
                          investorPortfolio.holdings.map((h) => (
                            <tr key={h.symbol}>
                              <td className="py-2.5 pr-3 font-mono font-bold text-slate-900 dark:text-white">
                                <button
                                  type="button"
                                  onClick={() => setSelectedSymbol(h.symbol)}
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
                                  onClick={() => handleRemoveHolding(h.symbol)}
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
            </>
          )}
        </div>
      )}

      {/* Tab 4: My Orders */}
      {activeTab === 'orders' && (
        <InvestorOrdersTab
          stocks={stocks}
          orders={orders}
          loading={loadingOrders}
          onCreateOrder={handleCreateOrder}
          onCancelOrder={handleCancelOrder}
        />
      )}

      {/* Tab 5: News */}
      {activeTab === 'news' && (
        <InvestorNewsTab
          newsData={newsData}
          loading={loadingNews}
          error={newsError}
          onRefresh={loadNews}
        />
      )}

      {/* Tab 6: Profile & Advisor Hub */}
      {activeTab === 'profile' && (
        <InvestorProfileTab
          user={profileUser ?? user}
          stocks={stocks}
          selectedSymbol={selectedSymbol}
          portfolio={investorPortfolio}
          orders={orders}
          loading={loadingProfile}
          activeSection={profileSection}
          onChangeSection={setProfileSection}
          brokerConnection={brokerConnection}
          requests={requests}
          adviceList={adviceList}
          messages={messages}
          onLinkBroker={handleLinkBroker}
          onCreateRequest={handleCreateRequest}
          onMarkAdviceRead={handleMarkAdviceRead}
          onSendMessage={handleSendMessage}
          onLogout={logoutUser}
        />
      )}
    </div>
  );
};
