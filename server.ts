import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import {
  authenticateCredentials,
  extractToken,
  registerAccount,
  requireAuth,
  requireRole,
  revokeSession,
  type AuthenticatedRequest,
} from './server/auth.ts';
import {
  buildRuleExplanations,
  filterRowsByRange,
  getLastDataError,
  loadDatasets,
} from './server/dataLoader.ts';
import {
  getDb,
  listBacktestRuns,
  listTrainingRuns,
  recordBacktestRun,
  recordTrainingRun,
} from './server/db.ts';
import { generateBullseyeResponse } from './server/geminiService.ts';
import {
  getInvestorSnapshot,
  removeInvestorHolding,
  removeWatchlistSymbol,
  upsertInvestorHolding,
  upsertWatchlistSymbol,
} from './server/investorStore.ts';
import { mlStore } from './server/mlStore.ts';
import { calculateRiskMetrics, runChronologicalBacktest } from './server/quantMath.ts';
import {
  cancelPendingOrder,
  executeSimulatedOrder,
  getPortfolioSnapshot,
  resetPracticePortfolio,
} from './server/tradingStore.ts';
import type {
  ModelType,
  StockSummary,
  TimeRangeKey,
  TrainedModelArtifact,
  UserRole,
} from './server/types.ts';

function sanitizeArtifactForClient(artifact: TrainedModelArtifact) {
  return {
    symbol: artifact.symbol,
    modelType: artifact.modelType,
    modelLabel: artifact.modelLabel,
    trainedAt: artifact.trainedAt,
    trainingDurationMs: artifact.trainingDurationMs,
    trainSize: artifact.trainSize,
    testSize: artifact.testSize,
    splitRatio: artifact.splitRatio,
    trainDateRange: artifact.trainDateRange,
    testDateRange: artifact.testDateRange,
    featuresUsed: artifact.featuresUsed,
    excludedLeakageColumns: artifact.excludedLeakageColumns,
    targetVariable: artifact.targetVariable,
    evaluation: artifact.evaluation,
    featureImportance: artifact.featureImportance,
  };
}

export async function createBullseyeApp(options?: { withVite?: boolean }) {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Initialize SQLite database, load real CSV datasets, and train baseline models for 4 showcase stocks
  getDb();
  try {
    loadDatasets();
    mlStore.bootstrapPrimaryModels();
  } catch (err) {
    mlStore.recordError(err instanceof Error ? err.message : String(err));
  }

  // ==================== PUBLIC HEALTH & MARKET SNAPSHOT ====================
  app.get('/api/health', (_req, res) => {
    try {
      const ds = loadDatasets();
      const db = getDb();
      const userCount = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt;
      const geminiConfigured = Boolean(
        process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== 'MY_GEMINI_API_KEY',
      );
      res.json({
        ok: true,
        datasetLoaded: true,
        databaseInitialized: true,
        registeredUsers: userCount,
        combinedRows: ds.validation.combinedTotalRows,
        featureRows: ds.validation.featuresTotalRows,
        stocksCount: ds.catalog.length,
        dateRange: ds.validation.combinedDateRange,
        geminiConfigured,
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        datasetLoaded: false,
        error: err instanceof Error ? err.message : 'Dataset failed to load',
      });
    }
  });

  app.get('/api/stocks', (req, res) => {
    try {
      const ds = loadDatasets();
      const threshold = Number(req.query.threshold ?? 0.75);
      const summaries: StockSummary[] = [];

      for (const meta of ds.catalog) {
        const ohlcv = ds.combinedBySymbol.get(meta.symbol) ?? [];
        const feats = ds.featuresBySymbol.get(meta.symbol) ?? [];
        if (ohlcv.length === 0 || feats.length === 0) continue;

        const latestOhlcv = ohlcv[ohlcv.length - 1];
        const latestFeat = feats[feats.length - 1];
        const pred = mlStore.predictLatest(meta.symbol, undefined, threshold);
        const risk = calculateRiskMetrics({
          symbol: meta.symbol,
          entryPrice: latestOhlcv.close,
          atr14: latestFeat.atr_14,
        });

        const prevOhlcv = ohlcv.length >= 2 ? ohlcv[ohlcv.length - 2] : null;
        const latestDailyReturn =
          prevOhlcv && prevOhlcv.close > 0
            ? (latestOhlcv.close - prevOhlcv.close) / prevOhlcv.close
            : latestFeat.daily_return;

        summaries.push({
          symbol: meta.symbol,
          name: meta.name,
          sector: meta.sector,
          featured: meta.featured,
          latestDate: latestOhlcv.date,
          firstDate: ohlcv[0].date,
          recordCount: ohlcv.length,
          featureRecordCount: feats.length,
          latestOpen: latestOhlcv.open,
          latestHigh: latestOhlcv.high,
          latestLow: latestOhlcv.low,
          latestClose: latestOhlcv.close,
          latestVolume: latestOhlcv.volume,
          dailyReturn: latestDailyReturn,
          rsi14: latestFeat.rsi_14,
          sma20: latestFeat.sma_20,
          sma50: latestFeat.sma_50,
          ema12: latestFeat.ema_12,
          ema26: latestFeat.ema_26,
          macd: latestFeat.macd,
          macdSignal: latestFeat.macd_signal,
          bbUpper: latestFeat.bb_upper,
          bbLower: latestFeat.bb_lower,
          atr14: latestFeat.atr_14,
          volumeSma20: latestFeat.volume_sma_20,
          volumeRatio: latestFeat.volume_ratio,
          riskCategory: risk.volatilityCategory,
          modelTrained: pred.modelTrained,
          signal: pred.signal,
          buyProbability: pred.buyProbability,
          sellProbability: pred.sellProbability,
          modelName: pred.modelName,
        });
      }

      res.json({
        latestDatasetDate: ds.validation.combinedDateRange.end,
        stocks: summaries,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list stocks' });
    }
  });

  // ==================== AUTHENTICATION & RBAC ====================
  app.post('/api/auth/login', (req, res) => {
    const identifier = String(req.body?.userId ?? req.body?.email ?? '').trim();
    const password = String(req.body?.password ?? '');
    const expectedRole = req.body?.expectedRole as UserRole | undefined;

    const result = authenticateCredentials({ identifier, password, expectedRole });
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.setHeader(
      'Set-Cookie',
      `bullseye_token=${encodeURIComponent(result.token)}; Path=/; HttpOnly; SameSite=Lax`,
    );
    res.json({
      authenticated: true,
      token: result.token,
      expiresAt: result.expiresAt,
      user: result.user,
    });
  });

  app.post('/api/auth/register', (req, res) => {
    const userCode = String(req.body?.userId ?? '').trim();
    const name = String(req.body?.name ?? '').trim();
    const email = String(req.body?.email ?? '').trim();
    const password = String(req.body?.password ?? '');
    const role = req.body?.role as UserRole;

    const result = registerAccount({ userCode, name, email, password, role });
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.status(201).json({
      authenticated: true,
      token: result.token,
      expiresAt: result.expiresAt,
      user: result.user,
    });
  });

  app.post('/api/auth/logout', (req: AuthenticatedRequest, res) => {
    const token = extractToken(req);
    const revoked = revokeSession(token);
    res.setHeader('Set-Cookie', 'bullseye_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
    res.json({ loggedOut: true, revoked });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ authenticated: true, user: req.authUser });
  });

  // ==================== PROTECTED STOCK, INDICATORS, PREDICTION & RISK ====================
  app.get(
    '/api/stocks/:symbol',
    requireRole(['Investor', 'Broker / Quant', 'Practice Trader']),
    (req, res) => {
      try {
        const symbol = req.params.symbol.trim().toUpperCase();
        const range = ((req.query.range as string) || '6M').toUpperCase() as TimeRangeKey;
        const threshold = Number(req.query.threshold ?? 0.75);
        const modelType = req.query.modelType as ModelType | undefined;

        const ds = loadDatasets();
        const meta = ds.catalog.find((c) => c.symbol === symbol);
        const ohlcv = ds.combinedBySymbol.get(symbol);
        const feats = ds.featuresBySymbol.get(symbol);

        if (!meta || !ohlcv || ohlcv.length === 0 || !feats || feats.length === 0) {
          res.status(404).json({
            error: `Historical data unavailable for symbol "${symbol}".`,
            available: false,
          });
          return;
        }

        const validRanges: TimeRangeKey[] = ['1M', '3M', '6M', '1Y', 'ALL'];
        const chosenRange: TimeRangeKey = validRanges.includes(range) ? range : '6M';

        const filteredOhlcv = filterRowsByRange(ohlcv, chosenRange);
        const filteredFeatures = filterRowsByRange(feats, chosenRange);
        const latestOhlcv = ohlcv[ohlcv.length - 1];
        const prevOhlcv = ohlcv.length >= 2 ? ohlcv[ohlcv.length - 2] : null;
        const latestFeat = feats[feats.length - 1];

        const latestDailyReturn =
          prevOhlcv && prevOhlcv.close > 0
            ? (latestOhlcv.close - prevOhlcv.close) / prevOhlcv.close
            : latestFeat.daily_return;

        const prediction = mlStore.predictLatest(symbol, modelType, threshold);
        const risk = calculateRiskMetrics({
          symbol,
          entryPrice: latestOhlcv.close,
          atr14: latestFeat.atr_14,
        });
        const garch = mlStore.getGarch(symbol);
        const trainedModels = mlStore.listTrainedModelsForSymbol(symbol).map(sanitizeArtifactForClient);

        const featMap = new Map(filteredFeatures.map((f) => [f.date, f]));
        const series = filteredOhlcv.map((bar) => {
          const f = featMap.get(bar.date);
          return {
            date: bar.date,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume,
            daily_return: f?.daily_return ?? null,
            sma_20: f?.sma_20 ?? null,
            sma_50: f?.sma_50 ?? null,
            ema_12: f?.ema_12 ?? null,
            ema_26: f?.ema_26 ?? null,
            rsi_14: f?.rsi_14 ?? null,
            macd: f?.macd ?? null,
            macd_signal: f?.macd_signal ?? null,
            bb_upper: f?.bb_upper ?? null,
            bb_lower: f?.bb_lower ?? null,
            atr_14: f?.atr_14 ?? null,
            volume_sma_20: f?.volume_sma_20 ?? null,
            volume_ratio: f?.volume_ratio ?? null,
          };
        });

        res.json({
          available: true,
          meta,
          range: chosenRange,
          latestDate: latestOhlcv.date,
          featureLatestDate: latestFeat.date,
          latestOhlcv,
          latestDailyReturn,
          latestFeatures: latestFeat,
          ruleExplanations: buildRuleExplanations(latestFeat),
          prediction,
          trainedModels,
          risk,
          garch,
          series,
        });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch stock details' });
      }
    },
  );

  app.get(
    '/api/stocks/:symbol/indicators',
    requireRole(['Investor', 'Broker / Quant']),
    (req, res) => {
      const symbol = req.params.symbol.trim().toUpperCase();
      const ds = loadDatasets();
      const feats = ds.featuresBySymbol.get(symbol);
      if (!feats || feats.length === 0) {
        res.status(404).json({ error: `Technical indicators unavailable for symbol "${symbol}".` });
        return;
      }
      const latest = feats[feats.length - 1];
      res.json({
        symbol,
        latestDate: latest.date,
        recordCount: feats.length,
        indicators: {
          daily_return: latest.daily_return,
          sma_20: latest.sma_20,
          sma_50: latest.sma_50,
          ema_12: latest.ema_12,
          ema_26: latest.ema_26,
          rsi_14: latest.rsi_14,
          macd: latest.macd,
          macd_signal: latest.macd_signal,
          bb_upper: latest.bb_upper,
          bb_lower: latest.bb_lower,
          atr_14: latest.atr_14,
          volume_sma_20: latest.volume_sma_20,
          volume_ratio: latest.volume_ratio,
        },
        ruleExplanations: buildRuleExplanations(latest),
      });
    },
  );

  app.get(
    '/api/ml/predict/:symbol',
    requireRole(['Investor', 'Broker / Quant']),
    (req, res) => {
      const symbol = req.params.symbol.trim().toUpperCase();
      const ds = loadDatasets();
      if (!ds.featuresBySymbol.has(symbol)) {
        res.status(404).json({ error: `Symbol "${symbol}" not found in NIFTY 50 dataset.` });
        return;
      }
      const modelType = req.query.modelType as ModelType | undefined;
      const threshold = Number(req.query.threshold ?? 0.75);
      const result = mlStore.predictLatest(symbol, modelType, threshold);
      res.json(result);
    },
  );

  app.get(
    '/api/quant/garch/:symbol',
    requireRole(['Investor', 'Broker / Quant']),
    (req, res) => {
      const symbol = req.params.symbol.trim().toUpperCase();
      const ds = loadDatasets();
      if (!ds.featuresBySymbol.has(symbol)) {
        res.status(404).json({ error: `Symbol "${symbol}" not found in NIFTY 50 dataset.` });
        return;
      }
      res.json(mlStore.getGarch(symbol));
    },
  );

  app.post(
    '/api/quant/risk',
    requireRole(['Investor', 'Broker / Quant']),
    (req, res) => {
      try {
        const symbol = String(req.body?.symbol ?? 'RELIANCE').trim().toUpperCase();
        const ds = loadDatasets();
        const feats = ds.featuresBySymbol.get(symbol);
        const ohlcv = ds.combinedBySymbol.get(symbol);
        if (!feats || !ohlcv || feats.length === 0 || ohlcv.length === 0) {
          res.status(404).json({ error: `No data for ${symbol}` });
          return;
        }
        const latestClose = ohlcv[ohlcv.length - 1].close;
        const latestAtr = feats[feats.length - 1].atr_14;

        const risk = calculateRiskMetrics({
          symbol,
          entryPrice: Number(req.body?.entryPrice ?? latestClose),
          atr14: Number(req.body?.atr14 ?? latestAtr),
          atrMultiplier: Number(req.body?.atrMultiplier ?? 1.5),
          availableCapital: Number(req.body?.availableCapital ?? 100000),
          riskPercentage: Number(req.body?.riskPercentage ?? 1.5),
          riskRewardMultiple: Number(req.body?.riskRewardMultiple ?? 2),
        });
        res.json(risk);
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Risk calculation failed' });
      }
    },
  );

  // ==================== INVESTOR-ONLY PORTFOLIO & WATCHLIST ====================
  app.get(
    '/api/investor/portfolio',
    requireRole(['Investor']),
    (req: AuthenticatedRequest, res) => {
      try {
        res.json(getInvestorSnapshot(req.authUser!.id));
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load investor portfolio' });
      }
    },
  );

  app.post(
    '/api/investor/watchlist',
    requireRole(['Investor']),
    (req: AuthenticatedRequest, res) => {
      const symbol = String(req.body?.symbol ?? '');
      const note = req.body?.note !== undefined ? String(req.body.note) : '';
      const result = upsertWatchlistSymbol({
        userId: req.authUser!.id,
        symbol,
        note,
      });
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json(result.snapshot);
    },
  );

  app.delete(
    '/api/investor/watchlist/:symbol',
    requireRole(['Investor']),
    (req: AuthenticatedRequest, res) => {
      res.json(removeWatchlistSymbol(req.authUser!.id, req.params.symbol));
    },
  );

  app.post(
    '/api/investor/holdings',
    requireRole(['Investor']),
    (req: AuthenticatedRequest, res) => {
      const result = upsertInvestorHolding({
        userId: req.authUser!.id,
        symbol: String(req.body?.symbol ?? ''),
        quantity: Number(req.body?.quantity ?? 0),
        avgBuyPrice: Number(req.body?.avgBuyPrice ?? 0),
        targetPrice: req.body?.targetPrice !== undefined ? Number(req.body.targetPrice) : null,
        stopLoss: req.body?.stopLoss !== undefined ? Number(req.body.stopLoss) : null,
        notes: req.body?.notes !== undefined ? String(req.body.notes) : '',
      });
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json(result.snapshot);
    },
  );

  app.delete(
    '/api/investor/holdings/:symbol',
    requireRole(['Investor']),
    (req: AuthenticatedRequest, res) => {
      res.json(removeInvestorHolding(req.authUser!.id, req.params.symbol));
    },
  );

  // ==================== BROKER / QUANT-ONLY PIPELINE, ML, BACKTEST, MONITOR ====================
  app.get('/api/dataset/summary', requireRole(['Broker / Quant']), (_req, res) => {
    try {
      const ds = loadDatasets();
      res.json({
        validation: ds.validation,
        pipelineStages: ds.pipelineStages,
        catalog: ds.catalog,
        loadDurationMs: ds.loadDurationMs,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load dataset summary' });
    }
  });

  app.post('/api/dataset/reload', requireRole(['Broker / Quant']), (_req, res) => {
    try {
      const ds = loadDatasets(true);
      res.json({
        reloaded: true,
        validation: ds.validation,
        pipelineStages: ds.pipelineStages,
        loadDurationMs: ds.loadDurationMs,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to reload dataset';
      mlStore.recordError(msg);
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/ml/train', requireRole(['Broker / Quant']), (req: AuthenticatedRequest, res) => {
    try {
      const symbol = String(req.body?.symbol ?? 'RELIANCE').trim().toUpperCase();
      const modelType = (req.body?.modelType ?? 'logistic_regression') as ModelType;
      const splitRatio = Number(req.body?.splitRatio ?? 0.8);
      const threshold = Number(req.body?.threshold ?? 0.75);

      const allowed: ModelType[] = ['logistic_regression', 'random_forest', 'gradient_boosting'];
      if (!allowed.includes(modelType)) {
        res.status(400).json({ error: `Unsupported model type "${modelType}".` });
        return;
      }

      const artifact = mlStore.train(symbol, modelType, splitRatio);
      const prediction = mlStore.predictLatest(symbol, modelType, threshold);
      const allModels = mlStore.listTrainedModelsForSymbol(symbol).map(sanitizeArtifactForClient);

      recordTrainingRun({
        symbol,
        modelType,
        accuracy: artifact.evaluation.accuracy,
        precisionScore: artifact.evaluation.precision,
        recallScore: artifact.evaluation.recall,
        f1Score: artifact.evaluation.f1Score,
        trainSize: artifact.trainSize,
        testSize: artifact.testSize,
        durationMs: artifact.trainingDurationMs,
        triggeredBy: req.authUser?.userCode ?? 'SYSTEM',
      });

      res.json({
        trained: true,
        artifact: sanitizeArtifactForClient(artifact),
        prediction,
        trainedModels: allModels,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Model training failed';
      mlStore.recordError(msg);
      res.status(400).json({ error: msg });
    }
  });

  app.get('/api/ml/models/:symbol', requireRole(['Broker / Quant']), (req, res) => {
    const symbol = req.params.symbol.trim().toUpperCase();
    const models = mlStore.listTrainedModelsForSymbol(symbol).map(sanitizeArtifactForClient);
    res.json({ symbol, models });
  });

  app.post(
    '/api/quant/backtest',
    requireRole(['Broker / Quant']),
    (req: AuthenticatedRequest, res) => {
      try {
        const symbol = String(req.body?.symbol ?? 'RELIANCE').trim().toUpperCase();
        const strategy = (req.body?.strategy ?? 'ml_model') as
          | 'ml_model'
          | 'sma_crossover'
          | 'rsi_mean_reversion';
        const modelType = req.body?.modelType as ModelType | undefined;
        const startDate = req.body?.startDate ? String(req.body.startDate) : undefined;
        const endDate = req.body?.endDate ? String(req.body.endDate) : undefined;
        const initialCapital = Number(req.body?.initialCapital ?? 1000000);
        const brokeragePct = Number(req.body?.brokeragePct ?? 0.05);
        const slippagePct = Number(req.body?.slippagePct ?? 0.02);
        const buyThreshold = Number(req.body?.buyThreshold ?? 0.55);

        const ds = loadDatasets();
        let rows = ds.featuresBySymbol.get(symbol) ?? [];
        if (startDate) rows = rows.filter((r) => r.date >= startDate);
        if (endDate) rows = rows.filter((r) => r.date <= endDate);

        if (rows.length < 30) {
          res.status(400).json({
            error: `Selected date window for ${symbol} has only ${rows.length} rows (minimum 30 required).`,
          });
          return;
        }

        let artifact = mlStore.getArtifact(symbol, modelType);
        if (strategy === 'ml_model' && !artifact) {
          artifact = mlStore.train(symbol, modelType ?? 'logistic_regression', 0.8);
        }

        const result = runChronologicalBacktest({
          symbol,
          rows,
          strategy,
          artifact: artifact ?? undefined,
          initialCapital,
          brokeragePct,
          slippagePct,
          buyThreshold,
        });

        mlStore.lastBacktestTimestamp = new Date().toISOString();
        mlStore.lastBacktestStatus = `Completed (${symbol} · ${result.numberOfTrades} trades · Sharpe ${result.sharpeRatio.toFixed(2)})`;

        recordBacktestRun({
          symbol,
          strategy: result.strategyLabel,
          totalReturnPct: result.totalReturnPct,
          benchmarkReturnPct: result.benchmarkReturnPct,
          sharpeRatio: result.sharpeRatio,
          maxDrawdownPct: result.maxDrawdownPct,
          numberOfTrades: result.numberOfTrades,
          triggeredBy: req.authUser?.userCode ?? 'SYSTEM',
        });

        res.json(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Backtest failed';
        mlStore.lastBacktestStatus = `Error: ${msg}`;
        mlStore.recordError(msg);
        res.status(400).json({ error: msg });
      }
    },
  );

  app.get('/api/quant/monitoring', requireRole(['Broker / Quant']), (_req, res) => {
    try {
      const ds = loadDatasets();
      const trainedEntries: Array<{ symbol: string; modelType: ModelType; trainedAt: string }> = [];
      for (const meta of ds.catalog) {
        for (const art of mlStore.listTrainedModelsForSymbol(meta.symbol)) {
          trainedEntries.push({
            symbol: art.symbol,
            modelType: art.modelType,
            trainedAt: art.trainedAt,
          });
        }
      }

      res.json({
        datasetStatus: 'Loaded & Validated',
        datasetLoadedAt: ds.validation.loadedAt,
        datasetLoadDurationMs: ds.loadDurationMs,
        pipelineStatus: 'Operational (9 stages ready)',
        trainedModelsCount: trainedEntries.length,
        trainedModels: trainedEntries,
        lastTrainingTimestamp: mlStore.lastTrainingTimestamp,
        lastPredictionTimestamp: mlStore.lastPredictionTimestamp,
        lastInferenceLatencyMs: mlStore.lastInferenceLatencyMs,
        lastBacktestTimestamp: mlStore.lastBacktestTimestamp,
        lastBacktestStatus: mlStore.lastBacktestStatus,
        lastDataError: getLastDataError(),
        recentErrors: mlStore.recentErrors,
        trainingHistory: listTrainingRuns(15),
        backtestHistory: listBacktestRuns(15),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Monitoring unavailable' });
    }
  });

  // ==================== PRACTICE TRADER-ONLY SIMULATOR ====================
  app.get(
    '/api/practice/portfolio',
    requireRole(['Practice Trader']),
    (req: AuthenticatedRequest, res) => {
      try {
        res.json(getPortfolioSnapshot(req.authUser!.id));
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load portfolio' });
      }
    },
  );

  app.post(
    '/api/practice/order',
    requireRole(['Practice Trader']),
    (req: AuthenticatedRequest, res) => {
      try {
        const result = executeSimulatedOrder({
          userId: req.authUser!.id,
          symbol: String(req.body?.symbol ?? ''),
          side: req.body?.side === 'SELL' ? 'SELL' : 'BUY',
          orderType: req.body?.orderType === 'LIMIT' ? 'LIMIT' : 'MARKET',
          quantity: Number(req.body?.quantity ?? 0),
          limitPrice: req.body?.limitPrice !== undefined ? Number(req.body.limitPrice) : undefined,
        });

        if (!result.ok) {
          res.status(400).json({ error: result.error });
          return;
        }
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Order execution error' });
      }
    },
  );

  app.post(
    '/api/practice/order/:id/cancel',
    requireRole(['Practice Trader']),
    (req: AuthenticatedRequest, res) => {
      res.json({ portfolio: cancelPendingOrder(req.params.id, req.authUser!.id) });
    },
  );

  app.post(
    '/api/practice/reset',
    requireRole(['Practice Trader']),
    (req: AuthenticatedRequest, res) => {
      res.json({ portfolio: resetPracticePortfolio(req.authUser!.id) });
    },
  );

  // ==================== GEMINI AI ASSISTANT ====================
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const message = String(req.body?.message ?? '').trim();
      if (!message) {
        res.status(400).json({ error: 'Message cannot be empty.' });
        return;
      }
      const result = await generateBullseyeResponse({
        message,
        history: Array.isArray(req.body?.history) ? req.body.history : [],
        language: req.body?.language === 'hi' || req.body?.language === 'te' ? req.body.language : 'en',
        context: typeof req.body?.context === 'object' ? req.body.context : undefined,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'AI assistant error' });
    }
  });

  if (options?.withVite !== false) {
    const isProd = process.env.NODE_ENV === 'production';
    const distDir = path.resolve(process.cwd(), 'dist');

    if (isProd && fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    } else {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    }
  }

  return app;
}

async function startServer() {
  const app = await createBullseyeApp({ withVite: true });
  const PORT = Number(process.env.PORT ?? 3000);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BULLSEYE AI server listening on http://localhost:${PORT}`);
  });
}

const isEntryPoint =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isEntryPoint) {
  startServer();
}
