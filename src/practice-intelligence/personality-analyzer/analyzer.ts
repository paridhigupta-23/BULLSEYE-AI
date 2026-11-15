import type {
  PortfolioPosition,
  TraderPersonalityMetrics,
  TraderPersonalityReport,
  TraderProfileType,
  VirtualPortfolio,
  VirtualTrade,
} from '../types.ts';

export function analyzeTradingPersonality(
  portfolio: VirtualPortfolio,
  trades: VirtualTrade[],
): TraderPersonalityReport {
  const safeTrades = trades || [];
  const holdings = portfolio.holdings || [];
  const totalEquity = Math.max(0, portfolio.totalPortfolioValue || 0);
  const cashBalance = Math.max(0, portfolio.cashBalance || 0);

  // 1. Active Trading Days & Trades per Active Day
  const activeDaysSet = new Set<string>();
  for (const t of safeTrades) {
    const d = t.datasetPriceDate || (t.timestamp ? t.timestamp.slice(0, 10) : '');
    if (d) activeDaysSet.add(d);
  }
  const activeTradingDaysCount = Math.max(1, activeDaysSet.size);
  const totalTradesCount = safeTrades.length;
  const tradesPerActiveDay = totalTradesCount > 0
    ? Number((totalTradesCount / activeTradingDaysCount).toFixed(2))
    : 0;

  // 2. Average Trade Size & Percentage of Equity
  let totalTradeVolumeINR = 0;
  for (const t of safeTrades) {
    totalTradeVolumeINR += t.totalValue || (t.quantity * t.price) || 0;
  }
  const averageTradeSizeINR = totalTradesCount > 0
    ? Number((totalTradeVolumeINR / totalTradesCount).toFixed(2))
    : 0;

  const averageTradePercentageOfEquity = totalEquity > 0 && totalTradesCount > 0
    ? Number(((averageTradeSizeINR / totalEquity) * 100).toFixed(2))
    : 0;

  // 3. Stop-Loss Coverage Percentage
  const buyTrades = safeTrades.filter((t) => t.side === 'BUY');
  let stopLossCoveragePercentage = 100;
  if (buyTrades.length > 0) {
    const protectedBuys = buyTrades.filter((t) => t.stopLoss && t.stopLoss > 0).length;
    stopLossCoveragePercentage = Number(((protectedBuys / buyTrades.length) * 100).toFixed(1));
  } else if (holdings.length > 0) {
    const protectedHoldings = holdings.filter((h) => h.stopLoss && h.stopLoss > 0).length;
    stopLossCoveragePercentage = Number(((protectedHoldings / holdings.length) * 100).toFixed(1));
  }

  // 4. Win Rate (Closed Trades)
  const closedTrades = safeTrades.filter(
    (t) => t.side === 'SELL' || (t.realizedPnl !== undefined && t.realizedPnl !== 0),
  );
  const winningTrades = closedTrades.filter((t) => t.realizedPnl > 0).length;
  const winRate = closedTrades.length > 0
    ? Number(((winningTrades / closedTrades.length) * 100).toFixed(1))
    : 0;

  // 5. Average Holding Hours
  let totalHoldingHours = 0;
  let tradesWithHoldingHours = 0;
  for (const t of safeTrades) {
    if (t.holdingHours !== undefined && t.holdingHours > 0) {
      totalHoldingHours += t.holdingHours;
      tradesWithHoldingHours++;
    }
  }
  const averageHoldingHours = tradesWithHoldingHours > 0
    ? Number((totalHoldingHours / tradesWithHoldingHours).toFixed(1))
    : (totalTradesCount >= 10 ? 4 : 48); // default conservative estimate if unrecorded

  // 6. Average Annualized Volatility
  let totalVol = 0;
  let volCount = 0;
  for (const h of holdings) {
    if (h.annualizedVolatility !== undefined && h.annualizedVolatility > 0) {
      totalVol += h.annualizedVolatility;
      volCount++;
    }
  }
  for (const t of safeTrades) {
    if (t.annualizedVolatility !== undefined && t.annualizedVolatility > 0) {
      totalVol += t.annualizedVolatility;
      volCount++;
    }
  }
  const averageAnnualizedVolatility = volCount > 0
    ? Number((totalVol / volCount).toFixed(1))
    : 22.5; // NIFTY 50 baseline average

  // 7. Maximum Position Weight
  let maximumPositionWeight = 0;
  if (totalEquity > 0) {
    for (const h of holdings) {
      const weight = ((h.quantity * h.currentPrice) / totalEquity) * 100;
      if (weight > maximumPositionWeight) {
        maximumPositionWeight = weight;
      }
    }
  }
  maximumPositionWeight = Number(maximumPositionWeight.toFixed(1));

  // 8. Cash Reserve Percentage
  const cashReservePercentage = totalEquity > 0
    ? Number(((cashBalance / totalEquity) * 100).toFixed(1))
    : 100;

  const metrics: TraderPersonalityMetrics = {
    tradesPerActiveDay,
    averageTradeSizeINR,
    averageTradePercentageOfEquity,
    stopLossCoveragePercentage,
    winRate,
    averageHoldingHours,
    averageAnnualizedVolatility,
    maximumPositionWeight,
    cashReservePercentage,
    totalTradesCount,
    activeTradingDaysCount,
  };

  // Profile Determination with strict precedence:
  // 1. Overtrader
  // 2. Risk-Taking Trader
  // 3. Momentum Chaser
  // 4. Disciplined Trader
  // 5. Conservative Trader (Default)

  const isOvertrader = tradesPerActiveDay >= 5 || (totalTradesCount >= 10 && averageHoldingHours < 6);
  const isRiskTaking = maximumPositionWeight >= 30 || (averageTradePercentageOfEquity >= 22 && stopLossCoveragePercentage < 50);
  const isMomentumChaser = averageAnnualizedVolatility >= 34 && averageHoldingHours <= 24 && stopLossCoveragePercentage < 60;
  const isDisciplined = stopLossCoveragePercentage >= 75 && maximumPositionWeight <= 30 && winRate >= 50 && (cashReservePercentage >= 10 && cashReservePercentage <= 65);

  let profile: TraderProfileType = 'Conservative Trader';
  const supporting_evidence: string[] = [];
  let strengths: string[] = [];
  let weaknesses: string[] = [];
  let suggestions: string[] = [];

  if (isOvertrader) {
    profile = 'Overtrader';
    supporting_evidence.push(
      `High trading frequency: ${tradesPerActiveDay} trades per active day across ${activeTradingDaysCount} trading sessions.`,
      `Short holding time: average ${averageHoldingHours} hours per trade with ${totalTradesCount} total executions.`,
    );
    strengths = ['High market responsiveness', 'Active trade execution capability', 'Rapid capital redeployment'];
    weaknesses = ['Excessive commission and slippage drag', 'Vulnerability to intraday market noise', 'Emotional overtrading risk'];
    suggestions = [
      'Institute a strict daily circuit breaker of maximum 2 trades per day.',
      'Transition to 3-day swing horizons to let profitable trends develop.',
      'Log trade pre-commitments in a journal before entering tickets.',
    ];
  } else if (isRiskTaking) {
    profile = 'Risk-Taking Trader';
    supporting_evidence.push(
      `Heavy position concentration: maximum single holding represents ${maximumPositionWeight}% of total equity (threshold 30%).`,
      `Aggressive sizing: average trade size is ${averageTradePercentageOfEquity}% of equity with ${stopLossCoveragePercentage}% stop-loss coverage.`,
    );
    strengths = ['High conviction sizing', 'Ability to capture outsized gains in strong bull trends', 'Decisive execution'];
    weaknesses = ['Susceptibility to severe portfolio drawdowns', 'Inadequate stop-loss discipline', 'Single-stock black swan vulnerability'];
    suggestions = [
      'Cap maximum single-stock exposure at 15–20% of total portfolio equity.',
      'Enforce mandatory 1.5× ATR stop-losses on 100% of open positions.',
      'Scale into positions in thirds (33%/33%/34%) rather than entering all at once.',
    ];
  } else if (isMomentumChaser) {
    profile = 'Momentum Chaser';
    supporting_evidence.push(
      `High portfolio volatility: average annualized volatility is ${averageAnnualizedVolatility}% (threshold 34%).`,
      `Rapid turnover: average holding period is ${averageHoldingHours} hours with only ${stopLossCoveragePercentage}% stop-loss coverage.`,
    );
    strengths = ['Strong trend awareness', 'Speed in identifying breakout momentum', 'Comfort with fast-moving stocks'];
    weaknesses = ['Buying at the peak of extended moves', 'Lack of risk management when momentum reverses', 'Whipsaw susceptibility'];
    suggestions = [
      'Avoid buying stocks when RSI(14) exceeds 70; wait for mean-reversion pullbacks to SMA(20).',
      'Lock in partial profits at predefined 2:1 reward-to-risk levels.',
      'Never trade momentum breakouts without a hard ATR stop placed below the breakout candle.',
    ];
  } else if (isDisciplined) {
    profile = 'Disciplined Trader';
    supporting_evidence.push(
      `Strong risk controls: ${stopLossCoveragePercentage}% of trades protected with stop-losses (threshold ≥75%).`,
      `Prudent diversification: maximum single holding capped at ${maximumPositionWeight}% of equity (threshold ≤30%).`,
      `Healthy metrics: win rate is ${winRate}% and cash reserve is ${cashReservePercentage}% of equity.`,
    );
    strengths = ['Consistent risk management', 'Balanced position sizing', 'Long-term capital preservation mindset'];
    weaknesses = ['Can occasionally exit winning runners prematurely', 'May be hesitant to scale size on A+ setups'];
    suggestions = [
      'Maintain existing stop-loss and diversification rules.',
      'Consider using trailing ATR stops to ride extended macro trends.',
      'Explore multi-factor quantitative models in the Broker terminal to refine entry timing.',
    ];
  } else {
    // Default: Conservative Trader
    profile = 'Conservative Trader';
    supporting_evidence.push(
      `High cash preservation: ${cashReservePercentage}% of portfolio held in liquid virtual cash.`,
      `Low turnover: ${totalTradesCount} total virtual trades executed across ${activeTradingDaysCount} active sessions.`,
      `Controlled sizing: maximum position weight is ${maximumPositionWeight}% of total equity.`,
    );
    strengths = ['Excellent downside capital preservation', 'Zero risk of panic liquidation', 'Patient, deliberate approach'];
    weaknesses = ['Potential cash drag during strong market uptrends', 'Underutilization of available investment capital'];
    suggestions = [
      'Gradually deploy idle cash into high-conviction NIFTY 50 blue chips using dollar-cost averaging.',
      'Review quantitative model signals for top-tier liquid leaders (RELIANCE, TCS, INFY).',
      'Use the What-If Simulator to evaluate the risk/reward of simulated 5% and 10% allocations.',
    ];
  }

  return {
    profile,
    educational_disclaimer:
      'This is an educational classification based on observed virtual trading activity, not a psychological diagnosis or financial recommendation.',
    supporting_evidence,
    strengths,
    weaknesses,
    suggestions,
    metrics,
  };
}
