import { Router } from 'express';
import { requireRole, type AuthenticatedRequest } from '../auth.ts';
import {
  askAiCoach,
  computePracticeIntelligenceOverview,
  getAuditablePredictionsAndBars,
  getUserVirtualTradingData,
} from '../services/practiceIntelligenceService.ts';
import {
  analyzeTradingPersonality,
  DEMO_PERSONAS,
  detectTradingMistakes,
  evaluatePredictions,
  runWhatIfSimulation,
  type WhatIfRequest,
} from '../../src/practice-intelligence/index.ts';

export const practiceIntelligenceRouter = Router();

// Enforce Practice Trader role or authorized access
practiceIntelligenceRouter.use(requireRole(['Practice Trader']));

/**
 * GET /api/practice-intelligence/overview
 * Comprehensive dashboard overview: portfolio, warnings, personality, autopsy, baseline simulation, and demo personas
 */
practiceIntelligenceRouter.get('/overview', (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.authUser!.id;
    const overview = computePracticeIntelligenceOverview(userId);
    res.json(overview);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to generate practice intelligence overview',
    });
  }
});

/**
 * POST /api/practice-intelligence/analyze
 * Deterministic mistake detection on real user portfolio or optional custom/persona portfolio
 */
practiceIntelligenceRouter.post('/analyze', (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.authUser!.id;
    let portfolio = req.body?.portfolio;
    let trades = req.body?.trades;

    if (!portfolio || !trades) {
      const userTrading = getUserVirtualTradingData(userId);
      portfolio = portfolio || userTrading.portfolio;
      trades = trades || userTrading.trades;
    }

    const warnings = detectTradingMistakes(portfolio, trades);
    res.json({
      warnings,
      activeWarningsCount: warnings.length,
      severityBreakdown: {
        high: warnings.filter((w) => w.severity === 'High').length,
        medium: warnings.filter((w) => w.severity === 'Medium').length,
        low: warnings.filter((w) => w.severity === 'Low').length,
      },
    });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Mistake detection failed',
    });
  }
});

/**
 * POST /api/practice-intelligence/what-if
 * Pure mathematical scenario stress-test. NEVER modifies actual virtual wallet or orders!
 */
practiceIntelligenceRouter.post('/what-if', (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.authUser!.id;
    const body = req.body || {};

    const targetSymbol = String(body.targetSymbol || 'ALL').trim().toUpperCase();
    const priceChangePct = Number(body.priceChangePct ?? 0);
    const hypotheticalInvestmentDelta = Number(body.hypotheticalInvestmentDelta ?? 0);

    if (isNaN(priceChangePct) || priceChangePct < -95 || priceChangePct > 500) {
      res.status(400).json({
        error: 'Price change percentage must be a valid number between -95% and +500%.',
      });
      return;
    }

    if (isNaN(hypotheticalInvestmentDelta)) {
      res.status(400).json({
        error: 'Hypothetical investment delta must be a valid number.',
      });
      return;
    }

    // Use requested portfolio (e.g. from a demo persona or real account)
    let portfolio = body.portfolio;
    if (!portfolio) {
      const userTrading = getUserVirtualTradingData(userId);
      portfolio = userTrading.portfolio;
    }

    const simulationRequest: WhatIfRequest = {
      targetSymbol,
      priceChangePct,
      hypotheticalInvestmentDelta,
    };

    const result = runWhatIfSimulation(portfolio, simulationRequest);
    res.json(result);
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'What-if simulation failed',
    });
  }
});

/**
 * GET /api/practice-intelligence/personality
 * Deterministic educational behavioral classification
 */
practiceIntelligenceRouter.get('/personality', (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.authUser!.id;
    const personaId = req.query.personaId ? String(req.query.personaId) : null;

    let portfolio;
    let trades;

    if (personaId) {
      const persona = DEMO_PERSONAS.find((p) => p.id === personaId);
      if (persona) {
        portfolio = persona.portfolio;
        trades = persona.trades;
      }
    }

    if (!portfolio || !trades) {
      const userTrading = getUserVirtualTradingData(userId);
      portfolio = userTrading.portfolio;
      trades = userTrading.trades;
    }

    const report = analyzeTradingPersonality(portfolio, trades);
    res.json(report);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to analyze trader personality',
    });
  }
});

/**
 * GET /api/practice-intelligence/autopsy
 * Historical AI prediction evaluations with strict no-look-ahead enforcement
 */
practiceIntelligenceRouter.get('/autopsy', (_req: AuthenticatedRequest, res) => {
  try {
    const { predictions, bars } = getAuditablePredictionsAndBars();
    const autopsy = evaluatePredictions(predictions, bars);
    res.json(autopsy);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to evaluate AI predictions autopsy',
    });
  }
});

/**
 * POST /api/practice-intelligence/coach
 * Personalized AI Trading Coach response grounded in actual calculations
 */
practiceIntelligenceRouter.post('/coach', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.authUser!.id;
    const question = String(req.body?.question || req.body?.message || '').trim();
    const customContext = req.body?.context;

    const coaching = await askAiCoach(userId, question, customContext);
    res.json(coaching);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'AI Trading Coach failed to generate advice',
    });
  }
});
