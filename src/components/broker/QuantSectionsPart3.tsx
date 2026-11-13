import React, { useEffect, useState } from 'react';
import {
  Activity,
  Bot,
  Database,
  History,
  Play,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext.tsx';
import { api } from '../../services/api.ts';
import {
  formatINR,
  formatPct,
  type AdvancedRiskResponse,
  type BacktestResult,
  type ModelType,
  type MonitoringStatus,
} from '../../types/index.ts';
import {
  EquityCurveChart,
  GarchVolatilityChart,
} from '../charts/IndicatorCharts.tsx';

interface QuantSectionsPart3Props {
  activeSection?: string;
  selectedSymbol: string;
  modelType: ModelType;
  monitoring: MonitoringStatus | null;
  onRefreshMonitoring: () => Promise<void>;
  btStrategy:
    | 'ml_model'
    | 'sma_crossover'
    | 'rsi_mean_reversion'
    | 'rsi_macd'
    | 'combined_ml_tech';
  setBtStrategy: (
    s: 'ml_model' | 'sma_crossover' | 'rsi_mean_reversion' | 'rsi_macd' | 'combined_ml_tech',
  ) => void;
  btStartDate: string;
  setBtStartDate: (d: string) => void;
  btEndDate: string;
  setBtEndDate: (d: string) => void;
  btCapital: number;
  setBtCapital: (c: number) => void;
  btBrokerage: number;
  setBtBrokerage: (b: number) => void;
  btSlippage: number;
  setBtSlippage: (s: number) => void;
  btBuyThreshold: number;
  setBtBuyThreshold: (t: number) => void;
  btLoading: boolean;
  btResult: BacktestResult | null;
  btError: string | null;
  onRunBacktest: (e: React.FormEvent, experimentId?: string | null) => void;
  experimentsVersion: number;
}

export const QuantSectionsPart3: React.FC<QuantSectionsPart3Props> = ({
  activeSection,
  selectedSymbol,
  modelType,
  monitoring,
  onRefreshMonitoring,
  btStrategy,
  setBtStrategy,
  btStartDate,
  setBtStartDate,
  btEndDate,
  setBtEndDate,
  btCapital,
  setBtCapital,
  btBrokerage,
  setBtBrokerage,
  btSlippage,
  setBtSlippage,
  btBuyThreshold,
  setBtBuyThreshold,
  btLoading,
  btResult,
  btError,
  onRunBacktest,
  experimentsVersion,
}) => {
  const { t, openAiWithContext } = useAppContext();

  // Section 10: Advanced Risk Monitor
  const [riskCapital, setRiskCapital] = useState(1000000);
  const [riskPct, setRiskPct] = useState(1.5);
  const [confidenceLevel, setConfidenceLevel] = useState(0.95);
  const [holdingDays, setHoldingDays] = useState(5);
  const [useRealHoldings, setUseRealHoldings] = useState(true);
  const [customAllocRows, setCustomAllocRows] = useState<Array<{ symbol: string; weightPct: number }>>([
    { symbol: 'RELIANCE', weightPct: 40 },
    { symbol: 'TCS', weightPct: 35 },
    { symbol: 'HDFCBANK', weightPct: 25 },
  ]);
  const [advRisk, setAdvRisk] = useState<AdvancedRiskResponse | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);

  // Section 11 & 12: Experiments Registry & Backtest linking
  const [experiments, setExperiments] = useState<
    NonNullable<MonitoringStatus['trainingHistory']>
  >([]);
  const [backtests, setBacktests] = useState<
    NonNullable<MonitoringStatus['backtestHistory']>
  >([]);
  const [linkedExpId, setLinkedExpId] = useState<string>('');
  const [cmpExpA, setCmpExpA] = useState<string>('');
  const [cmpExpB, setCmpExpB] = useState<string>('');

  const loadRiskMonitor = async (realMode = useRealHoldings) => {
    setRiskLoading(true);
    try {
      const res = await api.getAdvancedRisk({
        symbol: selectedSymbol,
        capital: riskCapital,
        riskPct,
        confidenceLevel,
        holdingPeriodDays: holdingDays,
        selectedSymbols: ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK'],
        useRealInvestorHoldings: realMode,
        allocations: realMode ? undefined : customAllocRows,
      });
      setAdvRisk(res);
    } finally {
      setRiskLoading(false);
    }
  };

  const loadExperiments = async () => {
    try {
      const res = await api.getExperiments();
      setExperiments(res.experiments);
      setBacktests(res.backtests);
      if (res.experiments.length >= 1 && !cmpExpA) {
        setCmpExpA(res.experiments[0].experimentId || String(res.experiments[0].id));
      }
      if (res.experiments.length >= 2 && !cmpExpB) {
        setCmpExpB(res.experiments[1].experimentId || String(res.experiments[1].id));
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (activeSection && activeSection !== '10') return;
    loadRiskMonitor(useRealHoldings).catch(() => {});
  }, [selectedSymbol, activeSection]);

  useEffect(() => {
    if (activeSection && !['11', '12', '13'].includes(activeSection)) return;
    loadExperiments().catch(() => {});
  }, [experimentsVersion, monitoring?.trainedModelsCount, btResult, activeSection]);

  const expAObj = experiments.find((e) => (e.experimentId || String(e.id)) === cmpExpA) ?? null;
  const expBObj = experiments.find((e) => (e.experimentId || String(e.id)) === cmpExpB) ?? null;

  return (
    <div className="space-y-8">
      {/* ==================== 10. ADVANCED RISK MONITOR ==================== */}
      {(!activeSection || activeSection === '10') && (
      <section
        id="sec-10"
        aria-labelledby="sec-10-heading"
        className="scroll-mt-28 space-y-6 rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]"
      >
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between dark:border-slate-800">
          <div>
            <span className="font-mono text-xs font-bold tracking-wider text-[#782F46] dark:text-[#B76E85]">
              10. ADVANCED RISK MONITOR
            </span>
            <h2
              id="sec-10-heading"
              className="font-display text-xl font-bold text-slate-900 dark:text-white"
            >
              Historical VaR / CVaR, GARCH(1,1) Regime, ATR Sizing &amp; Portfolio Concentration ({selectedSymbol})
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <div>
              <label htmlFor="risk-cap" className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                Capital (₹)
              </label>
              <input
                id="risk-cap"
                type="number"
                step="50000"
                value={riskCapital}
                onChange={(e) => setRiskCapital(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-[#111827]"
              />
            </div>
            <div>
              <label htmlFor="risk-pct" className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                Trade Risk %
              </label>
              <input
                id="risk-pct"
                type="number"
                step="0.25"
                min="0.25"
                max="5"
                value={riskPct}
                onChange={(e) => setRiskPct(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-[#111827]"
              />
            </div>
            <div>
              <label htmlFor="risk-conf" className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                VaR Confidence
              </label>
              <select
                id="risk-conf"
                value={confidenceLevel}
                onChange={(e) => setConfidenceLevel(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-[#111827]"
              >
                <option value={0.95}>95% VaR</option>
                <option value={0.99}>99% VaR</option>
              </select>
            </div>
            <div>
              <label htmlFor="risk-days" className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                Horizon (Days)
              </label>
              <select
                id="risk-days"
                value={holdingDays}
                onChange={(e) => setHoldingDays(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-[#111827]"
              >
                <option value={1}>1 Session</option>
                <option value={5}>5 Sessions</option>
                <option value={10}>10 Sessions</option>
                <option value={21}>21 Sessions</option>
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1 flex items-end">
              <button
                type="button"
                disabled={riskLoading}
                onClick={() => loadRiskMonitor(useRealHoldings)}
                className="w-full rounded-lg bg-[#087F5B] px-3 py-2 text-xs font-semibold text-white hover:bg-[#06684A] disabled:opacity-60 dark:bg-[#34D399] dark:text-slate-950"
              >
                {riskLoading ? 'Calculating...' : 'Run Risk Engine'}
              </button>
            </div>
          </div>
        </div>

        {advRisk && (
          <div className="space-y-6">
            {/* Risk Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7 tabular-nums">
              {[
                [`Historical VaR (${(advRisk.confidenceLevel * 100).toFixed(0)}%)`, `-${advRisk.varPct.toFixed(2)}%`, formatINR(advRisk.varRupees, 0)],
                ['Expected Shortfall (CVaR)', `-${advRisk.cvarPct.toFixed(2)}%`, formatINR(advRisk.cvarRupees, 0)],
                ['Max Drawdown', `-${advRisk.maxDrawdownPct.toFixed(2)}%`, 'Peak-to-Trough'],
                ['Annual Return', formatPct(advRisk.annualizedReturnPct), `Vol ${advRisk.annualizedVolatilityPct.toFixed(1)}%`],
                ['Sharpe Ratio', advRisk.sharpeRatio.toFixed(2), 'Rf = 6.0% RBI T-Bill'],
                ['Sortino Ratio', advRisk.sortinoRatio.toFixed(2), 'Downside Dev Adjusted'],
                ['ATR Position Limit', `${advRisk.atrRisk.positionSizeShares} sh`, `Stop ${formatINR(advRisk.atrRisk.stopLoss)}`],
              ].map(([label, primary, sub]) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-200 bg-[#F8F6F0]/75 p-3 dark:border-slate-700 dark:bg-[#111827]"
                >
                  <p className="text-[10px] text-slate-500">{label}</p>
                  <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">{primary}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-slate-500 dark:text-slate-400">{sub}</p>
                </div>
              ))}
            </div>

            {/* GARCH Volatility + Portfolio Concentration Audit */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="min-w-0 rounded-xl border border-slate-200 bg-[#F8F6F0]/60 p-4 lg:col-span-6 dark:border-slate-700 dark:bg-[#111827]">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                      Conditional GARCH(1,1) Volatility Forecast ({advRisk.primarySymbol})
                    </h3>
                    <p className="font-mono text-[11px] text-slate-500">
                      α={advRisk.garch.alpha.toFixed(3)} · β={advRisk.garch.beta.toFixed(3)} · Persistence{' '}
                      {advRisk.garch.persistence.toFixed(3)} · Next-Day Annual Vol{' '}
                      {advRisk.garch.nextDayForecastAnnualVolPct.toFixed(2)}%
                    </p>
                  </div>
                </div>
                <GarchVolatilityChart garch={advRisk.garch} />
              </div>

              <div className="min-w-0 rounded-xl border border-slate-200 bg-[#F8F6F0]/60 p-4 lg:col-span-6 dark:border-slate-700 dark:bg-[#111827]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    Portfolio Concentration (HHI: {advRisk.portfolioConcentration.herfindahlIndex.toFixed(0)})
                  </h3>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setUseRealHoldings(true);
                        loadRiskMonitor(true);
                      }}
                      className={`rounded px-2 py-1 text-[11px] font-semibold ${
                        useRealHoldings
                          ? 'bg-[#087F5B] text-white dark:bg-[#34D399] dark:text-slate-950'
                          : 'border border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-[#1F2937] dark:text-slate-300'
                      }`}
                    >
                      Real SQLite Holdings
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUseRealHoldings(false);
                        loadRiskMonitor(false);
                      }}
                      className={`rounded px-2 py-1 text-[11px] font-semibold ${
                        !useRealHoldings
                          ? 'bg-[#782F46] text-white dark:bg-[#B76E85] dark:text-slate-950'
                          : 'border border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-[#1F2937] dark:text-slate-300'
                      }`}
                    >
                      Hypothetical Weights
                    </button>
                  </div>
                </div>

                <p className="mt-1 text-[11px] text-slate-500">
                  Source: <code className="font-mono">{advRisk.portfolioConcentration.source}</code> —{' '}
                  {advRisk.portfolioConcentration.sourceDescription}
                </p>

                {!useRealHoldings && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {customAllocRows.map((row, idx) => (
                      <div key={row.symbol} className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-[#1F2937]">
                        <span className="font-mono font-bold">{row.symbol}</span>
                        <input
                          type="number"
                          aria-label={`${row.symbol} weight percent`}
                          value={row.weightPct}
                          onChange={(e) => {
                            const next = [...customAllocRows];
                            next[idx] = { ...next[idx], weightPct: Number(e.target.value) };
                            setCustomAllocRows(next);
                          }}
                          className="w-12 rounded bg-transparent text-right font-mono"
                        />
                        <span>%</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left font-mono text-[11px] tabular-nums">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                        <th className="py-1.5 pr-2">Symbol</th>
                        <th className="py-1.5 pr-2">Weight %</th>
                        <th className="py-1.5 pr-2">Exposure</th>
                        <th className="py-1.5 pr-2">Ann Vol</th>
                        <th className="py-1.5">1d 95% VaR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {advRisk.portfolioConcentration.positions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-3 text-slate-500">
                            No real holdings found in SQLite investor_holdings table. Switch to &ldquo;Hypothetical Weights&rdquo; to model custom portfolio exposure.
                          </td>
                        </tr>
                      ) : (
                        advRisk.portfolioConcentration.positions.map((pos) => (
                          <tr key={pos.symbol} className="border-b border-slate-100 dark:border-slate-800">
                            <td className="py-1.5 pr-2 font-bold">{pos.symbol}</td>
                            <td className="py-1.5 pr-2">{pos.weightPct.toFixed(1)}%</td>
                            <td className="py-1.5 pr-2">{formatINR(pos.allocatedRupees, 0)}</td>
                            <td className="py-1.5 pr-2">{pos.annualVolPct.toFixed(1)}%</td>
                            <td className="py-1.5 text-[#782F46] dark:text-[#B76E85]">
                              -{formatINR(pos.var95Rupees, 0)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
      )}

      {/* ==================== 11. STRATEGY RESEARCH & BACKTESTING ==================== */}
      {(!activeSection || activeSection === '11') && (
      <section
        id="sec-11"
        aria-labelledby="sec-11-heading"
        className="scroll-mt-28 space-y-6 rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <span className="font-mono text-xs font-bold tracking-wider text-[#782F46] dark:text-[#B76E85]">
              11. STRATEGY RESEARCH &amp; BACKTESTING
            </span>
            <h2
              id="sec-11-heading"
              className="font-display text-xl font-bold text-slate-900 dark:text-white"
            >
              Chronological Strategy Backtester ({selectedSymbol})
            </h2>
          </div>
        </div>

        <form
          onSubmit={(e) => onRunBacktest(e, linkedExpId || null)}
          className="rounded-xl border border-slate-200 bg-[#F8F6F0]/60 p-4 dark:border-slate-700 dark:bg-[#111827]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Next-Session Open Execution · Realistic Brokerage + Slippage Deduction
            </p>
            <button
              type="submit"
              disabled={btLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#087F5B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#06684A] disabled:opacity-60 dark:bg-[#34D399] dark:text-slate-950"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              <span>{btLoading ? 'Simulating...' : t.runBacktestBtn}</span>
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <div className="col-span-2">
              <label htmlFor="bt-strategy" className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                Strategy Ruleset
              </label>
              <select
                id="bt-strategy"
                value={btStrategy}
                onChange={(e) => setBtStrategy(e.target.value as typeof btStrategy)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-[#1F2937] dark:text-white"
              >
                <option value="ml_model">ML Signal ({modelType})</option>
                <option value="combined_ml_tech">Combined ML + Technical Gate</option>
                <option value="sma_crossover">SMA 20 / 50 Crossover</option>
                <option value="rsi_mean_reversion">RSI(14) Mean Reversion (&lt;35 / &gt;68)</option>
                <option value="rsi_macd">RSI(14) + MACD Consensus</option>
              </select>
            </div>
            <div>
              <label htmlFor="bt-start" className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                Start Date
              </label>
              <input
                id="bt-start"
                type="date"
                value={btStartDate}
                onChange={(e) => setBtStartDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-[#1F2937]"
              />
            </div>
            <div>
              <label htmlFor="bt-end" className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                End Date
              </label>
              <input
                id="bt-end"
                type="date"
                value={btEndDate}
                onChange={(e) => setBtEndDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-[#1F2937]"
              />
            </div>
            <div>
              <label htmlFor="bt-cap" className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                Capital (₹)
              </label>
              <input
                id="bt-cap"
                type="number"
                step="50000"
                value={btCapital}
                onChange={(e) => setBtCapital(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-[#1F2937]"
              />
            </div>
            <div>
              <label htmlFor="bt-brok" className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                Brokerage (%)
              </label>
              <input
                id="bt-brok"
                type="number"
                step="0.01"
                value={btBrokerage}
                onChange={(e) => setBtBrokerage(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-[#1F2937]"
              />
            </div>
            <div>
              <label htmlFor="bt-slip" className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                Slippage (%)
              </label>
              <input
                id="bt-slip"
                type="number"
                step="0.01"
                value={btSlippage}
                onChange={(e) => setBtSlippage(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-[#1F2937]"
              />
            </div>
            <div>
              <label htmlFor="bt-thresh" className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                ML Threshold
              </label>
              <input
                id="bt-thresh"
                type="number"
                step="0.05"
                min="0.45"
                max="0.85"
                value={btBuyThreshold}
                onChange={(e) => setBtBuyThreshold(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-[#1F2937]"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label htmlFor="bt-exp-link" className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
              Link Backtest to Registry Experiment (Optional):
            </label>
            <select
              id="bt-exp-link"
              value={linkedExpId}
              onChange={(e) => setLinkedExpId(e.target.value)}
              className="w-full max-w-full sm:w-auto sm:max-w-md rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-mono text-[11px] dark:border-slate-700 dark:bg-[#1F2937]"
            >
              <option value="">None (Standalone Run)</option>
              {experiments.slice(0, 12).map((ex) => {
                const eid = ex.experimentId || `EXP-${ex.id}`;
                return (
                  <option key={ex.id} value={eid}>
                    {eid} · {ex.symbol} · {ex.modelType} ({(ex.accuracy * 100).toFixed(1)}%)
                  </option>
                );
              })}
            </select>
          </div>

          {btError && <p className="mt-2 text-xs text-[#782F46]">{btError}</p>}
        </form>

        {btResult && (
          <div className="space-y-5">
            {btResult.walkForwardLeakageFree && (
              <div className="rounded-xl border border-[#087F5B]/30 bg-[#087F5B]/10 px-4 py-2.5 text-xs font-medium text-[#087F5B] dark:border-[#34D399]/30 dark:bg-[#34D399]/10 dark:text-[#34D399]">
                Strict Chronological Walk-Forward Mode Verified ({btResult.retrainCount ?? 0} leakage-free periodic retrains — every model trained strictly on historical rows settled prior to execution date).
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6 tabular-nums">
              {[
                ['Total Return', formatPct(btResult.totalReturnPct)],
                ['Net Profit', formatINR(btResult.netProfit, 0)],
                ['Gross Profit', formatINR(btResult.grossProfit, 0)],
                ['Gross Loss', formatINR(btResult.grossLoss, 0)],
                [
                  'Profit Factor',
                  btResult.profitFactor === null ? '∞ (0 Loss)' : btResult.profitFactor.toFixed(2),
                ],
                ['Buy & Hold', formatPct(btResult.benchmarkReturnPct)],
                ['Trades (W / L)', `${btResult.numberOfTrades} (${btResult.winningTrades}W / ${btResult.losingTrades}L)`],
                ['Win Rate', `${btResult.winRatePct.toFixed(1)}%`],
                ['Avg Win / Loss', `${formatINR(btResult.avgWinningTrade, 0)} / ${formatINR(btResult.avgLosingTrade, 0)}`],
                ['Total Costs', formatINR(btResult.totalTransactionCosts, 0)],
                ['Max Drawdown', `-${btResult.maxDrawdownPct.toFixed(2)}%`],
                ['Sharpe Ratio', btResult.sharpeRatio.toFixed(2)],
              ].map(([label, val]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-[#F8F6F0]/75 p-3 dark:border-slate-700 dark:bg-[#111827]">
                  <p className="text-[10px] text-slate-500">{label}</p>
                  <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">{val}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    Equity Curve vs Buy &amp; Hold Benchmark ({btResult.strategyLabel})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {btResult.startDate} → {btResult.endDate} · Transaction Costs:{' '}
                    {formatINR(btResult.totalTransactionCosts)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    openAiWithContext(
                      {
                        title: `Backtest Result · ${btResult.symbol}`,
                        symbol: btResult.symbol,
                        data: {
                          strategy: btResult.strategyLabel,
                          totalReturnPct: btResult.totalReturnPct,
                          benchmarkReturnPct: btResult.benchmarkReturnPct,
                          sharpeRatio: btResult.sharpeRatio,
                          maxDrawdownPct: btResult.maxDrawdownPct,
                          numberOfTrades: btResult.numberOfTrades,
                        },
                      },
                      `Interpret the ${btResult.symbol} backtest (${btResult.totalReturnPct.toFixed(2)}% return vs ${btResult.benchmarkReturnPct.toFixed(2)}% buy-and-hold, Sharpe ${btResult.sharpeRatio.toFixed(2)}).`,
                    )
                  }
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#087F5B] hover:underline dark:text-[#34D399]"
                >
                  <Bot className="h-3.5 w-3.5" />
                  <span>{t.explainThis}</span>
                </button>
              </div>
              <EquityCurveChart backtest={btResult} />
              <p className="mt-2 text-[11px] text-slate-500">{btResult.assumptionsNote}</p>
            </div>

            {btResult.recentTrades.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left font-mono text-[11px] tabular-nums">
                  <thead className="bg-[#F8F6F0] text-slate-500 dark:bg-[#111827]">
                    <tr>
                      <th className="px-2.5 py-2">Entry</th>
                      <th className="px-2.5 py-2">Exit</th>
                      <th className="px-2.5 py-2">Shares</th>
                      <th className="px-2.5 py-2">Costs</th>
                      <th className="px-2.5 py-2">Net P&amp;L</th>
                      <th className="px-2.5 py-2">Return %</th>
                      <th className="px-2.5 py-2">Signal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {btResult.recentTrades.slice(0, 10).map((tr, idx) => (
                      <tr key={idx}>
                        <td className="px-2.5 py-1.5">
                          {tr.entryDate} @ {formatINR(tr.entryPrice)}
                        </td>
                        <td className="px-2.5 py-1.5">
                          {tr.exitDate} @ {formatINR(tr.exitPrice)}
                        </td>
                        <td className="px-2.5 py-1.5">{tr.shares}</td>
                        <td className="px-2.5 py-1.5">{formatINR(tr.transactionCost)}</td>
                        <td
                          className={`px-2.5 py-1.5 font-bold ${
                            tr.netPnl >= 0
                              ? 'text-[#087F5B] dark:text-[#34D399]'
                              : 'text-[#782F46] dark:text-[#B76E85]'
                          }`}
                        >
                          {formatINR(tr.netPnl)}
                        </td>
                        <td className="px-2.5 py-1.5">{formatPct(tr.returnPct)}</td>
                        <td className="px-2.5 py-1.5 text-slate-500">{tr.signalReason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
      )}

      {/* ==================== 12. MODEL REGISTRY & EXPERIMENT HISTORY ==================== */}
      {(!activeSection || activeSection === '12') && (
      <section
        id="sec-12"
        aria-labelledby="sec-12-heading"
        className="scroll-mt-28 space-y-5 rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <span className="font-mono text-xs font-bold tracking-wider text-[#782F46] dark:text-[#B76E85]">
              12. MODEL REGISTRY &amp; EXPERIMENT HISTORY
            </span>
            <h2
              id="sec-12-heading"
              className="font-display text-xl font-bold text-slate-900 dark:text-white"
            >
              SQLite Persistent Experiment Tracking &amp; Side-by-Side Run Comparison
            </h2>
          </div>
          <button
            type="button"
            onClick={() => loadExperiments()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <History className="h-3.5 w-3.5" />
            <span>Reload Registry</span>
          </button>
        </div>

        {/* Compare Any 2 Saved Experiments Side-by-Side */}
        {experiments.length >= 2 && (
          <div className="rounded-xl border border-slate-200 bg-[#F8F6F0]/75 p-4 dark:border-slate-700 dark:bg-[#111827]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                Side-by-Side Experiment Metric Delta
              </p>
              <div className="flex flex-wrap gap-2">
                <select
                  aria-label="Experiment A"
                  value={cmpExpA}
                  onChange={(e) => setCmpExpA(e.target.value)}
                  className="w-full max-w-full sm:w-auto sm:max-w-xs rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-mono text-[11px] dark:border-slate-700 dark:bg-[#1F2937]"
                >
                  {experiments.map((ex) => {
                    const eid = ex.experimentId || String(ex.id);
                    return (
                      <option key={ex.id} value={eid}>
                        {eid} ({ex.symbol} · {ex.modelType})
                      </option>
                    );
                  })}
                </select>
                <span className="self-center text-xs text-slate-500">vs</span>
                <select
                  aria-label="Experiment B"
                  value={cmpExpB}
                  onChange={(e) => setCmpExpB(e.target.value)}
                  className="w-full max-w-full sm:w-auto sm:max-w-xs rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-mono text-[11px] dark:border-slate-700 dark:bg-[#1F2937]"
                >
                  {experiments.map((ex) => {
                    const eid = ex.experimentId || String(ex.id);
                    return (
                      <option key={ex.id} value={eid}>
                        {eid} ({ex.symbol} · {ex.modelType})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {expAObj && expBObj && (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono text-xs tabular-nums">
                {[
                  ['Accuracy', expAObj.accuracy, expBObj.accuracy],
                  ['Precision', expAObj.precisionScore, expBObj.precisionScore],
                  ['Recall', expAObj.recallScore, expBObj.recallScore],
                  ['F1 Score', expAObj.f1Score, expBObj.f1Score],
                ].map(([label, a, b]) => {
                  const delta = (Number(a) - Number(b)) * 100;
                  return (
                    <div key={String(label)} className="rounded-lg bg-white p-2.5 dark:bg-[#1F2937]">
                      <p className="text-[10px] text-slate-500">{label} (A vs B)</p>
                      <p className="mt-0.5 font-bold">
                        {(Number(a) * 100).toFixed(1)}% vs {(Number(b) * 100).toFixed(1)}%
                      </p>
                      <p
                        className={`text-[11px] font-bold ${
                          delta >= 0
                            ? 'text-[#087F5B] dark:text-[#34D399]'
                            : 'text-[#782F46] dark:text-[#B76E85]'
                        }`}
                      >
                        Δ {delta >= 0 ? '+' : ''}
                        {delta.toFixed(2)}%
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Experiments Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-left font-mono text-[11px] tabular-nums">
            <thead className="bg-[#F8F6F0] text-slate-500 dark:bg-[#111827]">
              <tr>
                <th className="px-2.5 py-2">Experiment ID</th>
                <th className="px-2.5 py-2">Symbol</th>
                <th className="px-2.5 py-2">Model</th>
                <th className="px-2.5 py-2">Test Span</th>
                <th className="px-2.5 py-2">Acc / F1</th>
                <th className="px-2.5 py-2">Status</th>
                <th className="px-2.5 py-2">Linked BT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {experiments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-slate-500">
                    Train a model or run Grid Search in Section 06 to record persistent SQLite experiments.
                  </td>
                </tr>
              ) : (
                experiments.slice(0, 15).map((ex) => (
                  <tr key={ex.id}>
                    <td className="px-2.5 py-1.5 font-bold text-[#087F5B] dark:text-[#34D399]">
                      {ex.experimentId || `EXP-${ex.id}`}
                    </td>
                    <td className="px-2.5 py-1.5">{ex.symbol}</td>
                    <td className="px-2.5 py-1.5">{ex.modelType}</td>
                    <td className="px-2.5 py-1.5 text-slate-500">{ex.testDateRange || 'Chronological 20%'}</td>
                    <td className="px-2.5 py-1.5">
                      {(ex.accuracy * 100).toFixed(1)}% / {(ex.f1Score * 100).toFixed(1)}%
                    </td>
                    <td className="px-2.5 py-1.5">{ex.status || 'COMPLETED'}</td>
                    <td className="px-2.5 py-1.5">
                      {ex.backtestRunId ? `#${ex.backtestRunId}` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {/* ==================== 13. LIVE SYSTEM MONITORING ==================== */}
      {(!activeSection || activeSection === '13') && (
      <section
        id="sec-13"
        aria-labelledby="sec-13-heading"
        className="scroll-mt-28 rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <span className="font-mono text-xs font-bold tracking-wider text-[#782F46] dark:text-[#B76E85]">
              13. LIVE SYSTEM MONITORING
            </span>
            <h2
              id="sec-13-heading"
              className="font-display text-xl font-bold text-slate-900 dark:text-white"
            >
              Backend Telemetry, Inference Latency &amp; SQLite Audit Logs
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onRefreshMonitoring()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#087F5B] hover:underline dark:text-[#34D399]"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Refresh Metrics</span>
          </button>
        </div>

        {monitoring && (
          <>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 text-xs tabular-nums">
              <div className="rounded-xl bg-[#F8F6F0] p-4 dark:bg-[#111827]">
                <p className="text-slate-500 dark:text-slate-400">Dataset Loading Status</p>
                <p className="mt-1 font-mono font-bold text-[#087F5B] dark:text-[#34D399]">
                  {monitoring.datasetStatus} ({monitoring.datasetLoadDurationMs} ms)
                </p>
              </div>
              <div className="rounded-xl bg-[#F8F6F0] p-4 dark:bg-[#111827]">
                <p className="text-slate-500 dark:text-slate-400">Pipeline &amp; Trained Models</p>
                <p className="mt-1 font-mono font-bold text-slate-900 dark:text-white">
                  {monitoring.pipelineStatus} · {monitoring.trainedModelsCount} active models
                </p>
              </div>
              <div className="rounded-xl bg-[#F8F6F0] p-4 dark:bg-[#111827]">
                <p className="text-slate-500 dark:text-slate-400">Measured Inference Latency</p>
                <p className="mt-1 font-mono font-bold text-slate-900 dark:text-white">
                  {monitoring.lastInferenceLatencyMs !== null
                    ? `${monitoring.lastInferenceLatencyMs} ms`
                    : 'No inference run yet'}
                </p>
              </div>
              <div className="rounded-xl bg-[#F8F6F0] p-4 dark:bg-[#111827]">
                <p className="text-slate-500 dark:text-slate-400">Last Training Timestamp</p>
                <p className="mt-1 font-mono font-semibold text-slate-900 dark:text-white">
                  {monitoring.lastTrainingTimestamp ?? '—'}
                </p>
              </div>
              <div className="rounded-xl bg-[#F8F6F0] p-4 dark:bg-[#111827]">
                <p className="text-slate-500 dark:text-slate-400">Last Prediction Timestamp</p>
                <p className="mt-1 font-mono font-semibold text-slate-900 dark:text-white">
                  {monitoring.lastPredictionTimestamp ?? '—'}
                </p>
              </div>
              <div className="rounded-xl bg-[#F8F6F0] p-4 dark:bg-[#111827]">
                <p className="text-slate-500 dark:text-slate-400">Backtest Status</p>
                <p className="mt-1 font-mono font-semibold text-slate-900 dark:text-white">
                  {monitoring.lastBacktestStatus}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Backend Error Log ({monitoring.recentErrors.length})
              </h3>
              {monitoring.recentErrors.length === 0 ? (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Zero backend errors recorded in current session.
                </p>
              ) : (
                <ul className="mt-2 space-y-1 font-mono text-xs text-[#782F46] dark:text-[#B76E85]">
                  {monitoring.recentErrors.map((e, idx) => (
                    <li key={idx}>
                      [{e.timestamp}] {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Recent SQLite Backtest Audit Log Summary */}
            <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Recent SQLite Backtest Audit Log ({backtests.length})
              </h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left font-mono text-[11px] tabular-nums">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                      <th className="py-1.5 pr-2">Run Code</th>
                      <th className="py-1.5 pr-2">Symbol</th>
                      <th className="py-1.5 pr-2">Strategy</th>
                      <th className="py-1.5 pr-2">Return</th>
                      <th className="py-1.5 pr-2">Sharpe</th>
                      <th className="py-1.5">By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {backtests.slice(0, 8).map((run) => (
                      <tr key={run.id}>
                        <td className="py-1.5 pr-2 font-bold">{run.runCode || `BT-${run.id}`}</td>
                        <td className="py-1.5 pr-2">{run.symbol}</td>
                        <td className="py-1.5 pr-2 max-w-[160px] truncate">{run.strategy}</td>
                        <td className="py-1.5 pr-2">{formatPct(run.totalReturnPct)}</td>
                        <td className="py-1.5 pr-2">{run.sharpeRatio.toFixed(2)}</td>
                        <td className="py-1.5 text-slate-500">{run.triggeredBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>
      )}
    </div>
  );
};
