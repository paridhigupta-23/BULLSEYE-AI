import React from 'react';
import { Award, AlertTriangle, CheckCircle, Activity, Bot, ShieldCheck } from 'lucide-react';
import type { TraderPersonalityReport, TraderProfileType } from '../../practice-intelligence/types.ts';
import { formatPct } from '../../types/index.ts';

interface PersonalityAnalyzerViewProps {
  personality: TraderPersonalityReport;
  onAskCoachAboutPersonality?: () => void;
}

export const PersonalityAnalyzerView: React.FC<PersonalityAnalyzerViewProps> = ({
  personality,
  onAskCoachAboutPersonality,
}) => {
  const archetypeColors: Record<TraderProfileType, { bg: string; border: string; text: string; ring: string }> = {
    'Disciplined Trader': {
      bg: 'bg-emerald-950/40',
      border: 'border-emerald-500/50',
      text: 'text-emerald-400',
      ring: 'ring-emerald-500/30',
    },
    'Overtrader': {
      bg: 'bg-rose-950/40',
      border: 'border-rose-500/50',
      text: 'text-rose-400',
      ring: 'ring-rose-500/30',
    },
    'Momentum Chaser': {
      bg: 'bg-cyan-950/40',
      border: 'border-cyan-500/50',
      text: 'text-cyan-400',
      ring: 'ring-cyan-500/30',
    },
    'Risk-Taking Trader': {
      bg: 'bg-amber-950/40',
      border: 'border-amber-500/50',
      text: 'text-amber-400',
      ring: 'ring-amber-500/30',
    },
    'Conservative Trader': {
      bg: 'bg-indigo-950/40',
      border: 'border-indigo-500/50',
      text: 'text-indigo-400',
      ring: 'ring-indigo-500/30',
    },
  };

  const currentTheme = archetypeColors[personality.profile] || archetypeColors['Disciplined Trader'];

  return (
    <div className="space-y-6">
      {/* Archetype Hero Card */}
      <div className={`rounded-2xl border p-6 backdrop-blur-sm ${currentTheme.bg} ${currentTheme.border}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-lg px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider ring-1 ${currentTheme.ring} ${currentTheme.text} bg-slate-950/60`}
              >
                {personality.profile}
              </span>
              <span className="rounded-lg bg-slate-900/90 px-2.5 py-1 font-mono text-xs text-slate-300">
                Stop-Loss Coverage: {formatPct(personality.metrics.stopLossCoveragePercentage)}
              </span>
              <span className="rounded-lg bg-slate-900/90 px-2.5 py-1 font-mono text-xs text-slate-300">
                Cash Reserve: {formatPct(personality.metrics.cashReservePercentage)}
              </span>
            </div>
            <h3 className="mt-3 text-2xl font-bold text-white">{personality.profile} Archetype</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-300 max-w-3xl">
              {personality.educational_disclaimer}
            </p>
          </div>

          {onAskCoachAboutPersonality && (
            <button
              type="button"
              onClick={onAskCoachAboutPersonality}
              className="inline-flex items-center gap-2 self-start md:self-center rounded-xl border border-cyan-500/40 bg-cyan-950/50 px-4 py-2.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/50 hover:text-white transition-all shadow-md shrink-0"
            >
              <Bot className="h-4 w-4" />
              <span>Ask Coach About Profile</span>
            </button>
          )}
        </div>

        {/* Supporting Evidence Chips */}
        {personality.supporting_evidence && personality.supporting_evidence.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-800/80">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Supporting Algorithmic Evidence:
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {personality.supporting_evidence.map((ev, idx) => (
                <span
                  key={idx}
                  className="rounded-md border border-slate-700/60 bg-slate-900/70 px-2.5 py-1 font-mono text-[11px] text-slate-300"
                >
                  {ev}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quantitative Behavioral Metrics Ribbon */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 tabular-nums">
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-4 backdrop-blur-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Win Rate</span>
          <div className="mt-1 font-mono text-xl font-bold text-white">
            {formatPct(personality.metrics.winRate)}
          </div>
          <span className="text-[10px] text-slate-500">closed trades</span>
        </div>

        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-4 backdrop-blur-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Trading Freq</span>
          <div
            className={`mt-1 font-mono text-xl font-bold ${
              personality.metrics.tradesPerActiveDay >= 10 ? 'text-rose-400' : 'text-white'
            }`}
          >
            {personality.metrics.tradesPerActiveDay.toFixed(1)}
          </div>
          <span className="text-[10px] text-slate-500">trades / active day</span>
        </div>

        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-4 backdrop-blur-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Avg Hold Time</span>
          <div className="mt-1 font-mono text-xl font-bold text-white">
            {personality.metrics.averageHoldingHours.toFixed(1)}h
          </div>
          <span className="text-[10px] text-slate-500">holding duration</span>
        </div>

        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-4 backdrop-blur-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Max Weight</span>
          <div
            className={`mt-1 font-mono text-xl font-bold ${
              personality.metrics.maximumPositionWeight >= 25 ? 'text-amber-400' : 'text-white'
            }`}
          >
            {formatPct(personality.metrics.maximumPositionWeight)}
          </div>
          <span className="text-[10px] text-slate-500">single-stock max</span>
        </div>

        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-4 backdrop-blur-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Stop-Loss Disc.</span>
          <div
            className={`mt-1 font-mono text-xl font-bold ${
              personality.metrics.stopLossCoveragePercentage >= 70 ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {formatPct(personality.metrics.stopLossCoveragePercentage)}
          </div>
          <span className="text-[10px] text-slate-500">covered orders</span>
        </div>

        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-4 backdrop-blur-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Cash Reserve</span>
          <div
            className={`mt-1 font-mono text-xl font-bold ${
              personality.metrics.cashReservePercentage < 10 ? 'text-rose-400' : 'text-cyan-400'
            }`}
          >
            {formatPct(personality.metrics.cashReservePercentage)}
          </div>
          <span className="text-[10px] text-slate-500">liquidity buffer</span>
        </div>
      </div>

      {/* Strengths, Weaknesses, Suggestions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Strengths */}
        <div className="rounded-2xl border border-emerald-500/30 bg-slate-900/80 p-5 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="rounded-lg bg-emerald-500/20 p-2 text-emerald-400">
              <Award className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Observed Strengths</h4>
              <p className="text-[11px] text-slate-400">Capital protective behaviors</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {personality.strengths.map((str, idx) => (
              <div key={idx} className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-200 leading-relaxed">{str}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Weaknesses */}
        <div className="rounded-2xl border border-rose-500/30 bg-slate-900/80 p-5 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="rounded-lg bg-rose-500/20 p-2 text-rose-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Behavioral Risks</h4>
              <p className="text-[11px] text-slate-400">Vulnerabilities to address</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {personality.weaknesses.map((wk, idx) => (
              <div key={idx} className="flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-950/20 p-3">
                <Activity className="h-3.5 w-3.5 text-rose-400 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-200 leading-relaxed">{wk}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Suggestions */}
        <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/80 p-5 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="rounded-lg bg-cyan-500/20 p-2 text-cyan-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Actionable Steps</h4>
              <p className="text-[11px] text-slate-400">Algorithmic coaching guidance</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {personality.suggestions.map((sug, idx) => (
              <div key={idx} className="flex items-start gap-2.5 rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-[10px] font-bold text-cyan-400">
                  {idx + 1}
                </span>
                <span className="text-xs text-slate-200 leading-relaxed">{sug}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
