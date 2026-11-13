import crypto from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { getDb } from './db.ts';
import type { LanguageCode } from './types.ts';

function hasConfiguredGeminiKey(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim() !== '' && key.trim() !== 'MY_GEMINI_API_KEY');
}

function getCacheKey(targetLang: LanguageCode, sourceText: string): string {
  const digest = crypto.createHash('sha256').update(sourceText).digest('hex').slice(0, 32);
  return `${targetLang}:${digest}`;
}

export function getCachedTranslation(targetLang: LanguageCode, sourceText: string): {
  translatedText: string;
  provider: string;
} | null {
  if (targetLang === 'en' || !sourceText.trim()) {
    return { translatedText: sourceText, provider: 'original' };
  }
  const db = getDb();
  const key = getCacheKey(targetLang, sourceText);
  const row = db
    .prepare('SELECT translated_text, provider FROM translation_cache WHERE cache_key = ?')
    .get(key) as { translated_text: string; provider: string } | undefined;
  if (!row) return null;
  return { translatedText: row.translated_text, provider: `${row.provider} (cached)` };
}

export function saveCachedTranslation(
  targetLang: LanguageCode,
  sourceText: string,
  translatedText: string,
  provider: string,
): void {
  if (targetLang === 'en' || !sourceText.trim() || !translatedText.trim()) return;
  const db = getDb();
  const key = getCacheKey(targetLang, sourceText);
  db.prepare(
    `INSERT OR REPLACE INTO translation_cache (cache_key, target_lang, source_text, translated_text, provider, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(key, targetLang, sourceText, translatedText, provider, new Date().toISOString());
}

const PHRASE_MAP_HI: Array<[RegExp, string]> = [
  [/\bOutcome of Board Meeting\b/gi, 'बोर्ड बैठक का परिणाम'],
  [/\bBoard Meeting\b/gi, 'बोर्ड बैठक'],
  [/\bFinancial Results\b/gi, 'वित्तीय परिणाम'],
  [/\bUnaudited Financial Results\b/gi, 'अलेखापरीक्षित वित्तीय परिणाम'],
  [/\bAudited Financial Results\b/gi, 'लेखापरीक्षित वित्तीय परिणाम'],
  [/\bQuarter and Half Year ended\b/gi, 'तिमाही और छमाही समाप्त'],
  [/\bQuarter ended\b/gi, 'तिमाही समाप्त'],
  [/\bInterim Dividend\b/gi, 'अंतरिम लाभांश'],
  [/\bFinal Dividend\b/gi, 'अंतिम लाभांश'],
  [/\bDividend\b/gi, 'लाभांश'],
  [/\bBook Closure\b/gi, 'बुक क्लोज़र'],
  [/\bRecord Date\b/gi, 'रिकॉर्ड तिथि'],
  [/\bPress Release\b/gi, 'प्रेस विज्ञप्ति'],
  [/\bInvestor Presentation\b/gi, 'निवेशक प्रस्तुति'],
  [/\bAnalyst \/ Institutional Investor Meet\b/gi, 'विश्लेषक / संस्थागत निवेशक बैठक'],
  [/\bAnalyst Meet\b/gi, 'विश्लेषक बैठक'],
  [/\bTrading Window\b/gi, 'ट्रेडिंग विंडो'],
  [/\bClosure of Trading Window\b/gi, 'ट्रेडिंग विंडो बंद होना'],
  [/\bIntimation\b/gi, 'आधिकारिक सूचना'],
  [/\bUpdate\b/gi, 'अद्यतन सूचना'],
  [/\bAppointment\b/gi, 'नियुक्ति'],
  [/\bResignation\b/gi, 'इस्तीफा'],
  [/\bAllotment\b/gi, 'आवंटन'],
  [/\bCredit Rating\b/gi, 'क्रेडिट रेटिंग'],
  [/\bBonus\b/gi, 'बोनस'],
  [/\bStock Split\b/gi, 'शेयर विभाजन'],
  [/\bAnnual General Meeting\b/gi, 'वार्षिक आम बैठक'],
  [/\bAGM\b/g, 'एजीएम (वार्षिक आम बैठक)'],
  [/\bCorporate Action\b/gi, 'कॉर्पोरेट कार्रवाई'],
  [/\bAnnouncement\b/gi, 'एक्सचेंज घोषणा'],
  [/\bEarnings Call\b/gi, 'आय कॉल'],
  [/\bAgreement\b/gi, 'समझौता'],
  [/\bAcquisition\b/gi, 'अधिग्रहण'],
  [/\bto consider and approve\b/gi, 'पर विचार और अनुमोदन करने हेतु'],
  [/\binter alia\b/gi, 'अन्य विषयों के साथ'],
];

const PHRASE_MAP_TE: Array<[RegExp, string]> = [
  [/\bOutcome of Board Meeting\b/gi, 'బోర్డు సమావేశ ఫలితాలు'],
  [/\bBoard Meeting\b/gi, 'బోర్డు సమావేశం'],
  [/\bFinancial Results\b/gi, 'ఆర్థిక ఫలితాలు'],
  [/\bUnaudited Financial Results\b/gi, 'ఆడిట్ చేయని ఆర్థిక ఫలితాలు'],
  [/\bAudited Financial Results\b/gi, 'ఆడిట్ చేసిన ఆర్థిక ఫలితాలు'],
  [/\bQuarter and Half Year ended\b/gi, 'త్రైమాసికం మరియు అర్ధ సంవత్సరం ముగింపు'],
  [/\bQuarter ended\b/gi, 'త్రైమాసికం ముగింపు'],
  [/\bInterim Dividend\b/gi, 'మధ్యంతర డివిడెండ్'],
  [/\bFinal Dividend\b/gi, 'తుది డివిడెండ్'],
  [/\bDividend\b/gi, 'డివిడెండ్'],
  [/\bBook Closure\b/gi, 'బుక్ క్లోజర్'],
  [/\bRecord Date\b/gi, 'రికార్డ్ తేదీ'],
  [/\bPress Release\b/gi, 'పత్రికా ప్రకటన'],
  [/\bInvestor Presentation\b/gi, 'పెట్టుబడిదారుల ప్రజెంటేషన్'],
  [/\bAnalyst \/ Institutional Investor Meet\b/gi, 'విశ్లేషకులు / సంస్థాగత పెట్టుబడిదారుల సమావేశం'],
  [/\bAnalyst Meet\b/gi, 'విశ్లేషకుల సమావేశం'],
  [/\bTrading Window\b/gi, 'ట్రేడింగ్ విండో'],
  [/\bClosure of Trading Window\b/gi, 'ట్రేడింగ్ విండో మూసివేత'],
  [/\bIntimation\b/gi, 'అధికారిక సమాచారం'],
  [/\bUpdate\b/gi, 'తాజా సమాచారం'],
  [/\bAppointment\b/gi, 'నియామకం'],
  [/\bResignation\b/gi, 'రాజీనామా'],
  [/\bAllotment\b/gi, 'కేటాయింపు'],
  [/\bCredit Rating\b/gi, 'క్రెడిట్ రేటింగ్'],
  [/\bBonus\b/gi, 'బోనస్'],
  [/\bStock Split\b/gi, 'షేర్ విభజన'],
  [/\bAnnual General Meeting\b/gi, 'వార్షిక సర్వసభ సమావేశం'],
  [/\bAGM\b/g, 'ఏజీఎం (వార్షిక సర్వసభ)'],
  [/\bCorporate Action\b/gi, 'కార్పొరేట్ చర్య'],
  [/\bAnnouncement\b/gi, 'ఎక్స్ఛేంజ్ ప్రకటన'],
  [/\bEarnings Call\b/gi, 'ఆదాయాల కాల్'],
  [/\bAgreement\b/gi, 'ఒప్పందం'],
  [/\bAcquisition\b/gi, 'కొనుగోలు'],
  [/\bto consider and approve\b/gi, 'పరిశీలించి ఆమోదించుటకు'],
  [/\binter alia\b/gi, 'ఇతర అంశాలతో పాటు'],
];

export function deterministicFinancialTranslate(text: string, targetLang: LanguageCode): string {
  if (targetLang === 'en' || !text.trim()) return text;
  let out = text;
  const rules = targetLang === 'hi' ? PHRASE_MAP_HI : PHRASE_MAP_TE;
  for (const [pattern, replacement] of rules) {
    out = out.replace(pattern, replacement);
  }
  if (out === text) {
    return targetLang === 'hi'
      ? `NSE एक्सचेंज फाइलिंग: ${text}`
      : `NSE ఎక్స్ఛేంజ్ ఫైలింగ్: ${text}`;
  }
  return out;
}

export async function translateFinancialTexts(
  texts: string[],
  targetLang: LanguageCode,
): Promise<Array<{ text: string; provider: string }>> {
  if (targetLang === 'en') {
    return texts.map((t) => ({ text: t, provider: 'original' }));
  }

  const results: Array<{ text: string; provider: string } | null> = texts.map((t) => {
    const cached = getCachedTranslation(targetLang, t);
    return cached ? { text: cached.translatedText, provider: cached.provider } : null;
  });

  const missingIndices: number[] = [];
  for (let i = 0; i < results.length; i++) {
    if (!results[i]) missingIndices.push(i);
  }

  if (missingIndices.length === 0) {
    return results as Array<{ text: string; provider: string }>;
  }

  // Attempt Gemini batch translation when GEMINI_API_KEY is configured
  if (hasConfiguredGeminiKey() && missingIndices.length > 0) {
    try {
      const langLabel = targetLang === 'hi' ? 'Hindi (Devanagari script)' : 'Telugu (Telugu script)';
      const payloadList = missingIndices.map((idx, pos) => ({
        i: pos,
        text: texts[idx],
      }));
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
      const geminiPromise = ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Translate the following Indian stock market / NSE corporate filing texts into natural, accurate ${langLabel}.
CRITICAL RULES:
- Preserve all stock ticker symbols (e.g., RELIANCE, TCS, TATASTEEL), company proper names, rupee amounts (₹), percentages, and dates accurately.
- Do NOT fabricate or add new facts beyond the provided text.
- Return ONLY a valid JSON array of strings matching the exact length and order of the input items.

Input JSON:
${JSON.stringify(payloadList.map((p) => p.text))}`,
      });
      const response = await Promise.race([
        geminiPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Gemini translation timeout')), 6500),
        ),
      ]);

      const raw = (response.text ?? '').trim();
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length === missingIndices.length) {
        missingIndices.forEach((origIdx, pos) => {
          const translated = String(parsed[pos] ?? texts[origIdx]).trim() || texts[origIdx];
          saveCachedTranslation(targetLang, texts[origIdx], translated, 'gemini');
          results[origIdx] = { text: translated, provider: 'gemini' };
        });
      }
    } catch {
      // Fall through to deterministic translator below without losing stock symbols/numbers
    }
  }

  // Deterministic fallback for any uncached entries (persisted in translation_cache)
  for (const idx of missingIndices) {
    if (!results[idx]) {
      const translated = deterministicFinancialTranslate(texts[idx], targetLang);
      saveCachedTranslation(targetLang, texts[idx], translated, 'dictionary-fallback');
      results[idx] = { text: translated, provider: 'dictionary-fallback' };
    }
  }

  return results as Array<{ text: string; provider: string }>;
}
