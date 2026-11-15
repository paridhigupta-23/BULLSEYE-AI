import type {
  MistakeWarning,
  PortfolioPosition,
  VirtualPortfolio,
  VirtualTrade,
  WarningSeverity,
} from '../types.ts';

export function detectTradingMistakes(
  portfolio: VirtualPortfolio,
  trades: VirtualTrade[],
): MistakeWarning[] {
  const warnings: MistakeWarning[] = [];
  const totalEquity = Math.max(0, portfolio.totalPortfolioValue || 0);
  const holdings = portfolio.holdings || [];
  const safeTrades = trades || [];

  // ==========================================
  // 1. OVERTRADING FREQUENCY
  // ==========================================
  const tradesByDay = new Map<string, VirtualTrade[]>();
  for (const trade of safeTrades) {
    const dayKey = trade.datasetPriceDate || (trade.timestamp ? trade.timestamp.slice(0, 10) : 'UNKNOWN');
    const existing = tradesByDay.get(dayKey) ?? [];
    existing.push(trade);
    tradesByDay.set(dayKey, existing);
  }

  let maxTradesInDay = 0;
  let peakTradingDay = '';
  let peakTradesList: VirtualTrade[] = [];

  for (const [day, dayTrades] of tradesByDay.entries()) {
    if (dayTrades.length > maxTradesInDay) {
      maxTradesInDay = dayTrades.length;
      peakTradingDay = day;
      peakTradesList = dayTrades;
    }
  }

  if (maxTradesInDay >= 6) {
    const severity: WarningSeverity = maxTradesInDay >= 10 ? 'High' : 'Medium';
    const sampleIds = peakTradesList.slice(0, 3).map((t) => t.id).join(', ');
    warnings.push({
      code: 'OVERTRADING_FREQUENCY',
      title: 'High-Frequency Overtrading Detected',
      severity,
      explanation: `You executed ${maxTradesInDay} virtual trades on ${peakTradingDay}. Excessive daily turnover degrades edge, increases frictional costs, and indicates emotional overactivity rather than planned setups.`,
      evidence: `Peak day: ${peakTradingDay} with ${maxTradesInDay} trades (Sample Trade IDs: ${sampleIds || 'None'}). Medium threshold = 6–9/day, High threshold = 10+/day.`,
      recommended_action: 'Limit execution to a maximum of 2 to 3 high-conviction trade setups per day with predefined entry and exit plans.',
      metric_value: maxTradesInDay,
    });
  }

  // ==========================================
  // 2. SINGLE-STOCK OVER-ALLOCATION
  // ==========================================
  if (totalEquity > 0) {
    for (const pos of holdings) {
      const marketVal = pos.quantity * pos.currentPrice;
      const stockWeight = (marketVal / totalEquity) * 100;
      if (stockWeight > 25) {
        const severity: WarningSeverity = stockWeight >= 40 ? 'High' : 'Medium';
        warnings.push({
          code: `SINGLE_STOCK_EXPOSURE_${pos.symbol}`,
          title: `Over-Allocation: ${pos.symbol} (${stockWeight.toFixed(1)}% of Portfolio)`,
          severity,
          explanation: `Holding ${pos.symbol} represents ${stockWeight.toFixed(1)}% of your total virtual equity (₹${marketVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })} of ₹${totalEquity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}). Standard risk guidelines recommend capping single-stock exposure at 15–20%.`,
          evidence: `Stock: ${pos.symbol}, Quantity: ${pos.quantity}, Current Price: ₹${pos.currentPrice.toFixed(2)}, Market Value: ₹${marketVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}, Exposure: ${stockWeight.toFixed(1)}% (Threshold: 25.0%).`,
          recommended_action: `Trim ${pos.symbol} position to bring exposure below 20% of total equity to avoid catastrophic single-stock drawdowns.`,
          metric_value: Number(stockWeight.toFixed(2)),
        });
      }
    }
  }

  // ==========================================
  // 3. PORTFOLIO CONCENTRATION (HHI & TOP-TWO)
  // ==========================================
  const totalInvestedValue = holdings.reduce((sum, h) => sum + (h.investedValue || (h.quantity * h.avgBuyPrice)), 0);
  let hhi = 0;
  if (totalInvestedValue > 0 && holdings.length > 0) {
    for (const pos of holdings) {
      const invVal = pos.investedValue || (pos.quantity * pos.avgBuyPrice);
      const w = invVal / totalInvestedValue;
      hhi += w * w;
    }
  }

  const sortedByMarketVal = [...holdings].sort((a, b) => (b.quantity * b.currentPrice) - (a.quantity * a.currentPrice));
  const top2MarketVal = sortedByMarketVal.slice(0, 2).reduce((sum, h) => sum + (h.quantity * h.currentPrice), 0);
  const top2EquityPct = totalEquity > 0 ? (top2MarketVal / totalEquity) * 100 : 0;
  const isFewPositions = holdings.length <= 2 && holdings.length > 0;

  if (hhi >= 0.35 || (isFewPositions && top2EquityPct > 40) || (holdings.length > 2 && top2EquityPct > 40)) {
    const severity: WarningSeverity = hhi >= 0.50 ? 'High' : 'Medium';
    const top2Symbols = sortedByMarketVal.slice(0, 2).map((h) => `${h.symbol} (${((h.quantity * h.currentPrice / (totalEquity || 1)) * 100).toFixed(1)}%)`).join(', ');
    warnings.push({
      code: 'PORTFOLIO_CONCENTRATION',
      title: 'Excessive Portfolio Concentration',
      severity,
      explanation: `Your portfolio concentration is dangerously high. Herfindahl-Hirschman Index is ${hhi.toFixed(3)} (threshold 0.35) and your top holdings account for ${top2EquityPct.toFixed(1)}% of total equity.`,
      evidence: `HHI: ${hhi.toFixed(3)} (High >= 0.50, Medium >= 0.35). Top holdings: ${top2Symbols || 'None'}. Top-2 weight: ${top2EquityPct.toFixed(1)}% (Threshold: 40%).`,
      recommended_action: 'Diversify across at least 4 to 6 non-correlated sectors (e.g., IT, Banking, Energy, FMCG, Pharmaceuticals).',
      metric_value: Number(hhi.toFixed(3)),
    });
  }

  // ==========================================
  // 4. MISSING STOP-LOSS
  // ==========================================
  const buyTrades = safeTrades.filter((t) => t.side === 'BUY');
  const unprotectedBuyTrades = buyTrades.filter((t) => !t.stopLoss || t.stopLoss <= 0);
  const unprotectedHoldings = holdings.filter((h) => !h.stopLoss || h.stopLoss <= 0);

  const unprotectedOpenMarketVal = unprotectedHoldings.reduce((sum, h) => sum + (h.quantity * h.currentPrice), 0);
  const unprotectedOpenPct = totalEquity > 0 ? (unprotectedOpenMarketVal / totalEquity) * 100 : 0;

  const hasUnprotectedOpen = unprotectedHoldings.length > 0;
  const hasMultipleUnprotectedBuys = unprotectedBuyTrades.length >= 2;

  if (hasUnprotectedOpen || hasMultipleUnprotectedBuys) {
    const isHigh = unprotectedOpenPct >= 30 || unprotectedBuyTrades.length >= 4;
    const severity: WarningSeverity = isHigh ? 'High' : 'Medium';
    const unprotSymbols = unprotectedHoldings.map((h) => h.symbol).join(', ') || 'None';
    warnings.push({
      code: 'MISSING_STOP_LOSS',
      title: 'Missing Stop-Loss Protection',
      severity,
      explanation: `Trading without predefined stop-losses exposes capital to open-ended market drawdowns. You have ${unprotectedHoldings.length} open position(s) lacking stop-loss protection (${unprotectedOpenPct.toFixed(1)}% of equity), and ${unprotectedBuyTrades.length} historical BUY trade(s) executed without a stop.`,
      evidence: `Unprotected open holdings: ${unprotSymbols} (Value: ₹${unprotectedOpenMarketVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}, ${unprotectedOpenPct.toFixed(1)}% of equity). Unprotected BUY trades: ${unprotectedBuyTrades.length} of ${buyTrades.length}.`,
      recommended_action: 'Place an ATR-based stop-loss (1.5× ATR(14) below entry) immediately upon entering every position.',
      metric_value: Number(unprotectedOpenPct.toFixed(1)),
    });
  }

  // ==========================================
  // 5. EXCESSIVE CAPITAL RISK
  // ==========================================
  const availableCash = Math.max(0, portfolio.cashBalance || 0);
  const cashRatioPct = totalEquity > 0 ? (availableCash / totalEquity) * 100 : 100;

  let totalCapitalAtRisk = 0;
  for (const pos of holdings) {
    const marketVal = pos.quantity * pos.currentPrice;
    if (pos.stopLoss && pos.stopLoss > 0 && pos.stopLoss < pos.currentPrice) {
      totalCapitalAtRisk += Math.max(pos.currentPrice - pos.stopLoss, 0) * pos.quantity;
    } else {
      // Unprotected position tail risk estimated at 15% of market value
      totalCapitalAtRisk += 0.15 * marketVal;
    }
  }

  const capitalRiskPct = totalEquity > 0 ? (totalCapitalAtRisk / totalEquity) * 100 : 0;

  if (cashRatioPct < 10 || capitalRiskPct > 8) {
    const isHigh = cashRatioPct < 5 || capitalRiskPct > 12;
    const severity: WarningSeverity = isHigh ? 'High' : 'Medium';
    warnings.push({
      code: 'EXCESSIVE_CAPITAL_RISK',
      title: 'Excessive Capital at Risk / Depleted Cash Buffer',
      severity,
      explanation: `Your estimated portfolio capital at risk is ₹${totalCapitalAtRisk.toLocaleString('en-IN', { maximumFractionDigits: 2 })} (${capitalRiskPct.toFixed(1)}% of equity), and available cash reserve is ${cashRatioPct.toFixed(1)}%. Risk exceeding 8% or cash reserves below 10% leave zero margin for adverse volatility.`,
      evidence: `Available Cash: ₹${availableCash.toLocaleString('en-IN', { maximumFractionDigits: 2 })} (${cashRatioPct.toFixed(1)}% ratio). Estimated Capital at Risk: ₹${totalCapitalAtRisk.toLocaleString('en-IN', { maximumFractionDigits: 2 })} (${capitalRiskPct.toFixed(1)}% of equity).`,
      recommended_action: 'Maintain at least 15% cash reserve and restrict combined portfolio risk to under 5–8% of total equity.',
      metric_value: Number(capitalRiskPct.toFixed(1)),
    });
  }

  // ==========================================
  // 6. REPEATED LOSS-MAKING TRADES
  // ==========================================
  const closedTrades = safeTrades
    .filter((t) => t.side === 'SELL' || (t.realizedPnl !== undefined && t.realizedPnl !== 0))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let currentStreak = 0;
  let maxLosingStreak = 0;
  let losingTradesCount = 0;

  for (const tr of closedTrades) {
    if (tr.realizedPnl < 0) {
      currentStreak++;
      losingTradesCount++;
      if (currentStreak > maxLosingStreak) {
        maxLosingStreak = currentStreak;
      }
    } else {
      currentStreak = 0;
    }
  }

  const totalClosed = closedTrades.length;
  const lossRatePct = totalClosed > 0 ? (losingTradesCount / totalClosed) * 100 : 0;

  if (maxLosingStreak >= 3 || (totalClosed >= 4 && lossRatePct >= 65)) {
    const isHigh = maxLosingStreak >= 4 || lossRatePct >= 75;
    const severity: WarningSeverity = isHigh ? 'High' : 'Medium';
    warnings.push({
      code: 'REPEATED_LOSS_TRADES',
      title: 'Persistent Losing Streak / High Loss Rate',
      severity,
      explanation: `You have encountered ${maxLosingStreak} consecutive losing trades with an overall closed trade loss rate of ${lossRatePct.toFixed(1)}% (${losingTradesCount} losses in ${totalClosed} closed trades). Repeated losses suggest adverse market conditions or strategy mismatch.`,
      evidence: `Longest consecutive losing streak: ${maxLosingStreak} trades. Total closed trades: ${totalClosed}. Loss rate: ${lossRatePct.toFixed(1)}% (${losingTradesCount}/${totalClosed}).`,
      recommended_action: 'Pause live simulation, review recent trade logs in the AI Coach, and reduce position sizes by 50% until edge is re-established.',
      metric_value: maxLosingStreak,
    });
  }

  // ==========================================
  // 7. UNCONTROLLED HIGH VOLATILITY
  // ==========================================
  const highVolHoldings = holdings.filter((h) => {
    const vol = h.annualizedVolatility || 0;
    const expPct = totalEquity > 0 ? ((h.quantity * h.currentPrice) / totalEquity) * 100 : 0;
    const lacksStop = !h.stopLoss || h.stopLoss <= 0;
    return vol >= 35 && (lacksStop || expPct > 15);
  });

  const highVolBuys = buyTrades.filter((t) => {
    const vol = t.annualizedVolatility || 0;
    const expPct = totalEquity > 0 ? (t.totalValue / totalEquity) * 100 : 0;
    const lacksStop = !t.stopLoss || t.stopLoss <= 0;
    return vol >= 35 && (lacksStop || expPct > 15);
  });

  if (highVolHoldings.length > 0 || highVolBuys.length > 0) {
    const volSymbols = Array.from(new Set([...highVolHoldings.map((h) => h.symbol), ...highVolBuys.map((t) => t.symbol)])).join(', ');
    const maxVol = Math.max(
      ...highVolHoldings.map((h) => h.annualizedVolatility || 0),
      ...highVolBuys.map((t) => t.annualizedVolatility || 0),
      35,
    );
    warnings.push({
      code: 'UNCONTROLLED_HIGH_VOLATILITY',
      title: 'Uncontrolled High Volatility Exposure',
      severity: 'High',
      explanation: `Positions in high-volatility securities (annualized volatility ≥ 35%) lack tight stop-loss controls or exceed 15% of your portfolio equity. High-beta and high-volatility stocks require strict sizing and stops.`,
      evidence: `Affected symbols: ${volSymbols || 'High-volatility stocks'}. Peak volatility observed: ${maxVol.toFixed(1)}% annualized (Threshold: 35.0%).`,
      recommended_action: 'Reduce position size on high-beta names to under 10% of portfolio equity and set guaranteed stops within 1.5× ATR.',
      metric_value: Number(maxVol.toFixed(1)),
    });
  }

  return warnings;
}
