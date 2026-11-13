import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Compass,
  Gauge,
  Percent,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { api } from '../../services/api.ts';
import {
  formatINR,
  formatPct,
  type PortfolioSnapshot,
  type PracticeIntelligenceData,
  type PracticeSimulatedOrderResult,
  type StockSummary,
  type UserProfile,
} from '../../types/index.ts';

interface PracticeIntelligenceViewProps {
  stocks: StockSummary[];
  portfolio: PortfolioSnapshot;
  onRefreshPortfolio?: () => Promise<void>;
  user: UserProfile | null;
}

function computeDirectIntelligence(
  portfolio: PortfolioSnapshot,
  stocks: StockSummary[],
  user: UserProfile | null,
): PracticeIntelligenceData {
  const holdings = portfolio.holdings;
  const totalHoldingsCount = holdings.length;
  let hhi = 0;
  if (portfolio.totalPortfolioValue > 0) {
    for (const h of holdings) {
      const weight = h.marketValue / portfolio.totalPortfolioValue;
      hhi += weight * weight;
    }
  }
  const diversificationScore =
    totalHoldingsCount === 0
      ? 100
      : Math.max(10, Math.min(100, Math.round((1 - Math.min(1, hhi)) * 100)));

  const concentrations = holdings.map((h) => ({
    symbol: h.symbol,
    marketValue: h.marketValue,
    allocationPct: Number(h.allocationPct.toFixed(2)),
    isConcentrated: h.allocationPct > 25,
  }));

  const totalAtrRiskExposure = holdings.reduce(
    (sum, h) => sum + 1.5 * h.atr14 * h.quantity,
    0,
  );

  const cashBufferPct =
    portfolio.totalPortfolioValue > 0
      ? Number(((portfolio.cashBalance / portfolio.totalPortfolioValue) * 100).toFixed(2))
      : 100;

  const cashBufferRating: 'OPTIMAL' | 'LOW' | 'HIGH' =
    cashBufferPct < 10 ? 'LOW' : cashBufferPct > 55 ? 'HIGH' : 'OPTIMAL';

  const stockMap = new Map(stocks.map((s) => [s.symbol, s]));
  const technicalBiases = holdings.map((h) => {
    const s = stockMap.get(h.symbol);
    const rsi14 = s?.rsi14 ?? 50;
    const trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = s
      ? s.latestClose > s.sma20 && s.sma20 > s.sma50
        ? 'BULLISH'
        : s.latestClose < s.sma20 && s.sma20 < s.sma50
        ? 'BEARISH'
        : 'NEUTRAL'
      : 'NEUTRAL';
    const rsiStatus: 'OVERBOUGHT' | 'OVERSOLD' | 'NORMAL' =
      rsi14 > 70 ? 'OVERBOUGHT' : rsi14 < 30 ? 'OVERSOLD' : 'NORMAL';
    const macdSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = s
      ? s.macd >= (s.macdSignal ?? 0)
        ? 'BULLISH'
        : 'BEARISH'
      : 'NEUTRAL';
    return {
      symbol: h.symbol,
      currentPrice: h.currentPrice,
      atr14: h.atr14,
      trend,
      rsi14: Number(rsi14.toFixed(1)),
      rsiStatus,
      macdSignal,
    };
  });

  const standardScenarios = [
    {
      id: 'nifty_flash_crash_5',
      name: 'NIFTY Flash Crash (-5%)',
      description: 'Sudden intra-day market drop across all equities; cash reserves remain fully liquid and unaffected.',
      marketShockPct: -0.05,
    },
    {
      id: 'market_correction_10',
      name: 'Severe Market Correction (-10%)',
      description: 'Macro headwind causing a -10% equity pullback across Indian large-cap holdings.',
      marketShockPct: -0.10,
    },
    {
      id: 'bull_rally_5',
      name: 'NIFTY Bull Rally (+5%)',
      description: 'Positive macroeconomic earnings surge lifting all equity positions by +5%.',
      marketShockPct: 0.05,
    },
    {
      id: 'volatility_spike_atr',
      name: 'Elevated Volatility Spike (-6.5%)',
      description: 'Sudden ATR surge triggering widespread trailing stops and an average -6.5% equity decline.',
      marketShockPct: -0.065,
    },
    {
      id: 'tail_risk_var99',
      name: 'Historical 99% Tail Risk (-8%)',
      description: 'Worst-case 1-day Value-at-Risk parametric stress event on equity assets.',
      marketShockPct: -0.08,
    },
  ];

  const stressScenarios = standardScenarios.map((sc) => {
    const impacts = holdings.map((h) => {
      const shockedPrice = Math.max(0.01, h.currentPrice * (1 + sc.marketShockPct));
      const shockedMarketValue = Math.round(h.quantity * shockedPrice);
      return {
        symbol: h.symbol,
        currentMarketValue: h.marketValue,
        shockedMarketValue,
        lossGain: Math.round(shockedMarketValue - h.marketValue),
      };
    });
    const totalShockedHoldings = impacts.reduce((sum, imp) => sum + imp.shockedMarketValue, 0);
    const shockedPortfolioValue = Math.round(portfolio.cashBalance + totalShockedHoldings);
    const simulatedPnL = Math.round(shockedPortfolioValue - portfolio.totalPortfolioValue);
    const simulatedPnLPct =
      portfolio.totalPortfolioValue > 0
        ? Number(((simulatedPnL / portfolio.totalPortfolioValue) * 100).toFixed(2))
        : 0;
    return {
      id: sc.id,
      name: sc.name,
      description: sc.description,
      marketShockPct: sc.marketShockPct * 100,
      shockedPortfolioValue,
      simulatedPnL,
      simulatedPnLPct,
      effectivePortfolioShockPct: simulatedPnLPct,
      holdingImpacts: impacts,
    };
  });

  const sellTrades = portfolio.trades.filter((t) => t.side === 'SELL');
  const winningTrades = sellTrades.filter((t) => t.realizedPnl > 0);
  const losingTrades = sellTrades.filter((t) => t.realizedPnl < 0);
  const totalTrades = sellTrades.length;
  const winRatePct =
    totalTrades > 0 ? Number(((winningTrades.length / totalTrades) * 100).toFixed(1)) : 0;
  const grossProfit = winningTrades.reduce((acc, t) => acc + t.realizedPnl, 0);
  const grossLoss = Math.abs(losingTrades.reduce((acc, t) => acc + t.realizedPnl, 0));
  const profitFactor =
    grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 99.99 : null;
  const avgWin = winningTrades.length > 0 ? Math.round(grossProfit / winningTrades.length) : 0;
  const avgLoss = losingTrades.length > 0 ? Math.round(grossLoss / losingTrades.length) : 0;
  const payoffRatio = avgLoss > 0 ? Number((avgWin / avgLoss).toFixed(2)) : null;
  const largestWin = sellTrades.length > 0 ? Math.max(0, ...sellTrades.map((t) => t.realizedPnl)) : 0;
  const largestLoss = sellTrades.length > 0 ? Math.min(0, ...sellTrades.map((t) => t.realizedPnl)) : 0;
  const marketOrdersCount = portfolio.orders.filter((o) => o.orderType === 'MARKET').length;
  const limitOrdersCount = portfolio.orders.filter((o) => o.orderType === 'LIMIT').length;
  const executedOrders = portfolio.orders.filter((o) => o.status === 'EXECUTED').length;
  const fillRatePct =
    portfolio.orders.length > 0
      ? Number(((executedOrders / portfolio.orders.length) * 100).toFixed(1))
      : 100;

  let disciplineScore = 75;
  const remarks: string[] = [];
  if (cashBufferRating === 'OPTIMAL') {
    disciplineScore += 10;
    remarks.push('Optimal cash buffer maintained (10%–55%), allowing tactical flexibility.');
  } else if (cashBufferRating === 'LOW') {
    disciplineScore -= 15;
    remarks.push('Cash reserve is low (<10%); elevated exposure to market downturns.');
  } else {
    remarks.push('High cash buffer (>55%) reduces drawdowns but creates cash drag in bull runs.');
  }
  if (limitOrdersCount > 0) {
    disciplineScore += 10;
    remarks.push('Demonstrated execution patience using disciplined limit orders.');
  }
  if (concentrations.some((c) => c.isConcentrated)) {
    disciplineScore -= 15;
    const concSymbols = concentrations.filter((c) => c.isConcentrated).map((c) => c.symbol).join(', ');
    remarks.push(`Concentration warning: Allocation exceeds 25% in ${concSymbols}.`);
  } else if (totalHoldingsCount >= 3) {
    disciplineScore += 5;
    remarks.push('Good position diversification across multiple NIFTY 50 equities.');
  }
  if (totalTrades > 0) {
    if (winRatePct >= 50) {
      remarks.push(`Profitable execution history with a ${winRatePct}% win rate on closed trades.`);
    } else {
      remarks.push(`Win rate currently at ${winRatePct}%; prioritize cutting losses using 1.5× ATR stops.`);
    }
  } else {
    remarks.push('No closed sell trades yet; behavioral scoring will refine as trades execute.');
  }
  disciplineScore = Math.max(20, Math.min(100, disciplineScore));

  return {
    userId: user?.id ?? 'usr-practice-01',
    portfolio,
    holdingsHealth: {
      totalHoldingsCount,
      diversificationScore,
      hhi: Number(hhi.toFixed(4)),
      concentrations,
      totalAtrRiskExposure: Math.round(totalAtrRiskExposure),
      cashBufferRating,
      cashBufferPct,
      technicalBiases,
    },
    behavioralAnalytics: {
      totalTrades,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRatePct,
      profitFactor,
      avgWin,
      avgLoss,
      payoffRatio,
      largestWin,
      largestLoss,
      marketOrdersCount,
      limitOrdersCount,
      fillRatePct,
      disciplineScore,
      disciplineRemarks: remarks,
    },
    stressScenarios,
    generatedAt: new Date().toISOString(),
  };
}

export const PracticeIntelligenceView: React.FC<PracticeIntelligenceViewProps> = ({
  stocks,
  portfolio,
  onRefreshPortfolio,
  user,
}) => {
  const [intel, setIntel] = useState<PracticeIntelligenceData>(() =>
    computeDirectIntelligence(portfolio, stocks, user),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFeature, setActiveFeature] = useState<'impact' | 'stress' | 'sizing' | 'health' | 'behavior'>('impact');

  // Feature 1: Trade Impact Simulation state
  const [simSymbol, setSimSymbol] = useState<string>(stocks[0]?.symbol ?? 'RELIANCE');
  const [simSide, setSimSide] = useState<'BUY' | 'SELL'>('BUY');
  const [simQty, setSimQty] = useState<number>(25);
  const [simPrice, setSimPrice] = useState<string>('');
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<PracticeSimulatedOrderResult | null>(null);

  // Feature 2: Stress test selected scenario
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('nifty_flash_crash_5');

  // Feature 3: Position sizing state
  const [sizingSymbol, setSizingSymbol] = useState<string>(stocks[0]?.symbol ?? 'RELIANCE');
  const [riskPct, setRiskPct] = useState<number>(1.5);
  const [atrMultiplier, setAtrMultiplier] = useState<number>(1.5);

  const selectedStockForSim = stocks.find((s) => s.symbol === simSymbol) ?? stocks[0];
  const selectedStockForSizing = stocks.find((s) => s.symbol === sizingSymbol) ?? stocks[0];

  const fetchIntelligence = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPracticeIntelligence();
      setIntel(data);
    } catch (err) {
      // Keep directly computed intelligence active and set a non-blocking diagnostic notice
      console.warn('Practice intelligence API endpoint unreachable, running in resilient client mode:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntelligence();
  }, [portfolio.totalPortfolioValue, portfolio.cashBalance, portfolio.holdings.length]);

  useEffect(() => {
    if (selectedStockForSim) {
      setSimPrice(selectedStockForSim.latestClose.toFixed(2));
    }
  }, [selectedStockForSim?.symbol]);

  const handleRunSimulation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedStockForSim) return;
    setSimulating(true);
    try {
      const res = await api.simulateTradeImpact({
        symbol: simSymbol,
        side: simSide,
        quantity: simQty,
        price: simPrice ? Number(simPrice) : undefined,
      });
      setSimResult(res);
    } catch {
      // Direct client calculation fallback
      const price = simPrice ? Number(simPrice) : selectedStockForSim.latestClose;
      const tradeVal = simQty * price;
      const canAfford = simSide === 'BUY' ? portfolio.cashBalance >= tradeVal : true;
      const existingHolding = portfolio.holdings.find((h) => h.symbol === simSymbol);
      const canExecute =
        simSide === 'BUY'
          ? canAfford
          : existingHolding
          ? existingHolding.quantity >= simQty
          : false;
      const projCash =
        simSide === 'BUY'
          ? Math.max(0, portfolio.cashBalance - tradeVal)
          : portfolio.cashBalance + tradeVal;
      const projHoldingsVal =
        simSide === 'BUY'
          ? portfolio.holdingsMarketValue + tradeVal
          : Math.max(0, portfolio.holdingsMarketValue - tradeVal);
      const projPortVal = projCash + projHoldingsVal;
      const existingVal = existingHolding ? existingHolding.marketValue : 0;
      const projSymVal = existingVal + (simSide === 'BUY' ? tradeVal : -tradeVal);
      const projAlloc = projPortVal > 0 ? (projSymVal / projPortVal) * 100 : 0;
      setSimResult({
        isSimulated: true,
        simulationNote:
          'Zero-mutation simulation: No actual order was placed and your virtual wallet remains completely unchanged.',
        actualWalletBefore: {
          cashBalance: portfolio.cashBalance,
          totalPortfolioValue: portfolio.totalPortfolioValue,
          holdingsCount: portfolio.holdings.length,
        },
        hypotheticalTrade: {
          symbol: simSymbol,
          side: simSide,
          quantity: simQty,
          price,
          totalValue: tradeVal,
        },
        canAfford,
        canExecute,
        projectedCashBalance: projCash,
        projectedPortfolioValue: projPortVal,
        projectedAllocationPct: Number(projAlloc.toFixed(2)),
        concentrationWarning: projAlloc > 25,
        projectedHoldingsCount:
          portfolio.holdings.length + (simSide === 'BUY' && !existingHolding ? 1 : 0),
      });
    } finally {
      setSimulating(false);
    }
  };

  useEffect(() => {
    if (selectedStockForSim && !simResult) {
      handleRunSimulation();
    }
  }, [selectedStockForSim?.symbol]);

  // Calculations for Feature 3: Risk Sizing
  const sizingPrice = selectedStockForSizing?.latestClose ?? 1000;
  const sizingAtr = selectedStockForSizing?.atr14 ?? sizingPrice * 0.02;
  const recommendedStopLoss = Math.max(0.05, sizingPrice - atrMultiplier * sizingAtr);
  const riskPerShare = Math.max(0.01, sizingPrice - recommendedStopLoss);
  const totalCapitalBase = portfolio.totalPortfolioValue > 0 ? portfolio.totalPortfolioValue : 1000000;
  const maxAllowedLoss = Math.round(totalCapitalBase * (riskPct / 100));
  const maxSafeShares = Math.max(1, Math.floor(maxAllowedLoss / riskPerShare));
  const capitalRequiredForSafeShares = Math.round(maxSafeShares * sizingPrice);
  const affordableShares = Math.floor(portfolio.cashBalance / sizingPrice);
  const recommendedShares = Math.min(maxSafeShares, affordableShares);

  const selectedScenario =
    intel?.stressScenarios.find((s) => s.id === selectedScenarioId) ?? intel?.stressScenarios[0];

  return (
    <div className="space-y-6">
      {/* Top Intelligence Banner */}
      <div className="rounded-2xl border border-[#087F5B]/30 bg-gradient-to-r from-[#087F5B]/10 via-[#087F5B]/5 to-transparent p-5 dark:border-[#34D399]/30 dark:from-[#34D399]/15 dark:via-transparent">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#087F5B]/20 px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#087F5B] dark:bg-[#34D399]/20 dark:text-[#34D399]">
                <BrainCircuit className="h-3 w-3" />
                Practice Intelligence Engine
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                <ShieldCheck className="h-3 w-3" />
                Zero-Mutation Analytics
              </span>
            </div>
            <h2 className="mt-2 font-display text-xl font-bold text-slate-900 sm:text-2xl dark:text-white">
              Portfolio Intelligence &amp; Hypothetical Risk Simulators
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 max-w-3xl">
              Grounded in your real authenticated virtual balance (
              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                {formatINR(portfolio.cashBalance)}
              </span>
              ) and active holdings. Simulations never place real virtual trades or alter your wallet.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchIntelligence}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#1F2937] dark:text-slate-200 dark:hover:bg-slate-800 shrink-0 self-start sm:self-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Diagnostics</span>
          </button>
        </div>
      </div>

      {/* Feature Selector Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        {[
          { id: 'impact', label: '1. What-If Order Impact', icon: Activity },
          { id: 'stress', label: '2. Macro Stress Testing', icon: AlertTriangle },
          { id: 'sizing', label: '3. ATR Position Sizing', icon: Scale },
          { id: 'health', label: '4. Holdings Health Audit', icon: ShieldCheck },
          { id: 'behavior', label: '5. Behavioral Analytics', icon: Gauge },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeFeature === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFeature(tab.id as typeof activeFeature)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all shrink-0 ${
                active
                  ? 'bg-[#087F5B] text-white shadow-sm dark:bg-[#34D399] dark:text-slate-950'
                  : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-[#1F2937] dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {/* ==================== FEATURE 1: WHAT-IF ORDER IMPACT SIMULATOR ==================== */}
      {activeFeature === 'impact' && (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-5 dark:border-slate-800 dark:bg-[#1F2937]">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Simulate Hypothetical Order
              </h3>
              <span className="rounded bg-blue-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                Zero Mutation
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Preview how an order impacts your cash reserve, concentration risk, and allocation before placing it.
            </p>

            <form onSubmit={handleRunSimulation} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Target NIFTY 50 Equity
                </label>
                <select
                  value={simSymbol}
                  onChange={(e) => setSimSymbol(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                >
                  {stocks.map((s) => (
                    <option key={s.symbol} value={s.symbol}>
                      {s.symbol} — {formatINR(s.latestClose)} ({s.latestDate})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSimSide('BUY')}
                  className={`rounded-lg py-2 text-xs font-bold transition-colors ${
                    simSide === 'BUY'
                      ? 'bg-[#087F5B] text-white dark:bg-[#34D399] dark:text-slate-950'
                      : 'border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  Simulate BUY
                </button>
                <button
                  type="button"
                  onClick={() => setSimSide('SELL')}
                  className={`rounded-lg py-2 text-xs font-bold transition-colors ${
                    simSide === 'SELL'
                      ? 'bg-[#782F46] text-white dark:bg-[#B76E85] dark:text-slate-950'
                      : 'border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  Simulate SELL
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Quantity (Shares)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={simQty}
                    onChange={(e) => setSimQty(Math.max(1, Math.floor(Number(e.target.value))))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Target Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.05"
                    value={simPrice}
                    onChange={(e) => setSimPrice(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-[#F8F6F0] p-3 text-xs dark:bg-[#111827] space-y-1">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Order Cost / Proceeds:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {formatINR(simQty * (Number(simPrice) || selectedStockForSim.latestClose))}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Available Cash Balance:</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">
                    {formatINR(portfolio.cashBalance)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={simulating}
                className="w-full rounded-lg bg-[#087F5B] py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#06684A] dark:bg-[#34D399] dark:text-slate-950 disabled:opacity-60"
              >
                {simulating ? 'Running Simulation...' : 'Run What-If Simulation'}
              </button>
            </form>
          </div>

          {/* Simulation Output Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-7 dark:border-slate-800 dark:bg-[#1F2937]">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Projected Post-Trade Portfolio State
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Hypothetical projection strictly in-memory — verified zero modification to your virtual account.
            </p>

            {simResult ? (
              <div className="mt-4 space-y-4">
                {/* Feasibility Alert */}
                {simResult.canExecute ? (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-300/60 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-800 dark:border-emerald-700/60 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>
                      Order is feasible! Available cash and holdings accommodate this hypothetical trade.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-300/60 bg-rose-500/10 p-3 text-xs font-medium text-rose-800 dark:border-rose-700/60 dark:text-rose-300">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{simResult.executionIssue ?? 'Order exceeds cash or holding limits.'}</span>
                  </div>
                )}

                {/* Pre vs Post Comparison Grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 tabular-nums">
                  <div className="rounded-xl bg-[#F8F6F0] p-3 dark:bg-[#111827]">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Actual Cash</span>
                    <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                      {formatINR(simResult.actualWalletBefore.cashBalance)}
                    </p>
                    <span className="text-[10px] text-slate-400">Current</span>
                  </div>

                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/40 dark:bg-blue-950/20">
                    <span className="text-[11px] text-blue-700 dark:text-blue-300">Projected Cash</span>
                    <p className="mt-1 font-mono text-sm font-bold text-blue-900 dark:text-blue-100">
                      {formatINR(simResult.projectedCashBalance)}
                    </p>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400">After Trade</span>
                  </div>

                  <div className="rounded-xl bg-[#F8F6F0] p-3 dark:bg-[#111827]">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Actual Value</span>
                    <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                      {formatINR(simResult.actualWalletBefore.totalPortfolioValue)}
                    </p>
                    <span className="text-[10px] text-slate-400">Current</span>
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-300">Projected Value</span>
                    <p className="mt-1 font-mono text-sm font-bold text-emerald-900 dark:text-emerald-100">
                      {formatINR(simResult.projectedPortfolioValue)}
                    </p>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400">After Trade</span>
                  </div>
                </div>

                {/* Concentration Warning Box */}
                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      Projected {simResult.hypotheticalTrade.symbol} Allocation:
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {simResult.projectedAllocationPct.toFixed(1)}% of portfolio
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full transition-all ${
                        simResult.concentrationWarning ? 'bg-amber-500' : 'bg-[#087F5B] dark:bg-[#34D399]'
                      }`}
                      style={{ width: `${Math.min(100, simResult.projectedAllocationPct)}%` }}
                    />
                  </div>
                  {simResult.concentrationWarning && (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        Concentration Caution: Projected position exceeds recommended 25% single-stock exposure limit.
                      </span>
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-500 dark:bg-[#111827] dark:text-slate-400 flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                  <span>
                    Verification guarantee: {simResult.simulationNote}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                Click &quot;Run What-If Simulation&quot; to inspect projected numbers.
              </div>
            )}
          </div>
        </section>
      )}

      {/* ==================== FEATURE 2: MACRO STRESS TESTING ==================== */}
      {activeFeature === 'stress' && (
        <section className="space-y-6">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Portfolio Macro Stress Testing
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Evaluates how your current holdings endure market-wide drawdowns. Liquid cash reserves remain protected and cushion total portfolio decline.
            </p>

            {/* Scenario Buttons */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {intel?.stressScenarios.map((sc) => {
                const isSelected = sc.id === selectedScenarioId;
                const isPositive = sc.marketShockPct > 0;
                return (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => setSelectedScenarioId(sc.id)}
                    className={`rounded-xl border p-3.5 text-left transition-all ${
                      isSelected
                        ? 'border-[#087F5B] bg-[#087F5B]/5 ring-2 ring-[#087F5B]/30 dark:border-[#34D399] dark:bg-[#34D399]/10'
                        : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-[#111827] dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                        {sc.marketShockPct > 0 ? `+${sc.marketShockPct}%` : `${sc.marketShockPct}%`}
                      </span>
                      {isPositive ? (
                        <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                      )}
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">
                      {sc.name}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                      {sc.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Selected Scenario Impact Details */}
            {selectedScenario && (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-[#F8F6F0]/60 p-5 dark:border-slate-800 dark:bg-[#111827]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
                  <div>
                    <span className="text-xs font-semibold text-[#087F5B] dark:text-[#34D399]">
                      Simulated Scenario
                    </span>
                    <h4 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                      {selectedScenario.name}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{selectedScenario.description}</p>
                  </div>
                  <div className="text-right tabular-nums">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Simulated Net Impact</span>
                    <p
                      className={`font-mono text-xl font-bold ${
                        selectedScenario.simulatedPnL >= 0
                          ? 'text-[#087F5B] dark:text-[#34D399]'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {formatINR(selectedScenario.simulatedPnL)} ({selectedScenario.simulatedPnLPct >= 0 ? '+' : ''}
                      {selectedScenario.simulatedPnLPct.toFixed(2)}%)
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 tabular-nums">
                  <div className="rounded-xl bg-white p-3.5 dark:bg-[#1F2937]">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Current Portfolio Value</span>
                    <p className="mt-1 font-mono text-base font-bold text-slate-900 dark:text-white">
                      {formatINR(portfolio.totalPortfolioValue)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white p-3.5 dark:bg-[#1F2937]">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Shocked Portfolio Value</span>
                    <p className="mt-1 font-mono text-base font-bold text-slate-900 dark:text-white">
                      {formatINR(selectedScenario.shockedPortfolioValue)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white p-3.5 dark:bg-[#1F2937]">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Cash Buffer Protection</span>
                    <p className="mt-1 font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
                      {formatINR(portfolio.cashBalance)} (100% Intact)
                    </p>
                  </div>
                </div>

                {/* Per-Holding Impact Table */}
                <div className="mt-4 overflow-x-auto">
                  {selectedScenario.holdingImpacts.length === 0 ? (
                    <p className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                      No active holdings. Your 100% cash position is completely insulated from market equity drawdowns.
                    </p>
                  ) : (
                    <table className="w-full text-left text-xs tabular-nums">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                          <th className="py-2 pr-3 font-medium">Holding Symbol</th>
                          <th className="py-2 px-3 text-right font-medium">Current Value</th>
                          <th className="py-2 px-3 text-right font-medium">Shocked Value</th>
                          <th className="py-2 pl-3 text-right font-medium">Simulated P&amp;L</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {selectedScenario.holdingImpacts.map((h) => (
                          <tr key={h.symbol}>
                            <td className="py-2 pr-3 font-mono font-bold text-slate-900 dark:text-white">
                              {h.symbol}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">{formatINR(h.currentMarketValue)}</td>
                            <td className="py-2 px-3 text-right font-mono">{formatINR(h.shockedMarketValue)}</td>
                            <td
                              className={`py-2 pl-3 text-right font-mono font-semibold ${
                                h.lossGain >= 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {formatINR(h.lossGain)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ==================== FEATURE 3: DYNAMIC ATR POSITION SIZING ==================== */}
      {activeFeature === 'sizing' && (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-5 dark:border-slate-800 dark:bg-[#1F2937]">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Dynamic ATR Position Sizing
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Calculate maximum safe share allocation based on your account equity and stock volatility (ATR 14).
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Select Target Stock
                </label>
                <select
                  value={sizingSymbol}
                  onChange={(e) => setSizingSymbol(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                >
                  {stocks.map((s) => (
                    <option key={s.symbol} value={s.symbol}>
                      {s.symbol} — {formatINR(s.latestClose)} (ATR {formatINR(s.atr14)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Account Capital at Risk Limit (%)
                </label>
                <div className="mt-1 grid grid-cols-4 gap-2">
                  {[1.0, 1.5, 2.0, 3.0].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setRiskPct(pct)}
                      className={`rounded-lg py-2 font-mono text-xs font-bold transition-all ${
                        riskPct === pct
                          ? 'bg-[#087F5B] text-white dark:bg-[#34D399] dark:text-slate-950'
                          : 'border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Stop-Loss ATR Multiplier
                </label>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {[1.5, 2.0, 2.5].map((mult) => (
                    <button
                      key={mult}
                      type="button"
                      onClick={() => setAtrMultiplier(mult)}
                      className={`rounded-lg py-2 font-mono text-xs font-bold transition-all ${
                        atrMultiplier === mult
                          ? 'bg-[#087F5B] text-white dark:bg-[#34D399] dark:text-slate-950'
                          : 'border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {mult}× ATR
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-[#F8F6F0] p-4 text-xs dark:bg-[#111827] space-y-2 tabular-nums">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Reference Close:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {formatINR(sizingPrice)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">ATR(14) Daily Volatility:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {formatINR(sizingAtr)} ({((sizingAtr / sizingPrice) * 100).toFixed(1)}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Stop-Loss Distance:</span>
                  <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                    -{formatINR(riskPerShare)} per share
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sizing Recommendations Output */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-7 dark:border-slate-800 dark:bg-[#1F2937]">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Sizing Diagnostics &amp; Risk Parameters
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Mathematically optimal position size to keep account risk capped at exactly {riskPct}% of total equity.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 tabular-nums">
              <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Max Allowed Loss</span>
                <p className="mt-1 font-mono text-base font-bold text-rose-600 dark:text-rose-400">
                  {formatINR(maxAllowedLoss)}
                </p>
                <span className="text-[10px] text-slate-400">{riskPct}% of ₹{totalCapitalBase.toLocaleString('en-IN')}</span>
              </div>

              <div className="rounded-xl border border-emerald-300/70 bg-emerald-50/40 p-3.5 dark:border-emerald-700/60 dark:bg-emerald-950/20">
                <span className="text-[11px] text-emerald-800 dark:text-emerald-300">Max Safe Shares</span>
                <p className="mt-1 font-mono text-xl font-bold text-emerald-900 dark:text-emerald-100">
                  {maxSafeShares} Qty
                </p>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300">Risk-Capped</span>
              </div>

              <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Recommended Stop</span>
                <p className="mt-1 font-mono text-base font-bold text-slate-900 dark:text-white">
                  {formatINR(recommendedStopLoss)}
                </p>
                <span className="text-[10px] text-slate-400">{atrMultiplier}× ATR Level</span>
              </div>

              <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Capital Required</span>
                <p className="mt-1 font-mono text-base font-bold text-slate-900 dark:text-white">
                  {formatINR(capitalRequiredForSafeShares)}
                </p>
                <span className="text-[10px] text-slate-400">{maxSafeShares} × {formatINR(sizingPrice)}</span>
              </div>

              <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Cash-Affordable Qty</span>
                <p className="mt-1 font-mono text-base font-bold text-slate-900 dark:text-white">
                  {affordableShares} Qty
                </p>
                <span className="text-[10px] text-slate-400">Based on cash</span>
              </div>

              <div className="rounded-xl border border-blue-300/70 bg-blue-50/40 p-3.5 dark:border-blue-700/60 dark:bg-blue-950/20">
                <span className="text-[11px] text-blue-800 dark:text-blue-300">Executable Recommendation</span>
                <p className="mt-1 font-mono text-xl font-bold text-blue-900 dark:text-blue-100">
                  {recommendedShares} Qty
                </p>
                <span className="text-[10px] text-blue-700 dark:text-blue-300">Optimal Order</span>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-[#F8F6F0] p-4 text-xs dark:bg-[#111827] space-y-1.5">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Professional Sizing Rule Applied:
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                Position Size = ⌊(Account Value × Risk %) / (ATR × Multiplier)⌋. By placing your stop-loss at{' '}
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {formatINR(recommendedStopLoss)}
                </span>
                , even if the trade fails completely, your account loss is strictly capped at{' '}
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                  {formatINR(maxAllowedLoss)}
                </span>
                .
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ==================== FEATURE 4: HOLDINGS HEALTH & TECHNICAL DIAGNOSTIC ==================== */}
      {activeFeature === 'health' && intel && (
        <section className="space-y-6">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Holdings Health &amp; Diversification Audit
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Evaluates portfolio concentration, aggregate volatility exposure, and technical trend alignment across all held positions.
            </p>

            {/* Health KPI Cards */}
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 tabular-nums">
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">Diversification Score</span>
                <p className="mt-1 font-mono text-2xl font-bold text-[#087F5B] dark:text-[#34D399]">
                  {intel.holdingsHealth.diversificationScore} / 100
                </p>
                <span className="text-[11px] text-slate-400">HHI {intel.holdingsHealth.hhi}</span>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">Total Holdings</span>
                <p className="mt-1 font-mono text-2xl font-bold text-slate-900 dark:text-white">
                  {intel.holdingsHealth.totalHoldingsCount}
                </p>
                <span className="text-[11px] text-slate-400">Equities Held</span>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">1.5× ATR Downside Risk</span>
                <p className="mt-1 font-mono text-2xl font-bold text-rose-600 dark:text-rose-400">
                  {formatINR(intel.holdingsHealth.totalAtrRiskExposure)}
                </p>
                <span className="text-[11px] text-slate-400">Aggregate Exposure</span>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">Cash Buffer Health</span>
                <p className="mt-1 font-mono text-2xl font-bold text-slate-900 dark:text-white">
                  {intel.holdingsHealth.cashBufferPct.toFixed(1)}%
                </p>
                <span
                  className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    intel.holdingsHealth.cashBufferRating === 'OPTIMAL'
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {intel.holdingsHealth.cashBufferRating} BUFFER
                </span>
              </div>
            </div>

            {/* Holdings Technical Trend Alignment Table */}
            <div className="mt-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Holding-By-Holding Technical Trend Matrix
              </h4>

              <div className="mt-3 overflow-x-auto">
                {intel.holdingsHealth.technicalBiases.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    No active positions held. Place simulated BUY orders from the Home tab to analyze holdings health.
                  </p>
                ) : (
                  <table className="w-full text-left text-xs tabular-nums">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        <th className="py-2 pr-3 font-medium">Symbol</th>
                        <th className="py-2 px-3 text-right font-medium">Price</th>
                        <th className="py-2 px-3 text-right font-medium">ATR(14)</th>
                        <th className="py-2 px-3 font-medium">Trend (SMA 20/50)</th>
                        <th className="py-2 px-3 text-right font-medium">RSI(14)</th>
                        <th className="py-2 pl-3 font-medium">MACD Bias</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {intel.holdingsHealth.technicalBiases.map((tb) => (
                        <tr key={tb.symbol}>
                          <td className="py-2.5 pr-3 font-mono font-bold text-slate-900 dark:text-white">
                            {tb.symbol}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">{formatINR(tb.currentPrice)}</td>
                          <td className="py-2.5 px-3 text-right font-mono">{formatINR(tb.atr14)}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                                tb.trend === 'BULLISH'
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                  : tb.trend === 'BEARISH'
                                  ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {tb.trend}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            <span
                              className={
                                tb.rsiStatus === 'OVERBOUGHT'
                                  ? 'font-bold text-amber-600'
                                  : tb.rsiStatus === 'OVERSOLD'
                                  ? 'font-bold text-blue-600'
                                  : ''
                              }
                            >
                              {tb.rsi14} ({tb.rsiStatus})
                            </span>
                          </td>
                          <td className="py-2.5 pl-3">
                            <span
                              className={`font-semibold ${
                                tb.macdSignal === 'BULLISH'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {tb.macdSignal}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ==================== FEATURE 5: EXECUTION & BEHAVIORAL ANALYTICS ==================== */}
      {activeFeature === 'behavior' && intel && (
        <section className="space-y-6">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Execution &amp; Trading Behavioral Intelligence
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Audit of your simulated trade journal, execution discipline, win rate, and order type distribution.
            </p>

            {/* Metrics Grid */}
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 tabular-nums">
              <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Win Rate</span>
                <p className="mt-1 font-mono text-xl font-bold text-[#087F5B] dark:text-[#34D399]">
                  {intel.behavioralAnalytics.winRatePct}%
                </p>
                <span className="text-[10px] text-slate-400">
                  {intel.behavioralAnalytics.winningTrades}W / {intel.behavioralAnalytics.losingTrades}L
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Profit Factor</span>
                <p className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-white">
                  {intel.behavioralAnalytics.profitFactor !== null
                    ? intel.behavioralAnalytics.profitFactor
                    : '—'}
                </p>
                <span className="text-[10px] text-slate-400">Gross W / L</span>
              </div>

              <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Avg Win / Loss</span>
                <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                  {formatINR(intel.behavioralAnalytics.avgWin)}
                </p>
                <span className="text-[10px] text-rose-500">
                  Avg L: {formatINR(intel.behavioralAnalytics.avgLoss)}
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Largest Win</span>
                <p className="mt-1 font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {formatINR(intel.behavioralAnalytics.largestWin)}
                </p>
                <span className="text-[10px] text-rose-500">
                  Max L: {formatINR(intel.behavioralAnalytics.largestLoss)}
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Order Discipline</span>
                <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                  {intel.behavioralAnalytics.limitOrdersCount} Limit
                </p>
                <span className="text-[10px] text-slate-400">
                  {intel.behavioralAnalytics.marketOrdersCount} Market
                </span>
              </div>

              <div className="rounded-xl border border-[#087F5B]/40 bg-[#087F5B]/5 p-3.5 dark:border-[#34D399]/40 dark:bg-[#34D399]/10">
                <span className="text-[11px] text-[#087F5B] dark:text-[#34D399]">Discipline Score</span>
                <p className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-white">
                  {intel.behavioralAnalytics.disciplineScore} / 100
                </p>
                <span className="text-[10px] text-slate-500">Execution Quality</span>
              </div>
            </div>

            {/* Personalized Behavioral Remarks */}
            <div className="mt-6 rounded-xl bg-[#F8F6F0] p-4 text-xs dark:bg-[#111827] space-y-2">
              <h4 className="font-bold text-slate-800 dark:text-slate-200">
                Behavioral Insights &amp; Execution Feedback
              </h4>
              <ul className="space-y-1.5 text-slate-600 dark:text-slate-300">
                {intel.behavioralAnalytics.disciplineRemarks.map((remark, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#087F5B] dark:text-[#34D399] mt-0.5" />
                    <span>{remark}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
