import React, { useEffect, useState } from 'react';
import {
  Activity,
  Archive,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Database,
  FileCode2,
  GitBranch,
  GitMerge,
  Home,
  Layers,
  LayoutDashboard,
  LogOut,
  PlayCircle,
  RefreshCw,
  ShieldAlert,
  Sigma,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext.tsx';
import { api } from '../services/api.ts';
import {
  type BacktestResult,
  type ModelType,
  type MonitoringStatus,
  type PipelineStage,
  type StockDetailResponse,
  type StockSummary,
  type TrainedModelSummary,
  type ValidationReport,
} from '../types/index.ts';
import { BrokerProfilePage } from './broker/BrokerSubPages.tsx';
import { FinalPerformancePage } from './broker/FinalPerformancePage.tsx';
import { QuantWorkflowHero } from './broker/QuantWorkflowHero.tsx';
import { QuantSectionsPart1 } from './broker/QuantSectionsPart1.tsx';
import { QuantSectionsPart2 } from './broker/QuantSectionsPart2.tsx';
import { QuantSectionsPart3 } from './broker/QuantSectionsPart3.tsx';

interface BrokerPortalProps {
  stocks: StockSummary[];
  onRefreshStocks: () => void;
}

type BrokerPageId = 'home' | 'performance' | 'profile';

interface ResearchSectionMeta {
  num: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const RESEARCH_SECTIONS: ResearchSectionMeta[] = [
  {
    num: '01',
    title: 'Workflow',
    description: 'End-to-end live quantitative pipeline & data-to-signal architecture.',
    icon: GitBranch,
  },
  {
    num: '02',
    title: 'Overview',
    description: 'Research scope, validation integrity & active symbol KPIs.',
    icon: LayoutDashboard,
  },
  {
    num: '03',
    title: 'Dataset',
    description: '9-stage CSV ingestion, 13-feature distributions & historical rows.',
    icon: Database,
  },
  {
    num: '04',
    title: 'Math Lab',
    description: 'Custom statistical indicators, GARCH(1,1) & return correlations.',
    icon: Sigma,
  },
  {
    num: '05',
    title: 'AI/DL & Python',
    description: 'ML/Sequence MLP models, python_quant/ code & live runner.',
    icon: FileCode2,
  },
  {
    num: '06',
    title: 'Train & Compare',
    description: 'Chronological training, validation grid search & 4-model benchmark.',
    icon: Cpu,
  },
  {
    num: '07',
    title: 'Walk-Forward',
    description: 'Expanding & rolling time-series out-of-sample cross-validation.',
    icon: Layers,
  },
  {
    num: '08',
    title: 'Explainability',
    description: 'Exact Linear SHAP & baseline-replaced perturbation attributions.',
    icon: Sparkles,
  },
  {
    num: '09',
    title: 'Signals',
    description: 'ML predictions vs technical bias consensus & invalidation rules.',
    icon: GitMerge,
  },
  {
    num: '10',
    title: 'Risk',
    description: 'Historical VaR/CVaR, ATR position sizing, Sharpe & concentration.',
    icon: ShieldAlert,
  },
  {
    num: '11',
    title: 'Backtest',
    description: 'Walk-forward ML & rule-based chronological equity simulation.',
    icon: PlayCircle,
  },
  {
    num: '12',
    title: 'Registry',
    description: 'Persistent SQLite training experiments & side-by-side deltas.',
    icon: Archive,
  },
  {
    num: '13',
    title: 'Monitor',
    description: 'Backend inference latency, system health & SQLite audit trail.',
    icon: Activity,
  },
];

const VALID_SECTION_NUMS = new Set(RESEARCH_SECTIONS.map((s) => s.num));

function parseSectionFromUrl(): string | null {
  const sec = new URLSearchParams(window.location.search).get('section');
  if (sec && VALID_SECTION_NUMS.has(sec)) return sec;
  return null;
}

function normalizeSectionId(sectionRef: string): string {
  const cleaned = sectionRef.replace(/^sec-/, '');
  return VALID_SECTION_NUMS.has(cleaned) ? cleaned : '01';
}

const BROKER_PAGES: Array<{
  id: BrokerPageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'home', label: 'Research Home', icon: Home },
  { id: 'performance', label: 'Final Performance', icon: BarChart3 },
  { id: 'profile', label: 'Profile', icon: UserCheck },
];

export const BrokerPortal: React.FC<BrokerPortalProps> = ({ stocks, onRefreshStocks }) => {
  const { selectedSymbol, setSelectedSymbol, t, user, logoutUser } = useAppContext();

  const [brokerPage, setBrokerPage] = useState<BrokerPageId>(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab === 'performance' || tab === 'profile') return tab;
    return 'home';
  });

  const [activeSection, setActiveSection] = useState<string | null>(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab && tab !== 'home') return null;
    return parseSectionFromUrl();
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', brokerPage);
    if (brokerPage === 'home' && activeSection) {
      url.searchParams.set('section', activeSection);
    } else {
      url.searchParams.delete('section');
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, [brokerPage, activeSection]);

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
  const [experimentsVersion, setExperimentsVersion] = useState(0);

  // Backtesting state
  const [btStrategy, setBtStrategy] = useState<
    'ml_model' | 'sma_crossover' | 'rsi_mean_reversion' | 'rsi_macd' | 'combined_ml_tech'
  >('ml_model');
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
    const matchingModel =
      res.trainedModels.find((m) => m.modelType === mType) ?? res.trainedModels[0] ?? null;
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
      setExperimentsVersion((v) => v + 1);
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

  const handleRunBacktest = async (e: React.FormEvent, experimentId?: string | null) => {
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
        experimentId: experimentId ?? null,
      });
      setBtResult(res);
      await loadMonitoring();
      setExperimentsVersion((v) => v + 1);
    } catch (err) {
      setBtError(err instanceof Error ? err.message : 'Backtest failed');
    } finally {
      setBtLoading(false);
    }
  };

  const openSection = (sectionRef: string) => {
    const num = normalizeSectionId(sectionRef);
    setBrokerPage('home');
    setActiveSection(num);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activeSectionIdx = activeSection
    ? RESEARCH_SECTIONS.findIndex((s) => s.num === activeSection)
    : -1;
  const activeSectionMeta = activeSectionIdx >= 0 ? RESEARCH_SECTIONS[activeSectionIdx] : null;
  const prevSectionMeta = activeSectionIdx > 0 ? RESEARCH_SECTIONS[activeSectionIdx - 1] : null;
  const nextSectionMeta =
    activeSectionIdx >= 0 && activeSectionIdx < RESEARCH_SECTIONS.length - 1
      ? RESEARCH_SECTIONS[activeSectionIdx + 1]
      : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header + 3-Page Research Terminal Navigation */}
      <div className="space-y-4 border-b border-slate-200 pb-5 dark:border-slate-800">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
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

          {(brokerPage === 'home' || brokerPage === 'performance') && (
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor="broker-stock-select"
                className="text-xs font-medium text-slate-600 dark:text-slate-300"
              >
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
          )}
        </div>

        {/* Focused 3-Tab Broker Research Navigation */}
        <nav aria-label="Broker Portal Navigation" className="flex flex-wrap items-center gap-2">
          {BROKER_PAGES.map((page) => {
            const Icon = page.icon;
            const active = brokerPage === page.id;

            return (
              <button
                key={page.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  setBrokerPage(page.id);
                  if (page.id === 'home' && brokerPage === 'home') {
                    setActiveSection(null);
                  }
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'border-[#087F5B] bg-[#087F5B] text-white dark:border-[#34D399] dark:bg-[#34D399] dark:text-slate-950'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#1F2937] dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{page.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Status Notice Banner */}
      {statusMessage && brokerPage === 'home' && (
        <div
          role="status"
          className="rounded-xl border border-[#087F5B]/30 bg-[#087F5B]/10 px-4 py-2.5 text-xs font-medium text-[#087F5B] dark:border-[#34D399]/30 dark:bg-[#34D399]/10 dark:text-[#34D399]"
        >
          {statusMessage}
        </div>
      )}

      {/* PAGE 1A: RESEARCH HOME INITIAL 13-CARD GRID */}
      {brokerPage === 'home' && !activeSection && (
        <div className="space-y-6 pb-12" data-testid="broker-research-grid">
          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200/90 bg-white p-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-[#1F2937]">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Quantitative Research Terminal — 13 Core Modules
              </h2>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                Select any module below to inspect calculations, train classifiers, run walk-forward validation, or simulate backtests for{' '}
                <span className="font-mono font-bold text-[#087F5B] dark:text-[#34D399]">
                  {selectedSymbol}
                </span>.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-slate-600 dark:text-slate-300 shrink-0 tabular-nums">
              <span>
                {validation
                  ? `${validation.combinedUniqueStocks} Equities · ${validation.combinedTotalRows.toLocaleString('en-IN')} Bars`
                  : 'Loading NSE Data...'}
              </span>
              <button
                type="button"
                onClick={() => setBrokerPage('performance')}
                className="inline-flex items-center gap-1 rounded-lg bg-[#087F5B]/10 px-3 py-1.5 font-sans text-xs font-semibold text-[#087F5B] hover:bg-[#087F5B]/20 dark:bg-[#34D399]/15 dark:text-[#34D399]"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                <span>Final Performance Summary</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {RESEARCH_SECTIONS.map((sec) => {
              const Icon = sec.icon;
              return (
                <button
                  key={sec.num}
                  type="button"
                  onClick={() => openSection(sec.num)}
                  data-testid={`research-card-${sec.num}`}
                  className="group flex h-full min-h-[158px] flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 text-left shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:border-[#087F5B] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087F5B] dark:border-slate-800 dark:bg-[#1F2937] dark:hover:border-[#34D399]"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold tracking-wider text-[#087F5B] dark:text-[#34D399]">
                        SECTION {sec.num}
                      </span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F8F6F0] text-slate-700 transition-colors group-hover:bg-[#087F5B]/10 group-hover:text-[#087F5B] dark:bg-[#111827] dark:text-slate-300 dark:group-hover:bg-[#34D399]/15 dark:group-hover:text-[#34D399]">
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>

                    <div>
                      <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                        {sec.num}. {sec.title}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {sec.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-semibold text-[#087F5B] dark:border-slate-800 dark:text-[#34D399]">
                    <span>Open Module</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* PAGE 1B: SELECTED SINGLE SECTION DETAIL VIEW */}
      {brokerPage === 'home' && activeSection && (
        <div className="min-w-0 space-y-6 pb-16 sm:pb-6" data-testid={`active-section-${activeSection}`}>
          {/* Back to Research Home & Quick Section Switcher Bar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-[#1F2937]">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveSection(null)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-[#F8F6F0] px-3.5 py-2 text-xs font-semibold text-slate-900 transition-colors hover:border-[#087F5B] hover:text-[#087F5B] dark:border-slate-700 dark:bg-[#111827] dark:text-white dark:hover:border-[#34D399] dark:hover:text-[#34D399]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Research Home</span>
              </button>

              {activeSectionMeta && (
                <div className="text-xs">
                  <span className="font-mono font-bold text-[#087F5B] dark:text-[#34D399]">
                    {activeSectionMeta.num}. {activeSectionMeta.title}
                  </span>
                  <span className="hidden text-slate-400 sm:inline"> · </span>
                  <span className="hidden text-slate-500 sm:inline dark:text-slate-400">
                    {activeSectionMeta.description}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!prevSectionMeta}
                onClick={() => prevSectionMeta && openSection(prevSectionMeta.num)}
                aria-label="Previous section"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-[#111827] dark:text-slate-200"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{prevSectionMeta ? prevSectionMeta.num : 'Prev'}</span>
              </button>

              <select
                aria-label="Jump to research section"
                value={activeSection}
                onChange={(e) => openSection(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
              >
                {RESEARCH_SECTIONS.map((sec) => (
                  <option key={sec.num} value={sec.num}>
                    {sec.num}. {sec.title}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={!nextSectionMeta}
                onClick={() => nextSectionMeta && openSection(nextSectionMeta.num)}
                aria-label="Next section"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-[#111827] dark:text-slate-200"
              >
                <span className="hidden sm:inline">{nextSectionMeta ? nextSectionMeta.num : 'Next'}</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Render ONLY the selected section component */}
          {activeSection === '01' && (
            <QuantWorkflowHero
              selectedSymbol={selectedSymbol}
              validation={validation}
              activeArtifact={activeArtifact}
              monitoring={monitoring}
              loadDurationMs={loadDurationMs}
              onJumpToSection={openSection}
            />
          )}

          {['02', '03', '04', '05'].includes(activeSection) && (
            <QuantSectionsPart1
              activeSection={activeSection}
              selectedSymbol={selectedSymbol}
              stocks={stocks}
              validation={validation}
              pipelineStages={pipelineStages}
              loadDurationMs={loadDurationMs}
              reloadingPipeline={reloadingPipeline}
              onRefreshPipeline={handleRefreshPipeline}
              activeArtifact={activeArtifact}
              trainedModelsCount={monitoring?.trainedModelsCount ?? 0}
              backtestsCount={monitoring?.backtestHistory?.length ?? 0}
              onOpenSection={openSection}
              onOpenPerformance={() => setBrokerPage('performance')}
            />
          )}

          {['06', '07', '08', '09'].includes(activeSection) && (
            <QuantSectionsPart2
              activeSection={activeSection}
              selectedSymbol={selectedSymbol}
              detail={detail}
              modelType={modelType}
              setModelType={setModelType}
              splitRatio={splitRatio}
              setSplitRatio={setSplitRatio}
              threshold={threshold}
              setThreshold={setThreshold}
              training={training}
              onTrainModel={handleTrainModel}
              activeArtifact={activeArtifact}
              onExperimentsUpdated={() => {
                setExperimentsVersion((v) => v + 1);
                loadMonitoring().catch(() => {});
              }}
            />
          )}

          {['10', '11', '12', '13'].includes(activeSection) && (
            <QuantSectionsPart3
              activeSection={activeSection}
              selectedSymbol={selectedSymbol}
              modelType={modelType}
              monitoring={monitoring}
              onRefreshMonitoring={loadMonitoring}
              btStrategy={btStrategy}
              setBtStrategy={setBtStrategy}
              btStartDate={btStartDate}
              setBtStartDate={setBtStartDate}
              btEndDate={btEndDate}
              setBtEndDate={setBtEndDate}
              btCapital={btCapital}
              setBtCapital={setBtCapital}
              btBrokerage={btBrokerage}
              setBtBrokerage={setBtBrokerage}
              btSlippage={btSlippage}
              setBtSlippage={setBtSlippage}
              btBuyThreshold={btBuyThreshold}
              setBtBuyThreshold={setBtBuyThreshold}
              btLoading={btLoading}
              btResult={btResult}
              btError={btError}
              onRunBacktest={handleRunBacktest}
              experimentsVersion={experimentsVersion}
            />
          )}
        </div>
      )}

      {/* PAGE 2: FINAL PERFORMANCE */}
      {brokerPage === 'performance' && (
        <FinalPerformancePage
          selectedSymbol={selectedSymbol}
          modelType={modelType}
          setModelType={setModelType}
          btResult={btResult}
          experimentsVersion={experimentsVersion}
          onJumpToSection={openSection}
        />
      )}

      {/* PAGE 3: PROFILE */}
      {brokerPage === 'profile' && (
        <BrokerProfilePage
          user={user}
          researchStats={{
            trainedModelsCount: monitoring?.trainedModelsCount ?? 0,
            backtestsCount: monitoring?.backtestHistory?.length ?? 0,
            experimentsCount: monitoring?.trainingHistory?.length ?? 0,
            datasetStatus: monitoring?.datasetStatus ?? 'Loaded & Validated',
            totalStocks: validation?.combinedUniqueStocks ?? stocks.length,
          }}
          onLogout={logoutUser}
        />
      )}
    </div>
  );
};
