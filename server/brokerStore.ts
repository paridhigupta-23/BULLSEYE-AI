import crypto from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { loadDatasets } from './dataLoader.ts';
import { getDb } from './db.ts';
import { getInvestorSnapshot, listInvestorOrders } from './investorStore.ts';
import { mlStore } from './mlStore.ts';
import { calculateRiskMetrics } from './quantMath.ts';
import { translateFinancialTexts } from './translationService.ts';
import type {
  AdviceSupportingMetrics,
  BrokerClientDetail,
  BrokerClientHoldingRow,
  BrokerClientSummary,
  BrokerConversationSummary,
  BrokerMessageItem,
  BrokerPortfoliosResponse,
  BrokerStockBreakdown,
  ClientRequestItem,
  ClientRequestStatus,
  ExpertAdviceItem,
  InvestorBrokerConnection,
  LanguageCode,
  RequestResponseItem,
  UserRole,
} from './types.ts';

export const ADVICE_DISCLAIMER_EN =
  'Educational Quantitative Assessment Only (Not SEBI-Registered Investment Advice): Based strictly on historical NSE data through 30 September 2025, portfolio holdings in SQLite, and deterministic technical/volatility calculations.';

function hasConfiguredGeminiKey(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim() !== '' && key.trim() !== 'MY_GEMINI_API_KEY');
}

export function isClientLinkedToBroker(brokerId: string, clientId: string): boolean {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT 1 as ok
       FROM broker_clients
       WHERE broker_id = ? AND client_id = ? AND status = 'Active'
       LIMIT 1`,
    )
    .get(brokerId, clientId) as { ok: number } | undefined;
  return Boolean(row?.ok);
}

export function getInvestorBrokerConnection(clientId: string): InvestorBrokerConnection {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT bc.broker_id, bc.linked_at, u.user_code, u.name, u.email
       FROM broker_clients bc
       JOIN users u ON u.id = bc.broker_id
       WHERE bc.client_id = ? AND bc.status = 'Active'
       ORDER BY bc.id DESC
       LIMIT 1`,
    )
    .get(clientId) as
    | {
        broker_id: string;
        linked_at: string;
        user_code: string;
        name: string;
        email: string;
      }
    | undefined;

  if (!row) {
    return {
      linked: false,
      brokerId: null,
      brokerUserCode: null,
      brokerName: null,
      brokerEmail: null,
      linkedAt: null,
    };
  }

  return {
    linked: true,
    brokerId: row.broker_id,
    brokerUserCode: row.user_code,
    brokerName: row.name,
    brokerEmail: row.email,
    linkedAt: row.linked_at,
  };
}

export function linkInvestorToBrokerByCode(
  clientId: string,
  brokerIdentifier: string,
): { ok: true; connection: InvestorBrokerConnection } | { ok: false; status: number; error: string } {
  const clean = brokerIdentifier.trim();
  if (!clean) {
    return { ok: false, status: 400, error: 'Broker User ID or email is required.' };
  }
  const db = getDb();
  const broker = db
    .prepare(
      `SELECT id, role
       FROM users
       WHERE (UPPER(user_code) = UPPER(?) OR LOWER(email) = LOWER(?))
       LIMIT 1`,
    )
    .get(clean, clean) as { id: string; role: UserRole } | undefined;

  if (!broker) {
    return { ok: false, status: 404, error: `No Broker / Quant account found for "${clean}".` };
  }
  if (broker.role !== 'Broker / Quant') {
    return {
      ok: false,
      status: 400,
      error: `Account "${clean}" is a "${broker.role}" account, not a Broker / Quant account.`,
    };
  }

  const now = new Date().toISOString();
  db.prepare(`DELETE FROM broker_clients WHERE client_id = ?`).run(clientId);
  db.prepare(
    `INSERT INTO broker_clients (broker_id, client_id, status, linked_at)
     VALUES (?, ?, 'Active', ?)`,
  ).run(broker.id, clientId, now);

  return { ok: true, connection: getInvestorBrokerConnection(clientId) };
}

export function linkClientForBroker(
  brokerId: string,
  clientIdentifier: string,
): { ok: true; clients: BrokerClientSummary[] } | { ok: false; status: number; error: string } {
  const clean = clientIdentifier.trim();
  if (!clean) {
    return { ok: false, status: 400, error: 'Investor User ID or email is required.' };
  }
  const db = getDb();
  const investor = db
    .prepare(
      `SELECT id, role
       FROM users
       WHERE (UPPER(user_code) = UPPER(?) OR LOWER(email) = LOWER(?))
       LIMIT 1`,
    )
    .get(clean, clean) as { id: string; role: UserRole } | undefined;

  if (!investor) {
    return { ok: false, status: 404, error: `No registered Investor found for "${clean}".` };
  }
  if (investor.role !== 'Investor') {
    return {
      ok: false,
      status: 400,
      error: `User "${clean}" has role "${investor.role}". Only Investor accounts can be linked as clients.`,
    };
  }

  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR IGNORE INTO broker_clients (broker_id, client_id, status, linked_at)
     VALUES (?, ?, 'Active', ?)`,
  ).run(brokerId, investor.id, now);

  return { ok: true, clients: listBrokerClients(brokerId) };
}

function buildClientHoldingRows(clientId: string, clientName: string, clientUserCode: string): BrokerClientHoldingRow[] {
  const snap = getInvestorSnapshot(clientId);
  const dataset = loadDatasets();
  const metaMap = new Map(dataset.catalog.map((m) => [m.symbol, m]));
  const totalValue = snap.totalMarketValue;

  return snap.holdings.map((h) => {
    const meta = metaMap.get(h.symbol);
    const allocationPct = totalValue > 0 ? (h.marketValue / totalValue) * 100 : 0;
    return {
      clientId,
      clientName,
      clientUserCode,
      symbol: h.symbol,
      stockName: h.name,
      sector: meta?.sector ?? 'NIFTY 50 Equity',
      quantity: h.quantity,
      avgPurchasePrice: h.avgBuyPrice,
      totalInvested: h.investedValue,
      latestMarketPrice: h.currentPrice,
      latestPriceDate: h.latestDate,
      currentHoldingValue: h.marketValue,
      pnlRupees: h.unrealizedPnl,
      pnlPct: h.unrealizedPnlPct,
      allocationPct,
    };
  });
}

function formatPerformanceLabel(pnlPct: number, holdingsCount: number): string {
  if (holdingsCount === 0) return 'No Active Holdings';
  if (pnlPct >= 10) return 'Strong Outperformer';
  if (pnlPct >= 0) return 'Net Positive';
  if (pnlPct >= -5) return 'Mild Drawdown';
  return 'Underperforming';
}

export function listBrokerClients(brokerId: string): BrokerClientSummary[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT u.id, u.user_code, u.name, u.email, u.preferred_language, u.created_at, bc.linked_at
       FROM broker_clients bc
       JOIN users u ON u.id = bc.client_id
       WHERE bc.broker_id = ? AND bc.status = 'Active' AND u.role = 'Investor'
       ORDER BY bc.id ASC`,
    )
    .all(brokerId) as Array<{
    id: string;
    user_code: string;
    name: string;
    email: string;
    preferred_language: string;
    created_at: string;
    linked_at: string;
  }>;

  const ds = loadDatasets();
  const valuationDate = ds.validation.combinedDateRange.end;

  return rows.map((u) => {
    const snap = getInvestorSnapshot(u.id);
    const pendingReq = (
      db
        .prepare(
          `SELECT COUNT(*) as cnt FROM client_requests
           WHERE broker_id = ? AND client_id = ? AND status IN ('Pending', 'Under Review')`,
        )
        .get(brokerId, u.id) as { cnt: number }
    ).cnt;

    const unreadMsgs = (
      db
        .prepare(
          `SELECT COUNT(*) as cnt FROM broker_messages
           WHERE broker_id = ? AND client_id = ? AND sender_id = ? AND is_read = 0`,
        )
        .get(brokerId, u.id, u.id) as { cnt: number }
    ).cnt;

    const adviceCount = (
      db
        .prepare(`SELECT COUNT(*) as cnt FROM expert_advice WHERE broker_id = ? AND client_id = ?`)
        .get(brokerId, u.id) as { cnt: number }
    ).cnt;

    return {
      clientId: u.id,
      userCode: u.user_code,
      name: u.name,
      email: u.email,
      preferredLanguage: (u.preferred_language === 'hi' || u.preferred_language === 'te'
        ? u.preferred_language
        : 'en') as LanguageCode,
      registrationDate: u.created_at,
      linkedAt: u.linked_at,
      totalInvested: snap.totalInvested,
      currentPortfolioValue: snap.totalMarketValue,
      totalPnl: snap.totalUnrealizedPnl,
      totalPnlPct: snap.totalUnrealizedPnlPct,
      stocksHeldCount: snap.holdings.length,
      pendingRequestsCount: pendingReq,
      unreadMessagesCount: unreadMsgs,
      adviceCount,
      portfolioPerformanceLabel: formatPerformanceLabel(snap.totalUnrealizedPnlPct, snap.holdings.length),
      valuationDateLabel: `Historical Close (${valuationDate})`,
    };
  });
}

export function getBrokerPortfoliosSummary(brokerId: string): BrokerPortfoliosResponse {
  const clientSummaries = listBrokerClients(brokerId);
  const holdings: BrokerClientHoldingRow[] = [];
  const stockMap = new Map<
    string,
    {
      symbol: string;
      stockName: string;
      clients: Set<string>;
      totalQuantity: number;
      totalInvested: number;
      currentValue: number;
      latestMarketPrice: number;
      latestPriceDate: string;
    }
  >();

  let overallInvested = 0;
  let overallCurrentValue = 0;

  for (const client of clientSummaries) {
    overallInvested += client.totalInvested;
    overallCurrentValue += client.currentPortfolioValue;
    const rows = buildClientHoldingRows(client.clientId, client.name, client.userCode);
    for (const row of rows) {
      holdings.push(row);
      const existing = stockMap.get(row.symbol);
      if (!existing) {
        stockMap.set(row.symbol, {
          symbol: row.symbol,
          stockName: row.stockName,
          clients: new Set([client.clientId]),
          totalQuantity: row.quantity,
          totalInvested: row.totalInvested,
          currentValue: row.currentHoldingValue,
          latestMarketPrice: row.latestMarketPrice,
          latestPriceDate: row.latestPriceDate,
        });
      } else {
        existing.clients.add(client.clientId);
        existing.totalQuantity += row.quantity;
        existing.totalInvested += row.totalInvested;
        existing.currentValue += row.currentHoldingValue;
      }
    }
  }

  const stockBreakdown: BrokerStockBreakdown[] = Array.from(stockMap.values())
    .map((s) => {
      const totalPnl = s.currentValue - s.totalInvested;
      const totalPnlPct = s.totalInvested > 0 ? (totalPnl / s.totalInvested) * 100 : 0;
      return {
        symbol: s.symbol,
        stockName: s.stockName,
        clientsCount: s.clients.size,
        totalQuantity: s.totalQuantity,
        totalInvested: s.totalInvested,
        currentValue: s.currentValue,
        totalPnl,
        totalPnlPct,
        latestMarketPrice: s.latestMarketPrice,
        latestPriceDate: s.latestPriceDate,
      };
    })
    .sort((a, b) => b.currentValue - a.currentValue);

  const overallPnl = overallCurrentValue - overallInvested;
  const overallPnlPct = overallInvested > 0 ? (overallPnl / overallInvested) * 100 : 0;
  const ds = loadDatasets();

  return {
    valuationLabel: `Historical Close (through ${ds.validation.combinedDateRange.end})`,
    overallInvested,
    overallCurrentValue,
    overallPnl,
    overallPnlPct,
    clientsCount: clientSummaries.length,
    holdingsCount: holdings.length,
    holdings,
    stockBreakdown,
    clientSummaries,
  };
}

function hydrateRequests(whereClause: string, params: unknown[]): ClientRequestItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT r.id, r.client_id, r.broker_id, r.category, r.symbol, r.message, r.status, r.created_at, r.updated_at,
              cu.user_code as client_code, cu.name as client_name, cu.email as client_email,
              bu.name as broker_name
       FROM client_requests r
       JOIN users cu ON cu.id = r.client_id
       JOIN users bu ON bu.id = r.broker_id
       ${whereClause}
       ORDER BY r.updated_at DESC, r.created_at DESC`,
    )
    .all(...(params as string[])) as Array<{
    id: string;
    client_id: string;
    broker_id: string;
    category: string;
    symbol: string | null;
    message: string;
    status: ClientRequestStatus;
    created_at: string;
    updated_at: string;
    client_code: string;
    client_name: string;
    client_email: string;
    broker_name: string;
  }>;

  const respStmt = db.prepare(
    `SELECT rr.id, rr.request_id, rr.broker_id, u.name as broker_name, rr.response_text, rr.created_at
     FROM request_responses rr
     JOIN users u ON u.id = rr.broker_id
     WHERE rr.request_id = ?
     ORDER BY rr.created_at ASC`,
  );

  return rows.map((r) => {
    const responses = (
      respStmt.all(r.id) as Array<{
        id: string;
        request_id: string;
        broker_id: string;
        broker_name: string;
        response_text: string;
        created_at: string;
      }>
    ).map(
      (rr): RequestResponseItem => ({
        id: rr.id,
        requestId: rr.request_id,
        brokerId: rr.broker_id,
        brokerName: rr.broker_name,
        responseText: rr.response_text,
        createdAt: rr.created_at,
      }),
    );

    const snap = getInvestorSnapshot(r.client_id);

    return {
      id: r.id,
      clientId: r.client_id,
      clientUserCode: r.client_code,
      clientName: r.client_name,
      clientEmail: r.client_email,
      brokerId: r.broker_id,
      brokerName: r.broker_name,
      category: r.category,
      symbol: r.symbol,
      message: r.message,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      responses,
      clientTotalInvested: snap.totalInvested,
      clientPortfolioValue: snap.totalMarketValue,
      clientPnlPct: snap.totalUnrealizedPnlPct,
    };
  });
}

export function createInvestorRequest(params: {
  clientId: string;
  category: string;
  symbol?: string | null;
  message: string;
}): { ok: true; request: ClientRequestItem } | { ok: false; status: number; error: string } {
  const message = params.message.trim();
  if (!message || message.length < 4) {
    return { ok: false, status: 400, error: 'Request question must be at least 4 characters.' };
  }

  const conn = getInvestorBrokerConnection(params.clientId);
  if (!conn.linked || !conn.brokerId) {
    return {
      ok: false,
      status: 400,
      error: 'No Broker / Quant advisor is linked to your account yet. Link a Broker ID (e.g. BRK-QUANT-01) in Profile first.',
    };
  }

  const symbol = params.symbol ? params.symbol.trim().toUpperCase() : null;
  if (symbol) {
    const ds = loadDatasets();
    if (!ds.combinedBySymbol.has(symbol)) {
      return { ok: false, status: 400, error: `Unknown stock symbol "${symbol}".` };
    }
  }

  const id = `REQ-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const now = new Date().toISOString();
  const db = getDb();

  db.prepare(
    `INSERT INTO client_requests (id, client_id, broker_id, category, symbol, message, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?, ?)`,
  ).run(id, params.clientId, conn.brokerId, params.category.trim() || 'Stock Analysis', symbol, message, now, now);

  const created = hydrateRequests('WHERE r.id = ?', [id])[0];
  return { ok: true, request: created };
}

export function listInvestorRequests(clientId: string): ClientRequestItem[] {
  return hydrateRequests('WHERE r.client_id = ?', [clientId]);
}

export function listBrokerRequests(brokerId: string): ClientRequestItem[] {
  return hydrateRequests('WHERE r.broker_id = ?', [brokerId]);
}

export function updateBrokerRequestStatus(params: {
  brokerId: string;
  requestId: string;
  status: ClientRequestStatus;
}): { ok: true; request: ClientRequestItem } | { ok: false; status: number; error: string } {
  const allowed: ClientRequestStatus[] = ['Pending', 'Under Review', 'Responded', 'Closed'];
  if (!allowed.includes(params.status)) {
    return { ok: false, status: 400, error: 'Invalid request status.' };
  }

  const db = getDb();
  const existing = db
    .prepare('SELECT id, broker_id FROM client_requests WHERE id = ?')
    .get(params.requestId) as { id: string; broker_id: string } | undefined;

  if (!existing) {
    return { ok: false, status: 404, error: 'Client request not found.' };
  }
  if (existing.broker_id !== params.brokerId) {
    return { ok: false, status: 403, error: 'Forbidden: this request belongs to another broker.' };
  }

  db.prepare('UPDATE client_requests SET status = ?, updated_at = ? WHERE id = ?').run(
    params.status,
    new Date().toISOString(),
    params.requestId,
  );

  return { ok: true, request: hydrateRequests('WHERE r.id = ?', [params.requestId])[0] };
}

export function respondToClientRequest(params: {
  brokerId: string;
  requestId: string;
  responseText: string;
}): { ok: true; request: ClientRequestItem } | { ok: false; status: number; error: string } {
  const responseText = params.responseText.trim();
  if (!responseText) {
    return { ok: false, status: 400, error: 'Response text cannot be empty.' };
  }

  const db = getDb();
  const existing = db
    .prepare('SELECT id, broker_id FROM client_requests WHERE id = ?')
    .get(params.requestId) as { id: string; broker_id: string } | undefined;

  if (!existing) {
    return { ok: false, status: 404, error: 'Client request not found.' };
  }
  if (existing.broker_id !== params.brokerId) {
    return { ok: false, status: 403, error: 'Forbidden: you cannot respond to another broker’s client request.' };
  }

  const now = new Date().toISOString();
  const respId = `RESP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  db.prepare(
    `INSERT INTO request_responses (id, request_id, broker_id, response_text, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(respId, params.requestId, params.brokerId, responseText, now);

  db.prepare(`UPDATE client_requests SET status = 'Responded', updated_at = ? WHERE id = ?`).run(
    now,
    params.requestId,
  );

  return { ok: true, request: hydrateRequests('WHERE r.id = ?', [params.requestId])[0] };
}

function hydrateAdviceRows(whereClause: string, params: unknown[]): ExpertAdviceItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT a.*, cu.user_code as client_code, cu.name as client_name,
              bu.user_code as broker_code, bu.name as broker_name
       FROM expert_advice a
       JOIN users cu ON cu.id = a.client_id
       JOIN users bu ON bu.id = a.broker_id
       ${whereClause}
       ORDER BY a.generated_at DESC`,
    )
    .all(...(params as string[])) as Array<{
    id: string;
    client_id: string;
    broker_id: string;
    request_id: string | null;
    symbol: string | null;
    category: string;
    analysis: string;
    recommendation: string;
    supporting_metrics_json: string;
    risk_level: 'Low' | 'Moderate' | 'Elevated' | 'High';
    disclaimer: string;
    status: 'Draft' | 'Sent' | 'Read';
    generated_at: string;
    sent_at: string | null;
    read_at: string | null;
    client_code: string;
    client_name: string;
    broker_code: string;
    broker_name: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    clientId: r.client_id,
    clientUserCode: r.client_code,
    clientName: r.client_name,
    brokerId: r.broker_id,
    brokerUserCode: r.broker_code,
    brokerName: r.broker_name,
    requestId: r.request_id,
    symbol: r.symbol,
    category: r.category,
    analysis: r.analysis,
    recommendation: r.recommendation,
    supportingMetrics: JSON.parse(r.supporting_metrics_json) as AdviceSupportingMetrics,
    riskLevel: r.risk_level,
    disclaimer: r.disclaimer,
    status: r.status,
    generatedAt: r.generated_at,
    sentAt: r.sent_at,
    readAt: r.read_at,
    language: 'en',
  }));
}

export function buildAdviceQuantitativeContext(params: {
  clientId: string;
  symbol?: string | null;
}): {
  chosenSymbol: string | null;
  metrics: AdviceSupportingMetrics;
  riskLevel: 'Low' | 'Moderate' | 'Elevated' | 'High';
  deterministicAnalysis: string;
  deterministicRecommendation: string;
} {
  const snap = getInvestorSnapshot(params.clientId);
  const ds = loadDatasets();
  const explicitSymbol = params.symbol ? params.symbol.trim().toUpperCase() : null;
  const fallbackSymbol =
    snap.holdings.length > 0
      ? [...snap.holdings].sort((a, b) => b.marketValue - a.marketValue)[0].symbol
      : 'RELIANCE';
  const chosenSymbol = explicitSymbol || fallbackSymbol;

  const ohlcv = ds.combinedBySymbol.get(chosenSymbol) ?? [];
  const feats = ds.featuresBySymbol.get(chosenSymbol) ?? [];
  const latestOhlcv = ohlcv[ohlcv.length - 1];
  const prevOhlcv = ohlcv.length >= 2 ? ohlcv[ohlcv.length - 2] : null;
  const latestFeat = feats[feats.length - 1];
  const valuationDate = latestOhlcv?.date ?? ds.validation.combinedDateRange.end;

  const dailyReturnPct =
    latestOhlcv && prevOhlcv && prevOhlcv.close > 0
      ? ((latestOhlcv.close - prevOhlcv.close) / prevOhlcv.close) * 100
      : latestFeat
        ? latestFeat.daily_return * 100
        : null;

  const pred = mlStore.predictLatest(chosenSymbol, undefined, 0.75);
  const garch = mlStore.getGarch(chosenSymbol);
  const risk =
    latestOhlcv && latestFeat
      ? calculateRiskMetrics({
          symbol: chosenSymbol,
          entryPrice: latestOhlcv.close,
          atr14: latestFeat.atr_14,
        })
      : null;

  const holding = snap.holdings.find((h) => h.symbol === chosenSymbol) ?? null;
  const holdingAllocationPct =
    holding && snap.totalMarketValue > 0 ? (holding.marketValue / snap.totalMarketValue) * 100 : null;

  const riskLevel = risk?.volatilityCategory ?? 'Moderate';

  const metrics: AdviceSupportingMetrics = {
    symbol: chosenSymbol,
    valuationDate,
    latestClose: latestOhlcv?.close ?? null,
    dailyReturnPct,
    rsi14: latestFeat?.rsi_14 ?? null,
    sma20: latestFeat?.sma_20 ?? null,
    sma50: latestFeat?.sma_50 ?? null,
    ema12: latestFeat?.ema_12 ?? null,
    ema26: latestFeat?.ema_26 ?? null,
    macd: latestFeat?.macd ?? null,
    macdSignal: latestFeat?.macd_signal ?? null,
    atr14: latestFeat?.atr_14 ?? null,
    garchAnnualVolPct: garch.fitted ? garch.nextDayForecastAnnualVolPct : null,
    mlModelTrained: pred.modelTrained,
    mlModelName: pred.modelName,
    mlSignal: pred.signal,
    mlBuyProbability: pred.buyProbability,
    clientPortfolioValue: snap.totalMarketValue,
    clientTotalInvested: snap.totalInvested,
    clientUnrealizedPnl: snap.totalUnrealizedPnl,
    clientUnrealizedPnlPct: snap.totalUnrealizedPnlPct,
    holdingQuantity: holding?.quantity ?? null,
    holdingAvgBuyPrice: holding?.avgBuyPrice ?? null,
    holdingAllocationPct,
    holdingPnlPct: holding?.unrealizedPnlPct ?? null,
  };

  const rsiDesc =
    metrics.rsi14 !== null
      ? metrics.rsi14 >= 70
        ? `RSI(14) at ${metrics.rsi14.toFixed(1)} reflects overbought short-term momentum`
        : metrics.rsi14 <= 30
          ? `RSI(14) at ${metrics.rsi14.toFixed(1)} indicates oversold mean-reversion territory`
          : `RSI(14) at ${metrics.rsi14.toFixed(1)} shows neutral momentum`
      : 'RSI(14) data unavailable';

  const trendDesc =
    metrics.sma20 !== null && metrics.sma50 !== null && metrics.latestClose !== null
      ? metrics.latestClose > metrics.sma20 && metrics.sma20 > metrics.sma50
        ? `Price (₹${metrics.latestClose.toFixed(2)}) trades above both SMA-20 (₹${metrics.sma20.toFixed(2)}) and SMA-50 (₹${metrics.sma50.toFixed(2)}), confirming constructive medium-term trend alignment`
        : metrics.latestClose < metrics.sma20 && metrics.sma20 < metrics.sma50
          ? `Price (₹${metrics.latestClose.toFixed(2)}) trades below SMA-20 (₹${metrics.sma20.toFixed(2)}) and SMA-50 (₹${metrics.sma50.toFixed(2)}), signaling downward trend pressure`
          : `Price (₹${metrics.latestClose.toFixed(2)}) shows mixed trend crossover near SMA-20 (₹${metrics.sma20.toFixed(2)}) and SMA-50 (₹${metrics.sma50.toFixed(2)})`
      : 'Moving average trend unavailable';

  const mlLine = metrics.mlModelTrained
    ? `Trained ${metrics.mlModelName} signals ${metrics.mlSignal} (${((metrics.mlBuyProbability ?? 0) * 100).toFixed(1)}% next-session BUY probability).`
    : `No ML classifier has been trained for ${chosenSymbol} yet; technical indicators and volatility metrics are used directly without fabricating ML scores.`;

  const volLine =
    metrics.atr14 !== null && risk
      ? `ATR(14) is ₹${metrics.atr14.toFixed(2)} (${risk.atrPctOfPrice.toFixed(2)}% of price, ${riskLevel} volatility), implying a 1.5x ATR reference stop-loss near ₹${risk.stopLoss.toFixed(2)}${metrics.garchAnnualVolPct !== null ? ` and GARCH(1,1) annualized forecast volatility of ${metrics.garchAnnualVolPct.toFixed(1)}%` : ''}.`
      : '';

  const portfolioLine = holding
    ? `Client currently holds ${holding.quantity} shares of ${chosenSymbol} at avg ₹${holding.avgBuyPrice.toFixed(2)} (${holding.unrealizedPnlPct >= 0 ? '+' : ''}${holding.unrealizedPnlPct.toFixed(2)}% P&L), representing ${(holdingAllocationPct ?? 0).toFixed(1)}% of their ₹${snap.totalMarketValue.toFixed(0)} tracked equity portfolio.`
    : `Client currently holds ${snap.holdings.length} positions totaling ₹${snap.totalMarketValue.toFixed(0)} (${snap.totalUnrealizedPnlPct >= 0 ? '+' : ''}${snap.totalUnrealizedPnlPct.toFixed(2)}% overall P&L) and has no active ${chosenSymbol} position.`;

  const deterministicAnalysis = `${chosenSymbol} quantitative review using verified historical NSE close on ${valuationDate}: ${trendDesc}. ${rsiDesc}. ${mlLine} ${volLine} ${portfolioLine}`;

  let deterministicRecommendation = '';
  if (holding && (holdingAllocationPct ?? 0) > 45) {
    deterministicRecommendation = `Position concentration in ${chosenSymbol} is elevated (${(holdingAllocationPct ?? 0).toFixed(1)}% of portfolio). Consider disciplined rebalancing toward diversified NIFTY 50 sectors and review stop-loss protection${risk ? ` near ₹${risk.stopLoss.toFixed(2)}` : ''}.`;
  } else if (metrics.mlModelTrained && metrics.mlSignal === 'BUY' && (metrics.rsi14 ?? 50) < 68) {
    deterministicRecommendation = `Maintain a constructive stance on ${chosenSymbol} with strict position sizing (max 1.5% capital risk per trade${risk ? `, reference stop ₹${risk.stopLoss.toFixed(2)}` : ''}).`;
  } else if (metrics.mlModelTrained && metrics.mlSignal === 'SELL') {
    deterministicRecommendation = `Exercise caution on ${chosenSymbol}; model probability favors defensive positioning or tightening trailing stops${risk ? ` around ₹${risk.stopLoss.toFixed(2)}` : ''}.`;
  } else {
    deterministicRecommendation = `Maintain balanced HOLD/monitoring discipline on ${chosenSymbol} while tracking RSI(14) and SMA-20/50 crossovers${risk ? ` with ATR risk anchor at ₹${risk.stopLoss.toFixed(2)}` : ''}.`;
  }

  return {
    chosenSymbol,
    metrics,
    riskLevel,
    deterministicAnalysis,
    deterministicRecommendation,
  };
}

export async function generateExpertAdviceForClient(params: {
  brokerId: string;
  clientId: string;
  symbol?: string | null;
  requestId?: string | null;
  category?: string;
}): Promise<{ ok: true; advice: ExpertAdviceItem } | { ok: false; status: number; error: string }> {
  if (!isClientLinkedToBroker(params.brokerId, params.clientId)) {
    return {
      ok: false,
      status: 403,
      error: 'Forbidden: this investor is not linked to your Broker / Quant account.',
    };
  }

  let effectiveSymbol = params.symbol ? params.symbol.trim().toUpperCase() : null;
  let requestMessage: string | null = null;
  const db = getDb();

  if (params.requestId) {
    const reqRow = db
      .prepare('SELECT id, client_id, broker_id, symbol, message FROM client_requests WHERE id = ?')
      .get(params.requestId) as
      | { id: string; client_id: string; broker_id: string; symbol: string | null; message: string }
      | undefined;
    if (!reqRow || reqRow.broker_id !== params.brokerId || reqRow.client_id !== params.clientId) {
      return { ok: false, status: 404, error: 'Linked client request not found.' };
    }
    if (!effectiveSymbol && reqRow.symbol) {
      effectiveSymbol = reqRow.symbol;
    }
    requestMessage = reqRow.message;
  }

  if (effectiveSymbol) {
    const ds = loadDatasets();
    if (!ds.combinedBySymbol.has(effectiveSymbol)) {
      return { ok: false, status: 400, error: `Unknown NIFTY symbol "${effectiveSymbol}".` };
    }
  }

  const ctx = buildAdviceQuantitativeContext({
    clientId: params.clientId,
    symbol: effectiveSymbol,
  });

  let analysis = ctx.deterministicAnalysis;
  let recommendation = ctx.deterministicRecommendation;

  if (hasConfiguredGeminiKey()) {
    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
      const prompt = `You are a quantitative equity research analyst assisting a broker drafting an educational portfolio review.
Strictly use ONLY the verified numbers below (historical NSE data ending ${ctx.metrics.valuationDate}; do NOT invent prices, dates, or untrained ML predictions).
${requestMessage ? `Client question: "${requestMessage}"` : ''}
Verified context JSON:
${JSON.stringify(ctx.metrics)}

Return ONLY valid JSON with two keys:
{
  "analysis": "2-4 clear sentences citing the actual closing price, RSI, SMA trend, ML status, ATR/GARCH volatility, and client portfolio concentration.",
  "recommendation": "1-2 actionable educational risk-management sentences tailored to the portfolio and risk level (${ctx.riskLevel})."
}`;
      const resp = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
      });
      const raw = (resp.text ?? '').trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(raw) as { analysis?: string; recommendation?: string };
      if (parsed.analysis && parsed.recommendation) {
        analysis = parsed.analysis.trim();
        recommendation = parsed.recommendation.trim();
      }
    } catch {
      // keep deterministic quantitative advice
    }
  }

  const id = `ADV-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO expert_advice
      (id, client_id, broker_id, request_id, symbol, category, analysis, recommendation,
       supporting_metrics_json, risk_level, disclaimer, status, generated_at, sent_at, read_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?, NULL, NULL)`,
  ).run(
    id,
    params.clientId,
    params.brokerId,
    params.requestId ?? null,
    ctx.chosenSymbol,
    params.category?.trim() || (params.requestId ? 'Request Advisory' : 'Portfolio & Risk Review'),
    analysis,
    recommendation,
    JSON.stringify(ctx.metrics),
    ctx.riskLevel,
    ADVICE_DISCLAIMER_EN,
    now,
  );

  return { ok: true, advice: hydrateAdviceRows('WHERE a.id = ?', [id])[0] };
}

export function sendExpertAdvice(
  brokerId: string,
  adviceId: string,
): { ok: true; advice: ExpertAdviceItem } | { ok: false; status: number; error: string } {
  const db = getDb();
  const row = db
    .prepare('SELECT id, broker_id, status FROM expert_advice WHERE id = ?')
    .get(adviceId) as { id: string; broker_id: string; status: string } | undefined;

  if (!row) return { ok: false, status: 404, error: 'Expert advice record not found.' };
  if (row.broker_id !== brokerId) {
    return { ok: false, status: 403, error: 'Forbidden: you cannot send another broker’s advice.' };
  }

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE expert_advice
     SET status = CASE WHEN status = 'Draft' THEN 'Sent' ELSE status END,
         sent_at = COALESCE(sent_at, ?)
     WHERE id = ?`,
  ).run(now, adviceId);

  return { ok: true, advice: hydrateAdviceRows('WHERE a.id = ?', [adviceId])[0] };
}

export function updateExpertAdviceDraft(params: {
  brokerId: string;
  adviceId: string;
  analysis?: string;
  recommendation?: string;
}): { ok: true; advice: ExpertAdviceItem } | { ok: false; status: number; error: string } {
  const db = getDb();
  const row = db
    .prepare('SELECT id, broker_id, analysis, recommendation FROM expert_advice WHERE id = ?')
    .get(params.adviceId) as
    | { id: string; broker_id: string; analysis: string; recommendation: string }
    | undefined;
  if (!row) return { ok: false, status: 404, error: 'Advice not found.' };
  if (row.broker_id !== params.brokerId) return { ok: false, status: 403, error: 'Forbidden.' };

  const analysis = params.analysis?.trim() || row.analysis;
  const recommendation = params.recommendation?.trim() || row.recommendation;
  db.prepare('UPDATE expert_advice SET analysis = ?, recommendation = ? WHERE id = ?').run(
    analysis,
    recommendation,
    params.adviceId,
  );
  return { ok: true, advice: hydrateAdviceRows('WHERE a.id = ?', [params.adviceId])[0] };
}

export function listBrokerAdvice(brokerId: string): ExpertAdviceItem[] {
  return hydrateAdviceRows('WHERE a.broker_id = ?', [brokerId]);
}

export async function listInvestorAdvice(
  clientId: string,
  lang: LanguageCode = 'en',
): Promise<ExpertAdviceItem[]> {
  const rows = hydrateAdviceRows(`WHERE a.client_id = ? AND a.status IN ('Sent', 'Read')`, [clientId]);
  if (lang === 'en' || rows.length === 0) return rows;

  const textsToTranslate: string[] = [];
  for (const r of rows) {
    textsToTranslate.push(r.category, r.analysis, r.recommendation, r.disclaimer);
  }
  const translated = await translateFinancialTexts(textsToTranslate, lang);

  return rows.map((r, idx) => {
    const base = idx * 4;
    return {
      ...r,
      category: translated[base]?.text || r.category,
      analysis: translated[base + 1]?.text || r.analysis,
      recommendation: translated[base + 2]?.text || r.recommendation,
      disclaimer: translated[base + 3]?.text || r.disclaimer,
      language: lang,
    };
  });
}

export function markAdviceAsRead(
  clientId: string,
  adviceId: string,
): { ok: true; advice: ExpertAdviceItem } | { ok: false; status: number; error: string } {
  const db = getDb();
  const row = db
    .prepare('SELECT id, client_id, status FROM expert_advice WHERE id = ?')
    .get(adviceId) as { id: string; client_id: string; status: string } | undefined;

  if (!row) return { ok: false, status: 404, error: 'Advice record not found.' };
  if (row.client_id !== clientId) {
    return { ok: false, status: 403, error: 'Forbidden: this advice belongs to another investor.' };
  }
  if (row.status === 'Draft') {
    return { ok: false, status: 403, error: 'Draft advice has not been published by your broker yet.' };
  }

  db.prepare(
    `UPDATE expert_advice SET status = 'Read', read_at = COALESCE(read_at, ?) WHERE id = ?`,
  ).run(new Date().toISOString(), adviceId);

  return { ok: true, advice: hydrateAdviceRows('WHERE a.id = ?', [adviceId])[0] };
}

export function listBrokerConversations(brokerId: string): BrokerConversationSummary[] {
  const db = getDb();
  const clients = listBrokerClients(brokerId);
  return clients.map((c) => {
    const latest = db
      .prepare(
        `SELECT message_text, created_at
         FROM broker_messages
         WHERE broker_id = ? AND client_id = ?
         ORDER BY created_at DESC, rowid DESC
         LIMIT 1`,
      )
      .get(brokerId, c.clientId) as { message_text: string; created_at: string } | undefined;

    return {
      clientId: c.clientId,
      clientUserCode: c.userCode,
      clientName: c.name,
      clientEmail: c.email,
      lastMessage: latest?.message_text ?? null,
      lastMessageAt: latest?.created_at ?? null,
      unreadCount: c.unreadMessagesCount,
    };
  });
}

export function getConversationMessages(params: {
  brokerId: string;
  clientId: string;
  readerUserId: string;
}): BrokerMessageItem[] {
  const db = getDb();
  // Mark opposite party's messages as read when opened
  db.prepare(
    `UPDATE broker_messages
     SET is_read = 1
     WHERE broker_id = ? AND client_id = ? AND sender_id != ? AND is_read = 0`,
  ).run(params.brokerId, params.clientId, params.readerUserId);

  const rows = db
    .prepare(
      `SELECT m.id, m.broker_id, m.client_id, m.sender_id, m.sender_role, u.name as sender_name,
              m.message_text, m.is_read, m.created_at
       FROM broker_messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.broker_id = ? AND m.client_id = ?
       ORDER BY m.created_at ASC, m.rowid ASC`,
    )
    .all(params.brokerId, params.clientId) as Array<{
    id: string;
    broker_id: string;
    client_id: string;
    sender_id: string;
    sender_role: UserRole;
    sender_name: string;
    message_text: string;
    is_read: number;
    created_at: string;
  }>;

  return rows.map((m) => ({
    id: m.id,
    brokerId: m.broker_id,
    clientId: m.client_id,
    senderId: m.sender_id,
    senderRole: m.sender_role,
    senderName: m.sender_name,
    messageText: m.message_text,
    isRead: Boolean(m.is_read),
    createdAt: m.created_at,
  }));
}

export function sendBrokerClientMessage(params: {
  brokerId: string;
  clientId: string;
  senderId: string;
  senderRole: UserRole;
  messageText: string;
}): { ok: true; message: BrokerMessageItem; messages: BrokerMessageItem[] } | { ok: false; status: number; error: string } {
  const text = params.messageText.trim();
  if (!text) {
    return { ok: false, status: 400, error: 'Message text cannot be empty.' };
  }
  if (!isClientLinkedToBroker(params.brokerId, params.clientId)) {
    return { ok: false, status: 403, error: 'Forbidden: no active broker-client link exists.' };
  }

  const db = getDb();
  const id = `MSG-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO broker_messages (id, broker_id, client_id, sender_id, sender_role, message_text, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
  ).run(id, params.brokerId, params.clientId, params.senderId, params.senderRole, text, now);

  const messages = getConversationMessages({
    brokerId: params.brokerId,
    clientId: params.clientId,
    readerUserId: params.senderId,
  });
  const created = messages.find((m) => m.id === id)!;
  return { ok: true, message: created, messages };
}

export function getBrokerClientDetail(brokerId: string, clientId: string): BrokerClientDetail | null {
  if (!isClientLinkedToBroker(brokerId, clientId)) {
    return null;
  }
  const client = listBrokerClients(brokerId).find((c) => c.clientId === clientId);
  if (!client) return null;

  const snap = getInvestorSnapshot(clientId);
  const holdings = buildClientHoldingRows(clientId, client.name, client.userCode);
  const orders = listInvestorOrders(clientId);
  const requests = hydrateRequests('WHERE r.broker_id = ? AND r.client_id = ?', [brokerId, clientId]);
  const advice = hydrateAdviceRows('WHERE a.broker_id = ? AND a.client_id = ?', [brokerId, clientId]);
  const messages = getConversationMessages({ brokerId, clientId, readerUserId: brokerId });

  return {
    client,
    holdings,
    watchlist: snap.watchlist,
    orders,
    requests,
    advice,
    messages,
  };
}
