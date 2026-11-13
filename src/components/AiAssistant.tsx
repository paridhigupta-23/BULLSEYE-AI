import React, { useEffect, useRef, useState } from 'react';
import { Bot, Mic, MicOff, Send, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext.tsx';
import { api } from '../services/api.ts';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const WELCOME_BY_LANG = {
  en: 'Hello! I am BULLSEYE AI. Ask me about any NIFTY 50 stock in our historical dataset (Oct 2020 – Sep 2025), technical indicators, ML signals, SHAP attributions, GARCH(1,1) volatility, or ATR stop-loss math.',
  hi: 'नमस्ते! मैं BULLSEYE AI हूँ। आप हमारे ऐतिहासिक NIFTY 50 डेटासेट (अक्टूबर 2020 – सितंबर 2025), तकनीकी इंडिकेटर, ML सिग्नल, GARCH(1,1) वोलैटिलिटी या ATR स्टॉप-लॉस के बारे में पूछ सकते हैं।',
  te: 'నమస్కారం! నేను BULLSEYE AI. మా చారిత్రక NIFTY 50 డేటాసెట్ (అక్టోబర్ 2020 – సెప్టెంబర్ 2025), సాంకేతిక సూచికలు, ML సిగ్నల్స్, GARCH(1,1) లేదా ATR స్టాప్-లాస్ గురించి అడగండి.',
};

export const AiAssistant: React.FC = () => {
  const {
    aiOpen,
    setAiOpen,
    aiContext,
    pendingAiPrompt,
    clearPendingAiPrompt,
    language,
    selectedSymbol,
    t,
  } = useAppContext();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: WELCOME_BY_LANG[language],
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages((prev) =>
      prev.length === 1 && prev[0].id === 'welcome'
        ? [{ id: 'welcome', role: 'assistant', text: WELCOME_BY_LANG[language] }]
        : prev,
    );
  }, [language]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, aiOpen]);

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || sending) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setSending(true);

    try {
      const ctxPayload = aiContext
        ? { title: aiContext.title, symbol: aiContext.symbol ?? selectedSymbol, ...aiContext.data }
        : { activeStockSymbol: selectedSymbol };

      const res = await api.chatWithAi({
        message: trimmed,
        history: nextHistory.map((m) => ({ role: m.role, text: m.text })),
        language,
        context: ctxPayload,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text:
            res.reply ??
            res.error ??
            'Unable to reach Gemini right now. Please verify server configuration.',
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text: err instanceof Error ? err.message : 'Assistant request failed.',
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (aiOpen && pendingAiPrompt) {
      const prompt = pendingAiPrompt;
      clearPendingAiPrompt();
      sendMessage(prompt);
    }
  }, [aiOpen, pendingAiPrompt]);

  const handleVoiceInput = () => {
    const SpeechRec =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

    if (!SpeechRec) {
      setMessages((prev) => [
        ...prev,
        {
          id: `v-${Date.now()}`,
          role: 'assistant',
          text: 'Voice-to-text is not supported in this browser. Please type your question below.',
        },
      ]);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new (SpeechRec as any)();
    rec.lang = language === 'hi' ? 'hi-IN' : language === 'te' ? 'te-IN' : 'en-IN';
    rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (evt: any) => {
      const transcript = evt?.results?.[0]?.[0]?.transcript;
      if (transcript) setInput(transcript);
    };
    rec.start();
  };

  return (
    <>
      {/* Floating Trigger Button */}
      {!aiOpen && (
        <button
          type="button"
          onClick={() => setAiOpen(true)}
          aria-label="Open BULLSEYE AI Assistant"
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-[#087F5B] px-4 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.02] dark:bg-[#34D399] dark:text-slate-950"
        >
          <Bot className="h-4 w-4" />
          <span>BULLSEYE AI</span>
        </button>
      )}

      {/* Slide-Over Chat Drawer */}
      {aiOpen && (
        <aside
          aria-label="BULLSEYE AI Assistant"
          className="fixed bottom-4 right-4 z-50 flex h-[min(620px,85vh)] w-[min(420px,calc(100vw-2rem))] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#1F2937]"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-[#087F5B] dark:text-[#34D399]" />
              <div>
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  {t.aiTitle}
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Educational Copilot · {aiContext?.symbol ?? selectedSymbol}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAiOpen(false)}
              aria-label="Close BULLSEYE AI Assistant"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {aiContext && (
            <div className="border-b border-slate-200 bg-[#EAE4F5]/60 px-4 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-[#111827] dark:text-slate-200">
              <span className="font-semibold">Context:</span> {aiContext.title}
            </div>
          )}

          {/* Chat History */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-xs leading-relaxed">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-[#087F5B] text-white dark:bg-[#34D399] dark:text-slate-950'
                      : 'bg-[#F8F6F0] text-slate-800 dark:bg-[#111827] dark:text-slate-100'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-[#F8F6F0] px-3.5 py-2.5 text-xs text-slate-500 dark:bg-[#111827] dark:text-slate-400">
                  Analyzing dataset context...
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Suggested Questions */}
          <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-700">
            <p className="mb-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              {t.suggestedQuestionsTitle}
            </p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {t.suggestedQuestions.slice(0, 5).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendMessage(q)}
                  className="rounded-lg border border-slate-200 bg-[#F8F6F0] px-2.5 py-1 text-[11px] text-slate-700 hover:border-[#087F5B] dark:border-slate-700 dark:bg-[#111827] dark:text-slate-200 whitespace-nowrap shrink-0"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="flex items-center gap-2 border-t border-slate-200 p-3 dark:border-slate-700"
          >
            <button
              type="button"
              onClick={handleVoiceInput}
              aria-label="Voice input"
              className={`rounded-lg p-2 ${
                listening
                  ? 'bg-[#782F46] text-white'
                  : 'border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.aiPlaceholder}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#111827] dark:text-white"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send message"
              className="rounded-lg bg-[#087F5B] p-2 text-white hover:bg-[#06684A] disabled:opacity-50 dark:bg-[#34D399] dark:text-slate-950"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </aside>
      )}
    </>
  );
};
