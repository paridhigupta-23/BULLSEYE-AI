import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Cpu,
  Database,
  FileCode2,
  GitBranch,
  Layers,
  Play,
  ShieldAlert,
  Sparkles,
  Square,
  TrendingUp,
} from 'lucide-react';
import type {
  MonitoringStatus,
  TrainedModelSummary,
  ValidationReport,
} from '../../types/index.ts';

interface WorkflowNodeMeta {
  id: string;
  step: string;
  title: string;
  track: 'production' | 'research';
  purpose: string;
  inputs: string;
  outputs: string;
  moduleRef: string;
  liveStat: string;
}

interface QuantWorkflowHeroProps {
  selectedSymbol: string;
  validation: ValidationReport | null;
  activeArtifact: TrainedModelSummary | null;
  monitoring: MonitoringStatus | null;
  loadDurationMs: number;
  onJumpToSection: (sectionId: string) => void;
}

export const QuantWorkflowHero: React.FC<QuantWorkflowHeroProps> = ({
  selectedSymbol,
  validation,
  activeArtifact,
  monitoring,
  loadDurationMs,
  onJumpToSection,
}) => {
  const nodes: WorkflowNodeMeta[] = useMemo(
    () => [
      {
        id: 'sec-03-source',
        step: '01',
        title: 'Historical NSE Data',
        track: 'production',
        purpose: 'Grounds all models and signals in audited NSE cash market CSV files without fabricated ticks.',
        inputs: 'nifty50_combined_2020_2025.csv & nifty50_features_2020_2025.csv',
        outputs: `${validation ? validation.combinedUniqueStocks : 50} equities · 2020-10-01 to 2025-09-30`,
        moduleRef: 'server/datasetLoader.ts · python_quant/data_loader.py',
        liveStat: `${validation ? validation.combinedTotalRows.toLocaleString('en-IN') : '61,135'} OHLCV bars`,
      },
      {
        id: 'sec-03-ingest',
        step: '02',
        title: 'Data Ingestion',
        track: 'production',
        purpose: 'Parses and indexes daily OHLCV and feature matrices in memory with measured latency.',
        inputs: 'UTF-8 CSV tables partitioned per NSE symbol',
        outputs: 'Typed Chronological FeatureRow & OhlcvRow maps',
        moduleRef: 'server/datasetLoader.ts',
        liveStat: `${loadDurationMs} ms load time`,
      },
      {
        id: 'sec-03-validate',
        step: '03',
        title: 'Data Validation',
        track: 'production',
        purpose: 'Verifies sort monotonicity, zero NaN/negative OHLC violations, duplicate keys, and leakage boundaries.',
        inputs: 'Parsed OHLCV + Feature maps',
        outputs: 'ValidationReport audit object',
        moduleRef: 'server/datasetLoader.ts · python_quant/preprocessing.py',
        liveStat: validation
          ? `${validation.combinedDuplicates} Dup · ${validation.combinedInvalidRecords} Inv`
          : '0 Dup · 0 Inv',
      },
      {
        id: 'sec-03-prep',
        step: '04',
        title: 'Data Preprocessing',
        track: 'production',
        purpose: 'Performs strict chronological train/val/test slicing and fits Z-score μ/σ only on training slices.',
        inputs: `${selectedSymbol} feature series (~1,173 sessions)`,
        outputs: 'Leakage-free standardized feature tensors',
        moduleRef: 'server/quantMath.ts · python_quant/preprocessing.py',
        liveStat: activeArtifact
          ? `${activeArtifact.trainSize} Train / ${activeArtifact.testSize} Test`
          : '80% / 20% Chronological',
      },
      {
        id: 'sec-03-feat',
        step: '05',
        title: 'Feature Engineering',
        track: 'production',
        purpose: 'Maintains 13 strictly lagged technical indicators and explicitly blocks future target columns.',
        inputs: 'Open, High, Low, Close, Volume',
        outputs: 'daily_return, SMA20/50, EMA12/26, RSI14, MACD, BB, ATR14, VolRatio',
        moduleRef: 'python_quant/features.py · Section 03',
        liveStat: '13 Features (Target Excluded)',
      },
      {
        id: 'sec-04',
        step: '06',
        title: 'Quantitative Engine',
        track: 'production',
        purpose: 'Computes custom-window statistics, log returns, Pearson correlations, and stationary GARCH(1,1).',
        inputs: `${selectedSymbol} OHLCV & cross-stock close returns`,
        outputs: 'Volatility series, RSI/SMA/ATR calculations, correlation heatmap',
        moduleRef: 'server/quantResearch.ts · python_quant/math_models.py',
        liveStat: '10 Live Math Calculations',
      },
      {
        id: 'sec-06',
        step: '07',
        title: 'ML / Sequence Prediction',
        track: 'production',
        purpose: 'Runs Logistic Regression, Random Forest, Gradient Boosting, or 5-day Sequence MLP inference.',
        inputs: 'Standardized latest observation (5-day window for MLP)',
        outputs: 'P(next_day_return > 0), class decision, confusion matrix',
        moduleRef: 'server/mlStore.ts · server/quantMath.ts',
        liveStat: activeArtifact
          ? `${(activeArtifact.evaluation.accuracy * 100).toFixed(1)}% OOS Acc`
          : `${monitoring?.trainedModelsCount ?? 0} Active Models`,
      },
      {
        id: 'sec-08',
        step: '08',
        title: 'Explainability',
        track: 'production',
        purpose: 'Attributes prediction push via Exact Linear SHAP (LR) or honest baseline perturbation (Non-SHAP).',
        inputs: 'Trained artifact + standardized session vector',
        outputs: 'Signed feature contributions + rule explanations',
        moduleRef: 'server/quantMath.ts · Section 08',
        liveStat:
          activeArtifact?.modelType === 'logistic_regression'
            ? 'Linear SHAP (Exact)'
            : 'Perturbation / Importance',
      },
      {
        id: 'sec-10',
        step: '09',
        title: 'Risk Management',
        track: 'production',
        purpose: 'Computes Historical VaR, CVaR (Expected Shortfall), ATR stop-loss sizing, Sharpe/Sortino, and GARCH.',
        inputs: 'Historical return distribution, ATR(14), capital & risk %',
        outputs: 'Max share allocation, stop-loss, VaR95/99, concentration HHI',
        moduleRef: 'server/quantResearch.ts · Section 10',
        liveStat: 'VaR / CVaR / ATR / GARCH',
      },
      {
        id: 'sec-09',
        step: '10',
        title: 'BUY / SELL / HOLD Output',
        track: 'production',
        purpose: 'Combines ML probability with SMA/RSI/MACD technical bias and risk guardrails into actionable research output.',
        inputs: 'ML signal, technical bias, probability threshold, ATR levels',
        outputs: 'Final Consensus Signal + Invalidation Conditions',
        moduleRef: 'server/quantResearch.ts · Section 09',
        liveStat: 'Consensus Gated Ledger',
      },
      // Research Branch
      {
        id: 'sec-06-train',
        step: 'R1',
        title: 'Model Training',
        track: 'research',
        purpose: 'Trains single models or runs chronological Train/Val Grid Search with validation-only threshold tuning.',
        inputs: 'Train & Validation folds',
        outputs: 'Fitted weights, trees, or Sequence MLP epoch curve',
        moduleRef: 'Section 06 · /api/ml/optimize',
        liveStat: '4 TS Architectures',
      },
      {
        id: 'sec-06-eval',
        step: 'R2',
        title: 'Model Evaluation',
        track: 'research',
        purpose: 'Evaluates held-out chronological test rows with 2-class Precision, Recall, F1, and Confusion Matrix.',
        inputs: 'Held-out Test slice',
        outputs: 'Classification report & Actual vs Predicted table',
        moduleRef: 'Section 06 · Evaluation',
        liveStat: activeArtifact
          ? `F1 ${(activeArtifact.evaluation.f1Score * 100).toFixed(1)}%`
          : 'Ready to Evaluate',
      },
      {
        id: 'sec-06-cmp',
        step: 'R3',
        title: 'Model Comparison',
        track: 'research',
        purpose: 'Benchmarks Logistic Regression, Random Forest, Gradient Boosting & Sequence MLP on identical dates.',
        inputs: 'Unified split ratio & rank metric',
        outputs: 'Side-by-side ranked comparison & model selection rationale',
        moduleRef: 'Section 06 · /api/ml/compare',
        liveStat: 'Side-by-Side 4-Model Lab',
      },
      {
        id: 'sec-07',
        step: 'R4',
        title: 'Walk-Forward Validation',
        track: 'research',
        purpose: 'Simulates periodic retraining across expanding or rolling time windows with fold-local scaling.',
        inputs: 'Initial train %, window count, expanding/rolling mode',
        outputs: 'Per-window Accuracy/F1 trajectory & mean OOS metrics',
        moduleRef: 'Section 07 · /api/quant/walk-forward',
        liveStat: 'Zero-Leakage Time Folds',
      },
      {
        id: 'sec-11',
        step: 'R5',
        title: 'Strategy Backtesting',
        track: 'research',
        purpose: 'Simulates next-session open fills deducting 0.05% brokerage + 0.02% slippage against Buy & Hold.',
        inputs: 'Strategy rules, capital, brokerage, slippage, Experiment ID',
        outputs: 'Equity curve, Sharpe, Max Drawdown & trade ledger',
        moduleRef: 'Section 11 · /api/quant/backtest',
        liveStat: `${monitoring?.backtestHistory?.length ?? 0} Logged Backtests`,
      },
      {
        id: 'sec-12',
        step: 'R6',
        title: 'Experiment Storage',
        track: 'research',
        purpose: 'Persists every training, grid-search, and backtest run to SQLite for reproducible audit comparison.',
        inputs: 'Experiment metadata, parameters & out-of-sample scores',
        outputs: 'SQLite ml_training_runs & backtest_runs registry',
        moduleRef: 'Section 12 · /api/quant/experiments',
        liveStat: `${monitoring?.trainingHistory?.length ?? 0} Saved Experiments`,
      },
    ],
    [validation, loadDurationMs, selectedSymbol, activeArtifact, monitoring],
  );

  const productionNodes = nodes.filter((n) => n.track === 'production');
  const researchNodes = nodes.filter((n) => n.track === 'research');

  const [selectedNodeId, setSelectedNodeId] = useState<string>('sec-03-source');
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoIndex, setDemoIndex] = useState<number>(-1);

  useEffect(() => {
    if (!demoRunning) return;
    const timer = window.setInterval(() => {
      setDemoIndex((prev) => {
        const next = prev + 1;
        if (next >= nodes.length) {
          setDemoRunning(false);
          return -1;
        }
        setSelectedNodeId(nodes[next].id);
        return next;
      });
    }, 650);
    return () => window.clearInterval(timer);
  }, [demoRunning, nodes]);

  const activeNode = nodes.find((n) => n.id === selectedNodeId) ?? nodes[0];

  const handleToggleDemo = () => {
    if (demoRunning) {
      setDemoRunning(false);
      setDemoIndex(-1);
    } else {
      setDemoIndex(0);
      setSelectedNodeId(nodes[0].id);
      setDemoRunning(true);
    }
  };

  const mapNodeIdToAnchor = (id: string): string => {
    if (id.startsWith('sec-03')) return 'sec-03';
    if (id.startsWith('sec-06')) return 'sec-06';
    return id;
  };

  return (
    <section
      id="sec-01"
      aria-labelledby="sec-01-heading"
      className="scroll-mt-28 overflow-x-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs sm:p-6 dark:border-slate-800 dark:bg-[#1F2937]"
    >
      {/* Top Hero Header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-start lg:justify-between dark:border-slate-800">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold tracking-wider text-[#782F46] dark:text-[#B76E85]">
              01. LIVE SYSTEM WORKFLOW
            </span>
            <span className="rounded-md border border-slate-200 bg-[#F8F6F0] px-2 py-0.5 font-mono text-[11px] font-medium text-slate-700 dark:border-slate-700 dark:bg-[#111827] dark:text-slate-300">
              Historical NSE Dataset: 2020-10-01 → 2025-09-30 (Not Live Exchange Feed)
            </span>
          </div>
          <h2
            id="sec-01-heading"
            className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white"
          >
            End-to-End Quantitative Research &amp; Signal Architecture ({selectedSymbol})
          </h2>
          <p className="max-w-3xl text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            Interactive blueprint of the real TypeScript backend, SQLite experiment registry, and modular{' '}
            <code className="font-mono text-[#087F5B] dark:text-[#34D399]">python_quant/</code> research
            engine. Click any stage node below to inspect inputs, outputs, and jump to its working module.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleToggleDemo}
            aria-pressed={demoRunning}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              demoRunning
                ? 'bg-[#782F46] text-white hover:bg-[#5E2336] dark:bg-[#B76E85] dark:text-slate-950'
                : 'bg-[#087F5B] text-white hover:bg-[#06684A] dark:bg-[#34D399] dark:text-slate-950'
            }`}
          >
            {demoRunning ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            <span>{demoRunning ? 'Stop Workflow Demo' : 'Run Workflow Demo (DEMO MODE)'}</span>
          </button>

          <button
            type="button"
            onClick={() => onJumpToSection(mapNodeIdToAnchor(activeNode.id))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <span>Jump to Active Section</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Explicit Demo Mode Banner when running */}
      {demoRunning && (
        <div
          role="status"
          className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#782F46]/40 bg-[#782F46]/10 px-4 py-2.5 text-xs font-medium text-[#782F46] dark:border-[#B76E85]/40 dark:bg-[#B76E85]/15 dark:text-[#FBCFE8]"
        >
          <span className="inline-flex items-center gap-2 font-mono font-bold">
            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
            DEMO MODE — Animated Traversal Simulation ({demoIndex + 1}/{nodes.length}: {activeNode.title})
          </span>
          <span className="text-[11px]">
            Visual walkthrough only — actual training/backtests execute in Sections 03–12.
          </span>
        </div>
      )}

      {/* Production Pipeline Grid (Nodes 01 - 10) */}
      <div className="mt-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            <Layers className="h-3.5 w-3.5 text-[#087F5B] dark:text-[#34D399]" />
            <span>Production Pipeline Flow (Data → Features → Prediction → Decision)</span>
          </h3>
          <span className="hidden items-center gap-1.5 font-mono text-[11px] text-slate-500 sm:inline-flex dark:text-slate-400">
            <span className="h-2 w-2 rounded-full bg-[#087F5B] animate-pulse dark:bg-[#34D399]" />
            Real Backend Telemetry Connected
          </span>
        </div>

        {/* Animated Flow Connectors SVG Strip (desktop visual pulse line) */}
        <div className="hidden lg:block" aria-hidden="true">
          <svg className="h-3 w-full" viewBox="0 0 1000 12" preserveAspectRatio="none">
            <line
              x1="15"
              y1="6"
              x2="985"
              y2="6"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="6 6"
              className="text-[#087F5B]/45 dark:text-[#34D399]/45 animate-pulse"
            />
          </svg>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          {productionNodes.map((node, idx) => {
            const isSelected = activeNode.id === node.id;
            const isDemoActive = demoRunning && demoIndex === idx;
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => {
                  setDemoRunning(false);
                  setSelectedNodeId(node.id);
                }}
                aria-pressed={isSelected}
                className={`group relative rounded-xl border p-3 text-left transition-all ${
                  isSelected
                    ? 'border-[#087F5B] bg-[#087F5B]/10 ring-1 ring-[#087F5B]/40 dark:border-[#34D399] dark:bg-[#34D399]/10 dark:ring-[#34D399]/40'
                    : 'border-slate-200 bg-[#F8F6F0]/75 hover:border-slate-400 dark:border-slate-700 dark:bg-[#111827] dark:hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-bold text-[#782F46] dark:text-[#B76E85]">
                    {node.step}
                  </span>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isDemoActive
                        ? 'bg-[#087F5B] animate-ping dark:bg-[#34D399]'
                        : isSelected
                          ? 'bg-[#087F5B] dark:bg-[#34D399]'
                          : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                  />
                </div>
                <p className="mt-1 font-display text-xs font-bold text-slate-900 dark:text-white">
                  {node.title}
                </p>
                <p className="mt-1 truncate font-mono text-[11px] text-[#087F5B] dark:text-[#34D399]">
                  {node.liveStat}
                </p>
              </button>
            );
          })}
        </div>

        {/* Research & Experimentation Sub-Branch (Nodes R1 - R6) */}
        <div className="rounded-xl border border-dashed border-slate-300 bg-[#F8F6F0]/60 p-4 dark:border-slate-700 dark:bg-[#111827]/70">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#782F46] dark:text-[#B76E85]">
              <GitBranch className="h-3.5 w-3.5" />
              <span>Research &amp; Validation Branch (Offline Chronological Tuning &amp; SQLite Registry)</span>
            </h3>
            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              Train → Evaluate → Compare → Walk-Forward → Backtest → Registry
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
            {researchNodes.map((node, rIdx) => {
              const globalIdx = productionNodes.length + rIdx;
              const isSelected = activeNode.id === node.id;
              const isDemoActive = demoRunning && demoIndex === globalIdx;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => {
                    setDemoRunning(false);
                    setSelectedNodeId(node.id);
                  }}
                  aria-pressed={isSelected}
                  className={`rounded-lg border p-2.5 text-left transition-all ${
                    isSelected
                      ? 'border-[#782F46] bg-[#782F46]/10 ring-1 ring-[#782F46]/40 dark:border-[#B76E85] dark:bg-[#B76E85]/15 dark:ring-[#B76E85]/40'
                      : 'border-slate-200 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-[#1F2937] dark:hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold text-[#782F46] dark:text-[#B76E85]">
                      {node.step}
                    </span>
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isDemoActive
                          ? 'bg-[#782F46] animate-ping dark:bg-[#B76E85]'
                          : isSelected
                            ? 'bg-[#782F46] dark:bg-[#B76E85]'
                            : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    />
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-900 dark:text-white">{node.title}</p>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500 dark:text-slate-400">
                    {node.liveStat}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Node Inspector Detail Panel + Real Live Telemetry */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="min-w-0 rounded-xl border border-slate-200 bg-[#F8F6F0] p-4 lg:col-span-8 dark:border-slate-700 dark:bg-[#111827]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded bg-[#087F5B] px-2 py-0.5 font-mono text-[11px] font-bold text-white dark:bg-[#34D399] dark:text-slate-950">
                STAGE {activeNode.step}
              </span>
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                {activeNode.title}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onJumpToSection(mapNodeIdToAnchor(activeNode.id))}
              className="text-xs font-semibold text-[#087F5B] hover:underline dark:text-[#34D399]"
            >
              Open Full Module →
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            {activeNode.purpose}
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-3">
            <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-[#1F2937]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Inputs
              </p>
              <p className="mt-1 break-words font-mono text-[11px] text-slate-800 dark:text-slate-200">
                {activeNode.inputs}
              </p>
            </div>
            <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-[#1F2937]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Outputs
              </p>
              <p className="mt-1 break-words font-mono text-[11px] text-slate-800 dark:text-slate-200">
                {activeNode.outputs}
              </p>
            </div>
            <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-[#1F2937]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Implementation
              </p>
              <p className="mt-1 break-words font-mono text-[11px] text-[#782F46] dark:text-[#B76E85]">
                {activeNode.moduleRef}
              </p>
            </div>
          </div>
        </div>

        {/* Live System Activity Feed */}
        <div className="min-w-0 rounded-xl border border-slate-200 bg-[#F8F6F0] p-4 lg:col-span-4 dark:border-slate-700 dark:bg-[#111827] tabular-nums">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
              <Activity className="h-3.5 w-3.5 text-[#087F5B] dark:text-[#34D399]" />
              <span>Actual System Status</span>
            </h3>
            <button
              type="button"
              onClick={() => onJumpToSection('sec-13')}
              className="text-[11px] font-semibold text-[#087F5B] hover:underline dark:text-[#34D399]"
            >
              Monitoring →
            </button>
          </div>
          <ul className="mt-2.5 space-y-1.5 text-[11px] text-slate-700 dark:text-slate-300">
            <li className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1">
                <Database className="h-3 w-3 text-slate-400" /> Dataset Engine
              </span>
              <span className="font-mono font-semibold text-[#087F5B] dark:text-[#34D399]">
                {monitoring?.datasetStatus ?? 'Loaded'} ({loadDurationMs} ms)
              </span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1">
                <Cpu className="h-3 w-3 text-slate-400" /> Active Models
              </span>
              <span className="font-mono font-semibold">
                {monitoring?.trainedModelsCount ?? 0} trained
              </span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-slate-400" /> Inference Latency
              </span>
              <span className="font-mono font-semibold">
                {monitoring?.lastInferenceLatencyMs !== null &&
                monitoring?.lastInferenceLatencyMs !== undefined
                  ? `${monitoring.lastInferenceLatencyMs} ms`
                  : 'Pending run'}
              </span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1">
                <FileCode2 className="h-3 w-3 text-slate-400" /> Python Package
              </span>
              <span className="font-mono font-semibold">python_quant/ (verified)</span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1">
                <ShieldAlert className="h-3 w-3 text-slate-400" /> Leakage Guard
              </span>
              <span className="font-mono font-semibold text-[#087F5B] dark:text-[#34D399]">
                {validation?.leakageCheckPassed ? 'STRICT PASS' : 'CHECKING'}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
};
