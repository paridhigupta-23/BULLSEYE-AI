import React, { useState, useEffect } from 'react';
import { Bot, Send, Sparkles, CheckSquare, RefreshCw } from 'lucide-react';
import type { CoachResponse, CoachContext } from '../../practice-intelligence/types.ts';
import { generateCoachResponse } from '../../practice-intelligence/ai-coach/coach.ts';
import { api } from '../../services/api.ts';

interface AICoachViewProps {
  context: CoachContext;
  initialQuestion?: string;
}

export const AICoachView: React.FC<AICoachViewProps> = ({ context, initialQuestion = '' }) => {
  const [question, setQuestion] = useState(initialQuestion);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<CoachResponse | null>(null);

  const promptChips = [
    'Why was an overtrading mistake detected?',
    'How can I improve my Sharpe and risk tolerance?',
    'What should I do about my missing stop-loss on top holdings?',
    'Summarize my trading strengths and weaknesses',
  ];

  const handleAsk = async (queryText: string) => {
    if (!queryText.trim()) return;
    setLoading(true);
    try {
      // Attempt backend API first
      const res = await api.askPracticeCoach({
        question: queryText,
        context: {
          userQuestion: queryText,
        },
      });
      setResponse(res);
    } catch {
      // Fallback to client-side deterministic response
      const fallbackRes = await generateCoachResponse({
        ...context,
        userQuestion: queryText,
      });
      setResponse(fallbackRes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const initialRun = async () => {
      setLoading(true);
      try {
        const initial = await generateCoachResponse({
          ...context,
          userQuestion: initialQuestion || 'Initial comprehensive portfolio assessment and coaching plan',
        });
        if (active) setResponse(initial);
      } catch {
        // Handled
      } finally {
        if (active) setLoading(false);
      }
    };
    initialRun();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAsk(question);
  };

  return (
    <div className="space-y-6">
      {/* Quick Prompt Chips */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Recommended Coaching Prompts
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {promptChips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setQuestion(chip);
                handleAsk(chip);
              }}
              className="rounded-xl border border-slate-700/80 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-500/50 hover:bg-slate-800 hover:text-white transition-all shadow-sm"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Input Box */}
      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-4 backdrop-blur-sm">
        <div className="relative">
          <textarea
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask AI Coach anything about your trades, mistakes, risk discipline, or strategy optimization..."
            className="w-full rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            Personalized advice computed directly from your executed virtual orders
          </span>
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:from-cyan-500 hover:to-emerald-500 disabled:opacity-50 transition-all cursor-pointer"
          >
            {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            <span>{loading ? 'Analyzing Portfolio...' : 'Ask AI Coach'}</span>
          </button>
        </div>
      </form>

      {/* Response Card */}
      {response && (
        <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/90 p-6 backdrop-blur-sm shadow-xl space-y-5">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 p-2.5 text-cyan-300 ring-1 ring-cyan-500/30">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  BULLSEYE Trading Coach
                </h3>
                <span className="font-mono text-xs text-slate-400">
                  {response.source === 'gemini'
                    ? '✨ Grounded Gemini Flash AI Analysis'
                    : '⚡ Deterministic Quantitative Reasoning Engine'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="rounded-md bg-slate-800 px-2 py-0.5 text-cyan-300">
                Profile: {response.contextSummary.profile}
              </span>
              <span className="rounded-md bg-slate-800 px-2 py-0.5 text-amber-300">
                {response.contextSummary.activeWarningsCount} Warnings
              </span>
            </div>
          </div>

          {/* Coach Narrative Answer */}
          <div className="prose prose-invert max-w-none text-sm text-slate-200 leading-relaxed space-y-3 whitespace-pre-line">
            {response.answer}
          </div>

          {/* Actionable Recommendations Checklist */}
          {response.recommendedActions && response.recommendedActions.length > 0 && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5 mb-3">
                <CheckSquare className="h-4 w-4" />
                Actionable Trading Directives
              </h4>
              <ul className="space-y-2">
                {response.recommendedActions.map((action, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-200">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-400">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
