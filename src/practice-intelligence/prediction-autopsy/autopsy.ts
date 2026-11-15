import type {
  AIPredictionRecord,
  PredictionAutopsyReport,
  PredictionEvaluationItem,
  PriceBar,
} from '../types.ts';

export function evaluatePredictions(
  predictions: AIPredictionRecord[],
  priceBars: PriceBar[],
): PredictionAutopsyReport {
  const safePredictions = predictions || [];
  const safeBars = priceBars || [];

  // Group and sort price bars chronologically by symbol
  const barsBySymbol = new Map<string, PriceBar[]>();
  for (const bar of safeBars) {
    const sym = bar.symbol.toUpperCase();
    const list = barsBySymbol.get(sym) ?? [];
    list.push(bar);
    barsBySymbol.set(sym, list);
  }

  for (const list of barsBySymbol.values()) {
    list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  const evaluations: PredictionEvaluationItem[] = [];
  let correctCount = 0;
  let incorrectCount = 0;
  let missingDataCount = 0;
  let totalHypotheticalReturn = 0;
  let brierSquaredErrorSum = 0;
  let validBrierCount = 0;

  for (const pred of safePredictions) {
    const sym = pred.symbol.toUpperCase();
    const symBars = barsBySymbol.get(sym) || [];
    const predTime = new Date(pred.prediction_timestamp).getTime();

    // STRICT NO-LOOK-AHEAD: First bar with timestamp strictly greater than prediction_timestamp
    let firstSubsequentBar: PriceBar | null = null;
    for (const b of symBars) {
      const bTime = new Date(b.timestamp).getTime();
      if (bTime > predTime) {
        firstSubsequentBar = b;
        break;
      }
    }

    if (!firstSubsequentBar) {
      missingDataCount++;
      evaluations.push({
        prediction_id: pred.prediction_id,
        symbol: pred.symbol,
        predicted_signal: pred.predicted_signal,
        confidence: pred.confidence,
        prediction_timestamp: pred.prediction_timestamp,
        price_at_prediction: pred.price_at_prediction,
        subsequent_bar_timestamp: null,
        subsequent_price: null,
        actual_return_pct: null,
        hypothetical_return_pct: null,
        was_correct: null,
        status: 'MISSING_OUTCOME_DATA',
      });
      continue;
    }

    const subPrice = firstSubsequentBar.close;
    const predPrice = pred.price_at_prediction;
    const actualReturnPct = predPrice > 0
      ? ((subPrice - predPrice) / predPrice) * 100
      : 0;

    let wasCorrect = false;
    let hypotheticalReturnPct = 0;

    if (pred.predicted_signal === 'BUY') {
      wasCorrect = actualReturnPct > 0;
      hypotheticalReturnPct = actualReturnPct;
    } else if (pred.predicted_signal === 'SELL') {
      wasCorrect = actualReturnPct < 0;
      hypotheticalReturnPct = -actualReturnPct;
    } else {
      // HOLD signal
      wasCorrect = Math.abs(actualReturnPct) <= 1.25;
      hypotheticalReturnPct = 0;
    }

    if (wasCorrect) {
      correctCount++;
    } else {
      incorrectCount++;
    }

    totalHypotheticalReturn += hypotheticalReturnPct;

    // Brier Score calculation: (confidence - binaryOutcome)^2
    if (pred.confidence >= 0 && pred.confidence <= 1) {
      const outcome = wasCorrect ? 1 : 0;
      brierSquaredErrorSum += Math.pow(pred.confidence - outcome, 2);
      validBrierCount++;
    }

    evaluations.push({
      prediction_id: pred.prediction_id,
      symbol: pred.symbol,
      predicted_signal: pred.predicted_signal,
      confidence: pred.confidence,
      prediction_timestamp: pred.prediction_timestamp,
      price_at_prediction: pred.price_at_prediction,
      subsequent_bar_timestamp: firstSubsequentBar.timestamp,
      subsequent_price: Number(subPrice.toFixed(2)),
      actual_return_pct: Number(actualReturnPct.toFixed(2)),
      hypothetical_return_pct: Number(hypotheticalReturnPct.toFixed(2)),
      was_correct: wasCorrect,
      status: 'EVALUATED',
    });
  }

  const evaluatedCount = correctCount + incorrectCount;
  const directionalAccuracyPct = evaluatedCount > 0
    ? Number(((correctCount / evaluatedCount) * 100).toFixed(1))
    : 0;

  const averageHypotheticalReturnPct = evaluatedCount > 0
    ? Number((totalHypotheticalReturn / evaluatedCount).toFixed(2))
    : 0;

  const brierCalibrationScore = validBrierCount > 0
    ? Number((brierSquaredErrorSum / validBrierCount).toFixed(4))
    : null;

  return {
    totalPredictions: safePredictions.length,
    evaluatedPredictionsCount: evaluatedCount,
    missingDataCount,
    directionalAccuracyPct,
    averageHypotheticalReturnPct,
    brierCalibrationScore,
    correctCount,
    incorrectCount,
    evaluations,
  };
}
