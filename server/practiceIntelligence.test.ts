import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createBullseyeApp } from '../server.ts';
import { closeDb } from './db.ts';
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
  type PriceBar,
  type VirtualPortfolio,
  type VirtualTrade,
  type WhatIfRequest,
} from '../src/practice-intelligence/index.ts';

test('Practice Intelligence Engine — Comprehensive Test Suite', async (t) => {
  // ==========================================
  // 1. MISTAKE DETECTOR: Single-Stock Exposure & HHI Concentration
  // ==========================================
  await t.test('detects single-stock over-allocation above 25% and HHI concentration', () => {
    const portfolio: VirtualPortfolio = {
      startingCapital: 1000000,
      cashBalance: 100000,
      holdingsMarketValue: 900000,
      totalPortfolioValue: 1000000,
      realizedPnl: 0,
      unrealizedPnl: 0,
      totalPnl: 0,
      totalReturnPct: 0,
      holdings: [
        {
          symbol: 'RELIANCE',
          name: 'Reliance',
          quantity: 400,
          avgBuyPrice: 1300,
          currentPrice: 1300,
          latestPriceDate: '2025-09-30',
          investedValue: 520000,
          marketValue: 520000, // 52% of total equity!
          unrealizedPnl: 0,
          unrealizedPnlPct: 0,
          allocationPct: 52,
          stopLoss: 1250,
        },
        {
          symbol: 'TCS',
          name: 'TCS',
          quantity: 126,
          avgBuyPrice: 3000,
          currentPrice: 3000,
          latestPriceDate: '2025-09-30',
          investedValue: 380000,
          marketValue: 380000, // 38% of total equity!
          unrealizedPnl: 0,
          unrealizedPnlPct: 0,
          allocationPct: 38,
          stopLoss: 2900,
        },
      ],
    };

    const warnings = detectTradingMistakes(portfolio, []);
    const singleStockRel = warnings.find((w) => w.code === 'SINGLE_STOCK_EXPOSURE_RELIANCE');
    assert.ok(singleStockRel, 'Must trigger single stock warning for RELIANCE');
    assert.equal(singleStockRel.severity, 'High', '52% exposure must be High severity (>=40%)');

    const singleStockTcs = warnings.find((w) => w.code === 'SINGLE_STOCK_EXPOSURE_TCS');
    assert.ok(singleStockTcs, 'Must trigger single stock warning for TCS');
    assert.equal(singleStockTcs.severity, 'Medium', '38% exposure must be Medium severity (25-39.9%)');

    const concentration = warnings.find((w) => w.code === 'PORTFOLIO_CONCENTRATION');
    assert.ok(concentration, 'Must trigger PORTFOLIO_CONCENTRATION when top-2 represent > 40%');
    assert.ok(concentration.metric_value >= 0.35, 'HHI must be >= 0.35');
  });

  // ==========================================
  // 2. MISTAKE DETECTOR: Overtrading Frequency (6-9 Medium, 10+ High)
  // ==========================================
  await t.test('detects overtrading frequency with 6-9 (Medium) and 10+ (High)', () => {
    const portfolio: VirtualPortfolio = {
      startingCapital: 1000000,
      cashBalance: 800000,
      holdingsMarketValue: 200000,
      totalPortfolioValue: 1000000,
      realizedPnl: 0,
      unrealizedPnl: 0,
      totalPnl: 0,
      totalReturnPct: 0,
      holdings: [],
    };

    // 7 trades in one day => Medium
    const tradesMedium: VirtualTrade[] = Array.from({ length: 7 }, (_, i) => ({
      id: `TRD-MED-${i}`,
      timestamp: '2025-09-25T10:00:00Z',
      datasetPriceDate: '2025-09-25',
      symbol: 'INFY',
      side: i % 2 === 0 ? 'BUY' : 'SELL',
      quantity: 10,
      price: 1400,
      totalValue: 14000,
      realizedPnl: 0,
    }));

    const warningsMedium = detectTradingMistakes(portfolio, tradesMedium);
    const otMedium = warningsMedium.find((w) => w.code === 'OVERTRADING_FREQUENCY');
    assert.ok(otMedium, 'Must trigger OVERTRADING_FREQUENCY for 7 trades');
    assert.equal(otMedium.severity, 'Medium', '7 trades/day must be Medium severity');
    assert.equal(otMedium.metric_value, 7);

    // 11 trades in one day => High
    const tradesHigh: VirtualTrade[] = Array.from({ length: 11 }, (_, i) => ({
      id: `TRD-HIGH-${i}`,
      timestamp: '2025-09-26T10:00:00Z',
      datasetPriceDate: '2025-09-26',
      symbol: 'INFY',
      side: i % 2 === 0 ? 'BUY' : 'SELL',
      quantity: 10,
      price: 1400,
      totalValue: 14000,
      realizedPnl: 0,
    }));

    const warningsHigh = detectTradingMistakes(portfolio, tradesHigh);
    const otHigh = warningsHigh.find((w) => w.code === 'OVERTRADING_FREQUENCY');
    assert.ok(otHigh, 'Must trigger OVERTRADING_FREQUENCY for 11 trades');
    assert.equal(otHigh.severity, 'High', '11 trades/day must be High severity');
    assert.equal(otHigh.metric_value, 11);
  });

  // ==========================================
  // 3. MISTAKE DETECTOR: Missing Stop-Loss & Uncontrolled Volatility
  // ==========================================
  await t.test('detects missing stop-loss and uncontrolled high volatility', () => {
    const portfolio: VirtualPortfolio = {
      startingCapital: 1000000,
      cashBalance: 600000,
      holdingsMarketValue: 400000,
      totalPortfolioValue: 1000000,
      realizedPnl: 0,
      unrealizedPnl: 0,
      totalPnl: 0,
      totalReturnPct: 0,
      holdings: [
        {
          symbol: 'ADANIENT',
          name: 'Adani Enterprises',
          quantity: 120,
          avgBuyPrice: 2800,
          currentPrice: 2800,
          latestPriceDate: '2025-09-30',
          investedValue: 336000,
          marketValue: 336000,
          unrealizedPnl: 0,
          unrealizedPnlPct: 0,
          allocationPct: 33.6,
          stopLoss: 0, // Unprotected!
          annualizedVolatility: 41.5, // High volatility >= 35%!
        },
      ],
    };

    const warnings = detectTradingMistakes(portfolio, []);
    const stopLossWarn = warnings.find((w) => w.code === 'MISSING_STOP_LOSS');
    assert.ok(stopLossWarn, 'Must trigger MISSING_STOP_LOSS');
    assert.equal(stopLossWarn.severity, 'High', 'Unprotected holding > 30% of equity must be High severity');

    const volWarn = warnings.find((w) => w.code === 'UNCONTROLLED_HIGH_VOLATILITY');
    assert.ok(volWarn, 'Must trigger UNCONTROLLED_HIGH_VOLATILITY for vol >= 35% with no stop or exposure > 15%');
    assert.equal(volWarn.severity, 'High');
  });

  // ==========================================
  // 4. MISTAKE DETECTOR: Consecutive Losing Trades & Loss Rate
  // ==========================================
  await t.test('detects losing streak and high loss rate', () => {
    const portfolio: VirtualPortfolio = {
      startingCapital: 1000000,
      cashBalance: 950000,
      holdingsMarketValue: 0,
      totalPortfolioValue: 950000,
      realizedPnl: -50000,
      unrealizedPnl: 0,
      totalPnl: -50000,
      totalReturnPct: -5,
      holdings: [],
    };

    // 4 consecutive losing trades
    const trades: VirtualTrade[] = [
      { id: 'T1', timestamp: '2025-09-01T10:00:00Z', datasetPriceDate: '2025-09-01', symbol: 'INFY', side: 'SELL', quantity: 10, price: 1400, totalValue: 14000, realizedPnl: -2000 },
      { id: 'T2', timestamp: '2025-09-02T10:00:00Z', datasetPriceDate: '2025-09-02', symbol: 'INFY', side: 'SELL', quantity: 10, price: 1390, totalValue: 13900, realizedPnl: -3000 },
      { id: 'T3', timestamp: '2025-09-03T10:00:00Z', datasetPriceDate: '2025-09-03', symbol: 'INFY', side: 'SELL', quantity: 10, price: 1380, totalValue: 13800, realizedPnl: -2500 },
      { id: 'T4', timestamp: '2025-09-04T10:00:00Z', datasetPriceDate: '2025-09-04', symbol: 'INFY', side: 'SELL', quantity: 10, price: 1370, totalValue: 13700, realizedPnl: -4000 },
    ];

    const warnings = detectTradingMistakes(portfolio, trades);
    const lossWarn = warnings.find((w) => w.code === 'REPEATED_LOSS_TRADES');
    assert.ok(lossWarn, 'Must trigger REPEATED_LOSS_TRADES');
    assert.equal(lossWarn.severity, 'High', 'Streak >= 4 or loss rate >= 75% must be High severity');
    assert.equal(lossWarn.metric_value, 4);
  });

  // ==========================================
  // 5. WHAT-IF SIMULATOR: Shocks, Individual Stocks, Cash Deficit
  // ==========================================
  await t.test('What-If simulation calculates positive/negative shocks and cash warning', () => {
    const portfolio: VirtualPortfolio = {
      startingCapital: 1000000,
      cashBalance: 200000,
      holdingsMarketValue: 800000,
      totalPortfolioValue: 1000000,
      realizedPnl: 0,
      unrealizedPnl: 0,
      totalPnl: 0,
      totalReturnPct: 0,
      holdings: [
        {
          symbol: 'RELIANCE',
          name: 'Reliance',
          quantity: 400,
          avgBuyPrice: 2000,
          currentPrice: 2000,
          latestPriceDate: '2025-09-30',
          investedValue: 800000,
          marketValue: 800000,
          unrealizedPnl: 0,
          unrealizedPnlPct: 0,
          allocationPct: 80,
        },
      ],
    };

    // -10% shock on ALL with 0 investment delta
    const reqNegative: WhatIfRequest = {
      targetSymbol: 'ALL',
      priceChangePct: -10,
      hypotheticalInvestmentDelta: 0,
    };
    const resNegative = runWhatIfSimulation(portfolio, reqNegative);
    assert.equal(resNegative.disclaimer, 'HYPOTHETICAL SIMULATION — NOT A MARKET PREDICTION');
    assert.equal(resNegative.simulatedPortfolioValue, 720000); // 800000 * 0.9
    assert.equal(resNegative.simulatedVirtualCash, 200000);
    assert.equal(resNegative.simulatedTotalEquity, 920000);
    assert.equal(resNegative.absoluteProfitLoss, -80000);
    assert.equal(resNegative.percentageChange, -8.0);
    assert.equal(resNegative.cashWarning, null);

    // +10% shock with hypothetical investment exceeding cash (₹300,000 > ₹200,000 cash)
    const reqExcessCash: WhatIfRequest = {
      targetSymbol: 'RELIANCE',
      priceChangePct: 10,
      hypotheticalInvestmentDelta: 300000,
    };
    const resExcessCash = runWhatIfSimulation(portfolio, reqExcessCash);
    assert.ok(resExcessCash.cashWarning, 'Must return cash warning when delta > available cash');
    assert.equal(resExcessCash.simulatedVirtualCash, -100000); // 200000 - 300000
    // Simulated position value: (800000 + 300000) * 1.1 = 1100000 * 1.1 = 1210000
    assert.equal(resExcessCash.simulatedPortfolioValue, 1210000);
    // Simulated total equity: -100000 + 1210000 = 1110000
    assert.equal(resExcessCash.simulatedTotalEquity, 1110000);
    assert.equal(resExcessCash.absoluteProfitLoss, 110000); // 1110000 - 1000000
  });

  // ==========================================
  // 6. TRADER PERSONALITY: Classification Across Profiles
  // ==========================================
  await t.test('Personality analyzer classifies Overtrader, Disciplined, and Conservative profiles', () => {
    // Test Conservative profile (default high cash, low trades)
    const conservativePersona = DEMO_PERSONAS.find((p) => p.id === 'conservative_beginner')!;
    const repConservative = analyzeTradingPersonality(conservativePersona.portfolio, conservativePersona.trades);
    assert.equal(repConservative.profile, 'Conservative Trader');
    assert.ok(repConservative.educational_disclaimer.includes('educational classification'));

    // Test Overtrader profile (12 trades in 1 day)
    const overtraderPersona = DEMO_PERSONAS.find((p) => p.id === 'active_overtrader')!;
    const repOvertrader = analyzeTradingPersonality(overtraderPersona.portfolio, overtraderPersona.trades);
    assert.equal(repOvertrader.profile, 'Overtrader');
    assert.ok(repOvertrader.metrics.tradesPerActiveDay >= 5);

    // Test Disciplined profile
    const disciplinedPersona = DEMO_PERSONAS.find((p) => p.id === 'disciplined_quant')!;
    const repDisciplined = analyzeTradingPersonality(disciplinedPersona.portfolio, disciplinedPersona.trades);
    assert.equal(repDisciplined.profile, 'Disciplined Trader');
    assert.ok(repDisciplined.metrics.stopLossCoveragePercentage >= 75);
    assert.ok(repDisciplined.metrics.winRate >= 50);
  });

  // ==========================================
  // 7. PREDICTION AUTOPSY: Strict Look-Ahead Prevention
  // ==========================================
  await t.test('Prediction Autopsy evaluates outcomes and strictly prevents look-ahead bias', () => {
    const predictions: AIPredictionRecord[] = [
      {
        prediction_id: 'P1',
        symbol: 'RELIANCE',
        predicted_signal: 'BUY',
        confidence: 0.8,
        prediction_timestamp: '2025-09-10T09:15:00Z',
        price_at_prediction: 1300,
      },
      {
        prediction_id: 'P2',
        symbol: 'TCS',
        predicted_signal: 'SELL',
        confidence: 0.75,
        prediction_timestamp: '2025-09-10T09:15:00Z',
        price_at_prediction: 3000,
      },
      {
        prediction_id: 'P3-FUTURE',
        symbol: 'INFY',
        predicted_signal: 'BUY',
        confidence: 0.9,
        prediction_timestamp: '2025-10-01T09:15:00Z', // No bars exist after this date
        price_at_prediction: 1500,
      },
    ];

    const priceBars: PriceBar[] = [
      // Before prediction (must NOT be used!)
      { symbol: 'RELIANCE', timestamp: '2025-09-09T15:30:00Z', open: 1290, high: 1305, low: 1285, close: 1295 },
      // First bar AFTER prediction (MUST be used!)
      { symbol: 'RELIANCE', timestamp: '2025-09-10T15:30:00Z', open: 1300, high: 1330, low: 1298, close: 1326 },
      // Subsequent bar (must NOT be used for first outcome)
      { symbol: 'RELIANCE', timestamp: '2025-09-11T15:30:00Z', open: 1325, high: 1340, low: 1320, close: 1335 },

      // TCS bars (subsequent close 2940 < 3000 => Correct SELL)
      { symbol: 'TCS', timestamp: '2025-09-10T15:30:00Z', open: 3000, high: 3010, low: 2930, close: 2940 },

      // INFY bar before prediction
      { symbol: 'INFY', timestamp: '2025-09-20T15:30:00Z', open: 1480, high: 1510, low: 1470, close: 1490 },
    ];

    const autopsy = evaluatePredictions(predictions, priceBars);
    assert.equal(autopsy.totalPredictions, 3);
    assert.equal(autopsy.evaluatedPredictionsCount, 2);
    assert.equal(autopsy.missingDataCount, 1);
    assert.equal(autopsy.correctCount, 2);
    assert.equal(autopsy.incorrectCount, 0);
    assert.equal(autopsy.directionalAccuracyPct, 100);

    const p1Eval = autopsy.evaluations.find((e) => e.prediction_id === 'P1')!;
    assert.equal(p1Eval.subsequent_bar_timestamp, '2025-09-10T15:30:00Z');
    assert.equal(p1Eval.subsequent_price, 1326);
    assert.equal(p1Eval.was_correct, true);

    const p3Eval = autopsy.evaluations.find((e) => e.prediction_id === 'P3-FUTURE')!;
    assert.equal(p3Eval.status, 'MISSING_OUTCOME_DATA');
    assert.equal(p3Eval.was_correct, null);
  });

  // ==========================================
  // 8. ADAPTERS & RESILIENCE: Empty Portfolios, Zero Equity, Zero Trades
  // ==========================================
  await t.test('Resilience on empty portfolios, zero equity, and null trades', () => {
    const emptySnap = {
      startingCapital: 1000000,
      cashBalance: 1000000,
      totalPortfolioValue: 1000000,
      holdings: [],
    };
    const vp = portfolioSnapshotToVirtualPortfolio(emptySnap);
    assert.equal(vp.holdings.length, 0);
    assert.equal(vp.cashBalance, 1000000);

    const vt = tradeRecordsToVirtualTrades([]);
    assert.equal(vt.length, 0);

    const mistakes = detectTradingMistakes(vp, vt);
    assert.ok(Array.isArray(mistakes));

    const sim = runWhatIfSimulation(vp, { targetSymbol: 'ALL', priceChangePct: 10 });
    assert.equal(sim.currentPortfolioValue, 0);
    assert.equal(sim.simulatedPortfolioValue, 0);
    assert.equal(sim.absoluteProfitLoss, 0);

    const personality = analyzeTradingPersonality(vp, vt);
    assert.equal(personality.profile, 'Conservative Trader');
    assert.equal(personality.metrics.tradesPerActiveDay, 0);
    assert.equal(personality.metrics.cashReservePercentage, 100);
  });

  // ==========================================
  // 9. AI COACH DETERMINISTIC FALLBACK
  // ==========================================
  await t.test('AI Trading Coach deterministic fallback works reliably', async () => {
    const persona = DEMO_PERSONAS[0];
    const coachRes = await generateCoachResponse({
      portfolio: persona.portfolio,
      mistakes: detectTradingMistakes(persona.portfolio, persona.trades),
      personality: analyzeTradingPersonality(persona.portfolio, persona.trades),
      autopsy: evaluatePredictions(DEMO_PREDICTIONS, DEMO_PRICE_BARS),
      userQuestion: 'Why was an overtrading mistake detected?',
    });

    assert.equal(coachRes.source, 'deterministic_fallback');
    assert.ok(coachRes.answer.includes('Practice Trading Intelligence Audit'));
    assert.ok(coachRes.contextSummary.activeWarningsCount > 0);
    assert.ok(coachRes.recommendedActions.length > 0);
  });
});

test('Practice Intelligence HTTP API Integration & RBAC', async () => {
  const tmpDb = path.join(os.tmpdir(), `bullseye-pi-test-${Date.now()}.db`);
  process.env.BULLSEYE_DB_PATH = tmpDb;

  const app = await createBullseyeApp({ withVite: false });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // 1. Unauthenticated request to /api/practice-intelligence/overview must return 401
    const unauthRes = await fetch(`${baseUrl}/api/practice-intelligence/overview`);
    assert.equal(unauthRes.status, 401, 'Unauthenticated request must be rejected with 401');

    // 2. Login as Practice Trader
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'PRC-TRADE-01', password: 'Trade@2026' }),
    });
    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    const token = loginData.token;

    // 3. Login as Investor (to test RBAC blocking)
    const invLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'INV-DEMO-01', password: 'Investor@2026' }),
    });
    const invToken = (await invLoginRes.json()).token;

    // 4. Investor calling /api/practice-intelligence/overview must be 403 Forbidden
    const rbacRes = await fetch(`${baseUrl}/api/practice-intelligence/overview`, {
      headers: { Authorization: `Bearer ${invToken}` },
    });
    assert.equal(rbacRes.status, 403, 'Investor must be forbidden from Practice Intelligence');

    // 5. Practice Trader calling /api/practice-intelligence/overview
    const overviewRes = await fetch(`${baseUrl}/api/practice-intelligence/overview`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(overviewRes.status, 200);
    const overview = await overviewRes.json();
    assert.ok(overview.portfolio);
    assert.equal(overview.portfolio.startingCapital, 1000000);
    assert.ok(Array.isArray(overview.mistakes));
    assert.ok(overview.personality);
    assert.ok(overview.autopsy);
    assert.ok(overview.baselineWhatIf);
    assert.equal(overview.demoPersonas.length, 4);

    // 6. Test What-If API endpoint
    const whatIfRes = await fetch(`${baseUrl}/api/practice-intelligence/what-if`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ targetSymbol: 'ALL', priceChangePct: 5, hypotheticalInvestmentDelta: 50000 }),
    });
    assert.equal(whatIfRes.status, 200);
    const whatIfData = await whatIfRes.json();
    assert.equal(whatIfData.disclaimer, 'HYPOTHETICAL SIMULATION — NOT A MARKET PREDICTION');
    assert.equal(whatIfData.priceChangePct, 5);

    // 7. Test Personality API endpoint
    const personalityRes = await fetch(`${baseUrl}/api/practice-intelligence/personality`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(personalityRes.status, 200);
    const personalityData = await personalityRes.json();
    assert.ok(personalityData.profile);
    assert.ok(personalityData.educational_disclaimer);

    // 8. Test Prediction Autopsy API endpoint
    const autopsyRes = await fetch(`${baseUrl}/api/practice-intelligence/autopsy`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(autopsyRes.status, 200);
    const autopsyData = await autopsyRes.json();
    assert.ok(autopsyData.totalPredictions > 0);
    assert.ok(autopsyData.evaluations.length > 0);

    // 9. Test AI Coach API endpoint
    const coachRes = await fetch(`${baseUrl}/api/practice-intelligence/coach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: 'How do I protect my portfolio from drawdowns?' }),
    });
    assert.equal(coachRes.status, 200);
    const coachData = await coachRes.json();
    assert.ok(coachData.answer.length > 0);
    assert.ok(coachData.contextSummary);

    // 10. Verify actual Practice Portfolio was NOT modified by What-If or Coach
    const checkPortRes = await fetch(`${baseUrl}/api/practice/portfolio`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const checkPort = await checkPortRes.json();
    assert.equal(checkPort.startingCapital, 1000000);
    assert.equal(checkPort.cashBalance, 1000000);
  } finally {
    server.close();
    closeDb();
    try {
      if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
    } catch {}
  }
});
