export type ModelType = 'logistic_regression' | 'random_forest' | 'gradient_boosting';

export type SignalDirection = 'BUY' | 'SELL' | 'HOLD';

export type TimeRangeKey = '1M' | '3M' | '6M' | '1Y' | 'ALL';

export interface StockMeta {
  symbol: string;
  name: string;
  sector: string;
  featured: boolean;
}

export interface OHLCVRow {
  date: string;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi: number;
}

export interface FeatureRow extends OHLCVRow {
  daily_return: number;
  sma_20: number;
  sma_50: number;
  ema_12: number;
  ema_26: number;
  rsi_14: number;
  macd: number;
  macd_signal: number;
  bb_upper: number;
  bb_lower: number;
  atr_14: number;
  volume_sma_20: number;
  volume_ratio: number;
  next_day_return: number;
  target_direction: number;
}

export interface StockSummary {
  symbol: string;
  name: string;
  sector: string;
  featured: boolean;
  latestDate: string;
  firstDate: string;
  recordCount: number;
  featureRecordCount: number;
  latestOpen: number;
  latestHigh: number;
  latestLow: number;
  latestClose: number;
  latestVolume: number;
  dailyReturn: number;
  rsi14: number;
  sma20: number;
  sma50: number;
  ema12: number;
  ema26: number;
  macd: number;
  macdSignal: number;
  bbUpper: number;
  bbLower: number;
  atr14: number;
  volumeSma20: number;
  volumeRatio: number;
  riskCategory: 'Low' | 'Moderate' | 'Elevated' | 'High';
  modelTrained: boolean;
  signal: SignalDirection | null;
  buyProbability: number | null;
  sellProbability: number | null;
  modelName: string | null;
}

export interface ValidationReport {
  combinedTotalRows: number;
  combinedColumns: string[];
  combinedUniqueStocks: number;
  combinedDateRange: { start: string; end: string };
  combinedMissingValues: Record<string, number>;
  combinedDuplicates: number;
  combinedInvalidRecords: number;
  featuresTotalRows: number;
  featuresColumns: string[];
  featuresUniqueStocks: number;
  featuresDateRange: { start: string; end: string };
  featuresMissingValues: Record<string, number>;
  targetDistribution: { positive: number; nonPositive: number };
  leakageCheckPassed: boolean;
  chronologicalSorted: boolean;
  loadedAt: string;
}

export interface PipelineStage {
  id: string;
  order: number;
  name: string;
  status: 'completed' | 'ready' | 'pending' | 'error';
  description: string;
  inputSummary: string;
  outputSummary: string;
  executionMs: number;
  details: string[];
}

export interface FeatureContribution {
  feature: string;
  label: string;
  rawValue: number;
  importance: number;
  contribution: number;
  direction: 'positive' | 'negative' | 'neutral';
  explanation: string;
}

export interface ModelEvaluation {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix: {
    tn: number;
    fp: number;
    fn: number;
    tp: number;
  };
  testPositiveRate: number;
  predictedPositiveRate: number;
}

export interface TrainedModelArtifact {
  symbol: string;
  modelType: ModelType;
  modelLabel: string;
  trainedAt: string;
  trainingDurationMs: number;
  trainSize: number;
  testSize: number;
  splitRatio: number;
  trainDateRange: { start: string; end: string };
  testDateRange: { start: string; end: string };
  featuresUsed: string[];
  excludedLeakageColumns: string[];
  targetVariable: string;
  evaluation: ModelEvaluation;
  featureImportance: Array<{ feature: string; label: string; importance: number }>;
  means: number[];
  stds: number[];
  weights?: number[];
  bias?: number;
  forest?: DecisionTreeNode[];
  gbTrees?: Array<{ tree: DecisionTreeNode; weight: number }>;
  gbBaseLogOdds?: number;
}

export interface DecisionTreeNode {
  isLeaf: boolean;
  prob?: number;
  value?: number;
  featureIndex?: number;
  threshold?: number;
  left?: DecisionTreeNode;
  right?: DecisionTreeNode;
}

export interface PredictionResult {
  symbol: string;
  modelTrained: boolean;
  modelType: ModelType | null;
  modelName: string | null;
  predictionDate: string | null;
  inferenceTimestamp: string | null;
  inferenceLatencyMs: number | null;
  threshold: number;
  signal: SignalDirection | null;
  buyProbability: number | null;
  sellProbability: number | null;
  confidence: number | null;
  explanationMethod: string | null;
  contributions: FeatureContribution[];
  ruleExplanations: Array<{
    indicator: string;
    value: string;
    bias: 'Bullish' | 'Bearish' | 'Neutral';
    summary: string;
  }>;
  statusMessage: string;
}

export interface GarchResult {
  symbol: string;
  fitted: boolean;
  statusMessage: string;
  sampleSize: number;
  omega: number;
  alpha: number;
  beta: number;
  persistence: number;
  longRunDailyVolPct: number;
  longRunAnnualVolPct: number;
  nextDayForecastDailyVolPct: number;
  nextDayForecastAnnualVolPct: number;
  logLikelihood: number;
  series: Array<{
    date: string;
    dailyReturnPct: number;
    conditionalVolAnnualPct: number;
  }>;
}

export interface RiskMetrics {
  symbol: string;
  entryPrice: number;
  atr14: number;
  atrMultiplier: number;
  availableCapital: number;
  riskPercentage: number;
  riskRewardMultiple: number;
  stopLoss: number;
  targetPrice: number;
  riskPerShare: number;
  rewardPerShare: number;
  riskRewardRatio: number;
  maxRiskAmount: number;
  positionSizeShares: number;
  suggestedCapitalAllocation: number;
  capitalExposurePct: number;
  volatilityCategory: 'Low' | 'Moderate' | 'Elevated' | 'High';
  atrPctOfPrice: number;
}

export interface BacktestTrade {
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  shares: number;
  grossPnl: number;
  transactionCost: number;
  netPnl: number;
  returnPct: number;
  signalReason: string;
}

export interface BacktestResult {
  symbol: string;
  strategyLabel: string;
  startDate: string;
  endDate: string;
  tradingDays: number;
  initialCapital: number;
  finalEquity: number;
  netProfit: number;
  totalReturnPct: number;
  benchmarkFinalEquity: number;
  benchmarkReturnPct: number;
  numberOfTrades: number;
  winningTrades: number;
  winRatePct: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  totalTransactionCosts: number;
  brokeragePct: number;
  slippagePct: number;
  assumptionsNote: string;
  equityCurve: Array<{
    date: string;
    strategyEquity: number;
    benchmarkEquity: number;
    drawdownPct: number;
  }>;
  recentTrades: BacktestTrade[];
}

export interface OrderRecord {
  id: string;
  timestamp: string;
  datasetPriceDate: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT';
  quantity: number;
  requestedPrice: number;
  executedPrice: number;
  totalValue: number;
  status: 'EXECUTED' | 'PENDING' | 'CANCELLED' | 'REJECTED';
  note: string;
}

export interface TradeRecord {
  id: string;
  timestamp: string;
  datasetPriceDate: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  totalValue: number;
  realizedPnl: number;
}

export interface HoldingPosition {
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
  atr14: number;
  suggestedStopLoss: number;
  allocationPct: number;
}

export interface PortfolioSnapshot {
  startingCapital: number;
  cashBalance: number;
  holdingsMarketValue: number;
  totalPortfolioValue: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  totalReturnPct: number;
  holdings: HoldingPosition[];
  orders: OrderRecord[];
  trades: TradeRecord[];
  equityHistory: Array<{
    timestamp: string;
    portfolioValue: number;
    cashBalance: number;
  }>;
}

export type UserRole = 'Investor' | 'Broker / Quant' | 'Practice Trader';

export interface AuthUser {
  id: string;
  userCode: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface InvestorWatchlistItem {
  symbol: string;
  name: string;
  sector: string;
  latestClose: number;
  latestDate: string;
  dailyReturn: number;
  rsi14: number;
  signal: SignalDirection | null;
  addedAt: string;
  note: string;
}

export interface InvestorHolding {
  symbol: string;
  name: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  latestDate: string;
  investedValue: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  targetPrice: number | null;
  stopLoss: number | null;
  notes: string;
  updatedAt: string;
}

export interface InvestorPortfolioSnapshot {
  totalInvested: number;
  totalMarketValue: number;
  totalUnrealizedPnl: number;
  totalUnrealizedPnlPct: number;
  holdings: InvestorHolding[];
  watchlist: InvestorWatchlistItem[];
}

export interface TrainingRunLog {
  id: number;
  symbol: string;
  modelType: ModelType;
  accuracy: number;
  precisionScore: number;
  recallScore: number;
  f1Score: number;
  trainSize: number;
  testSize: number;
  durationMs: number;
  triggeredBy: string;
  createdAt: string;
}

export interface BacktestRunLog {
  id: number;
  symbol: string;
  strategy: string;
  totalReturnPct: number;
  benchmarkReturnPct: number;
  sharpeRatio: number;
  maxDrawdownPct: number;
  numberOfTrades: number;
  triggeredBy: string;
  createdAt: string;
}

