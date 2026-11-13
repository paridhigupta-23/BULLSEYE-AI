import type {
  BacktestResult,
  GarchResult,
  InvestorPortfolioSnapshot,
  LanguageCode,
  ModelType,
  MonitoringStatus,
  PipelineStage,
  PortfolioSnapshot,
  PredictionResult,
  RiskMetrics,
  StockDetailResponse,
  StockMeta,
  StockSummary,
  TimeRangeKey,
  TrainedModelSummary,
  UserProfile,
  ValidationReport,
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
      artifact: TrainedModelSummary;
      prediction: PredictionResult;
      trainedModels: TrainedModelSummary[];
    }>('/api/ml/train', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, modelType, splitRatio, threshold }),
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
    strategy: 'ml_model' | 'sma_crossover' | 'rsi_mean_reversion';
    modelType?: ModelType;
    startDate?: string;
    endDate?: string;
    initialCapital: number;
    brokeragePct: number;
    slippagePct: number;
    buyThreshold?: number;
  }) =>
    fetchJson<BacktestResult>('/api/quant/backtest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  getMonitoring: () => fetchJson<MonitoringStatus>('/api/quant/monitoring'),

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
