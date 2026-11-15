import type {
  AIPredictionRecord,
  PortfolioPosition,
  PriceBar,
  VirtualPortfolio,
  VirtualTrade,
} from './types.ts';

export function portfolioSnapshotToVirtualPortfolio(
  snapshot: {
    startingCapital?: number;
    cashBalance: number;
    holdingsMarketValue?: number;
    totalPortfolioValue: number;
    realizedPnl?: number;
    unrealizedPnl?: number;
    totalPnl?: number;
    totalReturnPct?: number;
    holdings: Array<{
      symbol: string;
      name?: string;
      quantity: number;
      avgBuyPrice: number;
      currentPrice: number;
      latestPriceDate?: string;
      investedValue?: number;
      marketValue?: number;
      unrealizedPnl?: number;
      unrealizedPnlPct?: number;
      allocationPct?: number;
      atr14?: number;
      suggestedStopLoss?: number;
      stopLoss?: number;
      annualizedVolatility?: number;
    }>;
  },
  volatilityMap?: Map<string, number>,
): VirtualPortfolio {
  const totalVal = snapshot.totalPortfolioValue || 0;
  const holdings: PortfolioPosition[] = (snapshot.holdings || []).map((h) => {
    const qty = Number(h.quantity) || 0;
    const price = Number(h.currentPrice) || 0;
    const avgBuy = Number(h.avgBuyPrice) || price;
    const marketVal = Number(h.marketValue ?? (qty * price));
    const invVal = Number(h.investedValue ?? (qty * avgBuy));
    const pnl = Number(h.unrealizedPnl ?? (marketVal - invVal));
    const pnlPct = invVal > 0 ? (pnl / invVal) * 100 : 0;
    const alloc = totalVal > 0 ? (marketVal / totalVal) * 100 : 0;
    const vol = h.annualizedVolatility ?? (volatilityMap ? volatilityMap.get(h.symbol.toUpperCase()) : 24.5) ?? 24.5;

    return {
      symbol: h.symbol.toUpperCase(),
      name: h.name || h.symbol,
      quantity: qty,
      avgBuyPrice: Number(avgBuy.toFixed(2)),
      currentPrice: Number(price.toFixed(2)),
      latestPriceDate: h.latestPriceDate || new Date().toISOString().slice(0, 10),
      investedValue: Number(invVal.toFixed(2)),
      marketValue: Number(marketVal.toFixed(2)),
      unrealizedPnl: Number(pnl.toFixed(2)),
      unrealizedPnlPct: Number(pnlPct.toFixed(2)),
      allocationPct: Number(alloc.toFixed(2)),
      atr14: h.atr14,
      suggestedStopLoss: h.suggestedStopLoss,
      stopLoss: h.stopLoss,
      annualizedVolatility: vol,
    };
  });

  const holdingsMarketValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  const realizedPnl = Number(snapshot.realizedPnl ?? 0);
  const unrealizedPnl = holdings.reduce((sum, h) => sum + h.unrealizedPnl, 0);
  const totalPnl = realizedPnl + unrealizedPnl;
  const startingCapital = Number(snapshot.startingCapital ?? 1000000);
  const totalReturnPct = startingCapital > 0 ? (totalPnl / startingCapital) * 100 : 0;

  return {
    startingCapital,
    cashBalance: Number(snapshot.cashBalance.toFixed(2)),
    holdingsMarketValue: Number(holdingsMarketValue.toFixed(2)),
    totalPortfolioValue: Number(totalVal.toFixed(2)),
    realizedPnl: Number(realizedPnl.toFixed(2)),
    unrealizedPnl: Number(unrealizedPnl.toFixed(2)),
    totalPnl: Number(totalPnl.toFixed(2)),
    totalReturnPct: Number(totalReturnPct.toFixed(2)),
    holdings,
  };
}

export function tradeRecordsToVirtualTrades(
  trades: Array<{
    id: string;
    timestamp: string;
    datasetPriceDate?: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    totalValue: number;
    realizedPnl?: number;
    stopLoss?: number;
    holdingHours?: number;
    annualizedVolatility?: number;
  }>,
  volatilityMap?: Map<string, number>,
): VirtualTrade[] {
  return (trades || []).map((t) => ({
    id: t.id,
    timestamp: t.timestamp,
    datasetPriceDate: t.datasetPriceDate || t.timestamp.slice(0, 10),
    symbol: t.symbol.toUpperCase(),
    side: t.side,
    quantity: Number(t.quantity),
    price: Number(t.price),
    totalValue: Number(t.totalValue),
    realizedPnl: Number(t.realizedPnl ?? 0),
    stopLoss: t.stopLoss,
    holdingHours: t.holdingHours,
    annualizedVolatility: t.annualizedVolatility ?? (volatilityMap ? volatilityMap.get(t.symbol.toUpperCase()) : 24.5),
  }));
}

// ==========================================
// FOUR ISOLATED DEMO PERSONAS (DO NOT MUTATE USER DB)
// ==========================================

export interface DemoPersona {
  id: string;
  name: string;
  roleDescription: string;
  portfolio: VirtualPortfolio;
  trades: VirtualTrade[];
}

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    id: 'active_overtrader',
    name: 'Active Day Trader (Overtrading & No Stop-Loss)',
    roleDescription: 'High execution frequency (12 trades in one session), zero stop-loss discipline, facing repeated drawdown.',
    portfolio: {
      startingCapital: 1000000,
      cashBalance: 42000,
      holdingsMarketValue: 918000,
      totalPortfolioValue: 960000,
      realizedPnl: -40000,
      unrealizedPnl: -22000,
      totalPnl: -62000,
      totalReturnPct: -6.2,
      holdings: [
        {
          symbol: 'TATASTEEL',
          name: 'Tata Steel Ltd.',
          quantity: 2500,
          avgBuyPrice: 168.0,
          currentPrice: 162.4,
          latestPriceDate: '2025-09-30',
          investedValue: 420000,
          marketValue: 406000,
          unrealizedPnl: -14000,
          unrealizedPnlPct: -3.33,
          allocationPct: 42.29,
          annualizedVolatility: 38.4,
          stopLoss: 0,
        },
        {
          symbol: 'ADANIENT',
          name: 'Adani Enterprises Ltd.',
          quantity: 180,
          avgBuyPrice: 2900.0,
          currentPrice: 2844.4,
          latestPriceDate: '2025-09-30',
          investedValue: 522000,
          marketValue: 512000,
          unrealizedPnl: -10000,
          unrealizedPnlPct: -1.92,
          allocationPct: 53.33,
          annualizedVolatility: 42.1,
          stopLoss: 0,
        },
      ],
    },
    trades: [
      { id: 'TRD-OT-01', timestamp: '2025-09-28T09:15:00Z', datasetPriceDate: '2025-09-28', symbol: 'TATASTEEL', side: 'BUY', quantity: 500, price: 169.5, totalValue: 84750, realizedPnl: 0, stopLoss: 0 },
      { id: 'TRD-OT-02', timestamp: '2025-09-28T09:32:00Z', datasetPriceDate: '2025-09-28', symbol: 'TATASTEEL', side: 'SELL', quantity: 500, price: 167.0, totalValue: 83500, realizedPnl: -1250, holdingHours: 0.3 },
      { id: 'TRD-OT-03', timestamp: '2025-09-28T10:05:00Z', datasetPriceDate: '2025-09-28', symbol: 'ADANIENT', side: 'BUY', quantity: 50, price: 2920.0, totalValue: 146000, realizedPnl: 0, stopLoss: 0 },
      { id: 'TRD-OT-04', timestamp: '2025-09-28T10:45:00Z', datasetPriceDate: '2025-09-28', symbol: 'ADANIENT', side: 'SELL', quantity: 50, price: 2880.0, totalValue: 144000, realizedPnl: -2000, holdingHours: 0.6 },
      { id: 'TRD-OT-05', timestamp: '2025-09-28T11:15:00Z', datasetPriceDate: '2025-09-28', symbol: 'RELIANCE', side: 'BUY', quantity: 80, price: 1370.0, totalValue: 109600, realizedPnl: 0, stopLoss: 0 },
      { id: 'TRD-OT-06', timestamp: '2025-09-28T11:45:00Z', datasetPriceDate: '2025-09-28', symbol: 'RELIANCE', side: 'SELL', quantity: 80, price: 1355.0, totalValue: 108400, realizedPnl: -1200, holdingHours: 0.5 },
      { id: 'TRD-OT-07', timestamp: '2025-09-28T12:20:00Z', datasetPriceDate: '2025-09-28', symbol: 'TATASTEEL', side: 'BUY', quantity: 1000, price: 168.0, totalValue: 168000, realizedPnl: 0, stopLoss: 0 },
      { id: 'TRD-OT-08', timestamp: '2025-09-28T13:00:00Z', datasetPriceDate: '2025-09-28', symbol: 'TATASTEEL', side: 'SELL', quantity: 1000, price: 165.5, totalValue: 165500, realizedPnl: -2500, holdingHours: 0.7 },
      { id: 'TRD-OT-09', timestamp: '2025-09-28T13:40:00Z', datasetPriceDate: '2025-09-28', symbol: 'ADANIENT', side: 'BUY', quantity: 70, price: 2910.0, totalValue: 203700, realizedPnl: 0, stopLoss: 0 },
      { id: 'TRD-OT-10', timestamp: '2025-09-28T14:10:00Z', datasetPriceDate: '2025-09-28', symbol: 'ADANIENT', side: 'SELL', quantity: 70, price: 2875.0, totalValue: 201250, realizedPnl: -2450, holdingHours: 0.5 },
      { id: 'TRD-OT-11', timestamp: '2025-09-28T14:45:00Z', datasetPriceDate: '2025-09-28', symbol: 'TATASTEEL', side: 'BUY', quantity: 2500, price: 168.0, totalValue: 420000, realizedPnl: 0, stopLoss: 0 },
      { id: 'TRD-OT-12', timestamp: '2025-09-28T15:10:00Z', datasetPriceDate: '2025-09-28', symbol: 'ADANIENT', side: 'BUY', quantity: 180, price: 2900.0, totalValue: 522000, realizedPnl: 0, stopLoss: 0 },
    ],
  },
  {
    id: 'concentrated_momentum',
    name: 'Concentrated Momentum Chaser',
    roleDescription: 'Allocates over 50% to high-beta breakout names, rapid chasing, unprotected high volatility exposure.',
    portfolio: {
      startingCapital: 1000000,
      cashBalance: 75000,
      holdingsMarketValue: 965000,
      totalPortfolioValue: 1040000,
      realizedPnl: 25000,
      unrealizedPnl: 15000,
      totalPnl: 40000,
      totalReturnPct: 4.0,
      holdings: [
        {
          symbol: 'BEL',
          name: 'Bharat Electronics Ltd.',
          quantity: 1800,
          avgBuyPrice: 285.0,
          currentPrice: 304.5,
          latestPriceDate: '2025-09-30',
          investedValue: 513000,
          marketValue: 548100,
          unrealizedPnl: 35100,
          unrealizedPnlPct: 6.84,
          allocationPct: 52.7,
          annualizedVolatility: 36.8,
          stopLoss: 0,
        },
        {
          symbol: 'SHRIRAMFIN',
          name: 'Shriram Finance Ltd.',
          quantity: 140,
          avgBuyPrice: 3100.0,
          currentPrice: 2977.8,
          latestPriceDate: '2025-09-30',
          investedValue: 434000,
          marketValue: 416900,
          unrealizedPnl: -17100,
          unrealizedPnlPct: -3.94,
          allocationPct: 40.08,
          annualizedVolatility: 35.2,
          stopLoss: 0,
        },
      ],
    },
    trades: [
      { id: 'TRD-MC-01', timestamp: '2025-09-25T10:00:00Z', datasetPriceDate: '2025-09-25', symbol: 'BEL', side: 'BUY', quantity: 1800, price: 285.0, totalValue: 513000, realizedPnl: 0, annualizedVolatility: 36.8, stopLoss: 0, holdingHours: 12 },
      { id: 'TRD-MC-02', timestamp: '2025-09-26T11:30:00Z', datasetPriceDate: '2025-09-26', symbol: 'SHRIRAMFIN', side: 'BUY', quantity: 140, price: 3100.0, totalValue: 434000, realizedPnl: 0, annualizedVolatility: 35.2, stopLoss: 0, holdingHours: 18 },
    ],
  },
  {
    id: 'disciplined_quant',
    name: 'Disciplined Quant Trader',
    roleDescription: 'Diversified across sectors, 100% stop-loss coverage with 1.5× ATR stops, healthy cash buffer, high win rate.',
    portfolio: {
      startingCapital: 1000000,
      cashBalance: 325000,
      holdingsMarketValue: 746000,
      totalPortfolioValue: 1071000,
      realizedPnl: 48000,
      unrealizedPnl: 23000,
      totalPnl: 71000,
      totalReturnPct: 7.1,
      holdings: [
        {
          symbol: 'RELIANCE',
          name: 'Reliance Industries Ltd.',
          quantity: 140,
          avgBuyPrice: 1320.0,
          currentPrice: 1364.0,
          latestPriceDate: '2025-09-30',
          investedValue: 184800,
          marketValue: 190960,
          unrealizedPnl: 6160,
          unrealizedPnlPct: 3.33,
          allocationPct: 17.83,
          atr14: 14.8,
          stopLoss: 1341.8,
          annualizedVolatility: 21.4,
        },
        {
          symbol: 'TCS',
          name: 'Tata Consultancy Services Ltd.',
          quantity: 60,
          avgBuyPrice: 2980.0,
          currentPrice: 3045.0,
          latestPriceDate: '2025-09-30',
          investedValue: 178800,
          marketValue: 182700,
          unrealizedPnl: 3900,
          unrealizedPnlPct: 2.18,
          allocationPct: 17.06,
          atr14: 38.2,
          stopLoss: 2987.7,
          annualizedVolatility: 19.8,
        },
        {
          symbol: 'HDFCBANK',
          name: 'HDFC Bank Ltd.',
          quantity: 110,
          avgBuyPrice: 1610.0,
          currentPrice: 1675.0,
          latestPriceDate: '2025-09-30',
          investedValue: 177100,
          marketValue: 184250,
          unrealizedPnl: 7150,
          unrealizedPnlPct: 4.04,
          allocationPct: 17.2,
          atr14: 18.5,
          stopLoss: 1647.2,
          annualizedVolatility: 22.1,
        },
        {
          symbol: 'SUNPHARMA',
          name: 'Sun Pharmaceutical Industries Ltd.',
          quantity: 110,
          avgBuyPrice: 1670.0,
          currentPrice: 1710.0,
          latestPriceDate: '2025-09-30',
          investedValue: 183700,
          marketValue: 188100,
          unrealizedPnl: 4400,
          unrealizedPnlPct: 2.4,
          allocationPct: 17.56,
          atr14: 21.0,
          stopLoss: 1678.5,
          annualizedVolatility: 20.2,
        },
      ],
    },
    trades: [
      { id: 'TRD-DQ-01', timestamp: '2025-09-15T09:30:00Z', datasetPriceDate: '2025-09-15', symbol: 'INFY', side: 'BUY', quantity: 100, price: 1420.0, totalValue: 142000, realizedPnl: 0, stopLoss: 1395.0, holdingHours: 72 },
      { id: 'TRD-DQ-02', timestamp: '2025-09-18T14:30:00Z', datasetPriceDate: '2025-09-18', symbol: 'INFY', side: 'SELL', quantity: 100, price: 1490.0, totalValue: 149000, realizedPnl: 7000, holdingHours: 72 },
      { id: 'TRD-DQ-03', timestamp: '2025-09-20T10:00:00Z', datasetPriceDate: '2025-09-20', symbol: 'ICICIBANK', side: 'BUY', quantity: 150, price: 1180.0, totalValue: 177000, realizedPnl: 0, stopLoss: 1160.0, holdingHours: 48 },
      { id: 'TRD-DQ-04', timestamp: '2025-09-22T13:45:00Z', datasetPriceDate: '2025-09-22', symbol: 'ICICIBANK', side: 'SELL', quantity: 150, price: 1225.0, totalValue: 183750, realizedPnl: 6750, holdingHours: 48 },
      { id: 'TRD-DQ-05', timestamp: '2025-09-24T09:20:00Z', datasetPriceDate: '2025-09-24', symbol: 'RELIANCE', side: 'BUY', quantity: 140, price: 1320.0, totalValue: 184800, realizedPnl: 0, stopLoss: 1341.8, holdingHours: 120 },
      { id: 'TRD-DQ-06', timestamp: '2025-09-24T09:25:00Z', datasetPriceDate: '2025-09-24', symbol: 'TCS', side: 'BUY', quantity: 60, price: 2980.0, totalValue: 178800, realizedPnl: 0, stopLoss: 2987.7, holdingHours: 120 },
      { id: 'TRD-DQ-07', timestamp: '2025-09-24T09:30:00Z', datasetPriceDate: '2025-09-24', symbol: 'HDFCBANK', side: 'BUY', quantity: 110, price: 1610.0, totalValue: 177100, realizedPnl: 0, stopLoss: 1647.2, holdingHours: 120 },
      { id: 'TRD-DQ-08', timestamp: '2025-09-24T09:35:00Z', datasetPriceDate: '2025-09-24', symbol: 'SUNPHARMA', side: 'BUY', quantity: 110, price: 1670.0, totalValue: 183700, realizedPnl: 0, stopLoss: 1678.5, holdingHours: 120 },
    ],
  },
  {
    id: 'conservative_beginner',
    name: 'Conservative Cash-Heavy Beginner',
    roleDescription: 'Preserves 88% in cash, low turnover, small test position in blue-chip energy, zero impulsive churn.',
    portfolio: {
      startingCapital: 1000000,
      cashBalance: 882000,
      holdingsMarketValue: 122760,
      totalPortfolioValue: 1004760,
      realizedPnl: 0,
      unrealizedPnl: 4760,
      totalPnl: 4760,
      totalReturnPct: 0.48,
      holdings: [
        {
          symbol: 'RELIANCE',
          name: 'Reliance Industries Ltd.',
          quantity: 90,
          avgBuyPrice: 1311.1,
          currentPrice: 1364.0,
          latestPriceDate: '2025-09-30',
          investedValue: 118000,
          marketValue: 122760,
          unrealizedPnl: 4760,
          unrealizedPnlPct: 4.03,
          allocationPct: 12.22,
          atr14: 14.8,
          stopLoss: 1310.0,
          annualizedVolatility: 21.4,
        },
      ],
    },
    trades: [
      { id: 'TRD-CB-01', timestamp: '2025-09-20T10:15:00Z', datasetPriceDate: '2025-09-20', symbol: 'RELIANCE', side: 'BUY', quantity: 90, price: 1311.1, totalValue: 118000, realizedPnl: 0, stopLoss: 1310.0, holdingHours: 240 },
    ],
  },
];

// ==========================================
// DEMO PREDICTIONS & PRICE BARS (AUDITABLE HISTORICAL AUTOPSY)
// ==========================================

export const DEMO_PREDICTIONS: AIPredictionRecord[] = [
  {
    prediction_id: 'PRED-REL-20250915',
    symbol: 'RELIANCE',
    predicted_signal: 'BUY',
    confidence: 0.82,
    prediction_timestamp: '2025-09-15T09:15:00Z',
    price_at_prediction: 1330.0,
  },
  {
    prediction_id: 'PRED-TCS-20250916',
    symbol: 'TCS',
    predicted_signal: 'BUY',
    confidence: 0.74,
    prediction_timestamp: '2025-09-16T09:15:00Z',
    price_at_prediction: 3010.0,
  },
  {
    prediction_id: 'PRED-INFY-20250918',
    symbol: 'INFY',
    predicted_signal: 'SELL',
    confidence: 0.79,
    prediction_timestamp: '2025-09-18T09:15:00Z',
    price_at_prediction: 1485.0,
  },
  {
    prediction_id: 'PRED-TATAMOTORS-20250919',
    symbol: 'TATAMOTORS',
    predicted_signal: 'SELL',
    confidence: 0.68,
    prediction_timestamp: '2025-09-19T09:15:00Z',
    price_at_prediction: 840.0,
  },
  {
    prediction_id: 'PRED-HDFCBANK-20250922',
    symbol: 'HDFCBANK',
    predicted_signal: 'HOLD',
    confidence: 0.88,
    prediction_timestamp: '2025-09-22T09:15:00Z',
    price_at_prediction: 1650.0,
  },
  {
    prediction_id: 'PRED-ICICIBANK-20250924',
    symbol: 'ICICIBANK',
    predicted_signal: 'BUY',
    confidence: 0.81,
    prediction_timestamp: '2025-09-24T09:15:00Z',
    price_at_prediction: 1195.0,
  },
  {
    prediction_id: 'PRED-LT-20250926',
    symbol: 'LT',
    predicted_signal: 'BUY',
    confidence: 0.65,
    prediction_timestamp: '2025-09-26T09:15:00Z',
    price_at_prediction: 3450.0,
  },
  {
    prediction_id: 'PRED-FUTURE-20251001',
    symbol: 'RELIANCE',
    predicted_signal: 'BUY',
    confidence: 0.85,
    prediction_timestamp: '2025-10-01T09:15:00Z', // After dataset end (missing outcome demonstration)
    price_at_prediction: 1365.0,
  },
];

export const DEMO_PRICE_BARS: PriceBar[] = [
  // RELIANCE bars
  { symbol: 'RELIANCE', timestamp: '2025-09-14T15:30:00Z', open: 1320, high: 1335, low: 1315, close: 1328 },
  { symbol: 'RELIANCE', timestamp: '2025-09-15T15:30:00Z', open: 1330, high: 1352, low: 1325, close: 1348 }, // First subsequent bar for PRED-REL (1348 > 1330 => Correct BUY)
  { symbol: 'RELIANCE', timestamp: '2025-09-16T15:30:00Z', open: 1345, high: 1360, low: 1340, close: 1355 },

  // TCS bars
  { symbol: 'TCS', timestamp: '2025-09-16T15:30:00Z', open: 3010, high: 3055, low: 3005, close: 3042 }, // First subsequent bar for PRED-TCS (3042 > 3010 => Correct BUY)

  // INFY bars
  { symbol: 'INFY', timestamp: '2025-09-18T15:30:00Z', open: 1485, high: 1490, low: 1450, close: 1460 }, // First subsequent bar for PRED-INFY (1460 < 1485 => Correct SELL)

  // TATAMOTORS bars
  { symbol: 'TATAMOTORS', timestamp: '2025-09-19T15:30:00Z', open: 840, high: 865, low: 838, close: 858 }, // First subsequent bar (858 > 840 => Incorrect SELL)

  // HDFCBANK bars
  { symbol: 'HDFCBANK', timestamp: '2025-09-22T15:30:00Z', open: 1650, high: 1658, low: 1645, close: 1655 }, // (1655 vs 1650 is +0.30% <= 1.25% => Correct HOLD)

  // ICICIBANK bars
  { symbol: 'ICICIBANK', timestamp: '2025-09-24T15:30:00Z', open: 1195, high: 1220, low: 1192, close: 1215 }, // (1215 > 1195 => Correct BUY)

  // LT bars
  { symbol: 'LT', timestamp: '2025-09-26T15:30:00Z', open: 3450, high: 3460, low: 3410, close: 3420 }, // (3420 < 3450 => Incorrect BUY)
];
