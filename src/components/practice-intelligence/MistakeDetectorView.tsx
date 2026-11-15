import React, { useState } from 'react';
import { AlertTriangle, AlertOctagon, Info, CheckCircle2, ArrowRight, Bot, ShieldAlert } from 'lucide-react';
import type { MistakeWarning, WarningSeverity } from '../../practice-intelligence/types.ts';

interface MistakeDetectorViewProps {
  warnings: MistakeWarning[];
  onAskCoachAboutMistake?: (warning: MistakeWarning) => void;
}

export const MistakeDetectorView: React.FC<MistakeDetectorViewProps> = ({
  warnings,
  onAskCoachAboutMistake,
}) => {
  const [severityFilter, setSeverityFilter] = useState<'ALL' | WarningSeverity>('ALL');

  const highCount = warnings.filter((w) => w.severity === 'High').length;
  const mediumCount = warnings.filter((w) => w.severity === 'Medium').length;
  const lowCount = warnings.filter((w) => w.severity === 'Low').length;

  const filteredWarnings = warnings.filter((w) => {
    if (severityFilter === 'ALL') return true;
    return w.severity === severityFilter;
  });

  return (
    <div className="space-y-6">
      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/80 p-4 backdrop-blur-sm">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Warnings</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-white">{warnings.length}</span>
            <span className="text-xs text-slate-400">detected</span>
          </div>
        </div>

        <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 backdrop-blur-sm">
          <span className="text-xs font-medium uppercase tracking-wider text-rose-300">High Severity</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-rose-400">{highCount}</span>
            <span className="text-xs text-rose-300/70">critical risk</span>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 backdrop-blur-sm">
          <span className="text-xs font-medium uppercase tracking-wider text-amber-300">Medium Severity</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-amber-400">{mediumCount}</span>
            <span className="text-xs text-amber-300/70">needs attention</span>
          </div>
        </div>

        <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 backdrop-blur-sm">
          <span className="text-xs font-medium uppercase tracking-wider text-cyan-300">Low Severity</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-cyan-400">{lowCount}</span>
            <span className="text-xs text-cyan-300/70">advisory</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          {(['ALL', 'High', 'Medium', 'Low'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setSeverityFilter(filter)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                severityFilter === filter
                  ? 'bg-slate-700 text-white shadow-sm ring-1 ring-slate-600'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {filter === 'ALL'
                ? `All (${warnings.length})`
                : `${filter} (${warnings.filter((w) => w.severity === filter).length})`}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400">
          Deterministic 7-factor algorithmic audit rule engine
        </span>
      </div>

      {/* Warnings List */}
      {filteredWarnings.length === 0 ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-8 text-center backdrop-blur-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
          <h3 className="mt-3 text-base font-semibold text-white">No Warnings in this Category</h3>
          <p className="mt-1 text-sm text-slate-400">
            {severityFilter === 'ALL'
              ? 'Your virtual portfolio demonstrates disciplined execution with no rule violations.'
              : `Zero ${severityFilter.toLowerCase()} severity mistakes detected in the active portfolio snapshot.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredWarnings.map((w) => {
            const isHigh = w.severity === 'High';
            const isMedium = w.severity === 'Medium';

            return (
              <div
                key={w.code}
                className={`group rounded-2xl border p-5 backdrop-blur-sm transition-all duration-200 ${
                  isHigh
                    ? 'border-rose-500/40 bg-gradient-to-r from-rose-950/30 via-slate-900/80 to-slate-900/80 hover:border-rose-500/60'
                    : isMedium
                    ? 'border-amber-500/40 bg-gradient-to-r from-amber-950/25 via-slate-900/80 to-slate-900/80 hover:border-amber-500/60'
                    : 'border-slate-700/60 bg-slate-900/80 hover:border-cyan-500/40'
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 rounded-lg p-2 ${
                        isHigh
                          ? 'bg-rose-500/20 text-rose-400'
                          : isMedium
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-cyan-500/20 text-cyan-400'
                      }`}
                    >
                      {isHigh ? (
                        <AlertOctagon className="h-5 w-5" />
                      ) : isMedium ? (
                        <AlertTriangle className="h-5 w-5" />
                      ) : (
                        <Info className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider ${
                            isHigh
                              ? 'bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/40'
                              : isMedium
                              ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40'
                              : 'bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/40'
                          }`}
                        >
                          {w.severity.toUpperCase()} SEVERITY
                        </span>
                        <span className="rounded-md bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                          {w.code}
                        </span>
                      </div>
                      <h4 className="mt-2 text-base font-bold text-white">{w.title}</h4>
                      <p className="mt-1 text-sm leading-relaxed text-slate-300">{w.explanation}</p>
                    </div>
                  </div>

                  {onAskCoachAboutMistake && (
                    <button
                      type="button"
                      onClick={() => onAskCoachAboutMistake(w)}
                      className="inline-flex items-center gap-1.5 self-start rounded-lg border border-cyan-500/40 bg-cyan-950/30 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/40 hover:text-cyan-200 transition-colors shrink-0"
                    >
                      <Bot className="h-3.5 w-3.5" />
                      <span>Ask AI Coach</span>
                    </button>
                  )}
                </div>

                {/* Evidence Callout */}
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <ShieldAlert className="h-3.5 w-3.5 text-slate-400" />
                    <span>Calculated Metric Evidence</span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-slate-200">{w.evidence}</p>
                </div>

                {/* Actionable Recommendation */}
                <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span>Recommended Corrective Action</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300">{w.recommended_action}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
