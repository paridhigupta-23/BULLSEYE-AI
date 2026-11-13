import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  Database,
  Download,
  FileCode2,
  FlaskConical,
  Play,
  RefreshCw,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import {
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
  type DatasetInspectionResponse,
  type MathLabResponse,
  type PipelineStage,
  type PythonEnvironmentStatus,
  type StockSummary,
  type TrainedModelSummary,
  type ValidationReport,
} from '../../types/index.ts';

interface QuantSectionsPart1Props {
  activeSection?: string;
  selectedSymbol: string;
  stocks: StockSummary[];
  validation: ValidationReport | null;
  pipelineStages: PipelineStage[];
  loadDurationMs: number;
  reloadingPipeline: boolean;
  onRefreshPipeline: () => void;
  activeArtifact: TrainedModelSummary | null;
  trainedModelsCount?: number;
  backtestsCount?: number;
  onOpenSection?: (sectionNum: string) => void;
  onOpenPerformance?: () => void;
}

const CORRELATION_CANDIDATES = [
  'RELIANCE',
  'TCS',
  'HDFCBANK',
  'INFY',
  'ICICIBANK',
  'ADANIENT',
  'TATASTEEL',
  'SBIN',
];

export const QuantSectionsPart1: React.FC<QuantSectionsPart1Props> = ({
  activeSection,
  selectedSymbol,
  stocks,
  validation,
  pipelineStages,
  loadDurationMs,
  reloadingPipeline,
  onRefreshPipeline,
  activeArtifact,
  trainedModelsCount = 0,
  backtestsCount = 0,
  onOpenSection,
  onOpenPerformance,
}) => {
  const { theme } = useAppContext();
  const isDark = theme === 'dark';

  // Section 03: Dataset Inspection
  const [inspection, setInspection] = useState<DatasetInspectionResponse | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);

  // Section 04: Math Lab
  const [smaPeriod, setSmaPeriod] = useState(20);
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [volWindow, setVolWindow] = useState(20);
  const [atrPeriod, setAtrPeriod] = useState(14);
  const [compareSymbols, setCompareSymbols] = useState<string[]>([
    'RELIANCE',
    'TCS',
    'HDFCBANK',
    'INFY',
    'ICICIBANK',
  ]);
  const [mathLab, setMathLab] = useState<MathLabResponse | null>(null);
  const [mathLoading, setMathLoading] = useState(false);

  // Section 05: Python Workspace & DL Status
  const [pythonStatus, setPythonStatus] = useState<PythonEnvironmentStatus | null>(null);
  const [selectedPyFile, setSelectedPyFile] = useState<string>('dl_lstm.py');
  const [pyModelChoice, setPyModelChoice] = useState<'logistic_regression' | 'random_forest'>(
    'logistic_regression',
  );
  const [pyRunning, setPyRunning] = useState(false);
  const [pyRunOutput, setPyRunOutput] =
    useState<PythonEnvironmentStatus['lastRunResult']>(null);

  useEffect(() => {
    if (activeSection && activeSection !== '03') return;
    let cancelled = false;
    setInspectLoading(true);
    setInspectError(null);
    api
      .inspectDataset(selectedSymbol, 15, 0)
      .then((res) => {
        if (!cancelled) setInspection(res);
      })
      .catch((err) => {
        if (!cancelled) {
          setInspectError(err instanceof Error ? err.message : 'Dataset inspect failed');
        }
      })
      .finally(() => {
        if (!cancelled) setInspectLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSymbol, activeSection]);

  const handleRunMathLab = async () => {
    setMathLoading(true);
    try {
      const syms = Array.from(new Set([selectedSymbol, ...compareSymbols])).slice(0, 6);
      const res = await api.runMathLab({
        symbol: selectedSymbol,
        compareSymbols: syms,
        smaPeriod,
        rsiPeriod,
        volWindow,
        atrPeriod,
      });
      setMathLab(res);
    } finally {
      setMathLoading(false);
    }
  };

  useEffect(() => {
    if (activeSection && activeSection !== '04') return;
    handleRunMathLab().catch(() => {});
  }, [selectedSymbol, activeSection]);

  useEffect(() => {
    if (activeSection && activeSection !== '05') return;
    api
      .getPythonStatus()
      .then((res) => {
        setPythonStatus(res);
        setPyRunOutput(res.lastRunResult);
        if (res.files.length > 0 && !res.files.some((f) => f.name === selectedPyFile)) {
          setSelectedPyFile(res.files[0].name);
        }
      })
      .catch(() => {});
  }, [activeSection]);

  const handleDownloadCsv = async () => {
    setDownloadingCsv(true);
    try {
      const csv = await api.downloadDatasetCsv(selectedSymbol);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedSymbol}_features_2020_2025.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingCsv(false);
    }
  };

  const handleToggleCompareSymbol = (sym: string) => {
    setCompareSymbols((prev) => {
      if (prev.includes(sym)) {
        return prev.length > 2 ? prev.filter((s) => s !== sym) : prev;
      }
      return prev.length >= 6 ? prev : [...prev, sym];
    });
  };

  const handleRunPython = async () => {
    setPyRunning(true);
    try {
      const res = await api.runPythonPipeline(selectedSymbol, pyModelChoice);
      setPyRunOutput(res);
    } finally {
      setPyRunning(false);
    }
  };

  const activePyFileObj =
    pythonStatus?.files.find((f) => f.name === selectedPyFile) ?? pythonStatus?.files[0] ?? null;

  const volChartData = (mathLab?.rollingVsGarchSeries ?? []).slice(-180).map((pt) => ({
    date: pt.date.slice(2),
    rollingVol: Number(pt.rollingVolAnnualPct.toFixed(2)),
    garchVol: pt.garchVolAnnualPct !== null ? Number(pt.garchVolAnnualPct.toFixed(2)) : null,
  }));

  const availableCorpSymbols = Array.from(
    new Set([...CORRELATION_CANDIDATES, ...stocks.slice(0, 8).map((s) => s.symbol)]),
  );

  return (
    <div className="space-y-8">
      {/* ==================== 02. QUANT OVERVIEW ==================== */}
      {(!activeSection || activeSection === '02') && (
      <section
        id="sec-02"
        aria-labelledby="sec-02-heading"
        className="scroll-mt-28 space-y-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <span className="font-mono text-xs font-bold tracking-wider text-[#782F46] dark:text-[#B76E85]">
              02. QUANT OVERVIEW
            </span>
            <h2
              id="sec-02-heading"
              className="font-display text-xl font-bold text-slate-900 dark:text-white"
            >
              Quantitative Research Scope &amp; Active Symbol Summary
            </h2>
          </div>
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
            Active Focus: {selectedSymbol} · Historical NSE Dataset Ends 2025-09-30
          </span>
        </div>

        {/* Research Terminal Module Quick Links */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 tabular-nums">
          <button
            type="button"
            onClick={() => onOpenSection?.('03')}
            className="rounded-2xl border border-slate-200/90 bg-white p-4 text-left transition-colors hover:border-[#087F5B] dark:border-slate-800 dark:bg-[#1F2937]"
          >
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Dataset Audit Status
            </p>
            <p className="mt-1 font-mono text-lg font-bold text-[#087F5B] dark:text-[#34D399]">
              {validation?.leakageCheckPassed ? 'Zero-Leakage Pass' : 'Validated'}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-[#087F5B] dark:text-[#34D399]">
              Inspect 03. Dataset →
            </p>
          </button>

          <button
            type="button"
            onClick={() => onOpenSection?.('06')}
            className="rounded-2xl border border-slate-200/90 bg-white p-4 text-left transition-colors hover:border-[#087F5B] dark:border-slate-800 dark:bg-[#1F2937]"
          >
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Active Trained Models
            </p>
            <p className="mt-1 font-mono text-lg font-bold text-slate-900 dark:text-white">
              {trainedModelsCount}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-[#087F5B] dark:text-[#34D399]">
              Open 06. Train &amp; Compare →
            </p>
          </button>

          <button
            type="button"
            onClick={() => onOpenSection?.('11')}
            className="rounded-2xl border border-slate-200/90 bg-white p-4 text-left transition-colors hover:border-[#087F5B] dark:border-slate-800 dark:bg-[#1F2937]"
          >
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              SQLite Backtest Runs
            </p>
            <p className="mt-1 font-mono text-lg font-bold text-slate-900 dark:text-white">
              {backtestsCount}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-[#087F5B] dark:text-[#34D399]">
              Open 11. Backtest →
            </p>
          </button>

          <button
            type="button"
            onClick={() => onOpenPerformance?.()}
            className="rounded-2xl border border-slate-200/90 bg-white p-4 text-left transition-colors hover:border-[#087F5B] dark:border-slate-800 dark:bg-[#1F2937]"
          >
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Consolidated Metrics
            </p>
            <p className="mt-1 font-mono text-lg font-bold text-[#782F46] dark:text-[#B76E85]">
              5 Report Groups
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-[#087F5B] dark:text-[#34D399]">
              Open Final Performance →
            </p>
          </button>
        </div>

        {/* 6 Dataset & Active Model KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6 tabular-nums">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 dark:border-slate-800 dark:bg-[#1F2937]">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Raw OHLCV Rows</p>
            <p
              className="mt-1 font-mono text-lg font-bold text-slate-900 dark:text-white"
              data-testid="quant-combined-rows"
            >
              {validation ? validation.combinedTotalRows.toLocaleString('en-IN') : '—'}
            </p>
            <p className="mt-0.5 text-[11px] text-[#087F5B] dark:text-[#34D399]">
              {validation ? `${validation.combinedUniqueStocks} equities` : 'Loading'}
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
              {validation ? validation.combinedDateRange.start : '—'}
            </p>
            <p className="mt-0.5 font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">
              to {validation ? validation.combinedDateRange.end : '—'}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 dark:border-slate-800 dark:bg-[#1F2937]">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Validation Integrity</p>
            <p className="mt-1 font-mono text-sm font-bold text-[#087F5B] dark:text-[#34D399]">
              {validation
                ? `${validation.combinedDuplicates} Dup · ${validation.combinedInvalidRecords} Inv`
                : '—'}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Zero-Leakage Verified
            </p>
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
              {activeArtifact
                ? `F1 ${(activeArtifact.evaluation.f1Score * 100).toFixed(1)}%`
                : 'Train in Section 06'}
            </p>
          </div>
        </div>
      </section>
      )}

      {/* ==================== 03. DATASET PIPELINE ==================== */}
      {(!activeSection || activeSection === '03') && (
      <section
        id="sec-03"
        aria-labelledby="sec-03-heading"
        className="scroll-mt-28 space-y-6 rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <span className="font-mono text-xs font-bold tracking-wider text-[#782F46] dark:text-[#B76E85]">
              03. DATASET PIPELINE
            </span>
            <h2
              id="sec-03-heading"
              className="font-display text-xl font-bold text-slate-900 dark:text-white"
            >
              9-Stage Quantitative Ingestion, Audit &amp; Feature Engineering ({selectedSymbol})
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Measured load latency: {loadDurationMs} ms · Raw rows:{' '}
              {inspection?.rawRowCount ?? '—'} · Clean feature rows:{' '}
              {inspection?.featureRowCount ?? '—'} · Strictly excludes{' '}
              <code className="font-mono">next_day_return</code> &amp;{' '}
              <code className="font-mono">target_direction</code> from predictors.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={reloadingPipeline}
              onClick={onRefreshPipeline}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#111827] dark:text-slate-100"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${reloadingPipeline ? 'animate-spin' : ''}`} />
              <span>Re-Ingest &amp; Audit CSVs</span>
            </button>

            <button
              type="button"
              disabled={downloadingCsv}
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#087F5B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#06684A] disabled:opacity-60 dark:bg-[#34D399] dark:text-slate-950"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{downloadingCsv ? 'Exporting...' : `Download ${selectedSymbol} Features CSV`}</span>
            </button>
          </div>
        </div>

        {/* 9 Pipeline Stage Cards */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
                  <span className="font-semibold">In:</span> {stage.inputSummary}
                </p>
                <p>
                  <span className="font-semibold">Out:</span> {stage.outputSummary}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Audit Integrity Banner */}
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-[#F8F6F0] p-4 sm:grid-cols-4 dark:border-slate-700 dark:bg-[#111827] tabular-nums">
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Chronological Sort</p>
            <p className="font-mono text-sm font-bold text-[#087F5B] dark:text-[#34D399]">
              {inspection?.chronologicalSorted ? 'PASS (Ascending Date)' : 'Checking'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Missing Values</p>
            <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">
              {inspection ? inspection.missingValuesTotal : '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Duplicate Key Pairs</p>
            <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">
              {inspection ? inspection.duplicatesTotal : '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Excluded Target Columns</p>
            <p className="font-mono text-xs font-bold text-[#782F46] dark:text-[#B76E85]">
              next_day_return, target_direction
            </p>
          </div>
        </div>

        {/* 13 Feature Distributions & Economic Rationale */}
        <div>
          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            13 ML Input Features — Formulas, Model Role &amp; Distribution ({selectedSymbol})
          </h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="py-2 pr-3">Feature</th>
                  <th className="py-2 pr-3">Formula</th>
                  <th className="py-2 pr-3">Latest</th>
                  <th className="py-2 pr-3">Min / Mean / Max</th>
                  <th className="py-2 pr-3">Std Dev</th>
                  <th className="py-2">Trading &amp; Model Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(inspection?.featureStats ?? []).map((stat) => (
                  <tr key={stat.feature}>
                    <td className="py-2 pr-3 font-mono font-semibold text-slate-900 dark:text-white">
                      {stat.feature}
                    </td>
                    <td className="py-2 pr-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      {stat.formula}
                    </td>
                    <td className="py-2 pr-3 font-mono font-bold text-[#087F5B] dark:text-[#34D399]">
                      {Number(stat.latestValue).toFixed(4)}
                    </td>
                    <td className="py-2 pr-3 font-mono text-[11px]">
                      {stat.min.toFixed(2)} / {stat.mean.toFixed(2)} / {stat.max.toFixed(2)}
                    </td>
                    <td className="py-2 pr-3 font-mono text-[11px]">{stat.std.toFixed(3)}</td>
                    <td className="py-2 text-[11px] text-slate-600 dark:text-slate-300">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {stat.tellsModel}
                      </span>{' '}
                      — {stat.tradingUsefulness}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Interactive Symbol Data Preview Table */}
        <div>
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Latest Historical Feature Rows Preview ({selectedSymbol})
            </h3>
            {inspectLoading && (
              <span className="font-mono text-xs text-slate-500">Loading CSV rows...</span>
            )}
          </div>
          {inspectError && <p className="mt-2 text-xs text-[#782F46]">{inspectError}</p>}
          <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-left font-mono text-[11px] tabular-nums">
              <thead className="bg-[#F8F6F0] text-slate-600 dark:bg-[#111827] dark:text-slate-400">
                <tr>
                  <th className="px-2.5 py-2">Date</th>
                  <th className="px-2.5 py-2">Close</th>
                  <th className="px-2.5 py-2">Return %</th>
                  <th className="px-2.5 py-2">SMA20</th>
                  <th className="px-2.5 py-2">RSI14</th>
                  <th className="px-2.5 py-2">MACD</th>
                  <th className="px-2.5 py-2">ATR14</th>
                  <th className="px-2.5 py-2">VolRatio</th>
                  <th className="px-2.5 py-2">Target (Excluded)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(inspection?.previewRows ?? []).slice(0, 10).map((row) => (
                  <tr key={row.date}>
                    <td className="px-2.5 py-1.5 font-semibold">{row.date}</td>
                    <td className="px-2.5 py-1.5">{formatINR(row.close)}</td>
                    <td
                      className={`px-2.5 py-1.5 font-semibold ${
                        row.daily_return >= 0
                          ? 'text-[#087F5B] dark:text-[#34D399]'
                          : 'text-[#782F46] dark:text-[#B76E85]'
                      }`}
                    >
                      {(row.daily_return * 100).toFixed(2)}%
                    </td>
                    <td className="px-2.5 py-1.5">{row.sma_20.toFixed(1)}</td>
                    <td className="px-2.5 py-1.5">{row.rsi_14.toFixed(1)}</td>
                    <td className="px-2.5 py-1.5">{row.macd.toFixed(2)}</td>
                    <td className="px-2.5 py-1.5">{row.atr_14.toFixed(2)}</td>
                    <td className="px-2.5 py-1.5">{row.volume_ratio.toFixed(2)}x</td>
                    <td className="px-2.5 py-1.5 text-slate-500">
                      {row.target_direction === 1 ? '1 (Up)' : '0 (Down/Flat)'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      )}

      {/* ==================== 04. MATHEMATICAL & STATISTICAL MODELLING ==================== */}
      {(!activeSection || activeSection === '04') && (
      <section
        id="sec-04"
        aria-labelledby="sec-04-heading"
        className="scroll-mt-28 space-y-6 rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]"
      >
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between dark:border-slate-800">
          <div>
            <span className="font-mono text-xs font-bold tracking-wider text-[#782F46] dark:text-[#B76E85]">
              04. MATHEMATICAL &amp; STATISTICAL MODELLING
            </span>
            <h2
              id="sec-04-heading"
              className="font-display text-xl font-bold text-slate-900 dark:text-white"
            >
              Interactive Quantitative Equations, Rolling Vol vs GARCH(1,1) &amp; Correlations
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <div>
              <label htmlFor="math-sma" className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                SMA Window
              </label>
              <input
                id="math-sma"
                type="number"
                min={5}
                max={200}
                value={smaPeriod}
                onChange={(e) => setSmaPeriod(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-[#111827]"
              />
            </div>
            <div>
              <label htmlFor="math-rsi" className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                RSI Period
              </label>
              <input
                id="math-rsi"
                type="number"
                min={5}
                max={60}
                value={rsiPeriod}
                onChange={(e) => setRsiPeriod(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-[#111827]"
              />
            </div>
            <div>
              <label htmlFor="math-vol" className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                Rolling Vol
              </label>
              <input
                id="math-vol"
                type="number"
                min={5}
                max={120}
                value={volWindow}
                onChange={(e) => setVolWindow(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-[#111827]"
              />
            </div>
            <div>
              <label htmlFor="math-atr" className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                ATR Period
              </label>
              <input
                id="math-atr"
                type="number"
                min={5}
                max={60}
                value={atrPeriod}
                onChange={(e) => setAtrPeriod(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-[#111827]"
              />
            </div>
            <div className="col-span-2 sm:col-span-1 flex items-end">
              <button
                type="button"
                disabled={mathLoading}
                onClick={handleRunMathLab}
                className="w-full rounded-lg bg-[#087F5B] px-3 py-2 text-xs font-semibold text-white hover:bg-[#06684A] disabled:opacity-60 dark:bg-[#34D399] dark:text-slate-950"
              >
                {mathLoading ? 'Computing...' : 'Recalculate'}
              </button>
            </div>
          </div>
        </div>

        {/* All 10 Numbered Mathematical Calculations */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {(mathLab?.calculations ?? []).map((calc, idx) => (
            <div
              key={calc.id}
              className="rounded-xl border border-slate-200 bg-[#F8F6F0]/75 p-4 dark:border-slate-700 dark:bg-[#111827]"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-[11px] font-bold text-[#782F46] dark:text-[#B76E85]">
                    {String(idx + 1).padStart(2, '0')} · {calc.periodLabel}
                  </span>
                  <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    {calc.name}
                  </h3>
                </div>
                <span className="font-mono text-sm font-bold tabular-nums text-[#087F5B] dark:text-[#34D399]">
                  {calc.latestOutput}
                </span>
              </div>
              <p className="mt-2 rounded bg-white px-2.5 py-1.5 font-mono text-[11px] text-slate-800 dark:bg-[#1F2937] dark:text-slate-200">
                {calc.formula}
              </p>
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                Variables: {calc.variablesExplanation}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                {calc.interpretation}
              </p>
            </div>
          ))}
        </div>

        {/* Rolling Volatility vs Conditional GARCH(1,1) Chart + Correlation Matrix */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="min-w-0 rounded-xl border border-slate-200 bg-[#F8F6F0]/60 p-4 lg:col-span-6 dark:border-slate-700 dark:bg-[#111827]">
            <div className="mb-2">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Rolling Historical Volatility ({volWindow}d) vs Conditional GARCH(1,1)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Volatility clustering risk estimators only — neither series predicts upward/downward price direction.
              </p>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={volChartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E2E8F0'} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: isDark ? '#9CA3AF' : '#64748B' }} minTickGap={24} />
                  <YAxis tick={{ fontSize: 10, fill: isDark ? '#9CA3AF' : '#64748B' }} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#111827' : '#FFFFFF',
                      borderColor: isDark ? '#374151' : '#E2E8F0',
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="rollingVol"
                    name={`Rolling ${volWindow}d Vol (%)`}
                    stroke={isDark ? '#38BDF8' : '#0284C7'}
                    strokeWidth={1.8}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="garchVol"
                    name="Conditional GARCH(1,1) (%)"
                    stroke={isDark ? '#B76E85' : '#782F46'}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="min-w-0 rounded-xl border border-slate-200 bg-[#F8F6F0]/60 p-4 lg:col-span-6 dark:border-slate-700 dark:bg-[#111827]">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Aligned Daily Return Pearson Correlation Matrix
              </h3>
              <div className="flex flex-wrap gap-1">
                {availableCorpSymbols.slice(0, 7).map((sym) => {
                  const selected = compareSymbols.includes(sym) || sym === selectedSymbol;
                  return (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => handleToggleCompareSymbol(sym)}
                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold border ${
                        selected
                          ? 'border-[#087F5B] bg-[#087F5B]/15 text-[#087F5B] dark:border-[#34D399] dark:text-[#34D399]'
                          : 'border-slate-300 text-slate-500 dark:border-slate-700'
                      }`}
                    >
                      {sym}
                    </button>
                  );
                })}
              </div>
            </div>

            {mathLab && mathLab.correlationSymbols.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-center font-mono text-[11px] tabular-nums">
                  <thead>
                    <tr className="text-slate-500 dark:text-slate-400">
                      <th className="p-1.5 text-left">Ticker</th>
                      {mathLab.correlationSymbols.map((s) => (
                        <th key={s} className="p-1.5">
                          {s}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mathLab.correlationSymbols.map((rowSym, rIdx) => (
                      <tr key={rowSym} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="p-1.5 text-left font-bold text-slate-800 dark:text-slate-200">
                          {rowSym}
                        </td>
                        {mathLab.correlationMatrix[rIdx].map((val, cIdx) => {
                          const strong = val > 0.6 && rIdx !== cIdx;
                          return (
                            <td
                              key={cIdx}
                              className={`p-1.5 rounded ${
                                rIdx === cIdx
                                  ? 'font-bold text-slate-500'
                                  : strong
                                    ? 'bg-[#782F46]/15 font-bold text-[#782F46] dark:bg-[#B76E85]/20 dark:text-[#FBCFE8]'
                                    : 'text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {val.toFixed(2)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>
      )}

      {/* ==================== 05. AI/ML/DL MODEL DEVELOPMENT ==================== */}
      {(!activeSection || activeSection === '05') && (
      <section
        id="sec-05"
        aria-labelledby="sec-05-heading"
        className="scroll-mt-28 space-y-6 rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <span className="font-mono text-xs font-bold tracking-wider text-[#782F46] dark:text-[#B76E85]">
              05. AI / ML / DL MODEL DEVELOPMENT
            </span>
            <h2
              id="sec-05-heading"
              className="font-display text-xl font-bold text-slate-900 dark:text-white"
            >
              Supervised Classifiers, Temporal Sequence MLP &amp; Modular <code className="font-mono">python_quant/</code> Engine
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-[#F8F6F0] px-2.5 py-1 font-mono text-[11px] dark:border-slate-700 dark:bg-[#111827]">
            <Terminal className="h-3.5 w-3.5 text-[#087F5B] dark:text-[#34D399]" />
            Python {pythonStatus?.pythonVersion ?? '3.x'}
          </span>
        </div>

        {/* 4 TypeScript Models + Honest TensorFlow/PyTorch Status Card */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: 'Logistic Regression (L2 Baseline)',
              type: 'Linear Discriminative Classifier',
              strengths: 'Fast convergence, L2 regularization, Exact Linear SHAP attribution.',
              limitations: 'Captures linear decision boundaries across features.',
              status: 'ACTIVE IN TS + PYTHON',
            },
            {
              title: 'Random Forest (25 Bagged Trees)',
              type: 'Non-Linear Ensemble Classifier',
              strengths: 'Captures indicator regime interactions (RSI x ATR x MACD).',
              limitations: 'Uses perturbation importance rather than exact TreeSHAP.',
              status: 'ACTIVE IN TS + PYTHON',
            },
            {
              title: 'Gradient Boosting (XGBoost-Style)',
              type: 'Sequential Residual Stump Boosting',
              strengths: 'Learns subtle non-linear directional edges with shrinkage.',
              limitations: 'Requires careful depth/shrinkage tuning on validation fold.',
              status: 'ACTIVE IN TS + PYTHON',
            },
            {
              title: 'Sequence MLP (5-Day Lookback Net)',
              type: 'Pure-TS Temporal Neural Network',
              strengths: '5-day rolling feature window (65 inputs → 14 tanh → 1 sigmoid) with real BCE train/val loss curves.',
              limitations:
                'Full TensorFlow/PyTorch LSTM (python_quant/dl_lstm.py) requires installing requirements.txt in local Python.',
              status: 'ACTIVE PURE-TS + TF SPEC',
            },
          ].map((card) => (
            <div
              key={card.title}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-[#F8F6F0]/75 p-4 dark:border-slate-700 dark:bg-[#111827]"
            >
              <div>
                <span className="font-mono text-[10px] font-bold text-[#087F5B] dark:text-[#34D399]">
                  {card.status}
                </span>
                <h3 className="mt-1 font-display text-sm font-bold text-slate-900 dark:text-white">
                  {card.title}
                </h3>
                <p className="mt-0.5 text-[11px] font-medium text-[#782F46] dark:text-[#B76E85]">
                  {card.type}
                </p>
                <p className="mt-2 text-xs text-slate-700 dark:text-slate-300">
                  <span className="font-semibold">Strengths:</span> {card.strengths}
                </p>
              </div>
              <p className="mt-2 border-t border-slate-200 pt-2 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <span className="font-semibold">Honest Note:</span> {card.limitations}
              </p>
            </div>
          ))}
        </div>

        {/* Honest Python Runtime Capability Probe + Interactive Source Code Viewer & Live Runner */}
        <div className="rounded-xl border border-slate-200 bg-[#F8F6F0] p-4 dark:border-slate-700 dark:bg-[#111827]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="flex items-center gap-1.5 font-display text-sm font-bold text-slate-900 dark:text-white">
                <FileCode2 className="h-4 w-4 text-[#087F5B] dark:text-[#34D399]" />
                <span>Modular Python Quant Package (<code className="font-mono">python_quant/</code>) — Code Viewer &amp; Live Subprocess Runner</span>
              </h3>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                {pythonStatus?.deepLearningNote ??
                  'Auditing installed Python scientific stack in server environment...'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <select
                aria-label="Python runner model"
                value={pyModelChoice}
                onChange={(e) =>
                  setPyModelChoice(e.target.value as 'logistic_regression' | 'random_forest')
                }
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-[#1F2937]"
              >
                <option value="logistic_regression">Python Logistic Regression</option>
                <option value="random_forest">Python Decision Ensemble</option>
              </select>

              <button
                type="button"
                disabled={pyRunning || !pythonStatus?.pythonAvailable}
                onClick={handleRunPython}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#087F5B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#06684A] disabled:opacity-60 dark:bg-[#34D399] dark:text-slate-950"
              >
                <Play className="h-3.5 w-3.5" />
                <span>{pyRunning ? 'Executing python3...' : `Run python3 on ${selectedSymbol}`}</span>
              </button>
            </div>
          </div>

          {/* Package Capability Indicators */}
          {pythonStatus && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(pythonStatus.packages).map(([pkg, installed]) => (
                <span
                  key={pkg}
                  className={`rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold ${
                    installed
                      ? 'border-[#087F5B]/40 bg-[#087F5B]/10 text-[#087F5B] dark:text-[#34D399]'
                      : 'border-slate-300 bg-white text-slate-500 dark:border-slate-700 dark:bg-[#1F2937] dark:text-slate-400'
                  }`}
                >
                  {pkg}: {installed ? 'INSTALLED' : 'NOT INSTALLED (Stdlib Fallback Active)'}
                </span>
              ))}
            </div>
          )}

          {/* File Tabs + Code Viewer & Live Execution Output */}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="min-w-0 lg:col-span-7">
              <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-1">
                {(pythonStatus?.files ?? []).map((f) => (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => setSelectedPyFile(f.name)}
                    className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-semibold whitespace-nowrap ${
                      activePyFileObj?.name === f.name
                        ? 'bg-[#782F46] text-white dark:bg-[#B76E85] dark:text-slate-950'
                        : 'bg-white text-slate-700 border border-slate-200 dark:bg-[#1F2937] dark:text-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
              <pre className="max-h-72 max-w-full overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-100 dark:border-slate-800">
                {activePyFileObj?.content ?? '# Select a Python module above'}
              </pre>
            </div>

            <div className="min-w-0 lg:col-span-5">
              <p className="mb-2 flex items-center gap-1.5 font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                <FlaskConical className="h-3.5 w-3.5 text-[#087F5B] dark:text-[#34D399]" />
                <span>Real <code className="font-mono">python3 -m python_quant.run_pipeline</code> Output</span>
              </p>
              <pre className="max-h-72 max-w-full overflow-auto rounded-lg border border-slate-200 bg-white p-3 font-mono text-[11px] leading-relaxed text-slate-800 dark:border-slate-700 dark:bg-[#1F2937] dark:text-slate-200">
                {pyRunOutput
                  ? pyRunOutput.error
                    ? `Execution Error:\n${pyRunOutput.error}`
                    : JSON.stringify(pyRunOutput.output ?? pyRunOutput.rawStdout, null, 2)
                  : `Click "Run python3 on ${selectedSymbol}" to execute the live Python quant pipeline subprocess against real CSV data.`}
              </pre>
            </div>
          </div>
        </div>
      </section>
      )}
    </div>
  );
};
