import { GoogleGenAI } from '@google/genai';

export interface AssistantRequestPayload {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
  language?: 'en' | 'hi' | 'te';
  context?: Record<string, unknown>;
}

export async function generateBullseyeResponse(payload: AssistantRequestPayload): Promise<{
  configured: boolean;
  reply?: string;
  error?: string;
}> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return {
      configured: false,
      error:
        'GEMINI_API_KEY is not configured on the server yet. Configure your Gemini API key in Settings > Secrets to enable live BULLSEYE AI explanations. All quantitative analytics, ML models, backtests, and practice trading remain fully functional.',
    };
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const langInstruction =
    payload.language === 'hi'
      ? 'Respond clearly in Hindi (Devanagari script), keeping stock ticker symbols (like RELIANCE, TCS), technical abbreviations (RSI, MACD, SMA, EMA, ATR, GARCH), and mathematical formulas in English/standard notation.'
      : payload.language === 'te'
        ? 'Respond clearly in Telugu script, keeping stock ticker symbols (like RELIANCE, TCS), technical abbreviations (RSI, MACD, SMA, EMA, ATR, GARCH), and mathematical formulas in English/standard notation.'
        : 'Respond in clear, concise, beginner-friendly English.';

  const contextJson = payload.context ? JSON.stringify(payload.context, null, 2) : 'None provided.';

  const systemInstruction = `You are BULLSEYE AI, an educational quantitative investment and trading copilot for the Indian stock market (NSE NIFTY 50).

CRITICAL RULES:
1. Ground every numeric claim strictly in the Application Context provided below. Never invent live November 2026 stock prices, unverified company news, revenue/P/E numbers, or fabricated model accuracy.
2. Clearly note that the platform's historical NSE dataset spans October 2020 to September 30, 2025 — do not present September 2025 closing prices as live current market prices.
3. Never guarantee future stock returns or give personalized financial advice. Frame signals, probabilities, and risk calculations as educational model outputs.
4. Explain technical concepts (RSI, MACD, Bollinger Bands, ATR, Stop-Loss, SHAP/Feature Attribution, GARCH(1,1), Sharpe Ratio) in clear, accessible language.
5. ${langInstruction}

ACTIVE APPLICATION CONTEXT:
${contextJson}`;

  const historyLines = (payload.history ?? [])
    .slice(-8)
    .map((m) => `${m.role === 'user' ? 'User' : 'BULLSEYE AI'}: ${m.text}`)
    .join('\n');

  const fullPrompt = historyLines
    ? `${historyLines}\nUser: ${payload.message}`
    : payload.message;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: fullPrompt,
      config: {
        systemInstruction,
      },
    });
    const text = response.text?.trim();
    if (!text) {
      return {
        configured: true,
        error: 'The AI model returned an empty response. Please rephrase your question.',
      };
    }
    return { configured: true, reply: text };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate AI response.';
    return {
      configured: true,
      error: `Gemini API error: ${message}`,
    };
  }
}
