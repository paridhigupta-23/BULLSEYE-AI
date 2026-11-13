import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  Cpu,
  GitMerge,
  Layers,
  Play,
  Sliders,
  Sparkles,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAppContext } from '../../context/AppContext.tsx';
import { api } from '../../services/api.ts';
import {
  formatINR,
  type ModelComparisonResponse,
  type ModelType,
  type OptimizationResult,
  type StockDetailResponse,
  type StrategySignalResponse,
  type TradingStrategyId,
  type TrainedModelSummary,
  type WalkForwardResponse,
} from '../../types/index.ts';
import { ContributionChart } from '../charts/IndicatorCharts.tsx';

interface QuantSectionsPart2Props {
  activeSection?: string;
  selectedSymbol: string;
  detail: StockDetailResponse | null;
  modelType: ModelType;
  setModelType: (m: ModelType) => void;
  splitRatio: number;
  setSplitRatio: (r: number) => void;
  threshold: number;
  setThreshold: (t: number) => void;
  training: boolean;
  onTrainModel: () => void;
  activeArtifact: TrainedModelSummary | null;
  onExperimentsUpdated: () => void;
}

export const QuantSectionsPart2: React.FC<QuantSectionsPart2Props> = ({
  activeSection,
  selectedSymbol,
  detail,
  modelType,
  setModelType,
  splitRatio,
  setSplitRatio,
  threshold,
  setThreshold,
  training,
  onTrainModel,
  activeArtifact,
  onExperimentsUpdated,
}) => {
  const { theme, t, openAiWithContext } = useAppContext();
  const isDark = theme === 'dark';

  // Section 06: Optimization + Multi-Model Comparison Lab
  const [optTrainPct, setOptTrainPct] = useState(0.65);
  const [optValPct, setOptValPct] = useState(0.15);
  const [optLoading, setOptLoading] = useState(false);
  const [optResult, setOptResult] = useState<OptimizationResult | null>(null);
  const [optError, setOptError] = useState<string | null>(null);

  const [rankBy, setRankBy] = useState<'f1Score' | 'accuracy' | 'precision' | 'recall'>('f1Score');
  const [cmpLoading, setCmpLoading] = useState(false);
  const [cmpResult, setCmpResult] = useState<ModelComparisonResponse | null>(null);
  const [cmpError, setCmpError] = useState<string | null>(null);

  // Section 07: Walk-Forward Validation
  const [wfMode, setWfMode] = useState<'expanding' | 'rolling'>('expanding');
  const [wfWindows, setWfWindows] = useState(4);
  const [wfInitialPct, setWfInitialPct] = useState(0.5);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfResult, setWfResult] = useState<WalkForwardResponse | null>(null);
  const [wfError, setWfError] = useState<string | null>(null);

  // Section 09: Strategy & Signal Generation
  const [sigStrategy, setSigStrategy] = useState<TradingStrategyId>('combined_ml_tech');
  const [sigThreshold, setSigThreshold] = useState(0.55);
  const [sigLoading, setSigLoading] = useState(false);
  const [sigResult, setSigResult] = useState<StrategySignalResponse | null>(null);
  const [sigError, setSigError] = useState<string | null>(null);

  const handleRunOptimization = async () => {
    setOptLoading(true);
    setOptError(null);
    try {
      const res = await api.optimizeModel({
        symbol: selectedSymbol,
        modelType,
        trainPct: optTrainPct,
        valPct: optValPct,
      });
      setOptResult(res);
      onExperimentsUpdated();
    } catch (err) {
      setOptError(err instanceof Error ? err.message : 'Optimization failed');
    } finally {
      setOptLoading(false);
    }
  };

  const handleCompareAll = async () => {
    setCmpLoading(true);
    setCmpError(null);
    try {
      const res = await api.compareModels({
        symbol: selectedSymbol,
        models: ['logistic_regression', 'random_forest', 'gradient_boosting', 'sequence_mlp'],
        splitRatio,
        rankBy,
      });
      setCmpResult(res);
    } catch (err) {
      setCmpError(err instanceof Error ? err.message : 'Comparison failed');
    } finally {
      setCmpLoading(false);
    }
  };

  const handleRunWalkForward = async () => {
    setWfLoading(true);
    setWfError(null);
    try {
      const res = await api.runWalkForward({
        symbol: selectedSymbol,
        modelType,
        initialTrainPct: wfInitialPct,
        numWindows: wfWindows,
        mode: wfMode,
      });
      setWfResult(res);
    } catch (err) {
      setWfError(err instanceof Error ? err.message : 'Walk-forward failed');
    } finally {
      setWfLoading(false);
    }
  };

  const handleGenerateSignals = async (strategyOverride?: TradingStrategyId) => {
    setSigLoading(true);
    setSigError(null);
    try {
      const res = await api.getStrategySignals({
        symbol: selectedSymbol,
        strategy: strategyOverride ?? sigStrategy,
        modelType,
        threshold: sigThreshold,
        lookbackDays: 90,
      });
      setSigResult(res);
    } catch (err) {
      setSigError(err instanceof Error ? err.message : 'Signal generation failed');
    } finally {
      setSigLoading(false);
    }
  };

  useEffect(() => {
    if (activeSection && activeSection !== '09') return;
    handleGenerateSignals().catch(() => {});
  }, [selectedSymbol, modelType, sigStrategy, activeSection]);

  const lossCurveData =
    optResult?.lossHistory ??
    activeArtifact?.trainLossHistory ??
    [];

  const comparisonChartData = (cmpResult?.models ?? []).map((m) => ({
    name: m.modelType.replace('_', ' '),
    accuracy: Number((m.accuracy * 100).toFixed(2)),
    f1: Number((m.f1Score * 100).toFixed(2)),
    precision: Number((m.precision * 100).toFixed(2)),
  }));

  const wfChartData = (wfResult?.windows ?? []).map((w) => ({
    fold: `W${w.windowIndex} (${w.testRange.end.slice(2, 7)})`,
    accuracy: Number((w.accuracy * 100).toFixed(2)),
    f1: Number((w.f1Score * 100).toFixed(2)),
  }));

  const signalBadgeColor = (sig: string | null) => {
    if (sig === 'BUY') return 'bg-[#087F5B] text-white dark:bg-[#34D399] dark:text-slate-950';
    if (sig === 'SELL') return 'bg-[#782F46] text-white dark:bg-[#B76E85] dark:text-slate-950';
    return 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100';
  };

  return (
    <div className="space-y-8">
      {/* ==================== 06. ML TRAINING & MODEL COMPARISON ==================== */}
      {(!activeSection || activeSection === '06') && (
      <section
        id="sec-06"
        aria-labelledby="sec-06-heading"
        className="scroll-mt-28 space-y-6 rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]"
      >
        <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
          <span className="font-mono text-xs font-bold tracking-wider text-[#782F46] dark:text-[#B76E85]">
            06. ML TRAINING &amp; MODEL COMPARISON
          </span>
          <h2
            id="sec-06-heading"
            className="font-display text-xl font-bold text-slate-900 dark:text-white"
          >
            Chronological Training, Validation-Only Grid Search &amp; 4-Model Comparison Lab
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Zero-leakage enforcement: strictly excludes <code className="font-mono">next_day_return</code> &amp;{' '}
            <code className="font-mono">target_direction</code>; fits Z-score standardization exclusively on the training partition.
          </p>
        </div>

        {/* Part A: Standard Chronological Train Controls */}
        <div className="rounded-xl border border-slate-200 bg-[#F8F6F0]/75 p-4 dark:border-slate-700 dark:bg-[#111827]">
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
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-[#1F2937] dark:text-white"
                >
                  <option value="logistic_regression">Logistic Regression (L2 Baseline)</option>
                  <option value="random_forest">Random Forest (25 Decision Trees)</option>
                  <option value="gradient_boosting">Gradient Boosting (XGBoost-Style)</option>
                  <option value="sequence_mlp">Sequence MLP (5-Day Lookback Net)</option>
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
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-[#1F2937] dark:text-white"
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

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={training}
                onClick={onTrainModel}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#087F5B] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#06684A] disabled:opacity-60 dark:bg-[#34D399] dark:text-slate-950 whitespace-nowrap"
              >
                <Play className="h-3.5 w-3.5" />
                <span>{training ? 'Training...' : `${t.trainModelBtn} (${selectedSymbol})`}</span>
              </button>
            </div>
          </div>

          {/* Part B: Chronological Train / Val / Test Grid Search + Threshold Optimization */}
          <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-end sm:justify-between dark:border-slate-800">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="opt-train" className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  Grid Train Slice
                </label>
                <select
                  id="opt-train"
                  value={optTrainPct}
                  onChange={(e) => setOptTrainPct(Number(e.target.value))}
                  className="mt-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-[#1F2937]"
                >
                  <option value={0.6}>60% Train</option>
                  <option value={0.65}>65% Train</option>
                  <option value={0.7}>70% Train</option>
                </select>
              </div>
              <div>
                <label htmlFor="opt-val" className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  Validation Slice
                </label>
                <select
                  id="opt-val"
                  value={optValPct}
                  onChange={(e) => setOptValPct(Number(e.target.value))}
                  className="mt-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-[#1F2937]"
                >
                  <option value={0.1}>10% Val</option>
                  <option value={0.15}>15% Val</option>
                  <option value={0.2}>20% Val</option>
                </select>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Held-out Test Slice: <span className="font-mono font-bold">{Math.round((1 - optTrainPct - optValPct) * 100)}%</span>
              </div>
            </div>

            <button
              type="button"
              disabled={optLoading}
              onClick={handleRunOptimization}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#782F46] px-4 py-2 text-xs font-semibold text-white hover:bg-[#5E2336] disabled:opacity-60 dark:bg-[#B76E85] dark:text-slate-950 whitespace-nowrap"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>{optLoading ? 'Optimizing on Val Fold...' : 'Run Grid Search & Val Threshold Tuning'}</span>
            </button>
          </div>
          {optError && <p className="mt-2 text-xs text-[#782F46]">{optError}</p>}
        </div>

        {/* Active Evaluation or Grid Search Evaluation Display */}
        {activeArtifact && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="min-w-0 rounded-xl border border-slate-200 bg-[#F8F6F0]/60 p-4 lg:col-span-7 dark:border-slate-700 dark:bg-[#111827]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Out-of-Sample Evaluation: {activeArtifact.modelLabel}
                </h3>
                <span className="font-mono text-xs text-slate-500">
                  {activeArtifact.trainDateRange.start} → {activeArtifact.testDateRange.end} · {activeArtifact.trainingDurationMs} ms
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 tabular-nums">
                {[
                  ['Accuracy', `${(activeArtifact.evaluation.accuracy * 100).toFixed(2)}%`],
                  ['Precision', `${(activeArtifact.evaluation.precision * 100).toFixed(2)}%`],
                  ['Recall', `${(activeArtifact.evaluation.recall * 100).toFixed(2)}%`],
                  ['F1 Score', `${(activeArtifact.evaluation.f1Score * 100).toFixed(2)}%`],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-[#1F2937]">
                    <p className="text-[11px] text-slate-500">{k}</p>
                    <p className="mt-0.5 font-mono text-base font-bold text-slate-900 dark:text-white">{v}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-center font-mono text-xs sm:grid-cols-4 tabular-nums">
                <div className="rounded-lg bg-[#087F5B]/10 p-2 dark:bg-[#34D399]/15">
                  <span className="block text-[10px] text-slate-500">True Neg (TN)</span>
                  <span className="font-bold">{activeArtifact.evaluation.confusionMatrix.tn}</span>
                </div>
                <div className="rounded-lg bg-[#782F46]/10 p-2 dark:bg-[#B76E85]/15">
                  <span className="block text-[10px] text-slate-500">False Pos (FP)</span>
                  <span className="font-bold">{activeArtifact.evaluation.confusionMatrix.fp}</span>
                </div>
                <div className="rounded-lg bg-[#782F46]/10 p-2 dark:bg-[#B76E85]/15">
                  <span className="block text-[10px] text-slate-500">False Neg (FN)</span>
                  <span className="font-bold">{activeArtifact.evaluation.confusionMatrix.fn}</span>
                </div>
                <div className="rounded-lg bg-[#087F5B]/10 p-2 dark:bg-[#34D399]/15">
                  <span className="block text-[10px] text-slate-500">True Pos (TP)</span>
                  <span className="font-bold">{activeArtifact.evaluation.confusionMatrix.tp}</span>
                </div>
              </div>
            </div>

            {/* Prediction Output Card */}
            <div className="min-w-0 rounded-xl border border-slate-200 bg-[#F8F6F0]/60 p-4 lg:col-span-5 dark:border-slate-700 dark:bg-[#111827] tabular-nums">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Latest Inference ({selectedSymbol})
                </h3>
                {detail?.prediction.signal && (
                  <span className={`rounded-md px-2.5 py-1 font-mono text-xs font-bold ${signalBadgeColor(detail.prediction.signal)}`}>
                    {detail.prediction.signal}
                  </span>
                )}
              </div>
              {detail?.prediction.modelTrained ? (
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Observation Date</span>
                    <span className="font-mono font-semibold">{detail.prediction.predictionDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Upward Probability</span>
                    <span className="font-mono font-bold text-[#087F5B] dark:text-[#34D399]">
                      {((detail.prediction.buyProbability ?? 0) * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Downward Probability</span>
                    <span className="font-mono font-bold text-[#782F46] dark:text-[#B76E85]">
                      {((detail.prediction.sellProbability ?? 0) * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Measured Latency</span>
                    <span className="font-mono font-semibold">{detail.prediction.inferenceLatencyMs ?? 0} ms</span>
                  </div>
                  <p className="rounded border border-slate-200 bg-white p-2 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-[#1F2937] dark:text-slate-300">
                    {detail.prediction.statusMessage}
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-xs text-slate-500">Train model to inspect latest prediction.</p>
              )}
            </div>
          </div>
        )}

        {/* Grid Search Detailed Output: Loss Curve + Classification Report + Actual vs Predicted */}
        {optResult && (
          <div className="space-y-4 rounded-xl border border-[#782F46]/30 bg-[#F8F6F0]/75 p-4 dark:border-[#B76E85]/30 dark:bg-[#111827]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  Grid Search Winner ({optResult.experimentId}): Best Params{' '}
                  <code className="font-mono text-[#087F5B] dark:text-[#34D399]">
                    {JSON.stringify(optResult.bestParams)}
                  </code>{' '}
                  · Val Threshold = {optResult.selectedThreshold.toFixed(2)}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Train ({optResult.trainSize} rows) → Val ({optResult.valSize} rows) → Held-Out Test ({optResult.testSize} rows: {optResult.testDateRange.start} to {optResult.testDateRange.end})
                </p>
              </div>
              <span className="font-mono text-xs font-bold text-[#087F5B] dark:text-[#34D399]">
                Test Acc {(optResult.testEvaluation.accuracy * 100).toFixed(2)}% · F1{' '}
                {(optResult.testEvaluation.f1Score * 100).toFixed(2)}%
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              {/* Grid Candidates & 2-Class Classification Report */}
              <div className="min-w-0 space-y-4 lg:col-span-6">
                <div className="overflow-x-auto">
                  <p className="mb-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                    Hyperparameter Candidates Evaluated on Validation Fold
                  </p>
                  <table className="w-full text-left font-mono text-[11px] tabular-nums">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                        <th className="py-1 pr-2">Params</th>
                        <th className="py-1 pr-2">Val Acc</th>
                        <th className="py-1 pr-2">Val F1</th>
                        <th className="py-1">Thresh</th>
                      </tr>
                    </thead>
                    <tbody>
                      {optResult.gridCandidatesTested.map((c, idx) => (
                        <tr key={idx} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-1 pr-2">{c.paramsLabel}</td>
                          <td className="py-1 pr-2">{(c.valAccuracy * 100).toFixed(1)}%</td>
                          <td className="py-1 pr-2">{(c.valF1 * 100).toFixed(1)}%</td>
                          <td className="py-1">{c.selectedThreshold.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="overflow-x-auto">
                  <p className="mb-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                    2-Class Held-Out Test Classification Report
                  </p>
                  <table className="w-full text-left font-mono text-[11px] tabular-nums">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                        <th className="py-1 pr-2">Class</th>
                        <th className="py-1 pr-2">Precision</th>
                        <th className="py-1 pr-2">Recall</th>
                        <th className="py-1 pr-2">F1</th>
                        <th className="py-1">Support</th>
                      </tr>
                    </thead>
                    <tbody>
                      {optResult.classificationReport.map((r) => (
                        <tr key={r.className} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-1 pr-2 font-semibold">{r.className}</td>
                          <td className="py-1 pr-2">{(r.precision * 100).toFixed(1)}%</td>
                          <td className="py-1 pr-2">{(r.recall * 100).toFixed(1)}%</td>
                          <td className="py-1 pr-2">{(r.f1Score * 100).toFixed(1)}%</td>
                          <td className="py-1">{r.support}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Actual vs Predicted + Sequence MLP Loss Curve */}
              <div className="min-w-0 space-y-4 lg:col-span-6">
                {lossCurveData.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                      Sequence MLP Binary Cross-Entropy Train vs Val Loss Curve
                    </p>
                    <div className="h-40 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={lossCurveData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E2E8F0'} />
                          <XAxis dataKey="epoch" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                          <Line type="monotone" dataKey="trainLoss" name="Train BCE" stroke="#087F5B" dot={false} />
                          <Line type="monotone" dataKey="valLoss" name="Val BCE" stroke="#782F46" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <p className="mb-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                    Actual vs Predicted Test Sample (Latest Test Sessions)
                  </p>
                  <table className="w-full text-left font-mono text-[11px] tabular-nums">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                        <th className="py-1 pr-2">Date</th>
                        <th className="py-1 pr-2">Close</th>
                        <th className="py-1 pr-2">P(Up)</th>
                        <th className="py-1 pr-2">Pred</th>
                        <th className="py-1">Actual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {optResult.actualVsPredictedSample.slice(0, 8).map((row) => (
                        <tr key={row.date} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-1 pr-2">{row.date}</td>
                          <td className="py-1 pr-2">{formatINR(row.close)}</td>
                          <td className="py-1 pr-2">{(row.predictedProb * 100).toFixed(1)}%</td>
                          <td className="py-1 pr-2">{row.predictedDirection}</td>
                          <td
                            className={`py-1 font-bold ${
                              row.correct
                                ? 'text-[#087F5B] dark:text-[#34D399]'
                                : 'text-[#782F46] dark:text-[#B76E85]'
                            }`}
                          >
                            {row.actualDirection} ({row.correct ? 'HIT' : 'MISS'})
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Part C: Side-by-Side 4-Model Comparison Lab */}
        <div className="rounded-xl border border-slate-200 bg-[#F8F6F0]/60 p-4 dark:border-slate-700 dark:bg-[#111827]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-1.5 font-display text-sm font-bold text-slate-900 dark:text-white">
                <BarChart3 className="h-4 w-4 text-[#087F5B] dark:text-[#34D399]" />
                <span>Side-by-Side Multi-Model Comparison Lab ({selectedSymbol})</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Trains &amp; evaluates all 4 chronological TS models on identical train/test dates.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                id="cmp-rank-by"
                aria-label="Rank comparison by"
                value={rankBy}
                onChange={(e) => setRankBy(e.target.value as typeof rankBy)}
                className="max-w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-[#1F2937]"
              >
                <option value="f1Score">Rank by F1 Score</option>
                <option value="accuracy">Rank by Accuracy</option>
                <option value="precision">Rank by Precision</option>
                <option value="recall">Rank by Recall</option>
              </select>

              <button
                type="button"
                disabled={cmpLoading}
                onClick={handleCompareAll}
                className="rounded-lg bg-[#087F5B] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#06684A] disabled:opacity-60 dark:bg-[#34D399] dark:text-slate-950"
              >
                {cmpLoading ? 'Benchmarking 4 Models...' : 'Compare All 4 Models'}
              </button>
            </div>
          </div>

          {cmpError && <p className="mt-2 text-xs text-[#782F46]">{cmpError}</p>}

          {cmpResult && (
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="min-w-0 overflow-x-auto lg:col-span-7">
                <p className="mb-2 text-xs font-semibold text-[#087F5B] dark:text-[#34D399]">
                  {cmpResult.comparisonSummary}
                </p>
                <table className="w-full text-left font-mono text-[11px] tabular-nums">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                      <th className="py-1.5 pr-2">Model</th>
                      <th className="py-1.5 pr-2">Acc</th>
                      <th className="py-1.5 pr-2">Prec</th>
                      <th className="py-1.5 pr-2">Recall</th>
                      <th className="py-1.5 pr-2">F1</th>
                      <th className="py-1.5">Train ms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cmpResult.models.map((m, idx) => (
                      <tr key={m.modelType} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-1.5 pr-2 font-semibold">
                          #{idx + 1} {m.modelLabel}
                        </td>
                        <td className="py-1.5 pr-2">{(m.accuracy * 100).toFixed(2)}%</td>
                        <td className="py-1.5 pr-2">{(m.precision * 100).toFixed(2)}%</td>
                        <td className="py-1.5 pr-2">{(m.recall * 100).toFixed(2)}%</td>
                        <td className="py-1.5 pr-2 font-bold text-[#087F5B] dark:text-[#34D399]">
                          {(m.f1Score * 100).toFixed(2)}%
                        </td>
                        <td className="py-1.5">{m.trainingDurationMs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="h-52 lg:col-span-5">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E2E8F0'} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="accuracy" name="Accuracy %" fill="#087F5B" />
                    <Bar dataKey="f1" name="F1 %" fill="#782F46" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </section>
      )}

      {/* ==================== 07. WALK-FORWARD VALIDATION ==================== */}
      {(!activeSection || activeSection === '07') && (
      <section
        id="sec-07"
        aria-labelledby="sec-07-heading"
        className="scroll-mt-28 space-y-5 rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]"
      >
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between dark:border-slate-800">
          <div>
            <span className="font-mono text-xs font-bold tracking-wider text-[#782F46] dark:text-[#B76E85]">
              07. WALK-FORWARD VALIDATION
            </span>
            <h2
              id="sec-07-heading"
              className="font-display text-xl font-bold text-slate-900 dark:text-white"
            >
              Out-of-Sample Expanding &amp; Rolling Window Cross-Time Validation ({selectedSymbol})
            </h2>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="wf-mode" className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                Window Mode
              </label>
              <select
                id="wf-mode"
                value={wfMode}
                onChange={(e) => setWfMode(e.target.value as 'expanding' | 'rolling')}
                className="mt-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-[#111827]"
              >
                <option value="expanding">Expanding Window</option>
                <option value="rolling">Rolling Window</option>
              </select>
            </div>
            <div>
              <label htmlFor="wf-folds" className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                Folds
              </label>
              <select
                id="wf-folds"
                value={wfWindows}
                onChange={(e) => setWfWindows(Number(e.target.value))}
                className="mt-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs font-semibold dark:border-slate-700 dark:bg-[#111827]"
              >
                <option value={3}>3 Windows</option>
                <option value={4}>4 Windows</option>
                <option value={5}>5 Windows</option>
              </select>
            </div>
            <div>
              <label htmlFor="wf-init" className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                Initial Train %
              </label>
              <select
                id="wf-init"
                value={wfInitialPct}
                onChange={(e) => setWfInitialPct(Number(e.target.value))}
                className="mt-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs font-semibold dark:border-slate-700 dark:bg-[#111827]"
              >
                <option value={0.4}>40%</option>
                <option value={0.5}>50%</option>
                <option value={0.6}>60%</option>
              </select>
            </div>
            <button
              type="button"
              disabled={wfLoading}
              onClick={handleRunWalkForward}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#087F5B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#06684A] disabled:opacity-60 dark:bg-[#34D399] dark:text-slate-950"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>{wfLoading ? 'Running Folds...' : 'Execute Walk-Forward'}</span>
            </button>
          </div>
        </div>

        {wfError && <p className="text-xs text-[#782F46]">{wfError}</p>}

        {wfResult ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="min-w-0 space-y-3 lg:col-span-7">
              <div className="grid grid-cols-4 gap-2 tabular-nums">
                {[
                  ['Mean Acc', `${(wfResult.averageMetrics.accuracy * 100).toFixed(2)}%`],
                  ['Mean Prec', `${(wfResult.averageMetrics.precision * 100).toFixed(2)}%`],
                  ['Mean Rec', `${(wfResult.averageMetrics.recall * 100).toFixed(2)}%`],
                  ['Mean F1', `${(wfResult.averageMetrics.f1Score * 100).toFixed(2)}%`],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-[#F8F6F0] p-2.5 dark:bg-[#111827]">
                    <p className="text-[10px] text-slate-500">{k}</p>
                    <p className="font-mono text-sm font-bold text-[#087F5B] dark:text-[#34D399]">{v}</p>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[11px] tabular-nums">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                      <th className="py-1.5 pr-2">Fold</th>
                      <th className="py-1.5 pr-2">Train Span</th>
                      <th className="py-1.5 pr-2">Test Span</th>
                      <th className="py-1.5 pr-2">Acc</th>
                      <th className="py-1.5 pr-2">F1</th>
                      <th className="py-1.5">CM (TN/FP/FN/TP)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wfResult.windows.map((w) => (
                      <tr key={w.windowIndex} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-1.5 pr-2 font-bold">W{w.windowIndex}</td>
                        <td className="py-1.5 pr-2">
                          {w.trainRange.start} → {w.trainRange.end} ({w.trainSize})
                        </td>
                        <td className="py-1.5 pr-2">
                          {w.testRange.start} → {w.testRange.end} ({w.testSize})
                        </td>
                        <td className="py-1.5 pr-2">{(w.accuracy * 100).toFixed(1)}%</td>
                        <td className="py-1.5 pr-2 font-semibold text-[#087F5B] dark:text-[#34D399]">
                          {(w.f1Score * 100).toFixed(1)}%
                        </td>
                        <td className="py-1.5 font-mono text-[10px] text-slate-600 dark:text-slate-300">
                          {w.confusionMatrix
                            ? `${w.confusionMatrix.tn}/${w.confusionMatrix.fp}/${w.confusionMatrix.fn}/${w.confusionMatrix.tp}`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{wfResult.leakageNote}</p>
            </div>

            <div className="min-w-0 h-60 lg:col-span-5">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={wfChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E2E8F0'} />
                  <XAxis dataKey="fold" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="accuracy" name="Accuracy %" stroke="#087F5B" strokeWidth={2} />
                  <Line type="monotone" dataKey="f1" name="F1 Score %" stroke="#782F46" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Click &ldquo;Execute Walk-Forward&rdquo; to evaluate time-series stability across sequential out-of-sample folds with per-fold standardization.
          </p>
        )}
      </section>
      )}

      {/* ==================== 08. EXPLAINABILITY STUDIO ==================== */}
      {(!activeSection || activeSection === '08') && (
      <section
        id="sec-08"
        aria-labelledby="sec-08-heading"
        className="scroll-mt-28 space-y-5 rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]"
      >
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <span className="font-mono text-xs font-bold tracking-wider text-[#782F46] dark:text-[#B76E85]">
              08. EXPLAINABILITY STUDIO
            </span>
            <h2
              id="sec-08-heading"
              className="font-display text-xl font-bold text-slate-900 dark:text-white"
            >
              Feature Attribution, Global Importance &amp; Causal Interpretation Guardrails ({selectedSymbol})
            </h2>
          </div>
          {detail?.prediction.modelTrained && (
            <button
              type="button"
              onClick={() =>
                openAiWithContext(
                  {
                    title: `Explainability · ${selectedSymbol}`,
                    symbol: selectedSymbol,
                    data: {
                      model: detail.prediction.modelName,
                      method: detail.prediction.explanationMethod,
                      topFactors: detail.prediction.contributions.slice(0, 5),
                    },
                  },
                  `Explain the ${selectedSymbol} ${detail.prediction.signal} attribution (${detail.prediction.explanationMethod}) without implying causation.`,
                )
              }
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#087F5B] hover:underline dark:text-[#34D399]"
            >
              <Bot className="h-3.5 w-3.5" />
              <span>{t.explainThis}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="min-w-0 rounded-xl border border-slate-200 bg-[#F8F6F0]/60 p-4 lg:col-span-6 dark:border-slate-700 dark:bg-[#111827]">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Local Feature Attribution ({detail?.prediction.explanationMethod ?? 'Train model first'})
              </h3>
            </div>
            {detail?.prediction.contributions && detail.prediction.contributions.length > 0 ? (
              <ContributionChart contributions={detail.prediction.contributions} />
            ) : (
              <p className="py-12 text-center text-xs text-slate-500">
                Train any model in Section 06 to inspect exact feature contributions.
              </p>
            )}
          </div>

          <div className="min-w-0 space-y-4 lg:col-span-6">
            <div className="rounded-xl border border-slate-200 bg-[#F8F6F0]/60 p-4 dark:border-slate-700 dark:bg-[#111827]">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Global Normalized Feature Importance ({activeArtifact?.modelLabel ?? 'No Active Artifact'})
              </h3>
              <div className="mt-3 space-y-2 tabular-nums">
                {(activeArtifact?.featureImportance ?? []).slice(0, 7).map((fi) => (
                  <div key={fi.feature} className="space-y-1">
                    <div className="flex justify-between font-mono text-[11px]">
                      <span>{fi.label}</span>
                      <span className="font-bold">{(fi.importance * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full bg-[#087F5B] dark:bg-[#34D399]"
                        style={{ width: `${Math.min(100, Math.round(fi.importance * 100))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-[#111827] dark:text-slate-300">
              <p className="font-bold text-slate-900 dark:text-white">
                Statistical Distinction: Correlation vs Feature Importance vs Causality
              </p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px]">
                <li>
                  <span className="font-semibold">Exact Linear SHAP vs Non-SHAP Attribution:</span> Logistic Regression uses Exact Linear SHAP (<code className="font-mono">w_j · (x_j − μ_j)/σ_j</code>). Random Forest, Gradient Boosting &amp; Sequence MLP report Feature Importance and Baseline-Replaced Perturbation Attribution (strictly not TreeSHAP/DeepSHAP).
                </li>
                <li>
                  <span className="font-semibold">Correlation vs Causality:</span> High Pearson correlation (Section 04) or high classifier importance measures historical statistical association — never economic causation.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ==================== 09. TRADING STRATEGY & SIGNAL GENERATION ==================== */}
      {(!activeSection || activeSection === '09') && (
      <section
        id="sec-09"
        aria-labelledby="sec-09-heading"
        className="scroll-mt-28 space-y-5 rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]"
      >
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between dark:border-slate-800">
          <div>
            <span className="font-mono text-xs font-bold tracking-wider text-[#782F46] dark:text-[#B76E85]">
              09. TRADING STRATEGY &amp; SIGNAL GENERATION
            </span>
            <h2
              id="sec-09-heading"
              className="font-display text-xl font-bold text-slate-900 dark:text-white"
            >
              ML Direction vs Technical Indicators vs Final Gated Signal ({selectedSymbol})
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {sigResult?.isHistoricalOnlyLabel ??
                'Historical dataset observation through 2025-09-29 — not live exchange tick quotes.'}
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="sig-strategy" className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                Strategy Rule
              </label>
              <select
                id="sig-strategy"
                value={sigStrategy}
                onChange={(e) => setSigStrategy(e.target.value as TradingStrategyId)}
                className="mt-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-[#111827]"
              >
                <option value="combined_ml_tech">Combined ML + Technical Consensus Gate</option>
                <option value="ml_model">ML Classifier Probability Only</option>
                <option value="sma_crossover">SMA(20) / SMA(50) Trend Crossover</option>
                <option value="rsi_macd">RSI(14) + MACD Consensus</option>
              </select>
            </div>
            <div>
              <label htmlFor="sig-thresh" className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                Threshold
              </label>
              <input
                id="sig-thresh"
                type="number"
                step="0.05"
                min="0.50"
                max="0.85"
                value={sigThreshold}
                onChange={(e) => setSigThreshold(Number(e.target.value))}
                className="mt-1 w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-[#111827]"
              />
            </div>
            <button
              type="button"
              disabled={sigLoading}
              onClick={() => handleGenerateSignals()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#087F5B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#06684A] disabled:opacity-60 dark:bg-[#34D399] dark:text-slate-950"
            >
              <GitMerge className="h-3.5 w-3.5" />
              <span>{sigLoading ? 'Computing...' : 'Refresh Signals'}</span>
            </button>
          </div>
        </div>

        {sigError && <p className="text-xs text-[#782F46]">{sigError}</p>}

        {sigResult && (
          <div className="space-y-4">
            {/* 3-Column Comparison: ML vs Tech Bias vs Final Consensus */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-[#F8F6F0]/75 p-4 dark:border-slate-700 dark:bg-[#111827]">
                <p className="text-[11px] text-slate-500">1. ML Prediction Layer</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-mono text-lg font-bold">
                    {sigResult.latestDecision.mlSignal ?? 'NOT TRAINED'}
                  </span>
                  <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
                    P(Up):{' '}
                    {sigResult.latestDecision.buyProbability !== null
                      ? `${(sigResult.latestDecision.buyProbability * 100).toFixed(1)}%`
                      : '—'}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                  Threshold gate: {(sigResult.threshold * 100).toFixed(0)}% minimum directional probability.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-[#F8F6F0]/75 p-4 dark:border-slate-700 dark:bg-[#111827]">
                <p className="text-[11px] text-slate-500">2. Technical Indicator Bias</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-mono text-lg font-bold">
                    {sigResult.latestDecision.technicalBias}
                  </span>
                  <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
                    {sigResult.latestDecision.rsiInterpretation}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                  {sigResult.latestDecision.smaTrend} · {sigResult.latestDecision.macdDirection}
                </p>
              </div>

              <div className="rounded-xl border-2 border-[#087F5B]/40 bg-[#087F5B]/5 p-4 dark:border-[#34D399]/40 dark:bg-[#34D399]/10">
                <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  3. Final Gated Strategy Decision
                </p>
                <div className="mt-1 flex items-center justify-between">
                  <span className={`rounded-md px-3 py-1 font-mono text-base font-bold ${signalBadgeColor(sigResult.latestDecision.finalDecision)}`}>
                    {sigResult.latestDecision.finalDecision}
                  </span>
                  <span className="font-mono text-xs">
                    Close {formatINR(sigResult.historicalClose)}
                  </span>
                </div>
                <p className="mt-1.5 font-mono text-[11px] text-slate-700 dark:text-slate-200">
                  ATR Stop: {formatINR(sigResult.latestDecision.riskContext.stopLoss)} · Target:{' '}
                  {formatINR(sigResult.latestDecision.riskContext.targetPrice)}
                </p>
              </div>
            </div>

            {/* Combination Rule + Invalidation Conditions + Distribution */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="min-w-0 rounded-xl border border-slate-200 bg-[#F8F6F0]/60 p-4 lg:col-span-7 dark:border-slate-700 dark:bg-[#111827]">
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  Decision Rule &amp; Explanation ({sigResult.strategyLabel})
                </p>
                <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
                  {sigResult.latestDecision.explanation}
                </p>
                <p className="mt-2 font-mono text-[11px] text-[#087F5B] dark:text-[#34D399]">
                  Rule: {sigResult.latestDecision.combinationRule}
                </p>
                <div className="mt-3 border-t border-slate-200 pt-2 dark:border-slate-800">
                  <p className="flex items-center gap-1 text-[11px] font-bold text-[#782F46] dark:text-[#B76E85]">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Signal Invalidation Triggers</span>
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-slate-600 dark:text-slate-400">
                    {sigResult.latestDecision.invalidationConditions.map((cond, i) => (
                      <li key={i}>{cond}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="min-w-0 rounded-xl border border-slate-200 bg-[#F8F6F0]/60 p-4 lg:col-span-5 dark:border-slate-700 dark:bg-[#111827] tabular-nums">
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  Recent {sigResult.distribution.totalSessions}-Session Signal Distribution
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center font-mono">
                  <div className="rounded-lg bg-[#087F5B]/15 p-3">
                    <span className="block text-[10px] text-slate-500">BUY</span>
                    <span className="text-lg font-bold text-[#087F5B] dark:text-[#34D399]">
                      {sigResult.distribution.BUY}
                    </span>
                  </div>
                  <div className="rounded-lg bg-slate-200/70 p-3 dark:bg-slate-800">
                    <span className="block text-[10px] text-slate-500">HOLD</span>
                    <span className="text-lg font-bold text-slate-800 dark:text-white">
                      {sigResult.distribution.HOLD}
                    </span>
                  </div>
                  <div className="rounded-lg bg-[#782F46]/15 p-3">
                    <span className="block text-[10px] text-slate-500">SELL</span>
                    <span className="text-lg font-bold text-[#782F46] dark:text-[#B76E85]">
                      {sigResult.distribution.SELL}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Signal Ledger Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left font-mono text-[11px] tabular-nums">
                <thead className="bg-[#F8F6F0] text-slate-500 dark:bg-[#111827] dark:text-slate-400">
                  <tr>
                    <th className="px-2.5 py-2">Date</th>
                    <th className="px-2.5 py-2">Close</th>
                    <th className="px-2.5 py-2">ML Sig (P Up)</th>
                    <th className="px-2.5 py-2">Tech Bias</th>
                    <th className="px-2.5 py-2">RSI(14)</th>
                    <th className="px-2.5 py-2">MACD</th>
                    <th className="px-2.5 py-2">Final Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sigResult.recentSignals.slice(0, 12).map((row) => (
                    <tr key={row.date}>
                      <td className="px-2.5 py-1.5">{row.date}</td>
                      <td className="px-2.5 py-1.5">{formatINR(row.close)}</td>
                      <td className="px-2.5 py-1.5">
                        {row.mlSignal
                          ? `${row.mlSignal} (${((row.buyProbability ?? 0) * 100).toFixed(0)}%)`
                          : 'N/A'}
                      </td>
                      <td className="px-2.5 py-1.5">{row.technicalSignal}</td>
                      <td className="px-2.5 py-1.5">{row.rsi14.toFixed(1)}</td>
                      <td className="px-2.5 py-1.5">{row.macd.toFixed(2)}</td>
                      <td className="px-2.5 py-1.5">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${signalBadgeColor(row.finalDecision)}`}>
                          {row.finalDecision}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
      )}
    </div>
  );
};
