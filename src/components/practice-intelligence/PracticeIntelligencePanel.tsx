import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Play,
  UserCheck,
  Target,
  Bot,
  RefreshCw,
} from 'lucide-react';
import type { StockSummary } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { formatINR, formatPct } from '../../types/index.ts';
import {
  type VirtualPortfolio,
  type VirtualTrade,
  type MistakeWarning,
  STARTING_VIRTUAL_CAPITAL_INR,
} from '../../practice-intelligence/types.ts';
import {
  portfolioSnapshotToVirtualPortfolio,
  tradeRecordsToVirtualTrades,
  DEMO_PERSONAS,
  DEMO_PREDICTIONS,
  DEMO_PRICE_BARS,
} from '../../practice-intelligence/adapters.ts';
import { detectTradingMistakes } from '../../practice-intelligence/mistake-detector/detector.ts';
import { analyzeTradingPersonality } from '../../practice-intelligence/personality-analyzer/analyzer.ts';
import { evaluatePredictions } from '../../practice-intelligence/prediction-autopsy/autopsy.ts';
import { MistakeDetectorView } from './MistakeDetectorView.tsx';
import { WhatIfSimulatorView } from './WhatIfSimulatorView.tsx';
import { PersonalityAnalyzerView } from './PersonalityAnalyzerView.tsx';
import { PredictionAutopsyView } from './PredictionAutopsyView.tsx';
import { AICoachView } from './AICoachView.tsx';

interface PracticeIntelligencePanelProps {
  stocks: StockSummary[];
  onNavigateHome?: () => void;
}

export const PracticeIntelligencePanel: React.FC<PracticeIntelligencePanelProps> = ({
  stocks,
}) => {
  const [selectedPersona, setSelectedPersona] = useState<string>('live');
  const [activeTab, setActiveTab] = useState<'mistakes' | 'simulator' | 'personality' | 'autopsy' | 'coach'>('mistakes');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live data states
  const [livePortfolio, setLivePortfolio] = useState<VirtualPortfolio | null>(null);
  const [liveTrades, setLiveTrades] = useState<VirtualTrade[]>([]);
  const [selectedMistakeForCoach, setSelectedMistakeForCoach] = useState<MistakeWarning | null>(null);

  const loadLiveData = async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await api.getPortfolio();
      const converted = portfolioSnapshotToVirtualPortfolio(snap);
      const trades = tradeRecordsToVirtualTrades(snap.trades || []);
      setLivePortfolio(converted);
      setLiveTrades(trades);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch live portfolio intelligence data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLiveData();
  }, []);

  // Determine active portfolio & trades based on persona selection
  const activeDemo = DEMO_PERSONAS.find((p) => p.id === selectedPersona);
  const currentPortfolio: VirtualPortfolio = activeDemo
    ? activeDemo.portfolio
    : (livePortfolio ?? {
        startingCapital: STARTING_VIRTUAL_CAPITAL_INR,
        cashBalance: STARTING_VIRTUAL_CAPITAL_INR,
        holdingsMarketValue: 0,
        totalPortfolioValue: STARTING_VIRTUAL_CAPITAL_INR,
        realizedPnl: 0,
        unrealizedPnl: 0,
        totalPnl: 0,
        totalReturnPct: 0,
        holdings: [],
      });
  const currentTrades: VirtualTrade[] = activeDemo
    ? activeDemo.trades
    : liveTrades;

  // Real-time deterministic analysis on current portfolio
  const mistakes = detectTradingMistakes(currentPortfolio, currentTrades);
  const personality = analyzeTradingPersonality(currentPortfolio, currentTrades);
  const autopsy = evaluatePredictions(DEMO_PREDICTIONS, DEMO_PRICE_BARS);

  const handleAskCoachAboutMistake = (warning: MistakeWarning) => {
    setSelectedMistakeForCoach(warning);
    setActiveTab('coach');
  };

  const handleAskCoachAboutPersonality = () => {
    setSelectedMistakeForCoach(null);
    setActiveTab('coach');
  };

  const coachInitialQuestion = selectedMistakeForCoach
    ? `I was flagged with a ${selectedMistakeForCoach.severity} severity mistake: "${selectedMistakeForCoach.title}". Concrete evidence: ${selectedMistakeForCoach.evidence}. What specific steps should I take to fix this?`
    : `Please analyze my trading personality "${personality.profile}" and tell me how to reach the next level of profitability.`;

  return (
    <div className="space-y-6">
      {/* Top Controls: Persona Selector & Quick Actions */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
            Portfolio Analysis Scope
          </span>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedPersona('live')}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                selectedPersona === 'live'
                  ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400'
                  : 'border border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-750 hover:text-white'
              }`}
            >
              🟢 My Live Virtual Account
            </button>

            {DEMO_PERSONAS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPersona(p.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                  selectedPersona === p.id
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/20 ring-1 ring-cyan-400'
                    : 'border border-slate-700 bg-slate-800/80 text-slate-400 hover:bg-slate-750 hover:text-slate-200'
                }`}
              >
                Demo: {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={loadLiveData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Audit</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-3 text-xs text-amber-300">
          {error}
        </div>
      )}

      {/* KPI Summary Ribbon */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 tabular-nums">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Equity</span>
          <div className="mt-1 font-mono text-lg font-bold text-white">
            {formatINR(currentPortfolio.totalPortfolioValue)}
          </div>
          <span className="text-[10px] text-slate-500">
            Cash: {formatINR(currentPortfolio.cashBalance)}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Unrealized P&L</span>
          <div
            className={`mt-1 font-mono text-lg font-bold ${
              currentPortfolio.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatINR(currentPortfolio.unrealizedPnl)}
          </div>
          <span className="text-[10px] text-slate-500">
            Realized: {formatINR(currentPortfolio.realizedPnl)}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Return</span>
          <div
            className={`mt-1 font-mono text-lg font-bold ${
              currentPortfolio.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatPct(currentPortfolio.totalReturnPct)}
          </div>
          <span className="text-[10px] text-slate-500">vs ₹10L starting</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Active Mistakes</span>
          <div
            className={`mt-1 font-mono text-lg font-bold ${
              mistakes.length === 0
                ? 'text-emerald-400'
                : mistakes.some((m) => m.severity === 'High')
                ? 'text-rose-400'
                : 'text-amber-400'
            }`}
          >
            {mistakes.length} Warnings
          </div>
          <span className="text-[10px] text-slate-500">
            {mistakes.filter((m) => m.severity === 'High').length} High Severity
          </span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Archetype</span>
          <div className="mt-1 font-mono text-sm font-bold text-cyan-300 truncate">
            {personality.profile}
          </div>
          <span className="text-[10px] text-slate-500">
            Coverage: {formatPct(personality.metrics.stopLossCoveragePercentage)}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">AI Accuracy</span>
          <div className="mt-1 font-mono text-lg font-bold text-emerald-400">
            {formatPct(autopsy.directionalAccuracyPct)}
          </div>
          <span className="text-[10px] text-slate-500">
            {autopsy.correctCount}/{autopsy.evaluatedPredictionsCount} verified
          </span>
        </div>
      </div>

      {/* Feature Navigation Tabs */}
      <div className="flex border-b border-slate-800 overflow-x-auto">
        <nav className="flex space-x-2">
          <button
            type="button"
            onClick={() => setActiveTab('mistakes')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'mistakes'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-300'
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            <span>Mistake Detector</span>
            {mistakes.length > 0 && (
              <span className="rounded-full bg-rose-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-rose-300">
                {mistakes.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'simulator'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-300'
            }`}
          >
            <Play className="h-4 w-4" />
            <span>What-If Simulator</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('personality')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'personality'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-300'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            <span>Trader Personality</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('autopsy')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'autopsy'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-300'
            }`}
          >
            <Target className="h-4 w-4" />
            <span>Prediction Autopsy</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('coach')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'coach'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-300'
            }`}
          >
            <Bot className="h-4 w-4" />
            <span>AI Trading Coach</span>
          </button>
        </nav>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'mistakes' && (
          <MistakeDetectorView
            warnings={mistakes}
            onAskCoachAboutMistake={handleAskCoachAboutMistake}
          />
        )}

        {activeTab === 'simulator' && (
          <WhatIfSimulatorView portfolio={currentPortfolio} />
        )}

        {activeTab === 'personality' && (
          <PersonalityAnalyzerView
            personality={personality}
            onAskCoachAboutPersonality={handleAskCoachAboutPersonality}
          />
        )}

        {activeTab === 'autopsy' && (
          <PredictionAutopsyView autopsy={autopsy} />
        )}

        {activeTab === 'coach' && (
          <AICoachView
            context={{
              portfolio: currentPortfolio,
              mistakes,
              personality,
              autopsy,
            }}
            initialQuestion={coachInitialQuestion}
          />
        )}
      </div>
    </div>
  );
};
