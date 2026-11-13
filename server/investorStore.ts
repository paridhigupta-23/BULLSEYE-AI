import fs from 'node:fs';
import path from 'node:path';
import { loadDatasets } from './dataLoader.ts';
import { getDb } from './db.ts';
import { mlStore } from './mlStore.ts';
import { translateFinancialTexts } from './translationService.ts';
import type {
  InvestorAnnouncementItem,
  InvestorHolding,
  InvestorNewsResponse,
  InvestorOrder,
  InvestorPortfolioSnapshot,
  InvestorWatchlistItem,
  IpoSnapshotResponse,
  IpoSmeSecurity,
  LanguageCode,
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

export function listInvestorOrders(userId: string): InvestorOrder[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, symbol, side, order_type, quantity, price, total_value, status, notes, created_at
       FROM investor_orders
       WHERE user_id = ?
       ORDER BY rowid DESC
       LIMIT 200`,
    )
    .all(userId) as Array<{
    id: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    order_type: 'MARKET' | 'LIMIT';
    quantity: number;
    price: number;
    total_value: number;
    status: 'EXECUTED' | 'PLANNED' | 'CANCELLED';
    notes: string;
    created_at: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    side: r.side,
    orderType: r.order_type,
    quantity: r.quantity,
    price: r.price,
    totalValue: r.total_value,
    status: r.status,
    notes: r.notes,
    createdAt: r.created_at,
  }));
}

export function createInvestorOrder(params: {
  userId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT';
  quantity: number;
  price?: number;
  notes?: string;
}): { ok: true; order: InvestorOrder; orders: InvestorOrder[] } | { ok: false; error: string } {
  const symbol = params.symbol.trim().toUpperCase();
  const dataset = loadDatasets();
  const ohlcv = dataset.combinedBySymbol.get(symbol);
  if (!ohlcv || ohlcv.length === 0) {
    return { ok: false, error: `Unknown stock symbol "${symbol}".` };
  }

  const quantity = Number(params.quantity);
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, error: 'Order quantity must be a positive whole number.' };
  }

  const latestClose = ohlcv[ohlcv.length - 1].close;
  const price =
    params.orderType === 'LIMIT'
      ? Number(params.price ?? 0)
      : params.price && Number(params.price) > 0
        ? Number(params.price)
        : latestClose;

  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, error: 'Order price must be greater than zero.' };
  }

  const status: InvestorOrder['status'] = params.orderType === 'MARKET' ? 'EXECUTED' : 'PLANNED';
  const id = `INV-ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
  const totalValue = quantity * price;
  const createdAt = new Date().toISOString();
  const notes = (params.notes ?? '').trim() || `Investor ${params.side} ${params.orderType} log`;

  const db = getDb();
  db.prepare(
    `INSERT INTO investor_orders
       (id, user_id, symbol, side, order_type, quantity, price, total_value, status, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    params.userId,
    symbol,
    params.side,
    params.orderType,
    quantity,
    price,
    totalValue,
    status,
    notes,
    createdAt,
  );

  const order: InvestorOrder = {
    id,
    symbol,
    side: params.side,
    orderType: params.orderType,
    quantity,
    price,
    totalValue,
    status,
    notes,
    createdAt,
  };

  return { ok: true, order, orders: listInvestorOrders(params.userId) };
}

export function cancelInvestorOrder(userId: string, orderId: string): InvestorOrder[] {
  const db = getDb();
  db.prepare(
    `UPDATE investor_orders
     SET status = 'CANCELLED'
     WHERE id = ? AND user_id = ? AND status != 'CANCELLED'`,
  ).run(orderId, userId);
  return listInvestorOrders(userId);
}

export function getIpoAvailability(): IpoSnapshotResponse {
  const smePath = path.resolve(process.cwd(), 'data', 'datasets', 'old', 'PR121126', 'sme12112026.csv');
  const smeListings: IpoSmeSecurity[] = [];

  if (fs.existsSync(smePath)) {
    const raw = fs.readFileSync(smePath, 'utf-8');
    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      if (cols.length < 14) continue;
      const symbol = cols[2];
      const security = cols[3];
      if (!symbol || !security) continue;
      smeListings.push({
        symbol,
        security,
        series: cols[1] || 'SM',
        prevClose: Number(cols[4]) || 0,
        closePrice: Number(cols[8]) || 0,
        tradedQty: Number(cols[10]) || 0,
        high52Week: Number(cols[12]) || 0,
        low52Week: Number(cols[13]) || 0,
      });
    }
  }

  return {
    liveIpoFeedAvailable: false,
    statusMessage:
      'Live primary-market IPO subscription, GMP, and allotment feeds are unavailable in this offline environment. Showing verified NSE SME Emerge exchange market snapshot from PR121126/sme12112026.csv (12 Nov 2026).',
    sourceFile: 'data/datasets/old/PR121126/sme12112026.csv',
    sourceDate: '2026-11-12',
    smeListingsCount: smeListings.length,
    smeListings: smeListings.slice(0, 60),
  };
}

function buildFilingSummary(
  category: 'Announcement' | 'Board Meeting' | 'Corporate Action',
  company: string,
  symbol: string,
  headline: string,
  dateNote: string,
  lang: LanguageCode,
): string {
  if (lang === 'hi') {
    if (category === 'Board Meeting') {
      return `${company} (${symbol}) द्वारा बोर्ड बैठक सूचना (${dateNote})। केवल एक्सचेंज घोषणा शीर्षक उपलब्ध है; पूर्ण लेख स्रोत फ़ाइल में नहीं है।`;
    }
    if (category === 'Corporate Action') {
      return `${company} (${symbol}) के लिए कॉर्पोरेट कार्रवाई रिकॉर्ड (${dateNote})। केवल एक्सचेंज सारांश विवरण उपलब्ध है।`;
    }
    return `${company} (${symbol}) की NSE एक्सचेंज घोषणा (${dateNote})। केवल आधिकारिक घोषणा शीर्षक उपलब्ध है।`;
  }
  if (lang === 'te') {
    if (category === 'Board Meeting') {
      return `${company} (${symbol}) బోర్డు సమావేశ సమాచారం (${dateNote}). ఎక్స్ఛేంజ్ ప్రకటన శీర్షిక మాత్రమే అందుబాటులో ఉంది; పూర్తి కథనం ఫైల్‌లో లేదు.`;
    }
    if (category === 'Corporate Action') {
      return `${company} (${symbol}) కోసం కార్పొరేట్ చర్య రికార్డ్ (${dateNote}). ఎక్స్ఛేంజ్ సారాంశం మాత్రమే అందుబాటులో ఉంది.`;
    }
    return `${company} (${symbol}) NSE ఎక్స్ఛేంజ్ ప్రకటన (${dateNote}). అధికారిక ప్రకటన శీర్షిక మాత్రమే అందుబాటులో ఉంది.`;
  }
  if (category === 'Board Meeting') {
    return `${company} (${symbol}) board meeting intimation (${dateNote}). Headline-only exchange notice; full narrative article unavailable in offline archive.`;
  }
  if (category === 'Corporate Action') {
    return `Corporate action record for ${company} (${symbol}) scheduled for ${dateNote}: ${headline}.`;
  }
  return `Official NSE filing headline for ${company} (${symbol}) recorded on ${dateNote}. Full narrative article is not bundled in local exchange archive.`;
}

const NEWS_STATUS_BY_LANG: Record<LanguageCode, string> = {
  en: 'Live external financial news wires are unavailable in this environment. Displaying verified NSE Corporate Announcements, Board Meetings, and Corporate Actions parsed from PR121126 exchange filings.',
  hi: 'इस ऑफ़लाइन वातावरण में लाइव बाहरी वित्तीय समाचार फ़ीड उपलब्ध नहीं है। PR121126 NSE एक्सचेंज फ़ाइलों से सत्यापित कॉर्पोरेट घोषणाएँ, बोर्ड बैठकें और कॉर्पोरेट कार्रवाइयाँ हिंदी अनुवाद के साथ दिखाई जा रही हैं।',
  te: 'ఈ ఆఫ్‌లైన్ వాతావరణంలో లైవ్ బాహ్య ఆర్థిక వార్తా ఫీడ్ అందుబాటులో లేదు. PR121126 NSE ఎక్స్ఛేంజ్ ఫైళ్ళ నుండి ధృవీకరించబడిన కార్పొరేట్ ప్రకటనలు, బోర్డు సమావేశాలు మరియు కార్పొరేట్ చర్యలు తెలుగు అనువాదంతో చూపబడుతున్నాయి.',
};

export async function getInvestorNews(lang: LanguageCode = 'en'): Promise<InvestorNewsResponse> {
  const baseDir = path.resolve(process.cwd(), 'data', 'datasets', 'old', 'PR121126');
  const rawItems: Array<{
    company: string;
    symbol: string;
    originalHeadline: string;
    category: 'Announcement' | 'Board Meeting' | 'Corporate Action';
    dateNote: string;
    source: string;
  }> = [];
  const sourceFiles: string[] = [];

  const anPath = path.join(baseDir, 'an12112026.txt');
  if (fs.existsSync(anPath)) {
    sourceFiles.push('data/datasets/old/PR121126/an12112026.txt');
    const lines = fs.readFileSync(anPath, 'utf-8').split(/\r?\n/);
    for (let i = 1; i < lines.length && rawItems.length < 30; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(':');
      if (parts.length < 2) continue;
      const left = parts[0].trim();
      const headline = parts.slice(1).join(':').trim();
      const tokens = left.split(/\s+/);
      const symbol = tokens.length > 1 ? tokens[tokens.length - 1] : left;
      const company = tokens.length > 1 ? tokens.slice(0, -1).join(' ') : left;
      rawItems.push({
        company,
        symbol,
        originalHeadline: headline,
        category: 'Announcement',
        dateNote: '12 Nov 2026',
        source: 'NSE Filing (an12112026)',
      });
    }
  }

  const bmPath = path.join(baseDir, 'bm12112026.txt');
  if (fs.existsSync(bmPath)) {
    sourceFiles.push('data/datasets/old/PR121126/bm12112026.txt');
    const lines = fs.readFileSync(bmPath, 'utf-8').split(/\r?\n/);
    let bmCount = 0;
    for (let i = 1; i < lines.length && bmCount < 15; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(':').map((p) => p.trim());
      if (parts.length < 3) continue;
      const left = parts[0];
      const dateNote = parts[1];
      const headline = parts.slice(2).join(': ');
      const tokens = left.split(/\s+/);
      const symbol = tokens.length > 1 ? tokens[tokens.length - 1] : left;
      const company = tokens.length > 1 ? tokens.slice(0, -1).join(' ') : left;
      rawItems.push({
        company,
        symbol,
        originalHeadline: headline,
        category: 'Board Meeting',
        dateNote,
        source: 'NSE Filing (bm12112026)',
      });
      bmCount++;
    }
  }

  const bcPath = path.join(baseDir, 'bc12112026.csv');
  if (fs.existsSync(bcPath)) {
    sourceFiles.push('data/datasets/old/PR121126/bc12112026.csv');
    const lines = fs.readFileSync(bcPath, 'utf-8').split(/\r?\n/);
    let bcCount = 0;
    for (let i = 1; i < lines.length && bcCount < 15; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      if (cols.length < 10 || !cols[1]) continue;
      rawItems.push({
        company: cols[2] || cols[1],
        symbol: cols[1],
        originalHeadline: cols[9] || 'Corporate Action',
        category: 'Corporate Action',
        dateNote: cols[6] || cols[3] || 'Upcoming',
        source: 'NSE Filing (bc12112026)',
      });
      bcCount++;
    }
  }

  const translatedHeadlines = await translateFinancialTexts(
    rawItems.map((r) => r.originalHeadline),
    lang,
  );

  const items: InvestorAnnouncementItem[] = rawItems.map((r, idx) => {
    const tr = translatedHeadlines[idx];
    const headline = tr?.text || r.originalHeadline;
    return {
      company: r.company,
      symbol: r.symbol,
      headline,
      originalHeadline: r.originalHeadline,
      summary: buildFilingSummary(r.category, r.company, r.symbol, headline, r.dateNote, lang),
      category: r.category,
      dateNote: r.dateNote,
      source: r.source,
      articleAvailable: false,
      translationProvider: tr?.provider || 'original',
    };
  });

  return {
    liveNewsFeedAvailable: false,
    language: lang,
    statusMessage: NEWS_STATUS_BY_LANG[lang],
    sourceFiles,
    items,
  };
}


