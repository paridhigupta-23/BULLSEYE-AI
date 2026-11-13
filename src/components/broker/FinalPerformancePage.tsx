import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Cpu,
  Gauge,
  ReceiptIndianRupee,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import { api } from '../../services/api.ts';
import {
  formatINR,
  formatPct,
  type BacktestResult,
  type FinalPerformanceResponse,
  type ModelType,
} from '../../types/index.ts';

interface FinalPerformancePageProps {
  selectedSymbol: string;
  modelType: ModelType;
  setModelType: (m: ModelType) => void;
  btResult: BacktestResult | null;
  experimentsVersion: number;
  onJumpToSection: (sectionNum: string) => void;
}

export const FinalPerformancePage: React.FC<FinalPerformancePageProps> = ({
  selectedSymbol,
  modelType,
  setModelType,
  btResult,
  experimentsVersion,
  onJumpToSection,
}) => {
  const [data, setData] = useState<FinalPerformanceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getFinalPerformance(selectedSymbol, modelType, 0.95, 5);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load final performance report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary().catch(() => {});
  }, [selectedSymbol, modelType, experimentsVersion, btResult]);

  const mp = data?.modelPerformance ?? null;
  const tp = data?.tradingPerformance ?? null;
  const rk = data?.risk ?? null;
  const ef = data?.efficiency ?? null;
  const tc = data?.transactionCosts ?? null;

  return (
    <div className="space-y-6 pb-12" data-testid="final-performance-page">
      {/* Header & Benchmark Controls */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-[#1F2937]">
        <div>
          <span className="font-mono text-xs font-bold tracking-wider text-[#782F46] dark:text-[#B76E85]">
            CONSOLIDATED RESEARCH SUMMARY
          </span>
          <h2 className="mt-1 font-display text-xl font-bold text-slate-900 dark:text-white">
            Final Quantitative Performance Report — {selectedSymbol}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Audited out-of-sample model evaluation, chronological backtest accounting, real historical tail risk, and measured backend inference throughput.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <select
            aria-label="Final performance model filter"
            value={modelType}
            onChange={(e) => setModelType(e.target.value as ModelType)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
          >
            <option value="logistic_regression">Logistic Regression</option>
            <option value="random_forest">Random Forest</option>
            <option value="gradient_boosting">Gradient Boosting</option>
            <option value="sequence_mlp">Sequence MLP</option>
          </select>

          <button
            type="button"
            disabled={loading}
            onClick={() => loadSummary()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#087F5B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#06684A] disabled:opacity-60 dark:bg-[#34D399] dark:text-slate-950"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Benchmarking...' : 'Recalculate Benchmark'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-[#782F46]/40 bg-[#782F46]/10 p-4 text-xs font-medium text-[#782F46] dark:border-[#B76E85]/40 dark:text-[#FBCFE8]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. MODEL PERFORMANCE */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-[#087F5B] dark:text-[#34D399]" />
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              1. Model Performance (Out-of-Sample Evaluation)
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onJumpToSection('06')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#087F5B] hover:underline dark:text-[#34D399]"
          >
            <span>Open Section 06 (Train &amp; Compare)</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {data && !data.hasModelData ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-[#F8F6F0] p-5 text-xs text-slate-600 dark:border-slate-700 dark:bg-[#111827] dark:text-slate-300">
            <p className="font-semibold text-slate-900 dark:text-white">
              No trained model artifact found for {selectedSymbol} ({modelType}).
            </p>
            <p className="mt-1">
              Train a model in Section 06 to measure real out-of-sample Accuracy, Precision, Recall, F1 Score, Confusion Matrix, and Inference Latency. Metrics are never fabricated when unavailable.
            </p>
            <button
              type="button"
              onClick={() => onJumpToSection('06')}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#087F5B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#06684A] dark:bg-[#34D399] dark:text-slate-950"
            >
              <span>Go to 06. Train &amp; Compare</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          mp &&
          mp.confusionMatrix && (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
                <span>
                  Active Model: <strong className="text-slate-900 dark:text-white">{mp.modelLabel}</strong>
                </span>
                <span className="font-mono">
                  Train: {mp.trainDateRange ?? '—'} ({mp.trainSize ?? 0} rows) · Test:{' '}
                  {mp.testDateRange ?? '—'} ({mp.testSize ?? 0} rows)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 tabular-nums">
                {[
                  ['Accuracy', `${((mp.accuracy ?? 0) * 100).toFixed(2)}%`],
                  ['Precision', `${((mp.precision ?? 0) * 100).toFixed(2)}%`],
                  ['Recall', `${((mp.recall ?? 0) * 100).toFixed(2)}%`],
                  ['F1 Score', `${((mp.f1Score ?? 0) * 100).toFixed(2)}%`],
                ].map(([label, val]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-slate-200 bg-[#F8F6F0]/75 p-3.5 dark:border-slate-700 dark:bg-[#111827]"
                  >
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="mt-1 font-mono text-lg font-bold text-slate-900 dark:text-white">{val}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 text-center font-mono text-xs sm:grid-cols-4 tabular-nums">
                <div className="rounded-xl border border-[#087F5B]/30 bg-[#087F5B]/10 p-3 dark:bg-[#34D399]/10">
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400">True Neg (TN)</span>
                  <span className="mt-0.5 block text-base font-bold text-[#087F5B] dark:text-[#34D399]">
                    {mp.confusionMatrix.tn}
                  </span>
                </div>
                <div className="rounded-xl border border-[#782F46]/30 bg-[#782F46]/10 p-3 dark:bg-[#B76E85]/10">
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400">False Pos (FP)</span>
                  <span className="mt-0.5 block text-base font-bold text-[#782F46] dark:text-[#B76E85]">
                    {mp.confusionMatrix.fp}
                  </span>
                </div>
                <div className="rounded-xl border border-[#782F46]/30 bg-[#782F46]/10 p-3 dark:bg-[#B76E85]/10">
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400">False Neg (FN)</span>
                  <span className="mt-0.5 block text-base font-bold text-[#782F46] dark:text-[#B76E85]">
                    {mp.confusionMatrix.fn}
                  </span>
                </div>
                <div className="rounded-xl border border-[#087F5B]/30 bg-[#087F5B]/10 p-3 dark:bg-[#34D399]/10">
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400">True Pos (TP)</span>
                  <span className="mt-0.5 block text-base font-bold text-[#087F5B] dark:text-[#34D399]">
                    {mp.confusionMatrix.tp}
                  </span>
                </div>
              </div>
            </div>
          )
        )}
      </section>

      {/* 2. TRADING PERFORMANCE */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#087F5B] dark:text-[#34D399]" />
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              2. Trading Performance (Chronological Strategy Backtest)
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onJumpToSection('11')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#087F5B] hover:underline dark:text-[#34D399]"
          >
            <span>Open Section 11 (Backtest)</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {data && !data.hasBacktestData ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-[#F8F6F0] p-5 text-xs text-slate-600 dark:border-slate-700 dark:bg-[#111827] dark:text-slate-300">
            <p className="font-semibold text-slate-900 dark:text-white">
              No backtest run recorded yet for {selectedSymbol} in SQLite.
            </p>
            <p className="mt-1">
              Run a chronological backtest in Section 11 to populate Net Profit, ROI, Win Rate, Profit Factor, Average Win/Loss, and Transaction Cost breakdown.
            </p>
            <button
              type="button"
              onClick={() => onJumpToSection('11')}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#087F5B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#06684A] dark:bg-[#34D399] dark:text-slate-950"
            >
              <span>Go to 11. Backtest</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          tp &&
          data?.hasBacktestData && (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
                <span>
                  Strategy: <strong className="text-slate-900 dark:text-white">{tp.strategy}</strong>
                  {tp.runCode ? ` (${tp.runCode})` : ''}
                </span>
                <span className="font-mono">
                  {tp.startDate ?? '—'} → {tp.endDate ?? '—'} ·{' '}
                  {tp.walkForwardLeakageFree
                    ? `Walk-Forward Zero-Leakage (${tp.retrainCount ?? 0} retrains)`
                    : 'Rule-Based Execution'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 tabular-nums">
                {[
                  ['Initial Capital', tp.initialCapital !== null ? formatINR(tp.initialCapital, 0) : '—'],
                  ['Final Equity', tp.finalEquity !== null ? formatINR(tp.finalEquity, 0) : '—'],
                  ['Net Profit', tp.netProfit !== null ? formatINR(tp.netProfit, 0) : '—'],
                  ['ROI (%)', tp.roiPct !== null ? formatPct(tp.roiPct) : '—'],
                  ['Buy & Hold', tp.benchmarkReturnPct !== null ? formatPct(tp.benchmarkReturnPct) : '—'],
                  ['Win Rate', tp.winRatePct !== null ? `${tp.winRatePct.toFixed(1)}%` : '—'],
                  [
                    'Profit Factor',
                    tp.profitFactor === null ? '∞ (0 Loss)' : tp.profitFactor.toFixed(2),
                  ],
                  ['Total Trades', String(tp.totalTrades ?? 0)],
                  ['Winning Trades', String(tp.winningTrades ?? 0)],
                  ['Losing Trades', String(tp.losingTrades ?? 0)],
                  ['Avg Win / Trade', tp.avgWinningTrade !== null ? formatINR(tp.avgWinningTrade, 0) : '—'],
                  ['Avg Loss / Trade', tp.avgLosingTrade !== null ? formatINR(tp.avgLosingTrade, 0) : '—'],
                ].map(([label, val]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-slate-200 bg-[#F8F6F0]/75 p-3 dark:border-slate-700 dark:bg-[#111827]"
                  >
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">{val}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </section>

      {/* 3. RISK & 4. EFFICIENCY */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* 3. Risk */}
        <section className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-6 dark:border-slate-800 dark:bg-[#1F2937]">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-[#782F46] dark:text-[#B76E85]" />
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                3. Risk Metrics ({selectedSymbol})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onJumpToSection('10')}
              className="text-xs font-semibold text-[#087F5B] hover:underline dark:text-[#34D399]"
            >
              10. Risk Engine →
            </button>
          </div>

          {rk && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 tabular-nums">
              {[
                ['Max Drawdown (Hist)', `-${rk.maxDrawdownPct.toFixed(2)}%`],
                ['Annual Volatility', `${rk.annualizedVolatilityPct.toFixed(2)}%`],
                ['Sharpe (Rf=6.0%)', rk.sharpeRatio.toFixed(2)],
                [
                  'Backtest Sharpe',
                  rk.backtestSharpeRatio !== null ? rk.backtestSharpeRatio.toFixed(2) : 'Pending BT',
                ],
                [
                  `Historical VaR (${(rk.confidenceLevel * 100).toFixed(0)}%)`,
                  `-${rk.historicalVarPct.toFixed(2)}%`,
                ],
                ['CVaR (Expected Shortfall)', `-${rk.historicalCvarPct.toFixed(2)}%`],
              ].map(([label, val]) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-200 bg-[#F8F6F0]/75 p-3 dark:border-slate-700 dark:bg-[#111827]"
                >
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
                  <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">{val}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 4. Efficiency */}
        <section className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-6 dark:border-slate-800 dark:bg-[#1F2937]">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-[#087F5B] dark:text-[#34D399]" />
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                4. Runtime Efficiency &amp; Throughput
              </h3>
            </div>
            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              {ef && ef.measuredSampleCount > 0 ? `${ef.measuredSampleCount} inferences sampled` : ''}
            </span>
          </div>

          {ef && ef.avgInferenceLatencyMs !== null ? (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 tabular-nums">
                {[
                  ['Training Duration', `${ef.trainingDurationMs ?? 0} ms`],
                  ['Avg Inference Latency', `${ef.avgInferenceLatencyMs.toFixed(4)} ms`],
                  ['Min Inference Latency', `${(ef.minInferenceLatencyMs ?? 0).toFixed(4)} ms`],
                  ['Max Inference Latency', `${(ef.maxInferenceLatencyMs ?? 0).toFixed(4)} ms`],
                  ['Throughput', `${(ef.throughputPredictionsPerSec ?? 0).toLocaleString('en-IN')} pred/s`],
                  ['Measurement Mode', 'Live Server Hrtime'],
                ].map(([label, val]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-slate-200 bg-[#F8F6F0]/75 p-3 dark:border-slate-700 dark:bg-[#111827]"
                  >
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">{val}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{ef.measurementMethod}</p>
            </div>
          ) : (
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              Train a model for {selectedSymbol} in Section 06 to measure real training duration, min/avg/max inference latency, and throughput.
            </p>
          )}
        </section>
      </div>

      {/* 5. TRANSACTION COSTS */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ReceiptIndianRupee className="h-4 w-4 text-[#087F5B] dark:text-[#34D399]" />
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              5. Transaction Costs &amp; Gross-to-Net Reconciliation
            </h3>
          </div>
          {tc && tc.brokeragePct !== null && (
            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
              Brokerage {tc.brokeragePct}% · Slippage {tc.slippagePct ?? 0}% per side
            </span>
          )}
        </div>

        {data?.hasBacktestData && tc ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 tabular-nums">
            {[
              ['Brokerage (%)', tc.brokeragePct !== null ? `${tc.brokeragePct.toFixed(2)}%` : '—'],
              ['Slippage (%)', tc.slippagePct !== null ? `${tc.slippagePct.toFixed(2)}%` : '—'],
              [
                'Total Txn Costs',
                tc.totalTransactionCosts !== null ? formatINR(tc.totalTransactionCosts, 2) : '—',
              ],
              ['Gross Profit (Wins)', tc.grossProfit !== null ? formatINR(tc.grossProfit, 2) : '—'],
              ['Gross Loss (Losses)', tc.grossLoss !== null ? formatINR(tc.grossLoss, 2) : '—'],
              ['Net Profit (After Costs)', tc.netProfit !== null ? formatINR(tc.netProfit, 2) : '—'],
            ].map(([label, val]) => (
              <div
                key={label}
                className="rounded-xl border border-slate-200 bg-[#F8F6F0]/75 p-3 dark:border-slate-700 dark:bg-[#111827]"
              >
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
                <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">{val}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Execute a backtest in Section 11 to view per-trade brokerage, slippage, gross profit, gross loss, and net P&amp;L reconciliation.
          </p>
        )}
      </section>
    </div>
  );
};
