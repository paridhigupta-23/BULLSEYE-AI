export type PortalId = 'landing' | 'investor' | 'broker' | 'practice';
export type ThemeMode = 'light' | 'dark';
export type LanguageCode = 'en' | 'hi' | 'te';
export type TimeRangeKey = '1M' | '3M' | '6M' | '1Y' | 'ALL';
export type ModelType = 'logistic_regression' | 'random_forest' | 'gradient_boosting';
export type SignalDirection = 'BUY' | 'SELL' | 'HOLD';

export interface UserProfile {
  id: string;
  userCode: string;
  name: string;
  email: string;
  role: 'Investor' | 'Broker / Quant' | 'Practice Trader';
  createdAt?: string;
}

export interface StockMeta {
  symbol: string;
  name: string;
  sector: string;
  featured: boolean;
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

export interface StockSeriesPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  daily_return: number | null;
  sma_20: number | null;
  sma_50: number | null;
  ema_12: number | null;
  ema_26: number | null;
  rsi_14: number | null;
  macd: number | null;
  macd_signal: number | null;
  bb_upper: number | null;
  bb_lower: number | null;
  atr_14: number | null;
  volume_sma_20: number | null;
  volume_ratio: number | null;
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

export interface RuleExplanation {
  indicator: string;
  value: string;
  bias: 'Bullish' | 'Bearish' | 'Neutral';
  summary: string;
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
  ruleExplanations: RuleExplanation[];
  statusMessage: string;
}

export interface TrainedModelSummary {
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
  evaluation: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    confusionMatrix: { tn: number; fp: number; fn: number; tp: number };
    testPositiveRate: number;
    predictedPositiveRate: number;
  };
  featureImportance: Array<{ feature: string; label: string; importance: number }>;
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

export interface StockDetailResponse {
  available: boolean;
  meta: StockMeta;
  range: TimeRangeKey;
  latestDate: string;
  featureLatestDate: string;
  latestOhlcv: {
    date: string;
    symbol: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    oi: number;
  };
  latestDailyReturn: number;
  latestFeatures: Record<string, number | string>;
  ruleExplanations: RuleExplanation[];
  prediction: PredictionResult;
  trainedModels: TrainedModelSummary[];
  risk: RiskMetrics;
  garch: GarchResult;
  series: StockSeriesPoint[];
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

export interface MonitoringStatus {
  datasetStatus: string;
  datasetLoadedAt: string;
  datasetLoadDurationMs: number;
  pipelineStatus: string;
  trainedModelsCount: number;
  trainedModels: Array<{ symbol: string; modelType: ModelType; trainedAt: string }>;
  lastTrainingTimestamp: string | null;
  lastPredictionTimestamp: string | null;
  lastInferenceLatencyMs: number | null;
  lastBacktestTimestamp: string | null;
  lastBacktestStatus: string;
  lastDataError: string | null;
  recentErrors: Array<{ timestamp: string; message: string }>;
  trainingHistory?: Array<{
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
  }>;
  backtestHistory?: Array<{
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
  }>;
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

export function formatINR(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '₹0.00';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  return `${sign}₹${abs.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatVolume(vol: number): string {
  if (!Number.isFinite(vol)) return '0';
  if (vol >= 1e7) return `${(vol / 1e7).toFixed(2)} Cr`;
  if (vol >= 1e5) return `${(vol / 1e5).toFixed(2)} L`;
  return vol.toLocaleString('en-IN');
}

export function formatPct(val: number, showPlus = true): string {
  if (!Number.isFinite(val)) return '0.00%';
  const prefix = showPlus && val > 0 ? '+' : '';
  return `${prefix}${val.toFixed(2)}%`;
}
