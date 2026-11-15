import React, { useState } from 'react';
import { CheckCircle2, XCircle, HelpCircle, ShieldCheck, Target } from 'lucide-react';
import type { PredictionAutopsyReport } from '../../practice-intelligence/types.ts';
import { formatINR, formatPct } from '../../types/index.ts';

interface PredictionAutopsyViewProps {
  autopsy: PredictionAutopsyReport;
}

export const PredictionAutopsyView: React.FC<PredictionAutopsyViewProps> = ({ autopsy }) => {
  const [filter, setFilter] = useState<'ALL' | 'CORRECT' | 'INCORRECT' | 'MISSING'>('ALL');

  const filteredPredictions = autopsy.evaluations.filter((ev) => {
    if (filter === 'ALL') return true;
    if (filter === 'CORRECT') return ev.was_correct === true;
    if (filter === 'INCORRECT') return ev.was_correct === false;
    if (filter === 'MISSING') return ev.status === 'MISSING_OUTCOME_DATA';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Strict Anti-Look-Ahead Verification Banner */}
      <div className="rounded-xl border border-cyan-500/40 bg-cyan-950/20 px-4 py-3 text-xs text-cyan-200 backdrop-blur-sm flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold uppercase tracking-wider text-cyan-300">
            Strict Look-Ahead Bias Prevention Enforced
          </span>
          <p className="mt-0.5 text-slate-300">
            Predictions are evaluated strictly against subsequent price bars (<code className="font-mono text-cyan-300">bar.timestamp &gt; prediction.timestamp</code>). No future data is ever visible at prediction time, and unobserved periods are honestly marked as <code className="font-mono text-slate-400">MISSING_OUTCOME_DATA</code>.
          </p>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 tabular-nums">
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-5 backdrop-blur-sm">
          <span className="text-xs text-slate-400">Directional Accuracy</span>
          <div className="mt-1 font-mono text-2xl font-bold text-white">
            {formatPct(autopsy.directionalAccuracyPct)}
          </div>
          <span className="text-xs text-slate-500">
            {autopsy.correctCount} of {autopsy.evaluatedPredictionsCount} evaluated
          </span>
        </div>

        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-5 backdrop-blur-sm">
          <span className="text-xs text-slate-400">Hypothetical Strategy Return</span>
          <div
            className={`mt-1 font-mono text-2xl font-bold ${
              autopsy.averageHypotheticalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatPct(autopsy.averageHypotheticalReturnPct)}
          </div>
          <span className="text-xs text-slate-500">hypothetical signal pnl</span>
        </div>

        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-5 backdrop-blur-sm">
          <span className="text-xs text-slate-400">Brier Calibration Score</span>
          <div className="mt-1 font-mono text-2xl font-bold text-cyan-400">
            {autopsy.brierCalibrationScore !== null ? autopsy.brierCalibrationScore.toFixed(3) : '—'}
          </div>
          <span className="text-xs text-slate-500">0.0 = perfect calibration</span>
        </div>

        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-5 backdrop-blur-sm">
          <span className="text-xs text-slate-400">Total Recorded Signals</span>
          <div className="mt-1 font-mono text-2xl font-bold text-white">
            {autopsy.totalPredictions}
          </div>
          <span className="text-xs text-slate-500">
            {autopsy.missingDataCount} awaiting settlement
          </span>
        </div>
      </div>

      {/* Filter and Audit Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Target className="h-4 w-4 text-cyan-400" />
            Auditable Predictions Ledger
          </h4>

          <div className="flex items-center gap-2">
            {(['ALL', 'CORRECT', 'INCORRECT', 'MISSING'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  filter === tab
                    ? 'bg-slate-700 text-white shadow-sm ring-1 ring-slate-600'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {filteredPredictions.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-400">
            No predictions found matching the selected filter.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs tabular-nums">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 pr-3 font-semibold uppercase tracking-wider text-[11px]">Symbol</th>
                  <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-[11px]">Prediction Date</th>
                  <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-[11px]">Signal</th>
                  <th className="py-2.5 px-3 text-right font-semibold uppercase tracking-wider text-[11px]">Confidence</th>
                  <th className="py-2.5 px-3 text-right font-semibold uppercase tracking-wider text-[11px]">Price at Pred</th>
                  <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-[11px]">Subsequent Bar</th>
                  <th className="py-2.5 px-3 text-center font-semibold uppercase tracking-wider text-[11px]">Audit Status</th>
                  <th className="py-2.5 pl-3 text-right font-semibold uppercase tracking-wider text-[11px]">Hypo. Return</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredPredictions.map((item) => {
                  const isCorrect = item.was_correct === true;
                  const isIncorrect = item.was_correct === false;

                  return (
                    <tr key={item.prediction_id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 pr-3 font-mono font-bold text-white">{item.symbol}</td>
                      <td className="py-3 px-3 font-mono text-slate-400">
                        {item.prediction_timestamp.slice(0, 10)}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                            item.predicted_signal === 'BUY'
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                              : item.predicted_signal === 'SELL'
                              ? 'bg-rose-950/60 text-rose-400 border border-rose-500/30'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {item.predicted_signal}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-300">
                        {formatPct(item.confidence * 100)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-300">
                        {formatINR(item.price_at_prediction)}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300">
                        {item.subsequent_price !== null && item.subsequent_bar_timestamp ? (
                          <span>
                            {formatINR(item.subsequent_price)} ({item.subsequent_bar_timestamp.slice(0, 10)})
                          </span>
                        ) : (
                          <span className="text-slate-500">Awaiting settlement</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${
                            isCorrect
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : isIncorrect
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {isCorrect ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : isIncorrect ? (
                            <XCircle className="h-3 w-3" />
                          ) : (
                            <HelpCircle className="h-3 w-3" />
                          )}
                          <span>{item.status === 'MISSING_OUTCOME_DATA' ? 'MISSING DATA' : isCorrect ? 'CORRECT' : 'INCORRECT'}</span>
                        </span>
                      </td>
                      <td
                        className={`py-3 pl-3 text-right font-mono font-bold ${
                          (item.hypothetical_return_pct ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {item.hypothetical_return_pct !== null ? formatPct(item.hypothetical_return_pct) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
