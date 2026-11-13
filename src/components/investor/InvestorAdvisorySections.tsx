import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Brain,
  CheckCircle2,
  ClipboardList,
  Link2,
  MessageSquare,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext.tsx';
import {
  formatINR,
  type BrokerMessageItem,
  type ClientRequestItem,
  type ExpertAdviceItem,
  type InvestorBrokerConnection,
  type StockSummary,
} from '../../types/index.ts';

/* ==================== BROKER LINK CARD ==================== */
interface InvestorBrokerLinkCardProps {
  connection: InvestorBrokerConnection | null;
  onLinkBroker: (brokerCode: string) => Promise<void>;
}

export const InvestorBrokerLinkCard: React.FC<InvestorBrokerLinkCardProps> = ({
  connection,
  onLinkBroker,
}) => {
  const { inv } = useAppContext();
  const [brokerCode, setBrokerCode] = useState('');
  const [linking, setLinking] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brokerCode.trim()) return;
    setLinking(true);
    setSuccessMsg(null);
    setErrMsg(null);
    try {
      await onLinkBroker(brokerCode.trim());
      setSuccessMsg(inv.profile.brokerLinkedSuccess);
      setBrokerCode('');
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : inv.common.noData);
    } finally {
      setLinking(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#087F5B]/10 text-[#087F5B] dark:bg-[#34D399]/10 dark:text-[#34D399]">
            <Link2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              {inv.profile.brokerSectionTitle}
            </h3>
            <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              {connection?.linked && connection.brokerName
                ? `${connection.brokerName} (${connection.brokerUserCode}) · ${connection.brokerEmail}`
                : inv.advisory.linkBrokerFirst}
            </p>
          </div>
        </div>
        <span
          className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-bold ${
            connection?.linked
              ? 'bg-[#087F5B]/15 text-[#087F5B] dark:bg-[#34D399]/15 dark:text-[#34D399]'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
          }`}
        >
          {connection?.linked ? inv.profile.brokerLinkedBadge : inv.profile.brokerUnlinkedBadge}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label
            htmlFor="inv-link-broker-input"
            className="block text-[11px] font-medium text-slate-500 dark:text-slate-400"
          >
            {inv.profile.brokerCodeLabel}
          </label>
          <input
            id="inv-link-broker-input"
            type="text"
            value={brokerCode}
            onChange={(e) => setBrokerCode(e.target.value)}
            placeholder={inv.profile.linkBrokerPlaceholder}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
          />
        </div>
        <button
          type="submit"
          disabled={linking || !brokerCode.trim()}
          className="rounded-lg bg-[#087F5B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#06684A] disabled:opacity-50 dark:bg-[#34D399] dark:text-slate-950 whitespace-nowrap"
        >
          {linking ? inv.common.loading : inv.profile.linkBrokerBtn}
        </button>
      </form>

      {successMsg && (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#087F5B] dark:text-[#34D399]">
          <CheckCircle2 className="h-4 w-4" />
          <span>{successMsg}</span>
        </p>
      )}
      {errMsg && (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#782F46] dark:text-[#B76E85]">
          <AlertCircle className="h-4 w-4" />
          <span>{errMsg}</span>
        </p>
      )}
    </section>
  );
};

/* ==================== INVESTOR REQUESTS SECTION ==================== */
interface InvestorRequestsSectionProps {
  stocks: StockSummary[];
  requests: ClientRequestItem[];
  defaultSymbol: string;
  onCreateRequest: (payload: {
    category: string;
    symbol?: string | null;
    message: string;
  }) => Promise<void>;
}

export const InvestorRequestsSection: React.FC<InvestorRequestsSectionProps> = ({
  stocks,
  requests,
  defaultSymbol,
  onCreateRequest,
}) => {
  const { inv } = useAppContext();
  const [symbol, setSymbol] = useState(defaultSymbol || 'RELIANCE');
  const [category, setCategory] = useState(inv.stocks.categories.stockAnalysis);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    setFeedback(null);
    setErrMsg(null);
    try {
      await onCreateRequest({ category, symbol: symbol || null, message: message.trim() });
      setMessage('');
      setFeedback(inv.stocks.requestSuccess);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : inv.common.noData);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-[#087F5B] dark:text-[#34D399]" />
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
            {inv.advisory.askNewQuestionTitle}
          </h3>
        </div>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="req-hub-symbol"
                className="block text-[11px] font-medium text-slate-500 dark:text-slate-400"
              >
                {inv.common.symbol}
              </label>
              <select
                id="req-hub-symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
              >
                {stocks.map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.symbol} — {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="req-hub-category"
                className="block text-[11px] font-medium text-slate-500 dark:text-slate-400"
              >
                {inv.stocks.requestCategoryLabel}
              </label>
              <select
                id="req-hub-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
              >
                <option value={inv.stocks.categories.stockAnalysis}>
                  {inv.stocks.categories.stockAnalysis}
                </option>
                <option value={inv.stocks.categories.recommendation}>
                  {inv.stocks.categories.recommendation}
                </option>
                <option value={inv.stocks.categories.portfolioReview}>
                  {inv.stocks.categories.portfolioReview}
                </option>
                <option value={inv.stocks.categories.riskCheck}>
                  {inv.stocks.categories.riskCheck}
                </option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="req-hub-message"
              className="block text-[11px] font-medium text-slate-500 dark:text-slate-400"
            >
              {inv.stocks.requestQuestionLabel}
            </label>
            <textarea
              id="req-hub-message"
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={inv.stocks.requestPlaceholder}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !message.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#087F5B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#06684A] disabled:opacity-50 dark:bg-[#34D399] dark:text-slate-950"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{submitting ? inv.stocks.submittingRequest : inv.stocks.submitRequestBtn}</span>
          </button>
        </form>

        {feedback && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#087F5B] dark:text-[#34D399]">
            <CheckCircle2 className="h-4 w-4" />
            <span>{feedback}</span>
          </p>
        )}
        {errMsg && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#782F46] dark:text-[#B76E85]">
            <AlertCircle className="h-4 w-4" />
            <span>{errMsg}</span>
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            {inv.advisory.myRequestsTitle}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {inv.advisory.myRequestsSubtitle}
          </p>
        </div>

        {requests.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-[#1F2937] dark:text-slate-400">
            {inv.advisory.noRequests}
          </div>
        ) : (
          requests.map((req) => (
            <article
              key={req.id}
              className="rounded-2xl border border-slate-200/90 bg-white p-5 dark:border-slate-800 dark:bg-[#1F2937]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#087F5B] dark:text-[#34D399]">
                    {req.id}
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {req.category}
                  </span>
                  {req.symbol && (
                    <span className="rounded bg-[#087F5B]/10 px-2 py-0.5 font-mono text-[11px] font-bold text-[#087F5B] dark:bg-[#34D399]/15 dark:text-[#34D399]">
                      {req.symbol}
                    </span>
                  )}
                </div>
                <span className="rounded bg-amber-100 px-2.5 py-0.5 font-mono text-[11px] font-bold text-amber-900 dark:bg-amber-900/40 dark:text-amber-300">
                  {inv.statuses[req.status] ?? req.status}
                </span>
              </div>

              <p className="mt-2.5 text-xs leading-relaxed text-slate-800 dark:text-slate-100">
                {req.message}
              </p>

              {req.responses.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  {req.responses.map((resp) => (
                    <div
                      key={resp.id}
                      className="rounded-xl bg-[#F8F6F0] px-3.5 py-2.5 text-xs dark:bg-[#111827]"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-semibold text-[#087F5B] dark:text-[#34D399]">
                          {inv.advisory.brokerResponsesLabel} · {resp.brokerName}
                        </span>
                        <span className="font-mono">{resp.createdAt.slice(0, 16).replace('T', ' ')}</span>
                      </div>
                      <p className="mt-1 text-slate-800 dark:text-slate-200">{resp.responseText}</p>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))
        )}
      </section>
    </div>
  );
};

/* ==================== EXPERT ADVICE RECEIVED ==================== */
interface InvestorExpertAdviceSectionProps {
  adviceList: ExpertAdviceItem[];
  onMarkRead: (adviceId: string) => Promise<void>;
}

export const InvestorExpertAdviceSection: React.FC<InvestorExpertAdviceSectionProps> = ({
  adviceList,
  onMarkRead,
}) => {
  const { inv } = useAppContext();
  const [markingId, setMarkingId] = useState<string | null>(null);

  const handleMark = async (id: string) => {
    setMarkingId(id);
    try {
      await onMarkRead(id);
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
          {inv.advisory.expertAdviceTitle}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {inv.advisory.expertAdviceSubtitle}
        </p>
      </div>

      {adviceList.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-[#1F2937] dark:text-slate-400">
          {inv.advisory.noAdvice}
        </div>
      ) : (
        adviceList.map((adv) => (
          <article
            key={adv.id}
            className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#1F2937]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#782F46] dark:text-[#B76E85]" />
                <span className="font-mono text-xs font-bold text-[#782F46] dark:text-[#B76E85]">
                  {adv.id}
                </span>
                {adv.symbol && (
                  <span className="rounded bg-[#087F5B]/10 px-2 py-0.5 font-mono text-[11px] font-bold text-[#087F5B] dark:bg-[#34D399]/15 dark:text-[#34D399]">
                    {adv.symbol}
                  </span>
                )}
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {adv.category}
                </span>
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  {inv.advisory.riskLevelLabel}: {inv.statuses[adv.riskLevel] ?? adv.riskLevel}
                </span>
              </div>

              {adv.status === 'Sent' ? (
                <button
                  type="button"
                  disabled={markingId === adv.id}
                  onClick={() => handleMark(adv.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#087F5B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#06684A] disabled:opacity-50 dark:bg-[#34D399] dark:text-slate-950"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{inv.advisory.markAsRead}</span>
                </button>
              ) : (
                <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {inv.advisory.markedRead}
                </span>
              )}
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
              {adv.analysis}
            </p>

            <div className="mt-3 rounded-xl bg-[#087F5B]/10 p-3.5 text-xs dark:bg-[#34D399]/10">
              <p className="flex items-center gap-1.5 font-semibold text-[#087F5B] dark:text-[#34D399]">
                <Brain className="h-3.5 w-3.5" />
                <span>{inv.advisory.recommendationLabel}</span>
              </p>
              <p className="mt-1 leading-relaxed text-slate-800 dark:text-slate-100">
                {adv.recommendation}
              </p>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {inv.advisory.supportingIndicators}
              </p>
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#F8F6F0] p-3 text-[11px] sm:grid-cols-6 dark:bg-[#111827] tabular-nums">
                <div>
                  <span className="block text-slate-500">{inv.home.latestClose}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {adv.supportingMetrics.latestClose !== null
                      ? formatINR(adv.supportingMetrics.latestClose)
                      : inv.common.noData}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500">RSI (14)</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {adv.supportingMetrics.rsi14 !== null
                      ? adv.supportingMetrics.rsi14.toFixed(1)
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500">ATR (14)</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {adv.supportingMetrics.atr14 !== null
                      ? formatINR(adv.supportingMetrics.atr14)
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500">GARCH</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {adv.supportingMetrics.garchAnnualVolPct !== null
                      ? `${adv.supportingMetrics.garchAnnualVolPct.toFixed(1)}%`
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500">{inv.stocks.signalLabel}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {adv.supportingMetrics.mlModelTrained && adv.supportingMetrics.mlSignal
                      ? `${inv.statuses[adv.supportingMetrics.mlSignal] ?? adv.supportingMetrics.mlSignal}`
                      : inv.home.untrained}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500">{inv.stocks.capitalAlloc}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {adv.supportingMetrics.holdingAllocationPct !== null
                      ? `${adv.supportingMetrics.holdingAllocationPct.toFixed(1)}%`
                      : '0%'}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-[#087F5B] dark:text-[#34D399]" />
                <span>{adv.disclaimer}</span>
              </span>
              <span className="font-mono">
                {adv.brokerName} · {(adv.sentAt || adv.generatedAt).slice(0, 16).replace('T', ' ')}
              </span>
            </div>
          </article>
        ))
      )}
    </div>
  );
};

/* ==================== INVESTOR MESSAGES WITH BROKER ==================== */
interface InvestorMessagesSectionProps {
  linked: boolean;
  connection: InvestorBrokerConnection | null;
  messages: BrokerMessageItem[];
  currentUserId: string;
  onSendMessage: (messageText: string) => Promise<void>;
}

export const InvestorMessagesSection: React.FC<InvestorMessagesSectionProps> = ({
  linked,
  connection,
  messages,
  currentUserId,
  onSendMessage,
}) => {
  const { inv } = useAppContext();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || sending || !linked) return;
    setSending(true);
    setErrMsg(null);
    try {
      await onSendMessage(draft.trim());
      setDraft('');
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : inv.common.noData);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="flex h-[520px] flex-col rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-[#1F2937]">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="h-4 w-4 text-[#087F5B] dark:text-[#34D399]" />
          <div>
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              {inv.advisory.messagesTitle}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {linked && connection?.brokerName
                ? `${connection.brokerName} (${connection.brokerUserCode})`
                : inv.advisory.messagesSubtitle}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-5 text-xs">
        {!linked ? (
          <p className="py-12 text-center text-slate-500 dark:text-slate-400">
            {inv.advisory.linkBrokerFirst}
          </p>
        ) : messages.length === 0 ? (
          <p className="py-12 text-center text-slate-500 dark:text-slate-400">
            {inv.advisory.noMessages}
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === currentUserId;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${
                    mine
                      ? 'bg-[#087F5B] text-white dark:bg-[#34D399] dark:text-slate-950'
                      : 'bg-[#F8F6F0] text-slate-800 dark:bg-[#111827] dark:text-slate-100'
                  }`}
                >
                  <p className="text-[10px] font-semibold opacity-80">
                    {mine ? inv.advisory.youLabel : `${inv.advisory.brokerLabel} · ${m.senderName}`} ·{' '}
                    {m.createdAt.slice(0, 16).replace('T', ' ')}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{m.messageText}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {errMsg && (
        <p className="px-5 pb-2 text-xs font-semibold text-[#782F46] dark:text-[#B76E85]">{errMsg}</p>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-slate-200 p-4 dark:border-slate-800">
        <input
          type="text"
          aria-label={inv.advisory.messagePlaceholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={!linked}
          placeholder={inv.advisory.messagePlaceholder}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
        />
        <button
          type="submit"
          disabled={!linked || sending || !draft.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#087F5B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#06684A] disabled:opacity-50 dark:bg-[#34D399] dark:text-slate-950"
        >
          <Send className="h-3.5 w-3.5" />
          <span>{sending ? inv.common.loading : inv.advisory.sendMessageBtn}</span>
        </button>
      </form>
    </section>
  );
};
