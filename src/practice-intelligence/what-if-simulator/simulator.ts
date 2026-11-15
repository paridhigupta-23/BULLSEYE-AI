import type {
  PortfolioPosition,
  VirtualPortfolio,
  WhatIfPositionBreakdown,
  WhatIfRequest,
  WhatIfSimulationResult,
} from '../types.ts';

export function runWhatIfSimulation(
  portfolio: VirtualPortfolio,
  request: WhatIfRequest,
): WhatIfSimulationResult {
  const currentCash = Math.max(0, portfolio.cashBalance ?? 0);
  const targetSymbol = (request.targetSymbol || 'ALL').trim().toUpperCase();
  
  // Clamped price change between -95% and +500%
  const priceChangePct = Math.max(-95, Math.min(500, Number(request.priceChangePct) || 0));
  const hypotheticalInvestmentDelta = Number(request.hypotheticalInvestmentDelta) || 0;

  const simulatedVirtualCash = currentCash - hypotheticalInvestmentDelta;

  let cashWarning: string | null = null;
  if (hypotheticalInvestmentDelta > currentCash) {
    const deficit = hypotheticalInvestmentDelta - currentCash;
    cashWarning = `Hypothetical investment of ₹${hypotheticalInvestmentDelta.toLocaleString('en-IN', { maximumFractionDigits: 2 })} exceeds available cash of ₹${currentCash.toLocaleString('en-IN', { maximumFractionDigits: 2 })} by ₹${deficit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}.`;
  }

  const holdings = portfolio.holdings || [];
  const currentPortfolioValue = holdings.reduce((sum, h) => sum + (h.marketValue || (h.quantity * h.currentPrice)), 0);

  const breakdowns: WhatIfPositionBreakdown[] = [];

  const isAll = targetSymbol === 'ALL';
  const targetedHoldings = isAll
    ? holdings
    : holdings.filter((h) => h.symbol.toUpperCase() === targetSymbol);

  const totalTargetedMarketValue = targetedHoldings.reduce(
    (sum, h) => sum + (h.marketValue || (h.quantity * h.currentPrice)),
    0,
  );

  for (const pos of holdings) {
    const isTargeted = isAll || pos.symbol.toUpperCase() === targetSymbol;
    const curPrice = pos.currentPrice;
    const curMarketVal = pos.marketValue || (pos.quantity * curPrice);

    let allocatedDelta = 0;
    if (isTargeted) {
      if (isAll) {
        allocatedDelta = totalTargetedMarketValue > 0
          ? (curMarketVal / totalTargetedMarketValue) * hypotheticalInvestmentDelta
          : (holdings.length > 0 ? hypotheticalInvestmentDelta / holdings.length : 0);
      } else {
        allocatedDelta = hypotheticalInvestmentDelta;
      }
    }

    const simPrice = isTargeted ? curPrice * (1 + priceChangePct / 100) : curPrice;
    const baseVal = Math.max(0, curMarketVal + allocatedDelta);
    const simMarketVal = isTargeted ? baseVal * (1 + priceChangePct / 100) : curMarketVal;

    const pnlDelta = simMarketVal - curMarketVal - allocatedDelta;
    const pnlDeltaPct = (curMarketVal + allocatedDelta) > 0
      ? (pnlDelta / (curMarketVal + allocatedDelta)) * 100
      : priceChangePct;

    breakdowns.push({
      symbol: pos.symbol,
      name: pos.name || pos.symbol,
      currentQuantity: pos.quantity,
      currentPrice: Number(curPrice.toFixed(2)),
      simulatedPrice: Number(simPrice.toFixed(2)),
      currentMarketValue: Number(curMarketVal.toFixed(2)),
      allocatedInvestmentDelta: Number(allocatedDelta.toFixed(2)),
      simulatedMarketValue: Number(simMarketVal.toFixed(2)),
      pnlDelta: Number(pnlDelta.toFixed(2)),
      pnlDeltaPct: Number(pnlDeltaPct.toFixed(2)),
    });
  }

  // If a single stock was targeted but not currently in holdings, include simulated single stock if delta > 0
  if (!isAll && targetedHoldings.length === 0 && hypotheticalInvestmentDelta !== 0) {
    const baseVal = Math.max(0, hypotheticalInvestmentDelta);
    const simMarketVal = baseVal * (1 + priceChangePct / 100);
    const pnlDelta = simMarketVal - baseVal;
    breakdowns.push({
      symbol: targetSymbol,
      name: targetSymbol,
      currentQuantity: 0,
      currentPrice: 100, // reference price placeholder
      simulatedPrice: Number((100 * (1 + priceChangePct / 100)).toFixed(2)),
      currentMarketValue: 0,
      allocatedInvestmentDelta: Number(hypotheticalInvestmentDelta.toFixed(2)),
      simulatedMarketValue: Number(simMarketVal.toFixed(2)),
      pnlDelta: Number(pnlDelta.toFixed(2)),
      pnlDeltaPct: Number(priceChangePct.toFixed(2)),
    });
  }

  const simulatedPortfolioValue = breakdowns.reduce((sum, b) => sum + b.simulatedMarketValue, 0);
  const currentTotalEquity = currentCash + currentPortfolioValue;
  const simulatedTotalEquity = simulatedVirtualCash + simulatedPortfolioValue;
  const absoluteProfitLoss = simulatedTotalEquity - currentTotalEquity;
  const percentageChange = currentTotalEquity > 0
    ? (absoluteProfitLoss / currentTotalEquity) * 100
    : 0;

  return {
    disclaimer: 'HYPOTHETICAL SIMULATION — NOT A MARKET PREDICTION',
    targetSymbol,
    priceChangePct,
    hypotheticalInvestmentDelta,
    currentPortfolioValue: Number(currentPortfolioValue.toFixed(2)),
    simulatedPortfolioValue: Number(simMarketValueRound(simulatedPortfolioValue)),
    currentTotalEquity: Number(currentTotalEquity.toFixed(2)),
    simulatedTotalEquity: Number(simulatedTotalEquity.toFixed(2)),
    absoluteProfitLoss: Number(absoluteProfitLoss.toFixed(2)),
    percentageChange: Number(percentageChange.toFixed(2)),
    currentVirtualCash: Number(currentCash.toFixed(2)),
    simulatedVirtualCash: Number(simulatedVirtualCash.toFixed(2)),
    cashWarning,
    positionsBreakdown: breakdowns,
  };
}

function simMarketValueRound(val: number): number {
  return Math.round(val * 100) / 100;
}
