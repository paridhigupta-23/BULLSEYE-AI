import type {
  CoachContext,
  CoachResponse,
} from '../types.ts';

export async function generateCoachResponse(
  context: CoachContext,
  llmCallable?: (prompt: string, sysInst: string) => Promise<{ ok: boolean; reply?: string; error?: string }>,
): Promise<CoachResponse> {
  const { portfolio, mistakes, personality, autopsy, latestSimulation, userQuestion } = context;
  const totalEquity = Math.max(0, portfolio.totalPortfolioValue || 0);
  const cash = Math.max(0, portfolio.cashBalance || 0);
  const cashRatioPct = totalEquity > 0 ? (cash / totalEquity) * 100 : 100;
  const warningsCount = (mistakes || []).length;
  const profile = personality?.profile || 'Conservative Trader';
  const verifiedAccuracyPct = autopsy?.directionalAccuracyPct || 0;

  const contextSummary = {
    totalEquity: Number(totalEquity.toFixed(2)),
    cashRatioPct: Number(cashRatioPct.toFixed(1)),
    activeWarningsCount: warningsCount,
    profile,
    verifiedAccuracyPct: Number(verifiedAccuracyPct.toFixed(1)),
  };

  const defaultRecommendedActions = [
    'Enforce a strict 1.5× ATR stop-loss on every open position.',
    'Keep cash reserves at or above 15% of portfolio equity.',
    'Limit single-stock exposure to under 20% of total portfolio value.',
    'Maintain a maximum of 2–3 trade setups per active trading day.',
  ];

  // Try LLM Callable if provided
  if (llmCallable) {
    const systemPrompt = `You are the BULLSEYE AI Practice Intelligence Coach for the Indian stock market (NSE NIFTY 50).
You provide educational trading coaching grounded strictly in the user's actual virtual portfolio and performance metrics.

CRITICAL RULES:
1. Ground every numeric figure strictly in the provided Context. Never invent prices, profits, trades, or model accuracy.
2. Clearly state that all practice trades are simulated with ₹10,00,000 starting virtual capital based on historical dataset closes (2020–2025).
3. Distinguish educational analysis from financial advice. Never guarantee returns or provide personal investment recommendations.
4. If a question is about detected mistakes, explain the exact mathematical thresholds (e.g. Overtrading ≥6 trades/day, Single-stock >25% equity, HHI ≥0.35).
5. Tone: professional, analytical, encouraging, and focused on risk-first discipline.`;

    const userPrompt = `
CURRENT VIRTUAL PORTFOLIO CONTEXT:
- Total Virtual Equity: ₹${totalEquity.toLocaleString('en-IN', { maximumFractionDigits: 2 })} (Starting: ₹10,00,000)
- Available Virtual Cash: ₹${cash.toLocaleString('en-IN', { maximumFractionDigits: 2 })} (${cashRatioPct.toFixed(1)}% cash ratio)
- Active Holdings (${portfolio.holdings?.length || 0}): ${portfolio.holdings?.map((h) => `${h.symbol} (${h.quantity} shares @ ₹${h.currentPrice.toFixed(2)}, allocation ${h.allocationPct?.toFixed(1) || 0}%, P&L: ₹${h.unrealizedPnl.toFixed(2)})`).join(', ') || 'No active positions'}
- Active Trading Mistakes (${warningsCount}):
${mistakes.map((m) => `  * [${m.severity}] ${m.code}: ${m.title} — ${m.explanation} Evidence: ${m.evidence}`).join('\n') || '  * None'}
- Trader Personality Profile: ${profile} (Trades/day: ${personality?.metrics?.tradesPerActiveDay || 0}, Stop-Loss Coverage: ${personality?.metrics?.stopLossCoveragePercentage || 0}%, Win Rate: ${personality?.metrics?.winRate || 0}%)
- AI Prediction Autopsy: ${autopsy?.evaluatedPredictionsCount || 0} historical predictions evaluated with ${verifiedAccuracyPct.toFixed(1)}% directional accuracy and ${autopsy?.averageHypotheticalReturnPct?.toFixed(2) || 0}% avg hypothetical return (Strict no-look-ahead).
${latestSimulation ? `- Latest What-If Simulation: Target ${latestSimulation.targetSymbol}, Price Change ${latestSimulation.priceChangePct}%, Equity Change: ₹${latestSimulation.absoluteProfitLoss.toFixed(2)} (${latestSimulation.percentageChange.toFixed(2)}%)` : ''}

USER QUESTION / FOCUS:
${userQuestion || 'Provide a comprehensive coaching review of my trading behavior, mistake warnings, and key areas for improvement.'}
`;

    try {
      const res = await llmCallable(userPrompt, systemPrompt);
      if (res.ok && res.reply && res.reply.trim().length > 0) {
        return {
          answer: res.reply.trim(),
          source: 'gemini',
          contextSummary,
          recommendedActions: mistakes.length > 0
            ? mistakes.slice(0, 3).map((m) => m.recommended_action)
            : defaultRecommendedActions,
        };
      }
    } catch {
      // Fall through to deterministic fallback
    }
  }

  // Deterministic Fallback Responder
  const q = (userQuestion || '').toLowerCase();
  let answer = '';

  if (q.includes('mistake') || q.includes('warning') || q.includes('risk')) {
    if (warningsCount === 0) {
      answer = `### Practice Trading Intelligence Audit: Zero Warnings Detected

Your virtual portfolio is currently operating within standard risk parameters:
- **Total Virtual Equity:** ₹${totalEquity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
- **Cash Buffer:** ₹${cash.toLocaleString('en-IN', { maximumFractionDigits: 2 })} (${cashRatioPct.toFixed(1)}% reserve ratio)
- **Concentration:** All open positions are capped under 25% of total equity.

Keep maintaining strict position sizing and always attach an ATR-based stop-loss before entering new simulated orders.`;
    } else {
      const warningDetails = mistakes
        .map((m, i) => `${i + 1}. **[${m.severity} Severity] ${m.title}**\n   - *Why triggered:* ${m.explanation}\n   - *Evidence:* ${m.evidence}\n   - *Remedy:* ${m.recommended_action}`)
        .join('\n\n');

      answer = `### Practice Trading Intelligence Audit: ${warningsCount} Active Mistake(s) Detected

Based on deterministic rule evaluation across your ${portfolio.holdings?.length || 0} open position(s) and transaction logs:

${warningDetails}

**Educational Takeaway:** In live market conditions, risk management precedes return generation. Resolving high-severity warnings directly protects your capital from deep drawdowns.`;
    }
  } else if (q.includes('concentration') || q.includes('diversif') || q.includes('allocation')) {
    const topHoldings = [...(portfolio.holdings || [])].sort((a, b) => (b.quantity * b.currentPrice) - (a.quantity * a.currentPrice));
    const topList = topHoldings.slice(0, 3).map((h) => `- **${h.symbol}**: ₹${(h.quantity * h.currentPrice).toLocaleString('en-IN', { maximumFractionDigits: 2 })} (${((h.quantity * h.currentPrice / (totalEquity || 1)) * 100).toFixed(1)}% of equity)`).join('\n');

    answer = `### Understanding Portfolio Concentration & Sizing Discipline

- **Current Equity:** ₹${totalEquity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
- **Open Holdings:** ${portfolio.holdings?.length || 0} active positions
${topList || '- No open holdings.'}

**How to reduce concentration:**
1. **Rule of 20%:** Never allocate more than 20% of your total equity to any single security.
2. **Sector Decoupling:** Distribute capital across at least 4 independent sectors (e.g., Banking, Energy, IT, FMCG).
3. **Cash Buffer:** Retain at least 15% liquid virtual cash to exploit short-term volatility dips.`;
  } else if (q.includes('stop loss') || q.includes('stop-loss') || q.includes('protect')) {
    answer = `### Why Stop-Losses Are Mandatory in Algorithmic & Discretionary Trading

In trading, **capital preservation is rule #1**. Without an explicit stop-loss:
1. A single adverse gap or trend reversal can wipe out months of cumulative gains.
2. Emotional biases (loss aversion and anchoring) encourage holding losers while cutting winners short.
3. Tail risk escalates quadratically: recovering from a 50% drawdown requires a 100% gain just to break even.

**Recommended Method (1.5× ATR):**
Use the 14-day Average True Range (ATR). Place your stop-loss at:
$$\\text{Stop-Loss} = \\text{Entry Price} - 1.5 \\times \\text{ATR}(14)$$
This accommodates natural market noise while cutting trades when structural invalidation occurs.`;
  } else if (q.includes('autopsy') || q.includes('prediction') || q.includes('model') || q.includes('accuracy')) {
    answer = `### AI Prediction Autopsy Analysis (Strict No-Look-Ahead)

Historical AI signals are audited by evaluating predictions exclusively against the **first subsequent trading session close** timestamped after each signal:
- **Total Predictions Audited:** ${autopsy?.totalPredictions || 0}
- **Evaluated Outcomes:** ${autopsy?.evaluatedPredictionsCount || 0} (${autopsy?.missingDataCount || 0} awaiting subsequent outcome data)
- **Directional Accuracy:** ${verifiedAccuracyPct.toFixed(1)}% (${autopsy?.correctCount || 0} correct vs ${autopsy?.incorrectCount || 0} incorrect)
- **Average Hypothetical Return:** ${autopsy?.averageHypotheticalReturnPct?.toFixed(2) || 0}%
- **Brier Calibration Score:** ${autopsy?.brierCalibrationScore !== null ? autopsy?.brierCalibrationScore.toFixed(4) : 'N/A'} (Lower is better; 0 = perfect calibration)

**Insight:** Models provide probabilistic edges, not certainties. Even a model with 60% accuracy will experience 4 losses out of every 10 trades, making stop-loss discipline essential.`;
  } else if (q.includes('what-if') || q.includes('simulation') || q.includes('simulate')) {
    if (latestSimulation) {
      answer = `### Interpretation of Latest What-If Simulation

- **Target:** ${latestSimulation.targetSymbol}
- **Hypothetical Price Shock:** ${latestSimulation.priceChangePct >= 0 ? '+' : ''}${latestSimulation.priceChangePct}%
- **Hypothetical Investment Delta:** ₹${latestSimulation.hypotheticalInvestmentDelta.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
- **Current Total Equity:** ₹${latestSimulation.currentTotalEquity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
- **Simulated Total Equity:** ₹${latestSimulation.simulatedTotalEquity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
- **Projected P&L Impact:** ${latestSimulation.absoluteProfitLoss >= 0 ? '+' : ''}₹${latestSimulation.absoluteProfitLoss.toLocaleString('en-IN', { maximumFractionDigits: 2 })} (${latestSimulation.percentageChange >= 0 ? '+' : ''}${latestSimulation.percentageChange.toFixed(2)}%)
${latestSimulation.cashWarning ? `\n> [!WARNING]\n> ${latestSimulation.cashWarning}` : ''}

*Disclaimer: This is a mathematical scenario analysis, not a market price prediction. Actual historical practice balances remain untouched.*`;
    } else {
      answer = `### What-If Scenario Stress Testing Guide

The What-If Simulator allows you to stress-test your portfolio against sudden price shocks (-10%, -5%, +5%, +10% or custom -95% to +500%) without placing actual orders or altering your ₹10,00,000 wallet.

**Best Practice:** Before taking a large position, simulate a -10% market crash. If the simulated equity drawdown exceeds your risk tolerance, reduce your planned order size.`;
    }
  } else {
    // General comprehensive review
    answer = `### BULLSEYE AI Practice Intelligence Comprehensive Review

- **Virtual Wallet Capital:** ₹${totalEquity.toLocaleString('en-IN', { maximumFractionDigits: 2 })} (Starting: ₹10,00,000)
- **Available Cash Buffer:** ₹${cash.toLocaleString('en-IN', { maximumFractionDigits: 2 })} (${cashRatioPct.toFixed(1)}%)
- **Identified Trader Profile:** **${profile}**
- **Active Mistake Alerts:** ${warningsCount} ${warningsCount === 1 ? 'alert' : 'alerts'} detected
- **AI Historical Accuracy:** ${verifiedAccuracyPct.toFixed(1)}% (${autopsy?.evaluatedPredictionsCount || 0} evaluated signals)

**Priority Coaching Advice:**
${mistakes.length > 0 ? mistakes.map((m) => `* **${m.title}:** ${m.recommended_action}`).join('\n') : defaultRecommendedActions.map((a) => `* ${a}`).join('\n')}

*Educational Notice: BULLSEYE AI is designed for pedagogical purposes based on historical NSE NIFTY 50 market data. Always perform independent verification.*`;
  }

  return {
    answer,
    source: 'deterministic_fallback',
    contextSummary,
    recommendedActions: mistakes.length > 0
      ? mistakes.slice(0, 3).map((m) => m.recommended_action)
      : defaultRecommendedActions,
  };
}
