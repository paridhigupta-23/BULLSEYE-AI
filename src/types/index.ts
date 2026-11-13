export type PortalId = 'landing' | 'investor' | 'broker' | 'practice';
export type ThemeMode = 'light' | 'dark';
export type LanguageCode = 'en' | 'hi' | 'te';
export type TimeRangeKey = '1M' | '3M' | '6M' | '1Y' | 'ALL';
export type ModelType =
  | 'logistic_regression'
  | 'random_forest'
  | 'gradient_boosting'
  | 'sequence_mlp';
export type SignalDirection = 'BUY' | 'SELL' | 'HOLD';

export interface UserProfile {
  id: string;
  userCode: string;
  name: string;
  email: string;
  role: 'Investor' | 'Broker / Quant' | 'Practice Trader';
  preferredLanguage?: LanguageCode;
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
  hyperparameters?: Record<string, string | number>;
  trainLossHistory?: Array<{ epoch: number; trainLoss: number; valLoss: number }>;
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
  losingTrades: number;
  winRatePct: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number | null;
  avgWinningTrade: number;
  avgLosingTrade: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  totalTransactionCosts: number;
  brokeragePct: number;
  slippagePct: number;
  walkForwardLeakageFree?: boolean;
  retrainCount?: number;
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

export interface PracticeHoldingsHealth {
  totalHoldingsCount: number;
  diversificationScore: number;
  hhi: number;
  concentrations: Array<{
    symbol: string;
    marketValue: number;
    allocationPct: number;
    isConcentrated: boolean;
  }>;
  totalAtrRiskExposure: number;
  cashBufferRating: 'OPTIMAL' | 'LOW' | 'HIGH';
  cashBufferPct: number;
  technicalBiases: Array<{
    symbol: string;
    currentPrice: number;
    atr14: number;
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    rsi14: number;
    rsiStatus: 'OVERBOUGHT' | 'OVERSOLD' | 'NORMAL';
    macdSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  }>;
}

export interface PracticeBehavioralAnalytics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRatePct: number;
  profitFactor: number | null;
  avgWin: number;
  avgLoss: number;
  payoffRatio: number | null;
  largestWin: number;
  largestLoss: number;
  marketOrdersCount: number;
  limitOrdersCount: number;
  fillRatePct: number;
  disciplineScore: number;
  disciplineRemarks: string[];
}

export interface PracticeStressScenario {
  id: string;
  name: string;
  description: string;
  marketShockPct: number;
  shockedPortfolioValue: number;
  simulatedPnL: number;
  simulatedPnLPct: number;
  effectivePortfolioShockPct: number;
  holdingImpacts: Array<{
    symbol: string;
    currentMarketValue: number;
    shockedMarketValue: number;
    lossGain: number;
  }>;
}

export interface PracticeIntelligenceData {
  userId: string;
  portfolio: PortfolioSnapshot;
  holdingsHealth: PracticeHoldingsHealth;
  behavioralAnalytics: PracticeBehavioralAnalytics;
  stressScenarios: PracticeStressScenario[];
  generatedAt: string;
}

export interface PracticeSimulatedOrderResult {
  isSimulated: true;
  simulationNote: string;
  actualWalletBefore: {
    cashBalance: number;
    totalPortfolioValue: number;
    holdingsCount: number;
  };
  hypotheticalTrade: {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    totalValue: number;
  };
  canAfford: boolean;
  canExecute: boolean;
  executionIssue?: string;
  projectedCashBalance: number;
  projectedPortfolioValue: number;
  projectedAllocationPct: number;
  concentrationWarning: boolean;
  projectedHoldingsCount: number;
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
    experimentId?: string;
    symbol: string;
    modelType: ModelType;
    accuracy: number;
    precisionScore: number;
    recallScore: number;
    f1Score: number;
    trainSize: number;
    testSize: number;
    trainDateRange?: string;
    testDateRange?: string;
    paramsJson?: string;
    confusionMatrixJson?: string;
    status?: string;
    backtestRunId?: number | null;
    durationMs: number;
    triggeredBy: string;
    createdAt: string;
  }>;
  backtestHistory?: Array<{
    id: number;
    runCode?: string;
    experimentId?: string | null;
    symbol: string;
    strategy: string;
    totalReturnPct: number;
    benchmarkReturnPct: number;
    sharpeRatio: number;
    maxDrawdownPct: number;
    numberOfTrades: number;
    paramsJson?: string;
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

export interface InvestorOrder {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT';
  quantity: number;
  price: number;
  totalValue: number;
  status: 'EXECUTED' | 'PLANNED' | 'CANCELLED';
  notes: string;
  createdAt: string;
}

export interface IpoSmeSecurity {
  symbol: string;
  security: string;
  series: string;
  prevClose: number;
  closePrice: number;
  high52Week: number;
  low52Week: number;
  tradedQty: number;
}

export interface IpoSnapshotResponse {
  liveIpoFeedAvailable: boolean;
  statusMessage: string;
  sourceFile: string;
  sourceDate: string;
  smeListingsCount: number;
  smeListings: IpoSmeSecurity[];
}

export interface InvestorAnnouncementItem {
  company: string;
  symbol: string;
  headline: string;
  originalHeadline: string;
  summary: string;
  category: 'Announcement' | 'Board Meeting' | 'Corporate Action';
  dateNote: string;
  source: string;
  articleAvailable: boolean;
  translationProvider: string;
}

export interface InvestorNewsResponse {
  liveNewsFeedAvailable: boolean;
  language: LanguageCode;
  statusMessage: string;
  sourceFiles: string[];
  items: InvestorAnnouncementItem[];
}

export type ClientRequestStatus = 'Pending' | 'Under Review' | 'Responded' | 'Closed';
export type AdviceStatus = 'Draft' | 'Sent' | 'Read';

export interface InvestorBrokerConnection {
  linked: boolean;
  brokerId: string | null;
  brokerUserCode: string | null;
  brokerName: string | null;
  brokerEmail: string | null;
  linkedAt: string | null;
}

export interface BrokerClientSummary {
  clientId: string;
  userCode: string;
  name: string;
  email: string;
  preferredLanguage: LanguageCode;
  registrationDate: string;
  linkedAt: string;
  totalInvested: number;
  currentPortfolioValue: number;
  totalPnl: number;
  totalPnlPct: number;
  stocksHeldCount: number;
  pendingRequestsCount: number;
  unreadMessagesCount: number;
  adviceCount: number;
  portfolioPerformanceLabel: string;
  valuationDateLabel: string;
}

export interface BrokerClientHoldingRow {
  clientId: string;
  clientName: string;
  clientUserCode: string;
  symbol: string;
  stockName: string;
  sector: string;
  quantity: number;
  avgPurchasePrice: number;
  totalInvested: number;
  latestMarketPrice: number;
  latestPriceDate: string;
  currentHoldingValue: number;
  pnlRupees: number;
  pnlPct: number;
  allocationPct: number;
}

export interface BrokerStockBreakdown {
  symbol: string;
  stockName: string;
  clientsCount: number;
  totalQuantity: number;
  totalInvested: number;
  currentValue: number;
  totalPnl: number;
  totalPnlPct: number;
  latestMarketPrice: number;
  latestPriceDate: string;
}

export interface BrokerPortfoliosResponse {
  valuationLabel: string;
  overallInvested: number;
  overallCurrentValue: number;
  overallPnl: number;
  overallPnlPct: number;
  clientsCount: number;
  holdingsCount: number;
  holdings: BrokerClientHoldingRow[];
  stockBreakdown: BrokerStockBreakdown[];
  clientSummaries: BrokerClientSummary[];
}

export interface RequestResponseItem {
  id: string;
  requestId: string;
  brokerId: string;
  brokerName: string;
  responseText: string;
  createdAt: string;
}

export interface ClientRequestItem {
  id: string;
  clientId: string;
  clientUserCode: string;
  clientName: string;
  clientEmail: string;
  brokerId: string;
  brokerName: string;
  category: string;
  symbol: string | null;
  message: string;
  status: ClientRequestStatus;
  createdAt: string;
  updatedAt: string;
  responses: RequestResponseItem[];
  clientTotalInvested?: number;
  clientPortfolioValue?: number;
  clientPnlPct?: number;
}

export interface AdviceSupportingMetrics {
  symbol: string | null;
  valuationDate: string;
  latestClose: number | null;
  dailyReturnPct: number | null;
  rsi14: number | null;
  sma20: number | null;
  sma50: number | null;
  ema12: number | null;
  ema26: number | null;
  macd: number | null;
  macdSignal: number | null;
  atr14: number | null;
  garchAnnualVolPct: number | null;
  mlModelTrained: boolean;
  mlModelName: string | null;
  mlSignal: SignalDirection | null;
  mlBuyProbability: number | null;
  clientPortfolioValue: number;
  clientTotalInvested: number;
  clientUnrealizedPnl: number;
  clientUnrealizedPnlPct: number;
  holdingQuantity: number | null;
  holdingAvgBuyPrice: number | null;
  holdingAllocationPct: number | null;
  holdingPnlPct: number | null;
}

export interface ExpertAdviceItem {
  id: string;
  clientId: string;
  clientUserCode: string;
  clientName: string;
  brokerId: string;
  brokerUserCode: string;
  brokerName: string;
  requestId: string | null;
  symbol: string | null;
  category: string;
  analysis: string;
  recommendation: string;
  supportingMetrics: AdviceSupportingMetrics;
  riskLevel: 'Low' | 'Moderate' | 'Elevated' | 'High';
  disclaimer: string;
  status: AdviceStatus;
  generatedAt: string;
  sentAt: string | null;
  readAt: string | null;
  language?: LanguageCode;
}

export interface BrokerMessageItem {
  id: string;
  brokerId: string;
  clientId: string;
  senderId: string;
  senderRole: UserProfile['role'];
  senderName: string;
  messageText: string;
  isRead: boolean;
  createdAt: string;
}

export interface BrokerConversationSummary {
  clientId: string;
  clientUserCode: string;
  clientName: string;
  clientEmail: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface BrokerClientDetail {
  client: BrokerClientSummary;
  holdings: BrokerClientHoldingRow[];
  watchlist: InvestorWatchlistItem[];
  orders: InvestorOrder[];
  requests: ClientRequestItem[];
  advice: ExpertAdviceItem[];
  messages: BrokerMessageItem[];
}

export interface FeatureRowPreview {
  date: string;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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

export interface DatasetFeatureStat {
  feature: string;
  label: string;
  formula: string;
  tellsModel: string;
  tradingUsefulness: string;
  latestValue: number;
  min: number;
  mean: number;
  std: number;
  max: number;
  missingCount: number;
}

export interface DatasetInspectionResponse {
  symbol: string;
  rawRowCount: number;
  featureRowCount: number;
  dateRange: { start: string; end: string };
  excludedLeakageColumns: string[];
  leakageVerified: boolean;
  chronologicalSorted: boolean;
  missingValuesTotal: number;
  duplicatesTotal: number;
  previewRows: FeatureRowPreview[];
  featureStats: DatasetFeatureStat[];
}

export interface MathLabCalculationItem {
  id: string;
  name: string;
  formula: string;
  variablesExplanation: string;
  periodLabel: string;
  latestOutput: string;
  interpretation: string;
  category: 'technical' | 'volatility_statistical' | 'garch';
}

export interface MathLabResponse {
  symbol: string;
  latestDate: string;
  rowCount: number;
  periods: { sma: number; rsi: number; vol: number; atr: number };
  calculations: MathLabCalculationItem[];
  rollingVsGarchSeries: Array<{
    date: string;
    dailyReturnPct: number;
    rollingVolAnnualPct: number;
    garchVolAnnualPct: number | null;
    customSma: number | null;
    customRsi: number | null;
  }>;
  correlationSymbols: string[];
  correlationMatrix: number[][];
}

export interface OptimizationResult {
  symbol: string;
  modelType: ModelType;
  modelLabel: string;
  experimentId: string;
  trainDateRange: { start: string; end: string };
  valDateRange: { start: string; end: string };
  testDateRange: { start: string; end: string };
  trainSize: number;
  valSize: number;
  testSize: number;
  bestParams: Record<string, string | number>;
  selectedThreshold: number;
  gridCandidatesTested: Array<{
    paramsLabel: string;
    valAccuracy: number;
    valF1: number;
    selectedThreshold: number;
  }>;
  testEvaluation: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    confusionMatrix: { tn: number; fp: number; fn: number; tp: number };
    testPositiveRate: number;
    predictedPositiveRate: number;
  };
  classificationReport: Array<{
    className: string;
    precision: number;
    recall: number;
    f1Score: number;
    support: number;
  }>;
  actualVsPredictedSample: Array<{
    date: string;
    close: number;
    actualDirection: number;
    predictedProb: number;
    predictedDirection: number;
    correct: boolean;
  }>;
  lossHistory?: Array<{ epoch: number; trainLoss: number; valLoss: number }>;
  trainingDurationMs: number;
}

export interface ModelComparisonItem {
  modelType: ModelType;
  modelLabel: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix: { tn: number; fp: number; fn: number; tp: number };
  trainingDurationMs: number;
  inferenceLatencyMs: number;
  trainSize: number;
  testSize: number;
  lossHistoryLength: number;
  rationale: string;
}

export interface ModelComparisonResponse {
  symbol: string;
  metricRankBy: 'f1Score' | 'accuracy' | 'precision' | 'recall';
  testDateRange: { start: string; end: string };
  trainDateRange: { start: string; end: string };
  bestModelType: ModelType;
  bestModelLabel: string;
  comparisonSummary: string;
  models: ModelComparisonItem[];
}

export interface WalkForwardWindowResult {
  windowIndex: number;
  trainRange: { start: string; end: string };
  testRange: { start: string; end: string };
  trainSize: number;
  testSize: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix: { tn: number; fp: number; fn: number; tp: number };
}

export interface WalkForwardResponse {
  symbol: string;
  modelType: ModelType;
  mode: 'expanding' | 'rolling';
  totalRows: number;
  windows: WalkForwardWindowResult[];
  averageMetrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
  };
  leakageNote: string;
}

export type TradingStrategyId =
  | 'sma_crossover'
  | 'rsi_macd'
  | 'ml_model'
  | 'combined_ml_tech';

export interface StrategySignalRecord {
  date: string;
  close: number;
  mlSignal: SignalDirection | null;
  buyProbability: number | null;
  technicalSignal: SignalDirection;
  finalDecision: SignalDirection;
  rsi14: number;
  sma20: number;
  sma50: number;
  macd: number;
  macdSignal: number;
}

export interface StrategySignalResponse {
  symbol: string;
  strategy: TradingStrategyId;
  strategyLabel: string;
  modelType: ModelType | null;
  modelTrained: boolean;
  threshold: number;
  observationDate: string;
  historicalClose: number;
  isHistoricalOnlyLabel: string;
  latestDecision: {
    finalDecision: SignalDirection;
    mlSignal: SignalDirection | null;
    buyProbability: number | null;
    sellProbability: number | null;
    technicalBias: SignalDirection;
    rsiInterpretation: string;
    smaTrend: string;
    macdDirection: string;
    riskContext: {
      atr14: number;
      stopLoss: number;
      targetPrice: number;
      volatilityCategory: string;
    };
    explanation: string;
    combinationRule: string;
    invalidationConditions: string[];
  };
  distribution: { BUY: number; SELL: number; HOLD: number; totalSessions: number };
  recentSignals: StrategySignalRecord[];
}

export interface AdvancedRiskResponse {
  primarySymbol: string;
  latestDate: string;
  capital: number;
  riskPct: number;
  confidenceLevel: number;
  holdingPeriodDays: number;
  varPct: number;
  varRupees: number;
  cvarPct: number;
  cvarRupees: number;
  annualizedReturnPct: number;
  annualizedVolatilityPct: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  atrRisk: RiskMetrics;
  garch: GarchResult;
  correlationSymbols: string[];
  correlationMatrix: number[][];
  portfolioConcentration: {
    source: 'real_investor_holdings' | 'user_hypothetical_allocation' | 'none_entered';
    sourceDescription: string;
    herfindahlIndex: number;
    maxSingleWeightPct: number;
    positions: Array<{
      symbol: string;
      weightPct: number;
      allocatedRupees: number;
      annualVolPct: number;
      var95Rupees: number;
    }>;
  };
  assumptions: string[];
}

export interface PythonEnvironmentStatus {
  pythonVersion: string | null;
  pythonAvailable: boolean;
  packages: Record<string, boolean>;
  deepLearningNote: string;
  files: Array<{
    name: string;
    path: string;
    description: string;
    content: string;
  }>;
  lastRunResult: {
    executed: boolean;
    executedAt: string;
    command: string;
    output: Record<string, unknown> | null;
    rawStdout: string;
    error: string | null;
  } | null;
}

export interface FinalPerformanceResponse {
  symbol: string;
  generatedAt: string;
  hasModelData: boolean;
  hasBacktestData: boolean;
  modelPerformance: {
    modelType: ModelType | null;
    modelLabel: string | null;
    accuracy: number | null;
    precision: number | null;
    recall: number | null;
    f1Score: number | null;
    confusionMatrix: { tn: number; fp: number; fn: number; tp: number } | null;
    trainDateRange: string | null;
    testDateRange: string | null;
    trainSize: number | null;
    testSize: number | null;
  };
  tradingPerformance: {
    runCode: string | null;
    strategy: string | null;
    startDate: string | null;
    endDate: string | null;
    initialCapital: number | null;
    finalEquity: number | null;
    netProfit: number | null;
    roiPct: number | null;
    winRatePct: number | null;
    profitFactor: number | null;
    totalTrades: number | null;
    winningTrades: number | null;
    losingTrades: number | null;
    avgWinningTrade: number | null;
    avgLosingTrade: number | null;
    benchmarkReturnPct: number | null;
    walkForwardLeakageFree: boolean | null;
    retrainCount: number | null;
    createdAt: string | null;
  };
  risk: {
    confidenceLevel: number;
    holdingPeriodDays: number;
    maxDrawdownPct: number;
    backtestMaxDrawdownPct: number | null;
    annualizedVolatilityPct: number;
    sharpeRatio: number;
    backtestSharpeRatio: number | null;
    historicalVarPct: number;
    historicalVarRupees: number;
    historicalCvarPct: number;
    historicalCvarRupees: number;
  };
  efficiency: {
    trainingDurationMs: number | null;
    measuredSampleCount: number;
    avgInferenceLatencyMs: number | null;
    minInferenceLatencyMs: number | null;
    maxInferenceLatencyMs: number | null;
    throughputPredictionsPerSec: number | null;
    measurementMethod: string;
  };
  transactionCosts: {
    brokeragePct: number | null;
    slippagePct: number | null;
    totalTransactionCosts: number | null;
    grossProfit: number | null;
    grossLoss: number | null;
    netProfit: number | null;
  };
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
