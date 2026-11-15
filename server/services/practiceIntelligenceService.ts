import { loadDatasets } from '../dataLoader.ts';
import { getDb } from '../db.ts';
import { generateBullseyeResponse } from '../geminiService.ts';
import { getPortfolioSnapshot } from '../tradingStore.ts';
import {
  analyzeTradingPersonality,
  DEMO_PERSONAS,
  DEMO_PREDICTIONS,
  DEMO_PRICE_BARS,
  detectTradingMistakes,
  evaluatePredictions,
  generateCoachResponse,
  portfolioSnapshotToVirtualPortfolio,
  runWhatIfSimulation,
  tradeRecordsToVirtualTrades,
  type AIPredictionRecord,
  type CoachContext,
  type CoachResponse,
  type MistakeWarning,
  type PredictionAutopsyReport,
  type PriceBar,
  type TraderPersonalityReport,
  type VirtualPortfolio,
  type VirtualTrade,
  type WhatIfRequest,
  type WhatIfSimulationResult,
} from '../../src/practice-intelligence/index.ts';

// Initialize optional persistence tables for AI predictions and audits if not present
export function initializePracticeIntelligenceDb(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS practice_ai_predictions (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      predicted_signal TEXT NOT NULL CHECK (predicted_signal IN ('BUY', 'SELL', 'HOLD')),
      confidence REAL NOT NULL,
      prediction_timestamp TEXT NOT NULL,
      price_at_prediction REAL NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS practice_what_if_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      target_symbol TEXT NOT NULL,
      price_change_pct REAL NOT NULL,
      investment_delta REAL NOT NULL,
      pnl_impact REAL NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS practice_coaching_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      question TEXT NOT NULL,
      response_source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Seed default historical predictions if table is empty
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM practice_ai_predictions').get() as { cnt: number };
  if (countRow.cnt === 0) {
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO practice_ai_predictions
        (id, symbol, predicted_signal, confidence, prediction_timestamp, price_at_prediction, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const now = new Date().toISOString();
    for (const pred of DEMO_PREDICTIONS) {
      insertStmt.run(
        pred.prediction_id,
        pred.symbol,
        pred.predicted_signal,
        pred.confidence,
        pred.prediction_timestamp,
        pred.price_at_prediction,
        now,
      );
    }
  }
}

export function getSymbolVolatilityMap(): Map<string, number> {
  const map = new Map<string, number>();
  try {
    const ds = loadDatasets();
    for (const meta of ds.catalog) {
      const ohlcv = ds.combinedBySymbol.get(meta.symbol) ?? [];
      if (ohlcv.length >= 20) {
        // Compute 20-day annualized volatility from returns
        const returns: number[] = [];
        for (let i = 1; i < ohlcv.length; i++) {
          const prev = ohlcv[i - 1].close;
          if (prev > 0) {
            returns.push((ohlcv[i].close - prev) / prev);
          }
        }
        const recent = returns.slice(-60);
        if (recent.length > 0) {
          const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
          const variance = recent.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / recent.length;
          const dailyStd = Math.sqrt(variance);
          const annualVol = dailyStd * Math.sqrt(252) * 100;
          map.set(meta.symbol.toUpperCase(), Number(annualVol.toFixed(1)));
        }
      }
    }
  } catch {
    // fallback if datasets cannot be loaded immediately
  }
  return map;
}

export function getUserVirtualTradingData(userId: string): {
  portfolio: VirtualPortfolio;
  trades: VirtualTrade[];
} {
  const snapshot = getPortfolioSnapshot(userId);
  const volMap = getSymbolVolatilityMap();
  const portfolio = portfolioSnapshotToVirtualPortfolio(snapshot, volMap);
  const trades = tradeRecordsToVirtualTrades(snapshot.trades, volMap);
  return { portfolio, trades };
}

export function getAuditablePredictionsAndBars(): {
  predictions: AIPredictionRecord[];
  bars: PriceBar[];
} {
  initializePracticeIntelligenceDb();
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, symbol, predicted_signal, confidence, prediction_timestamp, price_at_prediction
    FROM practice_ai_predictions
    ORDER BY prediction_timestamp ASC
  `).all() as Array<{
    id: string;
    symbol: string;
    predicted_signal: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    prediction_timestamp: string;
    price_at_prediction: number;
  }>;

  const predictions: AIPredictionRecord[] = rows.map((r) => ({
    prediction_id: r.id,
    symbol: r.symbol,
    predicted_signal: r.predicted_signal,
    confidence: r.confidence,
    prediction_timestamp: r.prediction_timestamp,
    price_at_prediction: r.price_at_prediction,
  }));

  // Build price bars from actual NIFTY 50 dataset for symbols present in predictions
  const bars: PriceBar[] = [...DEMO_PRICE_BARS];
  try {
    const ds = loadDatasets();
    for (const pred of predictions) {
      const ohlcv = ds.combinedBySymbol.get(pred.symbol.toUpperCase());
      if (ohlcv && ohlcv.length > 0) {
        for (const bar of ohlcv.slice(-30)) {
          bars.push({
            symbol: pred.symbol.toUpperCase(),
            timestamp: `${bar.date}T15:30:00Z`,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume,
          });
        }
      }
    }
  } catch {
    // use default bars
  }

  return { predictions, bars };
}

export function computePracticeIntelligenceOverview(userId: string): {
  portfolio: VirtualPortfolio;
  trades: VirtualTrade[];
  mistakes: MistakeWarning[];
  personality: TraderPersonalityReport;
  autopsy: PredictionAutopsyReport;
  baselineWhatIf: WhatIfSimulationResult;
  demoPersonas: typeof DEMO_PERSONAS;
} {
  const { portfolio, trades } = getUserVirtualTradingData(userId);
  const mistakes = detectTradingMistakes(portfolio, trades);
  const personality = analyzeTradingPersonality(portfolio, trades);
  const { predictions, bars } = getAuditablePredictionsAndBars();
  const autopsy = evaluatePredictions(predictions, bars);
  const baselineWhatIf = runWhatIfSimulation(portfolio, {
    targetSymbol: 'ALL',
    priceChangePct: -5,
    hypotheticalInvestmentDelta: 0,
  });

  return {
    portfolio,
    trades,
    mistakes,
    personality,
    autopsy,
    baselineWhatIf,
    demoPersonas: DEMO_PERSONAS,
  };
}

export async function askAiCoach(
  userId: string,
  userQuestion: string,
  customContext?: Partial<CoachContext>,
): Promise<CoachResponse> {
  let context: CoachContext;
  if (customContext && customContext.portfolio && customContext.personality && customContext.autopsy) {
    context = {
      portfolio: customContext.portfolio,
      mistakes: customContext.mistakes || detectTradingMistakes(customContext.portfolio, []),
      personality: customContext.personality,
      autopsy: customContext.autopsy,
      latestSimulation: customContext.latestSimulation,
      userQuestion,
    };
  } else {
    const overview = computePracticeIntelligenceOverview(userId);
    context = {
      portfolio: overview.portfolio,
      mistakes: overview.mistakes,
      personality: overview.personality,
      autopsy: overview.autopsy,
      latestSimulation: overview.baselineWhatIf,
      userQuestion,
    };
  }

  // LLM callable using BULLSEYE AI's Gemini integration
  const llmCallable = async (prompt: string, sysInst: string) => {
    const res = await generateBullseyeResponse({
      message: prompt,
      context: { systemInstructionOverride: sysInst },
    });
    return {
      ok: Boolean(res.configured && res.reply),
      reply: res.reply,
      error: res.error,
    };
  };

  const response = await generateCoachResponse(context, llmCallable);

  // Record coaching history
  try {
    const db = getDb();
    const now = new Date().toISOString();
    const id = `COACH-${Date.now().toString(36).toUpperCase()}`;
    db.prepare(`
      INSERT INTO practice_coaching_history (id, user_id, question, response_source, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, userId, userQuestion || 'General coaching query', response.source, now);
  } catch {
    // ignore logging failure
  }

  return response;
}
