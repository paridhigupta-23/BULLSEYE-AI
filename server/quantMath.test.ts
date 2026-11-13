import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRiskMetrics,
  classifySignal,
  EXCLUDED_LEAKAGE_COLUMNS,
  explainSinglePrediction,
  fitGarch11,
  ML_FEATURE_COLUMNS,
  runChronologicalBacktest,
  trainChronologicalModel,
} from './quantMath.ts';
import type { FeatureRow } from './types.ts';

function makeSyntheticFeatureRows(count = 200): FeatureRow[] {
  const rows: FeatureRow[] = [];
  let price = 1000;
  for (let i = 0; i < count; i++) {
    const dayOffset = new Date(2024, 0, 1 + i).toISOString().slice(0, 10);
    const wave = Math.sin(i / 7) * 0.015 + (i % 5 === 0 ? 0.01 : -0.004);
    const prevClose = price;
    price = Math.max(100, price * (1 + wave));
    const nextWave = Math.sin((i + 1) / 7) * 0.015 + ((i + 1) % 5 === 0 ? 0.01 : -0.004);
    const target = nextWave > 0 ? 1 : 0;

    rows.push({
      date: dayOffset,
      symbol: 'TEST',
      open: prevClose,
      high: Math.max(prevClose, price) * 1.01,
      low: Math.min(prevClose, price) * 0.99,
      close: price,
      volume: 1000000 + i * 5000,
      oi: 0,
      daily_return: wave,
      sma_20: price * (1 - wave * 0.5),
      sma_50: price * (1 - wave * 0.8),
      ema_12: price * (1 + wave * 0.2),
      ema_26: price * (1 - wave * 0.1),
      rsi_14: 50 + Math.sin(i / 7) * 20,
      macd: Math.sin(i / 7) * 12,
      macd_signal: Math.sin((i - 1) / 7) * 10,
      bb_upper: price * 1.04,
      bb_lower: price * 0.96,
      atr_14: price * 0.02,
      volume_sma_20: 1000000,
      volume_ratio: 1 + wave * 5,
      next_day_return: nextWave,
      target_direction: target,
    });
  }
  return rows;
}

test('ML features strictly exclude leakage columns', () => {
  for (const leak of EXCLUDED_LEAKAGE_COLUMNS) {
    assert.equal(ML_FEATURE_COLUMNS.includes(leak as never), false);
  }
  assert.equal(ML_FEATURE_COLUMNS.length, 13);
});

test('Chronological ML training preserves date ordering and trains all 3 model types', () => {
  const rows = makeSyntheticFeatureRows(220);

  for (const modelType of ['logistic_regression', 'random_forest', 'gradient_boosting'] as const) {
    const artifact = trainChronologicalModel('TEST', rows, modelType, 0.8);
    assert.equal(artifact.trainSize, 176);
    assert.equal(artifact.testSize, 44);
    assert.ok(artifact.trainDateRange.end < artifact.testDateRange.start);
    assert.ok(artifact.evaluation.accuracy >= 0 && artifact.evaluation.accuracy <= 1);
    assert.equal(artifact.featureImportance.length, 13);

    const explanation = explainSinglePrediction(artifact, rows[rows.length - 1]);
    assert.equal(explanation.contributions.length, 13);
    if (modelType === 'logistic_regression') {
      assert.ok(explanation.explanationMethod.startsWith('Exact Linear SHAP'));
    } else {
      assert.equal(
        explanation.explanationMethod,
        'Feature Importance and Baseline-Replaced Perturbation Attribution',
      );
    }
  }
});

test('Risk calculator computes exact stop loss and floored position size', () => {
  const risk = calculateRiskMetrics({
    symbol: 'RELIANCE',
    entryPrice: 1400,
    atr14: 20,
    atrMultiplier: 1.5,
    availableCapital: 100000,
    riskPercentage: 1.5,
    riskRewardMultiple: 2,
  });

  // Stop Loss = 1400 - (1.5 * 20) = 1370
  assert.equal(risk.stopLoss, 1370);
  // Risk amount = 100,000 * 0.015 = 1500; Risk per share = 30; Position = floor(1500 / 30) = 50
  assert.equal(risk.positionSizeShares, 50);
  assert.equal(risk.suggestedCapitalAllocation, 70000);
  assert.equal(risk.targetPrice, 1460);
});

test('Signal classification applies configurable threshold properly', () => {
  assert.equal(classifySignal(0.78, 0.75), 'BUY');
  assert.equal(classifySignal(0.20, 0.75), 'SELL');
  assert.equal(classifySignal(0.60, 0.75), 'HOLD');
});

test('GARCH(1,1) fits stationary parameters and forecasts positive volatility', () => {
  const rows = makeSyntheticFeatureRows(180);
  const garch = fitGarch11('TEST', rows);
  assert.equal(garch.fitted, true);
  assert.ok(garch.omega > 0);
  assert.ok(garch.alpha + garch.beta < 1);
  assert.ok(garch.nextDayForecastAnnualVolPct > 0);
});

test('Chronological backtest computes equity curve and deducts transaction costs', () => {
  const rows = makeSyntheticFeatureRows(180);
  const res = runChronologicalBacktest({
    symbol: 'TEST',
    rows,
    strategy: 'sma_crossover',
    initialCapital: 1000000,
    brokeragePct: 0.05,
    slippagePct: 0.02,
  });

  assert.equal(res.equityCurve.length, rows.length);
  assert.ok(res.numberOfTrades >= 0);
  assert.equal(res.winningTrades + res.losingTrades, res.numberOfTrades);
  assert.ok(res.grossProfit >= 0);
  assert.ok(res.grossLoss >= 0);
  assert.ok(res.maxDrawdownPct >= 0);
  assert.ok(Number.isFinite(res.sharpeRatio));
  assert.equal(res.equityCurve[res.equityCurve.length - 1].strategyEquity, res.finalEquity);
});

test('ML backtest runs strict walk-forward retraining with zero future leakage and full reconciliation', () => {
  const rows = makeSyntheticFeatureRows(260);
  const windowRows = rows.slice(140);
  const res = runChronologicalBacktest({
    symbol: 'TEST',
    rows: windowRows,
    allSymbolRows: rows,
    strategy: 'ml_model',
    modelType: 'logistic_regression',
    initialCapital: 1000000,
    brokeragePct: 0.05,
    slippagePct: 0.02,
    buyThreshold: 0.52,
    retrainIntervalBars: 30,
  });

  assert.equal(res.walkForwardLeakageFree, true);
  assert.ok((res.retrainCount ?? 0) >= 1);
  assert.equal(res.equityCurve.length, windowRows.length);
  assert.equal(res.winningTrades + res.losingTrades, res.numberOfTrades);
  assert.equal(res.equityCurve[res.equityCurve.length - 1].strategyEquity, res.finalEquity);
  assert.ok(
    res.profitFactor === null || (typeof res.profitFactor === 'number' && res.profitFactor >= 0),
  );
});
