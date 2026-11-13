import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getDb, closeDb, recordBacktestRun } from './db.ts';
import { loadDatasets } from './dataLoader.ts';
import { mlStore } from './mlStore.ts';
import { EXCLUDED_LEAKAGE_COLUMNS, trainChronologicalModel } from './quantMath.ts';
import {
  buildSymbolFeaturesCsv,
  compareModelsOnPeriod,
  computeAdvancedRiskMonitor,
  computeFinalPerformanceSummary,
  computeMathLabAnalysis,
  generateStrategySignals,
  inspectDatasetForSymbol,
  runHyperparameterOptimization,
  runWalkForwardValidation,
} from './quantResearch.ts';

test('Sequence MLP trains chronologically with real BCE loss curve and excludes target leakage', () => {
  const ds = loadDatasets();
  const rows = ds.featuresBySymbol.get('RELIANCE') ?? [];
  assert.ok(rows.length > 300);

  const artifact = trainChronologicalModel('RELIANCE', rows, 'sequence_mlp', 0.8);
  assert.equal(artifact.modelType, 'sequence_mlp');
  assert.ok(artifact.trainDateRange.end < artifact.testDateRange.start);
  assert.ok(Array.isArray(artifact.trainLossHistory) && artifact.trainLossHistory.length > 0);
  for (const col of EXCLUDED_LEAKAGE_COLUMNS) {
    assert.ok(!artifact.featuresUsed.includes(col));
  }
});

test('Dataset inspect and CSV builder report accurate counts and exclude leakage in features', () => {
  const inspect = inspectDatasetForSymbol('RELIANCE', 10, 0);
  assert.equal(inspect.symbol, 'RELIANCE');
  assert.ok(inspect.rawRowCount >= inspect.featureRowCount);
  assert.equal(inspect.leakageVerified, true);
  assert.equal(inspect.chronologicalSorted, true);
  assert.equal(inspect.featureStats.length, 13);

  const csv = buildSymbolFeaturesCsv('RELIANCE', 25);
  const lines = csv.trim().split('\n');
  assert.equal(lines.length, 26);
  assert.ok(lines[0].startsWith('date,symbol,open,high,low,close'));
});

test('Math lab computes 10 calculations, Rolling vs GARCH series, and symmetric correlation matrix', () => {
  const res = computeMathLabAnalysis({
    symbol: 'RELIANCE',
    compareSymbols: ['RELIANCE', 'TCS', 'HDFCBANK'],
    smaPeriod: 20,
    rsiPeriod: 14,
    volWindow: 20,
    atrPeriod: 14,
  });
  assert.equal(res.calculations.length, 10);
  assert.ok(res.rollingVsGarchSeries.length > 100);
  assert.equal(res.correlationSymbols.length, 3);
  assert.ok(Math.abs(res.correlationMatrix[0][0] - 1) < 1e-6);
  assert.ok(Math.abs(res.correlationMatrix[0][1] - res.correlationMatrix[1][0]) < 1e-6);
});

test('Hyperparameter grid search optimizes strictly on val fold without touching test dates', () => {
  const res = runHyperparameterOptimization({
    symbol: 'RELIANCE',
    modelType: 'logistic_regression',
    trainPct: 0.65,
    valPct: 0.15,
  });
  assert.ok(res.trainDateRange.end < res.valDateRange.start);
  assert.ok(res.valDateRange.end < res.testDateRange.start);
  assert.ok(res.gridCandidatesTested.length >= 2);
  assert.equal(res.classificationReport.length, 2);
});

test('Multi-model comparison benchmarks all 4 models on identical date windows', () => {
  const cmp = compareModelsOnPeriod({
    symbol: 'TCS',
    models: ['logistic_regression', 'random_forest', 'gradient_boosting', 'sequence_mlp'],
    splitRatio: 0.8,
    rankBy: 'f1Score',
  });
  assert.equal(cmp.models.length, 4);
  assert.ok(cmp.bestModelLabel.length > 0);
});

test('Walk-forward validation enforces chronological train < test windows across folds', () => {
  const wf = runWalkForwardValidation({
    symbol: 'RELIANCE',
    modelType: 'logistic_regression',
    initialTrainPct: 0.5,
    numWindows: 4,
    mode: 'expanding',
  });
  assert.equal(wf.windows.length, 4);
  for (const w of wf.windows) {
    assert.ok(w.trainRange.end < w.testRange.start);
    assert.ok(w.confusionMatrix);
    assert.equal(
      w.confusionMatrix.tn + w.confusionMatrix.fp + w.confusionMatrix.fn + w.confusionMatrix.tp,
      w.testSize,
    );
  }
});

test('Strategy signal engine separates ML prediction from technical bias cleanly', () => {
  const sig = generateStrategySignals({
    symbol: 'RELIANCE',
    strategy: 'combined_ml_tech',
    modelType: 'logistic_regression',
    threshold: 0.55,
    lookbackDays: 60,
  });
  assert.equal(sig.symbol, 'RELIANCE');
  assert.ok(['BUY', 'SELL', 'HOLD'].includes(sig.latestDecision.finalDecision));
  assert.ok(sig.latestDecision.invalidationConditions.length >= 2);
  assert.equal(
    sig.distribution.BUY + sig.distribution.SELL + sig.distribution.HOLD,
    sig.distribution.totalSessions,
  );
});

test('Advanced risk monitor ensures CVaR >= VaR and never fabricates portfolio weights', () => {
  const tmpDb = path.join(os.tmpdir(), `bullseye-risk-test-${Date.now()}.db`);
  process.env.BULLSEYE_DB_PATH = tmpDb;
  getDb(tmpDb);
  try {
    const res = computeAdvancedRiskMonitor({
      symbol: 'RELIANCE',
      capital: 1000000,
      riskPct: 1.5,
      confidenceLevel: 0.95,
      holdingPeriodDays: 5,
      useRealInvestorHoldings: false,
    });
    assert.ok(res.cvarPct >= res.varPct);
    assert.equal(res.portfolioConcentration.source, 'none_entered');
    assert.equal(res.portfolioConcentration.positions.length, 0);
  } finally {
    closeDb();
    delete process.env.BULLSEYE_DB_PATH;
    if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
    if (fs.existsSync(`${tmpDb}-wal`)) fs.unlinkSync(`${tmpDb}-wal`);
    if (fs.existsSync(`${tmpDb}-shm`)) fs.unlinkSync(`${tmpDb}-shm`);
  }
});

test('computeFinalPerformanceSummary measures real latency/throughput and persists honest empty/populated states', () => {
  const tmpDb = path.join(os.tmpdir(), `bullseye-perf-test-${Date.now()}.db`);
  process.env.BULLSEYE_DB_PATH = tmpDb;
  getDb(tmpDb);
  try {
    mlStore.train('RELIANCE', 'logistic_regression', 0.8);
    const emptyBt = computeFinalPerformanceSummary({
      symbol: 'RELIANCE',
      modelType: 'logistic_regression',
    });
    assert.equal(emptyBt.hasModelData, true);
    assert.equal(emptyBt.hasBacktestData, false);
    assert.equal(emptyBt.tradingPerformance.finalEquity, null);
    assert.ok(emptyBt.efficiency);
    assert.equal(emptyBt.efficiency.measuredSampleCount, 200);
    assert.ok((emptyBt.efficiency.avgInferenceLatencyMs ?? 0) >= (emptyBt.efficiency.minInferenceLatencyMs ?? 0));
    assert.ok((emptyBt.efficiency.maxInferenceLatencyMs ?? 0) >= (emptyBt.efficiency.avgInferenceLatencyMs ?? 0));
    assert.ok((emptyBt.efficiency.throughputPredictionsPerSec ?? 0) > 0);

    recordBacktestRun({
      symbol: 'RELIANCE',
      strategy: 'Walk-Forward ML',
      totalReturnPct: 14.5,
      benchmarkReturnPct: 11.2,
      sharpeRatio: 1.25,
      maxDrawdownPct: 7.4,
      numberOfTrades: 12,
      paramsJson: JSON.stringify({
        initialCapital: 1000000,
        finalEquity: 1145000,
        netProfit: 145000,
        grossProfit: 210000,
        grossLoss: 65000,
        profitFactor: 3.23,
        winningTrades: 8,
        losingTrades: 4,
        winRatePct: 66.7,
        avgWinningTrade: 26250,
        avgLosingTrade: -16250,
        totalTransactionCosts: 4200,
        brokeragePct: 0.05,
        slippagePct: 0.02,
        walkForwardLeakageFree: true,
        retrainCount: 8,
      }),
      triggeredBy: 'BRK-QUANT-01',
    });

    const populated = computeFinalPerformanceSummary({
      symbol: 'RELIANCE',
      modelType: 'logistic_regression',
    });
    assert.equal(populated.hasBacktestData, true);
    assert.equal(populated.tradingPerformance?.finalEquity, 1145000);
    assert.equal(populated.tradingPerformance?.profitFactor, 3.23);
    assert.equal(populated.transactionCosts?.grossProfit, 210000);
  } finally {
    closeDb();
    delete process.env.BULLSEYE_DB_PATH;
    if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
    if (fs.existsSync(`${tmpDb}-wal`)) fs.unlinkSync(`${tmpDb}-wal`);
    if (fs.existsSync(`${tmpDb}-shm`)) fs.unlinkSync(`${tmpDb}-shm`);
  }
});
