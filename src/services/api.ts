import type {
  AdvancedRiskResponse,
  BacktestResult,
  BrokerClientDetail,
  BrokerClientSummary,
  BrokerConversationSummary,
  BrokerMessageItem,
  BrokerPortfoliosResponse,
  ClientRequestItem,
  ClientRequestStatus,
  DatasetInspectionResponse,
  ExpertAdviceItem,
  FinalPerformanceResponse,
  GarchResult,
  InvestorBrokerConnection,
  InvestorNewsResponse,
  InvestorOrder,
  InvestorPortfolioSnapshot,
  IpoSnapshotResponse,
  LanguageCode,
  MathLabResponse,
  ModelComparisonResponse,
  ModelType,
  MonitoringStatus,
  OptimizationResult,
  PipelineStage,
  PortfolioSnapshot,
  PracticeIntelligenceData,
  PracticeSimulatedOrderResult,
  PredictionResult,
  PythonEnvironmentStatus,
  RiskMetrics,
  StockDetailResponse,
  StockMeta,
  StockSummary,
  StrategySignalResponse,
  TimeRangeKey,
  TradingStrategyId,
  TrainedModelSummary,
  UserProfile,
  ValidationReport,
  WalkForwardResponse,
} from '../types/index.ts';

const TOKEN_STORAGE_KEY = 'bullseye_token';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(init?.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const res = await fetch(url, { ...init, headers });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  // Authentication & Session APIs
  login: (payload: {
    userId: string;
    password: string;
    expectedRole?: UserProfile['role'];
  }) =>
    fetchJson<{
      authenticated: boolean;
      token: string;
      expiresAt: string;
      user: UserProfile;
    }>('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  register: (payload: {
    userId: string;
    name: string;
    email: string;
    password: string;
    role: UserProfile['role'];
  }) =>
    fetchJson<{
      authenticated: boolean;
      token: string;
      expiresAt: string;
      user: UserProfile;
    }>('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  logout: () =>
    fetchJson<{ loggedOut: boolean; revoked: boolean }>('/api/auth/logout', {
      method: 'POST',
    }),

  getMe: () => fetchJson<{ authenticated: boolean; user: UserProfile }>('/api/auth/me'),

  updatePreferences: (preferredLanguage: LanguageCode) =>
    fetchJson<{ preferredLanguage: LanguageCode; user: UserProfile }>('/api/user/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferredLanguage }),
    }),

  // Public Health & Market Summary
  getHealth: () =>
    fetchJson<{
      ok: boolean;
      datasetLoaded: boolean;
      databaseInitialized: boolean;
      registeredUsers: number;
      combinedRows: number;
      featureRows: number;
      stocksCount: number;
      dateRange: { start: string; end: string };
      geminiConfigured: boolean;
    }>('/api/health'),

  getStocks: (threshold = 0.75) =>
    fetchJson<{ latestDatasetDate: string; stocks: StockSummary[] }>(
      `/api/stocks?threshold=${threshold}`,
    ),

  // Protected Broker Dataset APIs
  getDatasetSummary: () =>
    fetchJson<{
      validation: ValidationReport;
      pipelineStages: PipelineStage[];
      catalog: StockMeta[];
      loadDurationMs: number;
    }>('/api/dataset/summary'),

  reloadDataset: () =>
    fetchJson<{
      reloaded: boolean;
      validation: ValidationReport;
      pipelineStages: PipelineStage[];
      loadDurationMs: number;
    }>('/api/dataset/reload', { method: 'POST' }),

  // Protected Stock, Indicators, ML Prediction & Risk
  getStockDetail: (
    symbol: string,
    range: TimeRangeKey = '6M',
    modelType?: ModelType,
    threshold = 0.75,
  ) => {
    const params = new URLSearchParams({ range, threshold: String(threshold) });
    if (modelType) params.set('modelType', modelType);
    return fetchJson<StockDetailResponse>(`/api/stocks/${encodeURIComponent(symbol)}?${params}`);
  },

  trainModel: (symbol: string, modelType: ModelType, splitRatio = 0.8, threshold = 0.75) =>
    fetchJson<{
      trained: boolean;
      experimentId?: string;
      artifact: TrainedModelSummary;
      prediction: PredictionResult;
      trainedModels: TrainedModelSummary[];
    }>('/api/ml/train', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, modelType, splitRatio, threshold }),
    }),

  optimizeModel: (payload: {
    symbol: string;
    modelType: ModelType;
    trainPct?: number;
    valPct?: number;
    startDate?: string;
    endDate?: string;
  }) =>
    fetchJson<OptimizationResult>('/api/ml/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  compareModels: (payload: {
    symbol: string;
    models?: ModelType[];
    splitRatio?: number;
    startDate?: string;
    endDate?: string;
    rankBy?: 'f1Score' | 'accuracy' | 'precision' | 'recall';
  }) =>
    fetchJson<ModelComparisonResponse>('/api/ml/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  inspectDataset: (symbol: string, limit = 25, offset = 0) =>
    fetchJson<DatasetInspectionResponse>(
      `/api/quant/dataset/inspect/${encodeURIComponent(symbol)}?limit=${limit}&offset=${offset}`,
    ),

  downloadDatasetCsv: async (symbol: string) => {
    const token = getAuthToken();
    const res = await fetch(
      `/api/quant/dataset/inspect/${encodeURIComponent(symbol)}?format=csv&limit=500`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
    if (!res.ok) throw new Error(`CSV download failed (${res.status})`);
    return res.text();
  },

  runMathLab: (payload: {
    symbol: string;
    compareSymbols?: string[];
    smaPeriod?: number;
    rsiPeriod?: number;
    volWindow?: number;
    atrPeriod?: number;
  }) =>
    fetchJson<MathLabResponse>('/api/quant/math/analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  runWalkForward: (payload: {
    symbol: string;
    modelType: ModelType;
    initialTrainPct?: number;
    numWindows?: number;
    mode?: 'expanding' | 'rolling';
  }) =>
    fetchJson<WalkForwardResponse>('/api/quant/walk-forward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  getStrategySignals: (payload: {
    symbol: string;
    strategy: TradingStrategyId;
    modelType?: ModelType;
    threshold?: number;
    lookbackDays?: number;
  }) =>
    fetchJson<StrategySignalResponse>('/api/quant/signals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  getAdvancedRisk: (payload: {
    symbol: string;
    capital?: number;
    riskPct?: number;
    confidenceLevel?: number;
    holdingPeriodDays?: number;
    selectedSymbols?: string[];
    allocations?: Array<{ symbol: string; weightPct: number }>;
    useRealInvestorHoldings?: boolean;
  }) =>
    fetchJson<AdvancedRiskResponse>('/api/quant/risk/advanced', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  getExperiments: () =>
    fetchJson<{
      experiments: NonNullable<MonitoringStatus['trainingHistory']>;
      backtests: NonNullable<MonitoringStatus['backtestHistory']>;
    }>('/api/quant/experiments'),

  getPythonStatus: () => fetchJson<PythonEnvironmentStatus>('/api/quant/python'),

  runPythonPipeline: (symbol: string, model: 'logistic_regression' | 'random_forest' = 'logistic_regression') =>
    fetchJson<NonNullable<PythonEnvironmentStatus['lastRunResult']>>('/api/quant/python/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, model }),
    }),

  getPrediction: (symbol: string, modelType?: ModelType, threshold = 0.75) => {
    const params = new URLSearchParams({ threshold: String(threshold) });
    if (modelType) params.set('modelType', modelType);
    return fetchJson<PredictionResult>(`/api/ml/predict/${encodeURIComponent(symbol)}?${params}`);
  },

  getGarch: (symbol: string) =>
    fetchJson<GarchResult>(`/api/quant/garch/${encodeURIComponent(symbol)}`),

  calculateRisk: (payload: {
    symbol: string;
    entryPrice: number;
    atrMultiplier: number;
    availableCapital: number;
    riskPercentage: number;
    riskRewardMultiple: number;
  }) =>
    fetchJson<RiskMetrics>('/api/quant/risk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  runBacktest: (payload: {
    symbol: string;
    strategy: 'ml_model' | 'sma_crossover' | 'rsi_mean_reversion' | 'rsi_macd' | 'combined_ml_tech';
    modelType?: ModelType;
    startDate?: string;
    endDate?: string;
    initialCapital: number;
    brokeragePct: number;
    slippagePct: number;
    buyThreshold?: number;
    experimentId?: string | null;
  }) =>
    fetchJson<BacktestResult>('/api/quant/backtest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  getMonitoring: () => fetchJson<MonitoringStatus>('/api/quant/monitoring'),

  getFinalPerformance: (
    symbol: string,
    modelType?: ModelType,
    confidenceLevel = 0.95,
    holdingPeriodDays = 5,
  ) => {
    const params = new URLSearchParams({
      symbol,
      confidenceLevel: String(confidenceLevel),
      holdingPeriodDays: String(holdingPeriodDays),
    });
    if (modelType) params.set('modelType', modelType);
    return fetchJson<FinalPerformanceResponse>(`/api/quant/final-performance?${params}`);
  },

  // Protected Investor Portfolio & Watchlist APIs
  getInvestorPortfolio: () =>
    fetchJson<InvestorPortfolioSnapshot>('/api/investor/portfolio'),

  addToWatchlist: (symbol: string, note = '') =>
    fetchJson<InvestorPortfolioSnapshot>('/api/investor/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, note }),
    }),

  removeFromWatchlist: (symbol: string) =>
    fetchJson<InvestorPortfolioSnapshot>(`/api/investor/watchlist/${encodeURIComponent(symbol)}`, {
      method: 'DELETE',
    }),

  upsertInvestorHolding: (payload: {
    symbol: string;
    quantity: number;
    avgBuyPrice: number;
    targetPrice?: number | null;
    stopLoss?: number | null;
    notes?: string;
  }) =>
    fetchJson<InvestorPortfolioSnapshot>('/api/investor/holdings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  removeInvestorHolding: (symbol: string) =>
    fetchJson<InvestorPortfolioSnapshot>(`/api/investor/holdings/${encodeURIComponent(symbol)}`, {
      method: 'DELETE',
    }),

  getInvestorOrders: () => fetchJson<{ orders: InvestorOrder[] }>('/api/investor/orders'),

  createInvestorOrder: (payload: {
    symbol: string;
    side: 'BUY' | 'SELL';
    orderType: 'MARKET' | 'LIMIT';
    quantity: number;
    price?: number;
    notes?: string;
  }) =>
    fetchJson<{ ok: boolean; order: InvestorOrder; orders: InvestorOrder[] }>('/api/investor/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  cancelInvestorOrder: (id: string) =>
    fetchJson<{ orders: InvestorOrder[] }>(`/api/investor/orders/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
    }),

  getInvestorIpo: () => fetchJson<IpoSnapshotResponse>('/api/investor/ipo'),

  getInvestorNews: (lang?: LanguageCode) =>
    fetchJson<InvestorNewsResponse>(
      lang ? `/api/investor/news?lang=${encodeURIComponent(lang)}` : '/api/investor/news',
    ),

  // Protected Investor Broker Connection, Requests, Advice & Messages
  getInvestorBroker: () => fetchJson<InvestorBrokerConnection>('/api/investor/broker'),

  linkInvestorBroker: (brokerCode: string) =>
    fetchJson<InvestorBrokerConnection>('/api/investor/broker/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brokerCode }),
    }),

  getInvestorRequests: () => fetchJson<{ requests: ClientRequestItem[] }>('/api/investor/requests'),

  createInvestorRequest: (payload: {
    category: string;
    symbol?: string | null;
    message: string;
  }) =>
    fetchJson<{ request: ClientRequestItem; requests: ClientRequestItem[] }>('/api/investor/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  getInvestorAdvice: (lang?: LanguageCode) =>
    fetchJson<{ advice: ExpertAdviceItem[] }>(
      lang ? `/api/investor/advice?lang=${encodeURIComponent(lang)}` : '/api/investor/advice',
    ),

  markInvestorAdviceRead: (adviceId: string) =>
    fetchJson<{ advice: ExpertAdviceItem }>(
      `/api/investor/advice/${encodeURIComponent(adviceId)}/read`,
      { method: 'POST' },
    ),

  getInvestorMessages: () =>
    fetchJson<{
      linked: boolean;
      connection: InvestorBrokerConnection;
      messages: BrokerMessageItem[];
    }>('/api/investor/messages'),

  sendInvestorMessage: (message: string) =>
    fetchJson<{ message: BrokerMessageItem; messages: BrokerMessageItem[] }>('/api/investor/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    }),

  // Protected Broker Client Management, Portfolios, Requests, Advice & Messages
  getBrokerClients: () => fetchJson<{ clients: BrokerClientSummary[] }>('/api/broker/clients'),

  linkBrokerClient: (identifier: string) =>
    fetchJson<{ clients: BrokerClientSummary[] }>('/api/broker/clients/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    }),

  getBrokerClientDetail: (clientId: string) =>
    fetchJson<BrokerClientDetail>(`/api/broker/clients/${encodeURIComponent(clientId)}`),

  getBrokerPortfolios: () => fetchJson<BrokerPortfoliosResponse>('/api/broker/portfolios'),

  getBrokerRequests: () => fetchJson<{ requests: ClientRequestItem[] }>('/api/broker/requests'),

  updateBrokerRequestStatus: (requestId: string, status: ClientRequestStatus) =>
    fetchJson<{ request: ClientRequestItem; requests: ClientRequestItem[] }>(
      `/api/broker/requests/${encodeURIComponent(requestId)}/status`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      },
    ),

  respondToBrokerRequest: (requestId: string, responseText: string) =>
    fetchJson<{ request: ClientRequestItem; requests: ClientRequestItem[] }>(
      `/api/broker/requests/${encodeURIComponent(requestId)}/respond`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseText }),
      },
    ),

  getBrokerAdvice: () => fetchJson<{ advice: ExpertAdviceItem[] }>('/api/broker/advice'),

  generateBrokerAdvice: (payload: {
    clientId: string;
    symbol?: string | null;
    requestId?: string | null;
    category?: string;
  }) =>
    fetchJson<{ advice: ExpertAdviceItem; adviceList: ExpertAdviceItem[] }>(
      '/api/broker/advice/generate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    ),

  updateBrokerAdviceDraft: (
    adviceId: string,
    payload: { analysis?: string; recommendation?: string },
  ) =>
    fetchJson<{ advice: ExpertAdviceItem; adviceList: ExpertAdviceItem[] }>(
      `/api/broker/advice/${encodeURIComponent(adviceId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    ),

  sendBrokerAdvice: (adviceId: string) =>
    fetchJson<{ advice: ExpertAdviceItem; adviceList: ExpertAdviceItem[] }>(
      `/api/broker/advice/${encodeURIComponent(adviceId)}/send`,
      { method: 'POST' },
    ),

  getBrokerConversations: () =>
    fetchJson<{ conversations: BrokerConversationSummary[] }>('/api/broker/messages'),

  getBrokerMessages: (clientId: string) =>
    fetchJson<{ messages: BrokerMessageItem[] }>(
      `/api/broker/messages/${encodeURIComponent(clientId)}`,
    ),

  sendBrokerMessage: (clientId: string, message: string) =>
    fetchJson<{
      message: BrokerMessageItem;
      messages: BrokerMessageItem[];
      conversations: BrokerConversationSummary[];
    }>(`/api/broker/messages/${encodeURIComponent(clientId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    }),

  // Protected Practice Trading APIs
  getPortfolio: () => fetchJson<PortfolioSnapshot>('/api/practice/portfolio'),

  placeOrder: (payload: {
    symbol: string;
    side: 'BUY' | 'SELL';
    orderType: 'MARKET' | 'LIMIT';
    quantity: number;
    limitPrice?: number;
  }) =>
    fetchJson<{ ok: boolean; portfolio: PortfolioSnapshot }>('/api/practice/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  cancelOrder: (id: string) =>
    fetchJson<{ portfolio: PortfolioSnapshot }>(`/api/practice/order/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
    }),

  resetPortfolio: () =>
    fetchJson<{ portfolio: PortfolioSnapshot }>('/api/practice/reset', { method: 'POST' }),

  getPracticeIntelligence: () => fetchJson<PracticeIntelligenceData>('/api/practice/intelligence'),

  simulateTradeImpact: (payload: {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price?: number;
  }) =>
    fetchJson<PracticeSimulatedOrderResult>('/api/practice/simulate-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  // AI Assistant
  chatWithAi: (payload: {
    message: string;
    history: Array<{ role: 'user' | 'assistant'; text: string }>;
    language: LanguageCode;
    context?: Record<string, unknown>;
  }) =>
    fetchJson<{ configured: boolean; reply?: string; error?: string }>('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
};
