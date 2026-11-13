import { loadDatasets } from './dataLoader.ts';
import { getDb } from './db.ts';
import type {
  HoldingPosition,
  OrderRecord,
  PortfolioSnapshot,
  PracticeBehavioralAnalytics,
  PracticeHoldingsHealth,
  PracticeIntelligenceData,
  PracticeSimulatedOrderResult,
  PracticeStressScenario,
  TradeRecord,
} from './types.ts';

export const STARTING_VIRTUAL_CAPITAL = 1000000; // ₹10,00,000
const DEFAULT_PRACTICE_USER_ID = 'usr-practice-01';

function ensurePracticeAccount(userId: string, dbPath?: string): void {
  const db = getDb(dbPath);
  const existing = db
    .prepare('SELECT user_id FROM practice_accounts WHERE user_id = ?')
    .get(userId) as { user_id: string } | undefined;

  if (!existing) {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO practice_accounts (user_id, starting_capital, cash_balance, realized_pnl, updated_at)
       VALUES (?, ?, ?, 0, ?)`,
    ).run(userId, STARTING_VIRTUAL_CAPITAL, STARTING_VIRTUAL_CAPITAL, now);
    db.prepare(
      `INSERT INTO practice_equity_history (user_id, timestamp, portfolio_value, cash_balance)
       VALUES (?, ?, ?, ?)`,
    ).run(userId, now, STARTING_VIRTUAL_CAPITAL, STARTING_VIRTUAL_CAPITAL);
  }
}

export function getPortfolioSnapshot(
  userId = DEFAULT_PRACTICE_USER_ID,
  dbPath?: string,
): PortfolioSnapshot {
  ensurePracticeAccount(userId, dbPath);
  const db = getDb(dbPath);
  const dataset = loadDatasets();
  const nameMap = new Map(dataset.catalog.map((c) => [c.symbol, c.name]));

  const acct = db
    .prepare(
      `SELECT starting_capital, cash_balance, realized_pnl
       FROM practice_accounts WHERE user_id = ?`,
    )
    .get(userId) as {
    starting_capital: number;
    cash_balance: number;
    realized_pnl: number;
  };

  const holdingRows = db
    .prepare(
      `SELECT symbol, quantity, avg_buy_price
       FROM practice_holdings WHERE user_id = ? AND quantity > 0`,
    )
    .all(userId) as Array<{ symbol: string; quantity: number; avg_buy_price: number }>;

  let holdingsMarketValue = 0;
  let unrealizedPnl = 0;
  const rawHoldings: Array<Omit<HoldingPosition, 'allocationPct'>> = [];

  for (const pos of holdingRows) {
    const ohlcv = dataset.combinedBySymbol.get(pos.symbol);
    const feat = dataset.featuresBySymbol.get(pos.symbol);
    const latestBar = ohlcv?.[ohlcv.length - 1];
    const latestFeat = feat?.[feat.length - 1];
    const currentPrice = latestBar?.close ?? pos.avg_buy_price;
    const latestDate = latestBar?.date ?? dataset.validation.combinedDateRange.end;
    const atr14 = latestFeat?.atr_14 ?? currentPrice * 0.02;

    const investedValue = pos.quantity * pos.avg_buy_price;
    const marketValue = pos.quantity * currentPrice;
    const posUnrealized = marketValue - investedValue;
    const posUnrealizedPct = investedValue > 0 ? (posUnrealized / investedValue) * 100 : 0;

    holdingsMarketValue += marketValue;
    unrealizedPnl += posUnrealized;

    rawHoldings.push({
      symbol: pos.symbol,
      name: nameMap.get(pos.symbol) ?? pos.symbol,
      quantity: pos.quantity,
      avgBuyPrice: pos.avg_buy_price,
      currentPrice,
      latestPriceDate: latestDate,
      investedValue,
      marketValue,
      unrealizedPnl: posUnrealized,
      unrealizedPnlPct: posUnrealizedPct,
      atr14,
      suggestedStopLoss: Math.max(0.01, currentPrice - 1.5 * atr14),
    });
  }

  const totalPortfolioValue = acct.cash_balance + holdingsMarketValue;
  const holdings: HoldingPosition[] = rawHoldings
    .map((h) => ({
      ...h,
      allocationPct: totalPortfolioValue > 0 ? (h.marketValue / totalPortfolioValue) * 100 : 0,
    }))
    .sort((a, b) => b.marketValue - a.marketValue);

  const orders = (
    db
      .prepare(
        `SELECT id, timestamp, dataset_price_date, symbol, side, order_type, quantity,
                requested_price, executed_price, total_value, status, note
         FROM practice_orders
         WHERE user_id = ?
         ORDER BY rowid DESC
         LIMIT 200`,
      )
      .all(userId) as Array<{
      id: string;
      timestamp: string;
      dataset_price_date: string;
      symbol: string;
      side: 'BUY' | 'SELL';
      order_type: 'MARKET' | 'LIMIT';
      quantity: number;
      requested_price: number;
      executed_price: number;
      total_value: number;
      status: 'EXECUTED' | 'PENDING' | 'CANCELLED' | 'REJECTED';
      note: string;
    }>
  ).map((o) => ({
    id: o.id,
    timestamp: o.timestamp,
    datasetPriceDate: o.dataset_price_date,
    symbol: o.symbol,
    side: o.side,
    orderType: o.order_type,
    quantity: o.quantity,
    requestedPrice: o.requested_price,
    executedPrice: o.executed_price,
    totalValue: o.total_value,
    status: o.status,
    note: o.note,
  }));

  const trades = (
    db
      .prepare(
        `SELECT id, timestamp, dataset_price_date, symbol, side, quantity, price, total_value, realized_pnl
         FROM practice_trades
         WHERE user_id = ?
         ORDER BY rowid DESC
         LIMIT 200`,
      )
      .all(userId) as Array<{
      id: string;
      timestamp: string;
      dataset_price_date: string;
      symbol: string;
      side: 'BUY' | 'SELL';
      quantity: number;
      price: number;
      total_value: number;
      realized_pnl: number;
    }>
  ).map((t) => ({
    id: t.id,
    timestamp: t.timestamp,
    datasetPriceDate: t.dataset_price_date,
    symbol: t.symbol,
    side: t.side,
    quantity: t.quantity,
    price: t.price,
    totalValue: t.total_value,
    realizedPnl: t.realized_pnl,
  }));

  const equityHistory = (
    db
      .prepare(
        `SELECT timestamp, portfolio_value, cash_balance
         FROM practice_equity_history
         WHERE user_id = ?
         ORDER BY id ASC
         LIMIT 200`,
      )
      .all(userId) as Array<{
      timestamp: string;
      portfolio_value: number;
      cash_balance: number;
    }>
  ).map((e) => ({
    timestamp: e.timestamp,
    portfolioValue: e.portfolio_value,
    cashBalance: e.cash_balance,
  }));

  const totalPnl = acct.realized_pnl + unrealizedPnl;
  const totalReturnPct = (totalPnl / acct.starting_capital) * 100;

  return {
    startingCapital: acct.starting_capital,
    cashBalance: acct.cash_balance,
    holdingsMarketValue,
    totalPortfolioValue,
    realizedPnl: acct.realized_pnl,
    unrealizedPnl,
    totalPnl,
    totalReturnPct,
    holdings,
    orders,
    trades,
    equityHistory,
  };
}

export function executeSimulatedOrder(
  params: {
    userId?: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    orderType: 'MARKET' | 'LIMIT';
    quantity: number;
    limitPrice?: number;
  },
  dbPath?: string,
): { ok: true; order: OrderRecord; portfolio: PortfolioSnapshot } | { ok: false; error: string } {
  const userId = params.userId || DEFAULT_PRACTICE_USER_ID;
  ensurePracticeAccount(userId, dbPath);
  const db = getDb(dbPath);

  const symbol = params.symbol.trim().toUpperCase();
  const dataset = loadDatasets();
  const rows = dataset.combinedBySymbol.get(symbol);

  if (!rows || rows.length === 0) {
    return { ok: false, error: `Stock symbol "${symbol}" was not found in the NIFTY 50 dataset.` };
  }

  const rawQty = Number(params.quantity);
  if (!Number.isFinite(rawQty) || !Number.isInteger(rawQty) || rawQty <= 0) {
    return { ok: false, error: 'Order quantity must be a positive whole number.' };
  }
  const qty = rawQty;

  const latestBar = rows[rows.length - 1];
  const marketPrice = latestBar.close;
  const priceDate = latestBar.date;

  let executionPrice = marketPrice;
  if (params.orderType === 'LIMIT') {
    const lp = Number(params.limitPrice);
    if (!Number.isFinite(lp) || lp <= 0) {
      return { ok: false, error: 'Limit price must be a valid positive number.' };
    }
    executionPrice = lp;
  }

  const acct = db
    .prepare('SELECT cash_balance, realized_pnl FROM practice_accounts WHERE user_id = ?')
    .get(userId) as { cash_balance: number; realized_pnl: number };

  const heldRow = db
    .prepare('SELECT quantity, avg_buy_price FROM practice_holdings WHERE user_id = ? AND symbol = ?')
    .get(userId, symbol) as { quantity: number; avg_buy_price: number } | undefined;

  const now = new Date().toISOString();
  const orderId = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;

  if (params.orderType === 'LIMIT') {
    const canFillImmediately =
      (params.side === 'BUY' && executionPrice >= marketPrice) ||
      (params.side === 'SELL' && executionPrice <= marketPrice);

    if (!canFillImmediately) {
      if (params.side === 'BUY' && qty * executionPrice > acct.cash_balance) {
        return {
          ok: false,
          error: `Insufficient virtual cash (₹${acct.cash_balance.toFixed(2)}) for limit BUY order worth ₹${(qty * executionPrice).toFixed(2)}.`,
        };
      }
      const heldQty = heldRow?.quantity ?? 0;
      if (params.side === 'SELL' && qty > heldQty) {
        return {
          ok: false,
          error: `Insufficient ${symbol} holdings (${heldQty} shares available to sell).`,
        };
      }

      const pendingOrder: OrderRecord = {
        id: orderId,
        timestamp: now,
        datasetPriceDate: priceDate,
        symbol,
        side: params.side,
        orderType: 'LIMIT',
        quantity: qty,
        requestedPrice: executionPrice,
        executedPrice: 0,
        totalValue: qty * executionPrice,
        status: 'PENDING',
        note: `Simulated limit order queued (limit ₹${executionPrice.toFixed(2)} vs dataset ref ₹${marketPrice.toFixed(2)} on ${priceDate}).`,
      };

      db.prepare(
        `INSERT INTO practice_orders
           (id, user_id, timestamp, dataset_price_date, symbol, side, order_type, quantity,
            requested_price, executed_price, total_value, status, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        pendingOrder.id,
        userId,
        pendingOrder.timestamp,
        pendingOrder.datasetPriceDate,
        pendingOrder.symbol,
        pendingOrder.side,
        pendingOrder.orderType,
        pendingOrder.quantity,
        pendingOrder.requestedPrice,
        pendingOrder.executedPrice,
        pendingOrder.totalValue,
        pendingOrder.status,
        pendingOrder.note,
      );

      return { ok: true, order: pendingOrder, portfolio: getPortfolioSnapshot(userId, dbPath) };
    }
    executionPrice = marketPrice;
  }

  const totalValue = qty * executionPrice;

  if (params.side === 'BUY') {
    if (totalValue > acct.cash_balance) {
      return {
        ok: false,
        error: `Insufficient virtual cash. Available: ₹${acct.cash_balance.toFixed(2)}, Required: ₹${totalValue.toFixed(2)}.`,
      };
    }

    if (heldRow && heldRow.quantity > 0) {
      const newQty = heldRow.quantity + qty;
      const newAvg = (heldRow.quantity * heldRow.avg_buy_price + totalValue) / newQty;
      db.prepare(
        'UPDATE practice_holdings SET quantity = ?, avg_buy_price = ? WHERE user_id = ? AND symbol = ?',
      ).run(newQty, newAvg, userId, symbol);
    } else {
      db.prepare(
        'INSERT INTO practice_holdings (user_id, symbol, quantity, avg_buy_price) VALUES (?, ?, ?, ?)',
      ).run(userId, symbol, qty, executionPrice);
    }

    const newCash = acct.cash_balance - totalValue;
    db.prepare('UPDATE practice_accounts SET cash_balance = ?, updated_at = ? WHERE user_id = ?').run(
      newCash,
      now,
      userId,
    );

    const order: OrderRecord = {
      id: orderId,
      timestamp: now,
      datasetPriceDate: priceDate,
      symbol,
      side: 'BUY',
      orderType: params.orderType,
      quantity: qty,
      requestedPrice: params.orderType === 'LIMIT' ? Number(params.limitPrice) : marketPrice,
      executedPrice: executionPrice,
      totalValue,
      status: 'EXECUTED',
      note: `Simulated BUY filled at latest dataset close ₹${executionPrice.toFixed(2)} (${priceDate}).`,
    };
    const tradeId = `TRD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;

    db.prepare(
      `INSERT INTO practice_orders
         (id, user_id, timestamp, dataset_price_date, symbol, side, order_type, quantity,
          requested_price, executed_price, total_value, status, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      order.id,
      userId,
      order.timestamp,
      order.datasetPriceDate,
      order.symbol,
      order.side,
      order.orderType,
      order.quantity,
      order.requestedPrice,
      order.executedPrice,
      order.totalValue,
      order.status,
      order.note,
    );

    db.prepare(
      `INSERT INTO practice_trades
         (id, user_id, timestamp, dataset_price_date, symbol, side, quantity, price, total_value, realized_pnl)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    ).run(tradeId, userId, now, priceDate, symbol, 'BUY', qty, executionPrice, totalValue);

    const snap = getPortfolioSnapshot(userId, dbPath);
    db.prepare(
      `INSERT INTO practice_equity_history (user_id, timestamp, portfolio_value, cash_balance)
       VALUES (?, ?, ?, ?)`,
    ).run(userId, now, snap.totalPortfolioValue, snap.cashBalance);

    return { ok: true, order, portfolio: getPortfolioSnapshot(userId, dbPath) };
  }

  // SELL side
  const heldQty = heldRow?.quantity ?? 0;
  if (!heldRow || qty > heldQty) {
    return {
      ok: false,
      error: `Insufficient ${symbol} holdings. Held: ${heldQty} shares, Requested sell: ${qty}.`,
    };
  }

  const realized = (executionPrice - heldRow.avg_buy_price) * qty;
  const newRealizedPnl = acct.realized_pnl + realized;
  const newCash = acct.cash_balance + totalValue;

  db.prepare(
    'UPDATE practice_accounts SET cash_balance = ?, realized_pnl = ?, updated_at = ? WHERE user_id = ?',
  ).run(newCash, newRealizedPnl, now, userId);

  const remaining = heldQty - qty;
  if (remaining > 0) {
    db.prepare('UPDATE practice_holdings SET quantity = ? WHERE user_id = ? AND symbol = ?').run(
      remaining,
      userId,
      symbol,
    );
  } else {
    db.prepare('DELETE FROM practice_holdings WHERE user_id = ? AND symbol = ?').run(userId, symbol);
  }

  const order: OrderRecord = {
    id: orderId,
    timestamp: now,
    datasetPriceDate: priceDate,
    symbol,
    side: 'SELL',
    orderType: params.orderType,
    quantity: qty,
    requestedPrice: params.orderType === 'LIMIT' ? Number(params.limitPrice) : marketPrice,
    executedPrice: executionPrice,
    totalValue,
    status: 'EXECUTED',
    note: `Simulated SELL filled at latest dataset close ₹${executionPrice.toFixed(2)} (${priceDate}).`,
  };
  const tradeId = `TRD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;

  db.prepare(
    `INSERT INTO practice_orders
       (id, user_id, timestamp, dataset_price_date, symbol, side, order_type, quantity,
        requested_price, executed_price, total_value, status, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    order.id,
    userId,
    order.timestamp,
    order.datasetPriceDate,
    order.symbol,
    order.side,
    order.orderType,
    order.quantity,
    order.requestedPrice,
    order.executedPrice,
    order.totalValue,
    order.status,
    order.note,
  );

  db.prepare(
    `INSERT INTO practice_trades
       (id, user_id, timestamp, dataset_price_date, symbol, side, quantity, price, total_value, realized_pnl)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(tradeId, userId, now, priceDate, symbol, 'SELL', qty, executionPrice, totalValue, realized);

  const snap = getPortfolioSnapshot(userId, dbPath);
  db.prepare(
    `INSERT INTO practice_equity_history (user_id, timestamp, portfolio_value, cash_balance)
     VALUES (?, ?, ?, ?)`,
  ).run(userId, now, snap.totalPortfolioValue, snap.cashBalance);

  return { ok: true, order, portfolio: getPortfolioSnapshot(userId, dbPath) };
}

export function cancelPendingOrder(
  orderId: string,
  userId = DEFAULT_PRACTICE_USER_ID,
  dbPath?: string,
): PortfolioSnapshot {
  ensurePracticeAccount(userId, dbPath);
  const db = getDb(dbPath);
  db.prepare(
    `UPDATE practice_orders
     SET status = 'CANCELLED', note = 'Pending limit order cancelled by user.'
     WHERE id = ? AND user_id = ? AND status = 'PENDING'`,
  ).run(orderId, userId);
  return getPortfolioSnapshot(userId, dbPath);
}

export function resetPracticePortfolio(
  userId = DEFAULT_PRACTICE_USER_ID,
  dbPath?: string,
): PortfolioSnapshot {
  const db = getDb(dbPath);
  const now = new Date().toISOString();
  db.prepare('DELETE FROM practice_holdings WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM practice_orders WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM practice_trades WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM practice_equity_history WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM practice_accounts WHERE user_id = ?').run(userId);

  ensurePracticeAccount(userId, dbPath);
  db.prepare('UPDATE practice_accounts SET updated_at = ? WHERE user_id = ?').run(now, userId);

  return getPortfolioSnapshot(userId, dbPath);
}

// ==================== PRACTICE INTELLIGENCE (ZERO-MUTATION) ====================

const STANDARD_STRESS_SCENARIOS = [
  {
    id: 'nifty_flash_crash_5',
    name: 'NIFTY Flash Crash (-5%)',
    description: 'Sudden intra-day market drop across all equities; cash reserves remain fully liquid and unaffected.',
    marketShockPct: -0.05,
  },
  {
    id: 'market_correction_10',
    name: 'Severe Market Correction (-10%)',
    description: 'Macro headwind causing a -10% equity pullback across Indian large-cap holdings.',
    marketShockPct: -0.10,
  },
  {
    id: 'bull_rally_5',
    name: 'NIFTY Bull Rally (+5%)',
    description: 'Positive macroeconomic earnings surge lifting all equity positions by +5%.',
    marketShockPct: 0.05,
  },
  {
    id: 'volatility_spike_atr',
    name: 'Elevated Volatility Spike (-6.5%)',
    description: 'Sudden ATR surge triggering widespread trailing stops and an average -6.5% equity decline.',
    marketShockPct: -0.065,
  },
  {
    id: 'tail_risk_var99',
    name: 'Historical 99% Tail Risk (-8%)',
    description: 'Worst-case 1-day Value-at-Risk parametric stress event on equity assets.',
    marketShockPct: -0.08,
  },
];

export function getPracticeIntelligence(
  userId = DEFAULT_PRACTICE_USER_ID,
  dbPath?: string,
): PracticeIntelligenceData {
  const portfolio = getPortfolioSnapshot(userId, dbPath);
  const dataset = loadDatasets();

  // 1. Holdings Health & Diagnostic
  const holdings = portfolio.holdings;
  const totalHoldingsCount = holdings.length;
  let hhi = 0;
  if (portfolio.totalPortfolioValue > 0) {
    for (const h of holdings) {
      const weight = h.marketValue / portfolio.totalPortfolioValue;
      hhi += weight * weight;
    }
  }
  const diversificationScore =
    totalHoldingsCount === 0
      ? 100
      : Math.max(10, Math.min(100, Math.round((1 - Math.min(1, hhi)) * 100)));

  const concentrations = holdings.map((h) => ({
    symbol: h.symbol,
    marketValue: h.marketValue,
    allocationPct: Number(h.allocationPct.toFixed(2)),
    isConcentrated: h.allocationPct > 25,
  }));

  const totalAtrRiskExposure = holdings.reduce(
    (sum, h) => sum + 1.5 * h.atr14 * h.quantity,
    0,
  );

  const cashBufferPct =
    portfolio.totalPortfolioValue > 0
      ? Number(((portfolio.cashBalance / portfolio.totalPortfolioValue) * 100).toFixed(2))
      : 100;

  const cashBufferRating: 'OPTIMAL' | 'LOW' | 'HIGH' =
    cashBufferPct < 10 ? 'LOW' : cashBufferPct > 55 ? 'HIGH' : 'OPTIMAL';

  const technicalBiases = holdings.map((h) => {
    const feat = dataset.featuresBySymbol.get(h.symbol);
    const latestFeat = feat?.[feat.length - 1];
    const rsi14 = latestFeat?.rsi_14 ?? 50;
    const sma20 = latestFeat?.sma_20 ?? h.currentPrice;
    const sma50 = latestFeat?.sma_50 ?? h.currentPrice;
    const macd = latestFeat?.macd ?? 0;
    const macdSignalVal = latestFeat?.macd_signal ?? 0;

    let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (h.currentPrice > sma20 && sma20 > sma50) trend = 'BULLISH';
    else if (h.currentPrice < sma20 && sma20 < sma50) trend = 'BEARISH';

    const rsiStatus: 'OVERBOUGHT' | 'OVERSOLD' | 'NORMAL' =
      rsi14 > 70 ? 'OVERBOUGHT' : rsi14 < 30 ? 'OVERSOLD' : 'NORMAL';

    const macdSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' =
      macd >= macdSignalVal ? 'BULLISH' : 'BEARISH';

    return {
      symbol: h.symbol,
      currentPrice: h.currentPrice,
      atr14: h.atr14,
      trend,
      rsi14: Number(rsi14.toFixed(1)),
      rsiStatus,
      macdSignal,
    };
  });

  const holdingsHealth: PracticeHoldingsHealth = {
    totalHoldingsCount,
    diversificationScore,
    hhi: Number(hhi.toFixed(4)),
    concentrations,
    totalAtrRiskExposure: Math.round(totalAtrRiskExposure),
    cashBufferRating,
    cashBufferPct,
    technicalBiases,
  };

  // 2. Execution & Behavioral Analytics
  const sellTrades = portfolio.trades.filter((t) => t.side === 'SELL');
  const winningTrades = sellTrades.filter((t) => t.realizedPnl > 0);
  const losingTrades = sellTrades.filter((t) => t.realizedPnl < 0);
  const totalTrades = sellTrades.length;
  const winRatePct = totalTrades > 0 ? Number(((winningTrades.length / totalTrades) * 100).toFixed(1)) : 0;

  const grossProfit = winningTrades.reduce((acc, t) => acc + t.realizedPnl, 0);
  const grossLoss = Math.abs(losingTrades.reduce((acc, t) => acc + t.realizedPnl, 0));
  const profitFactor =
    grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 99.99 : null;
  const avgWin = winningTrades.length > 0 ? Math.round(grossProfit / winningTrades.length) : 0;
  const avgLoss = losingTrades.length > 0 ? Math.round(grossLoss / losingTrades.length) : 0;
  const payoffRatio = avgLoss > 0 ? Number((avgWin / avgLoss).toFixed(2)) : null;

  const largestWin = sellTrades.length > 0 ? Math.max(0, ...sellTrades.map((t) => t.realizedPnl)) : 0;
  const largestLoss = sellTrades.length > 0 ? Math.min(0, ...sellTrades.map((t) => t.realizedPnl)) : 0;

  const marketOrdersCount = portfolio.orders.filter((o) => o.orderType === 'MARKET').length;
  const limitOrdersCount = portfolio.orders.filter((o) => o.orderType === 'LIMIT').length;
  const executedOrders = portfolio.orders.filter((o) => o.status === 'EXECUTED').length;
  const fillRatePct =
    portfolio.orders.length > 0
      ? Number(((executedOrders / portfolio.orders.length) * 100).toFixed(1))
      : 100;

  let disciplineScore = 75;
  const remarks: string[] = [];

  if (cashBufferRating === 'OPTIMAL') {
    disciplineScore += 10;
    remarks.push('Optimal cash buffer maintained (10%–55%), allowing tactical flexibility.');
  } else if (cashBufferRating === 'LOW') {
    disciplineScore -= 15;
    remarks.push('Cash reserve is low (<10%); elevated exposure to market downturns.');
  } else {
    remarks.push('High cash buffer (>55%) reduces drawdowns but creates cash drag in bull runs.');
  }

  if (limitOrdersCount > 0) {
    disciplineScore += 10;
    remarks.push('Demonstrated execution patience using disciplined limit orders.');
  }

  if (concentrations.some((c) => c.isConcentrated)) {
    disciplineScore -= 15;
    const concSymbols = concentrations.filter((c) => c.isConcentrated).map((c) => c.symbol).join(', ');
    remarks.push(`Concentration warning: Allocation exceeds 25% in ${concSymbols}.`);
  } else if (totalHoldingsCount >= 3) {
    disciplineScore += 5;
    remarks.push('Good position diversification across multiple NIFTY 50 equities.');
  }

  if (totalTrades > 0) {
    if (winRatePct >= 50) {
      remarks.push(`Profitable execution history with a ${winRatePct}% win rate on closed trades.`);
    } else {
      remarks.push(`Win rate currently at ${winRatePct}%; prioritize cutting losses using 1.5× ATR stops.`);
    }
  } else {
    remarks.push('No closed sell trades yet; behavioral scoring will refine as trades execute.');
  }

  disciplineScore = Math.max(20, Math.min(100, disciplineScore));

  const behavioralAnalytics: PracticeBehavioralAnalytics = {
    totalTrades,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRatePct,
    profitFactor,
    avgWin,
    avgLoss,
    payoffRatio,
    largestWin,
    largestLoss,
    marketOrdersCount,
    limitOrdersCount,
    fillRatePct,
    disciplineScore,
    disciplineRemarks: remarks,
  };

  // 3. Stress Scenarios
  const stressScenarios: PracticeStressScenario[] = STANDARD_STRESS_SCENARIOS.map((sc) => {
    const impacts = holdings.map((h) => {
      const shockedPrice = Math.max(0.01, h.currentPrice * (1 + sc.marketShockPct));
      const shockedMarketValue = Math.round(h.quantity * shockedPrice);
      return {
        symbol: h.symbol,
        currentMarketValue: h.marketValue,
        shockedMarketValue,
        lossGain: Math.round(shockedMarketValue - h.marketValue),
      };
    });

    const totalShockedHoldings = impacts.reduce((sum, imp) => sum + imp.shockedMarketValue, 0);
    const shockedPortfolioValue = Math.round(portfolio.cashBalance + totalShockedHoldings);
    const simulatedPnL = Math.round(shockedPortfolioValue - portfolio.totalPortfolioValue);
    const simulatedPnLPct =
      portfolio.totalPortfolioValue > 0
        ? Number(((simulatedPnL / portfolio.totalPortfolioValue) * 100).toFixed(2))
        : 0;

    return {
      id: sc.id,
      name: sc.name,
      description: sc.description,
      marketShockPct: sc.marketShockPct * 100,
      shockedPortfolioValue,
      simulatedPnL,
      simulatedPnLPct,
      effectivePortfolioShockPct: simulatedPnLPct,
      holdingImpacts: impacts,
    };
  });

  return {
    userId,
    portfolio,
    holdingsHealth,
    behavioralAnalytics,
    stressScenarios,
    generatedAt: new Date().toISOString(),
  };
}

export function simulateTradeImpact(
  userId = DEFAULT_PRACTICE_USER_ID,
  params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price?: number;
  },
  dbPath?: string,
): PracticeSimulatedOrderResult {
  const snap = getPortfolioSnapshot(userId, dbPath);
  const dataset = loadDatasets();
  const symbol = params.symbol.trim().toUpperCase();
  const rows = dataset.combinedBySymbol.get(symbol);
  const currentPrice = rows && rows.length > 0 ? rows[rows.length - 1].close : 100;
  const executionPrice = params.price && params.price > 0 ? params.price : currentPrice;
  const qty = Math.max(1, Math.floor(params.quantity));
  const tradeValue = Math.round(qty * executionPrice);

  const existingHolding = snap.holdings.find((h) => h.symbol === symbol);
  let canAfford = true;
  let canExecute = true;
  let issue: string | undefined;

  let projectedCash = snap.cashBalance;
  let projectedHoldingsMarketValue = snap.holdingsMarketValue;
  let projectedSymbolHoldingValue = 0;

  if (params.side === 'BUY') {
    if (tradeValue > snap.cashBalance) {
      canAfford = false;
      canExecute = false;
      issue = `Required cash ₹${tradeValue.toLocaleString('en-IN')} exceeds available virtual cash ₹${snap.cashBalance.toLocaleString('en-IN')}.`;
    }
    projectedCash = Math.max(0, snap.cashBalance - tradeValue);
    const existingVal = existingHolding ? existingHolding.marketValue : 0;
    projectedSymbolHoldingValue = existingVal + tradeValue;
    projectedHoldingsMarketValue = snap.holdingsMarketValue + tradeValue;
  } else {
    const existingQty = existingHolding?.quantity ?? 0;
    if (qty > existingQty) {
      canExecute = false;
      issue = `Requested sell quantity (${qty}) exceeds currently held shares (${existingQty} ${symbol}).`;
    }
    projectedCash = snap.cashBalance + tradeValue;
    const existingVal = existingHolding ? existingHolding.marketValue : 0;
    projectedSymbolHoldingValue = Math.max(0, existingVal - tradeValue);
    projectedHoldingsMarketValue = Math.max(0, snap.holdingsMarketValue - tradeValue);
  }

  const projectedPortfolioValue = projectedCash + projectedHoldingsMarketValue;
  const projectedAllocationPct =
    projectedPortfolioValue > 0
      ? Number(((projectedSymbolHoldingValue / projectedPortfolioValue) * 100).toFixed(2))
      : 0;
  const concentrationWarning = projectedAllocationPct > 25;

  let projectedHoldingsCount = snap.holdings.length;
  if (params.side === 'BUY' && !existingHolding) projectedHoldingsCount += 1;
  if (params.side === 'SELL' && existingHolding && qty >= existingHolding.quantity) {
    projectedHoldingsCount = Math.max(0, projectedHoldingsCount - 1);
  }

  return {
    isSimulated: true,
    simulationNote:
      'Zero-mutation simulation: No actual order was placed and your virtual wallet remains completely unchanged.',
    actualWalletBefore: {
      cashBalance: snap.cashBalance,
      totalPortfolioValue: snap.totalPortfolioValue,
      holdingsCount: snap.holdings.length,
    },
    hypotheticalTrade: {
      symbol,
      side: params.side,
      quantity: qty,
      price: executionPrice,
      totalValue: tradeValue,
    },
    canAfford,
    canExecute,
    executionIssue: issue,
    projectedCashBalance: projectedCash,
    projectedPortfolioValue,
    projectedAllocationPct,
    concentrationWarning,
    projectedHoldingsCount,
  };
}
