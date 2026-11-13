import React, { useEffect, useState } from 'react';
import {
  Activity,
  Bot,
  CheckCircle2,
  Cpu,
  Database,
  LogOut,
  Play,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext.tsx';
import { api } from '../services/api.ts';
import {
  formatINR,
  formatPct,
  type BacktestResult,
  type ModelType,
  type MonitoringStatus,
  type PipelineStage,
  type StockDetailResponse,
  type StockSummary,
  type TrainedModelSummary,
  type ValidationReport,
} from '../types/index.ts';
import {
  ContributionChart,
  EquityCurveChart,
  GarchVolatilityChart,
} from './charts/IndicatorCharts.tsx';

interface BrokerPortalProps {
  stocks: StockSummary[];
  onRefreshStocks: () => void;
}

type QuantTab = 'pipeline' | 'ml' | 'volatility' | 'backtest' | 'monitoring';

export const BrokerPortal: React.FC<BrokerPortalProps> = ({ stocks, onRefreshStocks }) => {
  const { selectedSymbol, setSelectedSymbol, t, openAiWithContext, user, logoutUser } =
    useAppContext();

  const [activeTab, setActiveTab] = useState<QuantTab>('pipeline');
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [loadDurationMs, setLoadDurationMs] = useState<number>(0);
  const [reloadingPipeline, setReloadingPipeline] = useState(false);

  const [detail, setDetail] = useState<StockDetailResponse | null>(null);
  const [modelType, setModelType] = useState<ModelType>('logistic_regression');
  const [splitRatio, setSplitRatio] = useState<number>(0.8);
  const [threshold, setThreshold] = useState<number>(0.75);
  const [training, setTraining] = useState(false);
  const [activeArtifact, setActiveArtifact] = useState<TrainedModelSummary | null>(null);

  // Backtesting state
  const [btStrategy, setBtStrategy] = useState<'ml_model' | 'sma_crossover' | 'rsi_mean_reversion'>('ml_model');
  const [btStartDate, setBtStartDate] = useState('2023-01-01');
  const [btEndDate, setBtEndDate] = useState('2025-09-29');
  const [btCapital, setBtCapital] = useState(1000000);
  const [btBrokerage, setBtBrokerage] = useState(0.05);
  const [btSlippage, setBtSlippage] = useState(0.02);
  const [btBuyThreshold, setBtBuyThreshold] = useState(0.55);
  const [btLoading, setBtLoading] = useState(false);
  const [btResult, setBtResult] = useState<BacktestResult | null>(null);
  const [btError, setBtError] = useState<string | null>(null);

  // Monitoring state
  const [monitoring, setMonitoring] = useState<MonitoringStatus | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadDatasetInfo = async () => {
    const res = await api.getDatasetSummary();
    setValidation(res.validation);
    setPipelineStages(res.pipelineStages);
    setLoadDurationMs(res.loadDurationMs);
  };

  const loadMonitoring = async () => {
    const m = await api.getMonitoring();
    setMonitoring(m);
  };

  const loadStockQuant = async (sym: string, mType: ModelType, thresh: number) => {
    const res = await api.getStockDetail(sym, '1Y', mType, thresh);
    setDetail(res);
    const matchingModel = res.trainedModels.find((m) => m.modelType === mType) ?? res.trainedModels[0] ?? null;
    setActiveArtifact(matchingModel);
  };

  useEffect(() => {
    loadDatasetInfo().catch(() => {});
    loadMonitoring().catch(() => {});
  }, []);

  useEffect(() => {
    loadStockQuant(selectedSymbol, modelType, threshold).catch(() => {});
  }, [selectedSymbol, modelType, threshold]);

  const handleRefreshPipeline = async () => {
    setReloadingPipeline(true);
    setStatusMessage(null);
    try {
      const res = await api.reloadDataset();
      setValidation(res.validation);
      setPipelineStages(res.pipelineStages);
      setLoadDurationMs(res.loadDurationMs);
      setStatusMessage(`Dataset re-ingested and validated in ${res.loadDurationMs} ms.`);
      await loadMonitoring();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Pipeline reload failed');
    } finally {
      setReloadingPipeline(false);
    }
  };

  const handleTrainModel = async () => {
    setTraining(true);
    setStatusMessage(null);
    try {
      const res = await api.trainModel(selectedSymbol, modelType, splitRatio, threshold);
      setActiveArtifact(res.artifact);
      await loadStockQuant(selectedSymbol, modelType, threshold);
      await loadMonitoring();
      onRefreshStocks();
      setStatusMessage(
        `Trained ${res.artifact.modelLabel} on ${selectedSymbol} (${res.artifact.trainSize} train / ${res.artifact.testSize} test rows) in ${res.artifact.trainingDurationMs} ms.`,
      );
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Training failed');
    } finally {
      setTraining(false);
    }
  };

  const handleRunBacktest = async (e: React.FormEvent) => {
    e.preventDefault();
    setBtLoading(true);
    setBtError(null);
    try {
      const res = await api.runBacktest({
        symbol: selectedSymbol,
        strategy: btStrategy,
        modelType,
        startDate: btStartDate,
        endDate: btEndDate,
        initialCapital: btCapital,
        brokeragePct: btBrokerage,
        slippagePct: btSlippage,
        buyThreshold: btBuyThreshold,
      });
      setBtResult(res);
      await loadMonitoring();
    } catch (err) {
      setBtError(err instanceof Error ? err.message : 'Backtest failed');
    } finally {
      setBtLoading(false);
    }
  };

  const latestFeat = detail?.latestFeatures as Record<string, number> | undefined;

  const featureFormulas = latestFeat
    ? [
        {
          name: 'Daily Return',
          formula: '(Close_t − Close_{t−1}) / Close_{t−1}',
          value: formatPct(Number(latestFeat.daily_return) * 100),
          period: '1 trading day',
          desc: 'Percentage session close-to-close return.',
        },
        {
          name: 'SMA (20 & 50)',
          formula: '(1/n) · Σ Close_{t−i}',
          value: `${formatINR(Number(latestFeat.sma_20))} / ${formatINR(Number(latestFeat.sma_50))}`,
          period: '20 & 50 sessions',
          desc: 'Unweighted rolling closing price averages.',
        },
        {
          name: 'EMA (12 & 26)',
          formula: 'Price·k + EMA_{t−1}·(1−k), k = 2/(n+1)',
          value: `${formatINR(Number(latestFeat.ema_12))} / ${formatINR(Number(latestFeat.ema_26))}`,
          period: '12 & 26 spans',
          desc: 'Exponentially weighted averages emphasizing recent sessions.',
        },
        {
          name: 'RSI (14)',
          formula: '100 − [100 / (1 + AvgGain / AvgLoss)]',
          value: Number(latestFeat.rsi_14).toFixed(2),
          period: '14 sessions (Wilder)',
          desc: 'Momentum oscillator scaling gains vs losses (0–100).',
        },
        {
          name: 'MACD & Signal',
          formula: 'MACD = EMA(12) − EMA(26); Signal = EMA_9(MACD)',
          value: `${Number(latestFeat.macd).toFixed(2)} / ${Number(latestFeat.macd_signal).toFixed(2)}`,
          period: '12 / 26 / 9',
          desc: 'Trend-following momentum convergence/divergence.',
        },
        {
          name: 'Bollinger Bands',
          formula: 'SMA(20) ± 2 · σ_{20}',
          value: `${formatINR(Number(latestFeat.bb_lower))} – ${formatINR(Number(latestFeat.bb_upper))}`,
          period: '20 sessions · 2σ',
          desc: 'Dynamic volatility envelope around SMA 20.',
        },
        {
          name: 'ATR (14)',
          formula: 'SMA_14(max(H−L, |H−C_{t−1}|, |L−C_{t−1}|))',
          value: formatINR(Number(latestFeat.atr_14)),
          period: '14 sessions',
          desc: 'Average True Range measuring absolute daily price volatility.',
        },
        {
          name: 'Volume Ratio',
          formula: 'Volume_t / SMA_20(Volume)',
          value: `${Number(latestFeat.volume_ratio).toFixed(2)}x`,
          period: '20 sessions',
          desc: 'Current session volume relative to 20-day average liquidity.',
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header & Stock Selector */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between dark:border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-[#782F46] dark:text-[#B76E85]">
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
            {t.brokerHeading}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t.brokerSubheading}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="broker-stock-select" className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Research Equity:
          </label>
          <select
            id="broker-stock-select"
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-[#1F2937] dark:text-white"
          >
            {stocks.map((s) => (
              <option key={s.symbol} value={s.symbol}>
                {s.symbol} — {s.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={reloadingPipeline}
            onClick={handleRefreshPipeline}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#1F2937] dark:text-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${reloadingPipeline ? 'animate-spin' : ''}`} />
            <span>{t.executePipelineBtn}</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          role="status"
          className="rounded-xl border border-[#087F5B]/30 bg-[#087F5B]/10 px-4 py-2.5 text-xs font-medium text-[#087F5B] dark:border-[#34D399]/30 dark:bg-[#34D399]/10 dark:text-[#34D399]"
        >
          {statusMessage}
        </div>
      )}

      {/* A. Quant Dashboard Summary KPIs */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-6 tabular-nums">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 dark:border-slate-800 dark:bg-[#1F2937]">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Raw OHLCV Rows</p>
          <p className="mt-1 font-mono text-lg font-bold text-slate-900 dark:text-white" data-testid="quant-combined-rows">
            {validation ? validation.combinedTotalRows.toLocaleString('en-IN') : '—'}
          </p>
          <p className="mt-0.5 text-[11px] text-[#087F5B] dark:text-[#34D399]">
            {validation ? `${validation.combinedUniqueStocks} stocks` : 'Loading'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 dark:border-slate-800 dark:bg-[#1F2937]">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Feature Rows</p>
          <p className="mt-1 font-mono text-lg font-bold text-slate-900 dark:text-white">
            {validation ? validation.featuresTotalRows.toLocaleString('en-IN') : '—'}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {validation ? `${validation.featuresColumns.length} columns` : ''}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 dark:border-slate-800 dark:bg-[#1F2937]">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Dataset Date Span</p>
          <p className="mt-1 font-mono text-xs font-bold text-slate-900 dark:text-white">
            {validation ? `${validation.combinedDateRange.start}` : '—'}
          </p>
          <p className="mt-0.5 font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">
            to {validation ? validation.combinedDateRange.end : '—'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 dark:border-slate-800 dark:bg-[#1F2937]">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Validation Integrity</p>
          <p className="mt-1 font-mono text-sm font-bold text-[#087F5B] dark:text-[#34D399]">
            {validation ? `${validation.combinedDuplicates} Dup · ${validation.combinedInvalidRecords} Inv` : '—'}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Zero-Leakage Verified</p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 dark:border-slate-800 dark:bg-[#1F2937]">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Active Equity &amp; Model</p>
          <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
            {selectedSymbol}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
            {activeArtifact ? activeArtifact.modelLabel : 'Not trained yet'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 dark:border-slate-800 dark:bg-[#1F2937]">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Out-of-Sample Accuracy</p>
          <p className="mt-1 font-mono text-lg font-bold text-slate-900 dark:text-white">
            {activeArtifact ? `${(activeArtifact.evaluation.accuracy * 100).toFixed(2)}%` : 'N/A'}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
            {activeArtifact ? `F1 ${(activeArtifact.evaluation.f1Score * 100).toFixed(1)}%` : 'Train to evaluate'}
          </p>
        </div>
      </section>

      {/* Sub-Navigation Tabs inside Broker / Quant Terminal */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        {(
          [
            ['pipeline', '1. Data Pipeline & Features', Database],
            ['ml', '2. ML Training, Inference & SHAP', Cpu],
            ['volatility', '3. GARCH(1,1) & Risk Engine', Activity],
            ['backtest', '4. Historical Backtesting', TrendingUp],
            ['monitoring', '5. System Monitoring', ShieldCheck],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === id
                ? 'bg-[#087F5B] text-white dark:bg-[#34D399] dark:text-slate-950'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#1F2937] dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: DATA PIPELINE & FEATURE ENGINEERING */}
      {activeTab === 'pipeline' && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  9-Stage Quantitative Data Pipeline
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Measured CSV ingestion &amp; validation duration: {loadDurationMs} ms · Loaded at{' '}
                  {validation?.loadedAt.slice(0, 19).replace('T', ' ')} UTC
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
              {pipelineStages.map((stage) => (
                <div
                  key={stage.id}
                  className="rounded-xl border border-slate-200 bg-[#F8F6F0]/70 p-4 dark:border-slate-700 dark:bg-[#111827]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[#782F46] dark:text-[#B76E85]">
                      Stage 0{stage.order}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[#087F5B] dark:text-[#34D399]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {stage.status.toUpperCase()}
                    </span>
                  </div>
                  <h3 className="mt-1.5 font-display text-sm font-bold text-slate-900 dark:text-white">
                    {stage.name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{stage.description}</p>
                  <div className="mt-3 space-y-1 border-t border-slate-200 pt-2 text-[11px] dark:border-slate-800">
                    <p>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Input:</span>{' '}
                      {stage.inputSummary}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Output:</span>{' '}
                      {stage.outputSummary}
                    </p>
                    {stage.executionMs > 0 && (
                      <p className="font-mono text-slate-500 dark:text-slate-400">
                        Duration: {stage.executionMs} ms
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Feature Engineering Mathematical Formulas & Live Values */}
          <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Feature Engineering Formulas &amp; Calculated Values ({selectedSymbol})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Calculated independently per stock · Latest feature date: {detail?.featureLatestDate ?? '2025-09-29'}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {featureFormulas.map((f) => (
                <div
                  key={f.name}
                  className="rounded-xl border border-slate-200 bg-[#F8F6F0]/70 p-4 dark:border-slate-700 dark:bg-[#111827]"
                >
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">{f.name}</h3>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">{f.period}</span>
                  </div>
                  <p className="mt-2 font-mono text-base font-bold tabular-nums text-[#087F5B] dark:text-[#34D399]">
                    {f.value}
                  </p>
                  <p className="mt-2 rounded bg-white px-2 py-1 font-mono text-[11px] text-slate-700 dark:bg-[#1F2937] dark:text-slate-200">
                    {f.formula}
                  </p>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: ML ENGINE, PREDICTION ENGINE & EXPLAINABILITY */}
      {activeTab === 'ml' && (
        <div className="space-y-6">
          {/* Training Controls */}
          <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:flex-1">
                <div>
                  <label htmlFor="ml-model-type" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Algorithm
                  </label>
                  <select
                    id="ml-model-type"
                    value={modelType}
                    onChange={(e) => setModelType(e.target.value as ModelType)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                  >
                    <option value="logistic_regression">Logistic Regression (L2 Baseline)</option>
                    <option value="random_forest">Random Forest (25 Decision Trees)</option>
                    <option value="gradient_boosting">Gradient Boosting (XGBoost-Style)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="ml-split" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Chronological Split
                  </label>
                  <select
                    id="ml-split"
                    value={splitRatio}
                    onChange={(e) => setSplitRatio(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                  >
                    <option value={0.7}>70% Train / 30% Test</option>
                    <option value={0.8}>80% Train / 20% Test</option>
                    <option value={0.85}>85% Train / 15% Test</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="ml-threshold" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Signal Filter Threshold ({(threshold * 100).toFixed(0)}%)
                  </label>
                  <input
                    id="ml-threshold"
                    type="range"
                    min="0.50"
                    max="0.85"
                    step="0.05"
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="mt-3 w-full accent-[#087F5B]"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={training}
                onClick={handleTrainModel}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#087F5B] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#06684A] disabled:opacity-60 dark:bg-[#34D399] dark:text-slate-950 whitespace-nowrap shrink-0"
              >
                <Play className="h-3.5 w-3.5" />
                <span>{training ? 'Training Chronologically...' : `${t.trainModelBtn} (${selectedSymbol})`}</span>
              </button>
            </div>

            {/* Anti-Leakage Disclosure */}
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Leakage Prevention: Strictly excludes <code className="font-mono">next_day_return</code> and{' '}
              <code className="font-mono">target_direction</code> from input features; fits feature standardization (μ, σ) on training fold only; never shuffles time-series rows.
            </p>
          </section>

          {/* Evaluation + Prediction Output */}
          {!activeArtifact ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-[#1F2937]">
              <p className="text-sm font-semibold text-[#782F46] dark:text-[#B76E85]">
                {t.modelNotTrainedMsg}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Click &ldquo;{t.trainModelBtn}&rdquo; above to fit {modelType} on {selectedSymbol}&apos;s chronological dataset.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* Model Evaluation & Confusion Matrix */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-7 dark:border-slate-800 dark:bg-[#1F2937]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                      Evaluation: {activeArtifact.modelLabel}
                    </h3>
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      Trained in {activeArtifact.trainingDurationMs} ms
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 tabular-nums">
                    {[
                      ['Accuracy', `${(activeArtifact.evaluation.accuracy * 100).toFixed(2)}%`],
                      ['Precision', `${(activeArtifact.evaluation.precision * 100).toFixed(2)}%`],
                      ['Recall', `${(activeArtifact.evaluation.recall * 100).toFixed(2)}%`],
                      ['F1 Score', `${(activeArtifact.evaluation.f1Score * 100).toFixed(2)}%`],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-xl bg-[#F8F6F0] p-3 dark:bg-[#111827]">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{k}</p>
                        <p className="mt-1 font-mono text-base font-bold text-slate-900 dark:text-white">{v}</p>
                      </div>
                    ))}
                  </div>

                  {/* Train/Test Split Metadata & Confusion Matrix */}
                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <p>
                        <span className="font-semibold">Train Partition:</span> {activeArtifact.trainSize} rows (
                        {activeArtifact.trainDateRange.start} → {activeArtifact.trainDateRange.end})
                      </p>
                      <p>
                        <span className="font-semibold">Test Partition:</span> {activeArtifact.testSize} rows (
                        {activeArtifact.testDateRange.start} → {activeArtifact.testDateRange.end})
                      </p>
                      <p>
                        <span className="font-semibold">Target:</span>{' '}
                        <code className="font-mono">{activeArtifact.targetVariable}</code> (1 = next_day_return &gt; 0)
                      </p>
                      <p>
                        <span className="font-semibold">Features Used:</span> {activeArtifact.featuresUsed.length} technical indicators
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700 tabular-nums">
                      <p className="mb-2 text-xs font-semibold text-slate-900 dark:text-white">
                        Out-of-Sample Confusion Matrix
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-center font-mono text-xs">
                        <div className="rounded-lg bg-[#087F5B]/10 p-2 dark:bg-[#34D399]/15">
                          <span className="block text-[10px] text-slate-500 dark:text-slate-400">True Neg (TN)</span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {activeArtifact.evaluation.confusionMatrix.tn}
                          </span>
                        </div>
                        <div className="rounded-lg bg-[#782F46]/10 p-2 dark:bg-[#B76E85]/15">
                          <span className="block text-[10px] text-slate-500 dark:text-slate-400">False Pos (FP)</span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {activeArtifact.evaluation.confusionMatrix.fp}
                          </span>
                        </div>
                        <div className="rounded-lg bg-[#782F46]/10 p-2 dark:bg-[#B76E85]/15">
                          <span className="block text-[10px] text-slate-500 dark:text-slate-400">False Neg (FN)</span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {activeArtifact.evaluation.confusionMatrix.fn}
                          </span>
                        </div>
                        <div className="rounded-lg bg-[#087F5B]/10 p-2 dark:bg-[#34D399]/15">
                          <span className="block text-[10px] text-slate-500 dark:text-slate-400">True Pos (TP)</span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {activeArtifact.evaluation.confusionMatrix.tp}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Inference Output */}
                {detail?.prediction && (
                  <div className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-5 dark:border-slate-800 dark:bg-[#1F2937]">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                        Prediction Engine Output
                      </h3>
                      <button
                        type="button"
                        onClick={() =>
                          openAiWithContext(
                            {
                              title: `Quant Prediction · ${selectedSymbol}`,
                              symbol: selectedSymbol,
                              data: {
                                model: detail.prediction.modelName,
                                accuracy: activeArtifact.evaluation.accuracy,
                                signal: detail.prediction.signal,
                                buyProbability: detail.prediction.buyProbability,
                                topFeatures: activeArtifact.featureImportance.slice(0, 5),
                              },
                            },
                            `Explain the ${detail.prediction.modelName} evaluation and signal output for ${selectedSymbol}.`,
                          )
                        }
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#087F5B] hover:underline dark:text-[#34D399]"
                      >
                        <Bot className="h-3.5 w-3.5" />
                        <span>{t.explainThis}</span>
                      </button>
                    </div>

                    <div className="mt-4 rounded-xl bg-[#F8F6F0] p-4 dark:bg-[#111827] tabular-nums">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Classification (≥{(threshold * 100).toFixed(0)}%)
                        </span>
                        <span className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
                          {detail.prediction.signal}
                        </span>
                      </div>
                      <div className="mt-3 flex justify-between text-xs">
                        <span>BUY Probability</span>
                        <span className="font-mono font-bold text-[#087F5B] dark:text-[#34D399]">
                          {((detail.prediction.buyProbability ?? 0) * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between text-xs">
                        <span>SELL Probability</span>
                        <span className="font-mono font-bold text-[#782F46] dark:text-[#B76E85]">
                          {((detail.prediction.sellProbability ?? 0) * 100).toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                      <p>
                        <span className="font-semibold">Inference Latency:</span>{' '}
                        <span className="font-mono">{detail.prediction.inferenceLatencyMs} ms</span>
                      </p>
                      <p>
                        <span className="font-semibold">Input Date:</span> {detail.prediction.predictionDate}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Experimental model output for quantitative research only — not financial advice or a guarantee of price direction.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Explainability Engine: Global Importance + Local SHAP/Attribution */}
              {detail?.prediction && (
                <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  <div className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-7 dark:border-slate-800 dark:bg-[#1F2937]">
                    <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                      Local Feature Attribution ({selectedSymbol})
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Method: {detail.prediction.explanationMethod}
                    </p>
                    <div className="mt-4">
                      <ContributionChart contributions={detail.prediction.contributions} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-5 dark:border-slate-800 dark:bg-[#1F2937]">
                    <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                      Global Feature Importance Ranking
                    </h3>
                    <div className="mt-4 space-y-2.5 tabular-nums">
                      {activeArtifact.featureImportance.slice(0, 8).map((item) => (
                        <div key={item.feature}>
                          <div className="flex justify-between text-xs">
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {item.label}
                            </span>
                            <span className="font-mono text-slate-600 dark:text-slate-400">
                              {(item.importance * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div
                              className="h-full bg-[#087F5B] dark:bg-[#34D399]"
                              style={{ width: `${Math.min(100, item.importance * 220)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 3: VOLATILITY ENGINE (GARCH 1,1) & RISK ENGINE */}
      {activeTab === 'volatility' && detail && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-8 dark:border-slate-800 dark:bg-[#1F2937]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  GARCH(1,1) Volatility Engine — {selectedSymbol}
                </h2>
                <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  σ²(t) = ω + α · ε²(t−1) + β · σ²(t−1) · {detail.garch.statusMessage}
                </p>
              </div>
            </div>

            {detail.garch.fitted ? (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5 tabular-nums">
                  <div className="rounded-xl bg-[#F8F6F0] p-3 dark:bg-[#111827]">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">ω (Omega)</p>
                    <p className="mt-1 font-mono text-xs font-bold text-slate-900 dark:text-white">
                      {detail.garch.omega.toExponential(2)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#F8F6F0] p-3 dark:bg-[#111827]">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">α (ARCH Shock)</p>
                    <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                      {detail.garch.alpha.toFixed(4)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#F8F6F0] p-3 dark:bg-[#111827]">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">β (Persistence)</p>
                    <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                      {detail.garch.beta.toFixed(4)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#F8F6F0] p-3 dark:bg-[#111827]">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Forecast Vol (Ann.)</p>
                    <p className="mt-1 font-mono text-sm font-bold text-[#782F46] dark:text-[#B76E85]">
                      {detail.garch.nextDayForecastAnnualVolPct.toFixed(2)}%
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#F8F6F0] p-3 dark:bg-[#111827]">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Long-Run Vol (Ann.)</p>
                    <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                      {detail.garch.longRunAnnualVolPct.toFixed(2)}%
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Rolling Conditional Annualized Volatility (Last 120 Sessions)
                  </p>
                  <GarchVolatilityChart garch={detail.garch} />
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-[#782F46] dark:text-[#B76E85]">
                {detail.garch.statusMessage}
              </p>
            )}
          </div>

          {/* Risk Summary */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-4 dark:border-slate-800 dark:bg-[#1F2937]">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Quant Risk Summary
            </h2>
            <div className="mt-4 space-y-3 text-xs tabular-nums">
              <div className="flex justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Latest Close ({detail.latestDate})</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {formatINR(detail.risk.entryPrice)}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">ATR (14)</span>
                <span className="font-mono font-bold">{formatINR(detail.risk.atr14)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">1.5× ATR Stop-Loss</span>
                <span className="font-mono font-bold text-[#782F46] dark:text-[#B76E85]">
                  {formatINR(detail.risk.stopLoss)}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">2:1 R:R Target</span>
                <span className="font-mono font-bold text-[#087F5B] dark:text-[#34D399]">
                  {formatINR(detail.risk.targetPrice)}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Position Size (₹1L @ 1.5% risk)</span>
                <span className="font-mono font-bold">{detail.risk.positionSizeShares} shares</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Volatility Category</span>
                <span className="font-mono font-bold">{detail.risk.volatilityCategory}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: HISTORICAL BACKTESTING ENGINE */}
      {activeTab === 'backtest' && (
        <div className="space-y-6">
          <form
            onSubmit={handleRunBacktest}
            className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Chronological Backtesting Configuration ({selectedSymbol})
              </h2>
              <button
                type="submit"
                disabled={btLoading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#087F5B] px-5 py-2 text-xs font-semibold text-white hover:bg-[#06684A] disabled:opacity-60 dark:bg-[#34D399] dark:text-slate-950 whitespace-nowrap shrink-0"
              >
                <Play className="h-3.5 w-3.5" />
                <span>{btLoading ? 'Simulating...' : t.runBacktestBtn}</span>
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
              <div>
                <label htmlFor="bt-strategy" className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  Strategy
                </label>
                <select
                  id="bt-strategy"
                  value={btStrategy}
                  onChange={(e) => setBtStrategy(e.target.value as typeof btStrategy)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                >
                  <option value="ml_model">ML Model Signals</option>
                  <option value="sma_crossover">SMA 20 / 50 Crossover</option>
                  <option value="rsi_mean_reversion">RSI + MACD Filter</option>
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
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
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
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
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
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
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
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
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
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="bt-thresh" className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  Buy Threshold
                </label>
                <input
                  id="bt-thresh"
                  type="number"
                  step="0.05"
                  min="0.45"
                  max="0.85"
                  value={btBuyThreshold}
                  onChange={(e) => setBtBuyThreshold(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                />
              </div>
            </div>

            {btError && (
              <p className="mt-3 text-xs font-medium text-[#782F46] dark:text-[#B76E85]">{btError}</p>
            )}
          </form>

          {btResult && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7 tabular-nums">
                {[
                  ['Total Return', formatPct(btResult.totalReturnPct)],
                  ['Net Profit', formatINR(btResult.netProfit, 0)],
                  ['Buy & Hold', formatPct(btResult.benchmarkReturnPct)],
                  ['Trades', String(btResult.numberOfTrades)],
                  ['Win Rate', `${btResult.winRatePct.toFixed(1)}%`],
                  ['Max Drawdown', `-${btResult.maxDrawdownPct.toFixed(2)}%`],
                  ['Sharpe Ratio', btResult.sharpeRatio.toFixed(2)],
                ].map(([label, val]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-slate-200/90 bg-white p-4 dark:border-slate-800 dark:bg-[#1F2937]"
                  >
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="mt-1 font-mono text-base font-bold text-slate-900 dark:text-white">{val}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Equity Curve vs Buy &amp; Hold Benchmark ({btResult.strategyLabel})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {btResult.startDate} → {btResult.endDate} · Total Transaction Costs:{' '}
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
                            winRatePct: btResult.winRatePct,
                            numberOfTrades: btResult.numberOfTrades,
                          },
                        },
                        `Interpret the ${btResult.symbol} backtest result (${btResult.totalReturnPct.toFixed(2)}% return vs ${btResult.benchmarkReturnPct.toFixed(2)}% buy-and-hold, Sharpe ${btResult.sharpeRatio.toFixed(2)}, Max Drawdown ${btResult.maxDrawdownPct.toFixed(2)}%).`,
                      )
                    }
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#087F5B] hover:underline dark:text-[#34D399]"
                  >
                    <Bot className="h-3.5 w-3.5" />
                    <span>{t.explainThis}</span>
                  </button>
                </div>

                <EquityCurveChart backtest={btResult} />
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{btResult.assumptionsNote}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: SYSTEM MONITORING */}
      {activeTab === 'monitoring' && monitoring && (
        <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Live Backend System Monitoring
            </h2>
            <button
              type="button"
              onClick={() => loadMonitoring()}
              className="text-xs font-semibold text-[#087F5B] hover:underline dark:text-[#34D399]"
            >
              Refresh Metrics
            </button>
          </div>

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

          {/* SQLite Training & Backtest Run History */}
          <div className="mt-6 grid grid-cols-1 gap-6 border-t border-slate-200 pt-5 lg:grid-cols-2 dark:border-slate-800">
            <div>
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                SQLite ML Training Audit Log ({monitoring.trainingHistory?.length ?? 0})
              </h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-[11px] tabular-nums">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                      <th className="py-1.5 pr-2">Symbol</th>
                      <th className="py-1.5 pr-2">Model</th>
                      <th className="py-1.5 pr-2">Acc</th>
                      <th className="py-1.5 pr-2">F1</th>
                      <th className="py-1.5">By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(monitoring.trainingHistory ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-3 text-slate-500">
                          Train a model in ML Training &amp; Eval to persist SQLite run logs.
                        </td>
                      </tr>
                    ) : (
                      (monitoring.trainingHistory ?? []).map((run) => (
                        <tr key={run.id}>
                          <td className="py-1.5 pr-2 font-mono font-semibold">{run.symbol}</td>
                          <td className="py-1.5 pr-2 font-mono">{run.modelType}</td>
                          <td className="py-1.5 pr-2 font-mono">{(run.accuracy * 100).toFixed(1)}%</td>
                          <td className="py-1.5 pr-2 font-mono">{(run.f1Score * 100).toFixed(1)}%</td>
                          <td className="py-1.5 font-mono text-slate-500">{run.triggeredBy}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                SQLite Backtest Audit Log ({monitoring.backtestHistory?.length ?? 0})
              </h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-[11px] tabular-nums">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                      <th className="py-1.5 pr-2">Symbol</th>
                      <th className="py-1.5 pr-2">Strategy</th>
                      <th className="py-1.5 pr-2">Return</th>
                      <th className="py-1.5 pr-2">Sharpe</th>
                      <th className="py-1.5">By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(monitoring.backtestHistory ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-3 text-slate-500">
                          Run a chronological backtest to persist SQLite evaluation logs.
                        </td>
                      </tr>
                    ) : (
                      (monitoring.backtestHistory ?? []).map((run) => (
                        <tr key={run.id}>
                          <td className="py-1.5 pr-2 font-mono font-semibold">{run.symbol}</td>
                          <td className="py-1.5 pr-2 truncate max-w-[140px]">{run.strategy}</td>
                          <td className="py-1.5 pr-2 font-mono">{formatPct(run.totalReturnPct)}</td>
                          <td className="py-1.5 pr-2 font-mono">{run.sharpeRatio.toFixed(2)}</td>
                          <td className="py-1.5 font-mono text-slate-500">{run.triggeredBy}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
