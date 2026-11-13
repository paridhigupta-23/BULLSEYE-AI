import { loadDatasets } from './dataLoader.ts';
import { getDb } from './db.ts';
import type { HoldingPosition, OrderRecord, PortfolioSnapshot, TradeRecord } from './types.ts';

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
