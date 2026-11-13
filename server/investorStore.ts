import { loadDatasets } from './dataLoader.ts';
import { getDb } from './db.ts';
import { mlStore } from './mlStore.ts';
import type {
  InvestorHolding,
  InvestorPortfolioSnapshot,
  InvestorWatchlistItem,
} from './types.ts';

export function getInvestorSnapshot(userId: string): InvestorPortfolioSnapshot {
  const db = getDb();
  const dataset = loadDatasets();
  const metaMap = new Map(dataset.catalog.map((c) => [c.symbol, c]));

  const watchRows = db
    .prepare(
      `SELECT symbol, added_at, note
       FROM investor_watchlist
       WHERE user_id = ?
       ORDER BY added_at DESC`,
    )
    .all(userId) as Array<{ symbol: string; added_at: string; note: string }>;

  const watchlist: InvestorWatchlistItem[] = [];
  for (const row of watchRows) {
    const meta = metaMap.get(row.symbol);
    const ohlcv = dataset.combinedBySymbol.get(row.symbol);
    const feats = dataset.featuresBySymbol.get(row.symbol);
    if (!meta || !ohlcv || ohlcv.length === 0 || !feats || feats.length === 0) continue;

    const latest = ohlcv[ohlcv.length - 1];
    const prev = ohlcv.length >= 2 ? ohlcv[ohlcv.length - 2] : null;
    const latestFeat = feats[feats.length - 1];
    const dailyReturn =
      prev && prev.close > 0 ? (latest.close - prev.close) / prev.close : latestFeat.daily_return;
    const pred = mlStore.predictLatest(row.symbol, undefined, 0.75);

    watchlist.push({
      symbol: row.symbol,
      name: meta.name,
      sector: meta.sector,
      latestClose: latest.close,
      latestDate: latest.date,
      dailyReturn,
      rsi14: latestFeat.rsi_14,
      signal: pred.signal,
      addedAt: row.added_at,
      note: row.note,
    });
  }

  const holdingRows = db
    .prepare(
      `SELECT symbol, quantity, avg_buy_price, target_price, stop_loss, notes, updated_at
       FROM investor_holdings
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
    )
    .all(userId) as Array<{
    symbol: string;
    quantity: number;
    avg_buy_price: number;
    target_price: number | null;
    stop_loss: number | null;
    notes: string;
    updated_at: string;
  }>;

  let totalInvested = 0;
  let totalMarketValue = 0;
  const holdings: InvestorHolding[] = [];

  for (const row of holdingRows) {
    const meta = metaMap.get(row.symbol);
    const ohlcv = dataset.combinedBySymbol.get(row.symbol);
    if (!meta || !ohlcv || ohlcv.length === 0) continue;
    const latest = ohlcv[ohlcv.length - 1];
    const currentPrice = latest.close;
    const investedValue = row.quantity * row.avg_buy_price;
    const marketValue = row.quantity * currentPrice;
    const unrealizedPnl = marketValue - investedValue;
    const unrealizedPnlPct = investedValue > 0 ? (unrealizedPnl / investedValue) * 100 : 0;

    totalInvested += investedValue;
    totalMarketValue += marketValue;

    holdings.push({
      symbol: row.symbol,
      name: meta.name,
      quantity: row.quantity,
      avgBuyPrice: row.avg_buy_price,
      currentPrice,
      latestDate: latest.date,
      investedValue,
      marketValue,
      unrealizedPnl,
      unrealizedPnlPct,
      targetPrice: row.target_price,
      stopLoss: row.stop_loss,
      notes: row.notes,
      updatedAt: row.updated_at,
    });
  }

  const totalUnrealizedPnl = totalMarketValue - totalInvested;
  const totalUnrealizedPnlPct = totalInvested > 0 ? (totalUnrealizedPnl / totalInvested) * 100 : 0;

  return {
    totalInvested,
    totalMarketValue,
    totalUnrealizedPnl,
    totalUnrealizedPnlPct,
    holdings,
    watchlist,
  };
}

export function upsertWatchlistSymbol(params: {
  userId: string;
  symbol: string;
  note?: string;
}): { ok: true; snapshot: InvestorPortfolioSnapshot } | { ok: false; error: string } {
  const symbol = params.symbol.trim().toUpperCase();
  const dataset = loadDatasets();
  if (!dataset.combinedBySymbol.has(symbol)) {
    return { ok: false, error: `Unknown stock symbol "${symbol}".` };
  }

  const db = getDb();
  db.prepare(
    `INSERT INTO investor_watchlist (user_id, symbol, added_at, note)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, symbol) DO UPDATE SET
       note = excluded.note,
       added_at = excluded.added_at`,
  ).run(params.userId, symbol, new Date().toISOString(), (params.note ?? '').trim());

  return { ok: true, snapshot: getInvestorSnapshot(params.userId) };
}

export function removeWatchlistSymbol(userId: string, symbol: string): InvestorPortfolioSnapshot {
  const db = getDb();
  db.prepare('DELETE FROM investor_watchlist WHERE user_id = ? AND symbol = ?').run(
    userId,
    symbol.trim().toUpperCase(),
  );
  return getInvestorSnapshot(userId);
}

export function upsertInvestorHolding(params: {
  userId: string;
  symbol: string;
  quantity: number;
  avgBuyPrice: number;
  targetPrice?: number | null;
  stopLoss?: number | null;
  notes?: string;
}): { ok: true; snapshot: InvestorPortfolioSnapshot } | { ok: false; error: string } {
  const symbol = params.symbol.trim().toUpperCase();
  const dataset = loadDatasets();
  if (!dataset.combinedBySymbol.has(symbol)) {
    return { ok: false, error: `Unknown stock symbol "${symbol}".` };
  }

  const quantity = Math.floor(Number(params.quantity));
  const avgBuyPrice = Number(params.avgBuyPrice);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, error: 'Quantity must be a positive whole number.' };
  }
  if (!Number.isFinite(avgBuyPrice) || avgBuyPrice <= 0) {
    return { ok: false, error: 'Average buy price must be greater than zero.' };
  }

  const targetPrice =
    params.targetPrice !== undefined && params.targetPrice !== null && Number(params.targetPrice) > 0
      ? Number(params.targetPrice)
      : null;
  const stopLoss =
    params.stopLoss !== undefined && params.stopLoss !== null && Number(params.stopLoss) > 0
      ? Number(params.stopLoss)
      : null;

  const db = getDb();
  db.prepare(
    `INSERT INTO investor_holdings
       (user_id, symbol, quantity, avg_buy_price, target_price, stop_loss, notes, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, symbol) DO UPDATE SET
       quantity = excluded.quantity,
       avg_buy_price = excluded.avg_buy_price,
       target_price = excluded.target_price,
       stop_loss = excluded.stop_loss,
       notes = excluded.notes,
       updated_at = excluded.updated_at`,
  ).run(
    params.userId,
    symbol,
    quantity,
    avgBuyPrice,
    targetPrice,
    stopLoss,
    (params.notes ?? '').trim(),
    new Date().toISOString(),
  );

  return { ok: true, snapshot: getInvestorSnapshot(params.userId) };
}

export function removeInvestorHolding(userId: string, symbol: string): InvestorPortfolioSnapshot {
  const db = getDb();
  db.prepare('DELETE FROM investor_holdings WHERE user_id = ? AND symbol = ?').run(
    userId,
    symbol.trim().toUpperCase(),
  );
  return getInvestorSnapshot(userId);
}
