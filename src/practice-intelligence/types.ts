export const STARTING_VIRTUAL_CAPITAL_INR = 1000000;

export interface VirtualTrade {
  id: string;
  timestamp: string;
  datasetPriceDate: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  totalValue: number;
  realizedPnl: number;
  stopLoss?: number;
  holdingHours?: number;
  annualizedVolatility?: number;
}

export interface PortfolioPosition {
  symbol: string;
  name: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  latestPriceDate: string;
  investedValue: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  allocationPct: number;
  atr14?: number;
  suggestedStopLoss?: number;
  stopLoss?: number;
  annualizedVolatility?: number;
}

export interface VirtualPortfolio {
  userId?: string;
  startingCapital: number;
  cashBalance: number;
  holdingsMarketValue: number;
  totalPortfolioValue: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  totalReturnPct: number;
  holdings: PortfolioPosition[];
}

export type WarningSeverity = 'Low' | 'Medium' | 'High';

export interface MistakeWarning {
  code: string;
  title: string;
  severity: WarningSeverity;
  explanation: string;
  evidence: string;
  recommended_action: string;
  metric_value: number;
}

export interface WhatIfRequest {
  targetSymbol: string; // 'ALL' or specific stock like 'RELIANCE'
  priceChangePct: number; // between -95% and +500%
  hypotheticalInvestmentDelta?: number; // INR increase (+) or decrease (-)
}

export interface WhatIfPositionBreakdown {
  symbol: string;
  name: string;
  currentQuantity: number;
  currentPrice: number;
  simulatedPrice: number;
  currentMarketValue: number;
  allocatedInvestmentDelta: number;
  simulatedMarketValue: number;
  pnlDelta: number;
  pnlDeltaPct: number;
}

export interface WhatIfSimulationResult {
  disclaimer: string; // 'HYPOTHETICAL SIMULATION — NOT A MARKET PREDICTION'
  targetSymbol: string;
  priceChangePct: number;
  hypotheticalInvestmentDelta: number;
  currentPortfolioValue: number;
  simulatedPortfolioValue: number;
  currentTotalEquity: number;
  simulatedTotalEquity: number;
  absoluteProfitLoss: number;
  percentageChange: number;
  currentVirtualCash: number;
  simulatedVirtualCash: number;
  cashWarning: string | null;
  positionsBreakdown: WhatIfPositionBreakdown[];
}

export type TraderProfileType =
  | 'Overtrader'
  | 'Momentum Chaser'
  | 'Risk-Taking Trader'
  | 'Disciplined Trader'
  | 'Conservative Trader';

export interface TraderPersonalityMetrics {
  tradesPerActiveDay: number;
  averageTradeSizeINR: number;
  averageTradePercentageOfEquity: number;
  stopLossCoveragePercentage: number;
  winRate: number;
  averageHoldingHours: number;
  averageAnnualizedVolatility: number;
  maximumPositionWeight: number;
  cashReservePercentage: number;
  totalTradesCount: number;
  activeTradingDaysCount: number;
}

export interface TraderPersonalityReport {
  profile: TraderProfileType;
  educational_disclaimer: string;
  supporting_evidence: string[];
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  metrics: TraderPersonalityMetrics;
}

export interface AIPredictionRecord {
  prediction_id: string;
  symbol: string;
  predicted_signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0.0 to 1.0
  prediction_timestamp: string; // ISO string
  price_at_prediction: number;
}

export interface PriceBar {
  symbol: string;
  timestamp: string; // ISO string or YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface PredictionEvaluationItem {
  prediction_id: string;
  symbol: string;
  predicted_signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  prediction_timestamp: string;
  price_at_prediction: number;
  subsequent_bar_timestamp: string | null;
  subsequent_price: number | null;
  actual_return_pct: number | null;
  hypothetical_return_pct: number | null;
  was_correct: boolean | null;
  status: 'EVALUATED' | 'MISSING_OUTCOME_DATA';
}

export interface PredictionAutopsyReport {
  totalPredictions: number;
  evaluatedPredictionsCount: number;
  missingDataCount: number;
  directionalAccuracyPct: number;
  averageHypotheticalReturnPct: number;
  brierCalibrationScore: number | null;
  correctCount: number;
  incorrectCount: number;
  evaluations: PredictionEvaluationItem[];
}

export interface CoachContext {
  portfolio: VirtualPortfolio;
  mistakes: MistakeWarning[];
  personality: TraderPersonalityReport;
  autopsy: PredictionAutopsyReport;
  latestSimulation?: WhatIfSimulationResult | null;
  userQuestion?: string;
}

export interface CoachResponse {
  answer: string;
  source: 'gemini' | 'deterministic_fallback';
  contextSummary: {
    totalEquity: number;
    cashRatioPct: number;
    activeWarningsCount: number;
    profile: TraderProfileType;
    verifiedAccuracyPct: number;
  };
  recommendedActions: string[];
}
