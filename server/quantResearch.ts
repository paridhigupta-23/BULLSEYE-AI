import type {
  AdvancedRiskResponse,
  DatasetFeatureStat,
  DatasetInspectionResponse,
  FeatureRow,
  FinalPerformanceResponse,
  MathLabCalculationItem,
  MathLabResponse,
  ModelComparisonItem,
  ModelComparisonResponse,
  ModelType,
  OptimizationResult,
  SignalDirection,
  StrategySignalRecord,
  StrategySignalResponse,
  TradingStrategyId,
  WalkForwardResponse,
  WalkForwardWindowResult,
} from './types.ts';
import { loadDatasets } from './dataLoader.ts';
import { listBacktestRuns, listRealInvestorAggregateHoldings } from './db.ts';
import {
  calculateRiskMetrics,
  classifySignal,
  evaluatePredictions,
  EXCLUDED_LEAKAGE_COLUMNS,
  extractFeatureVector,
  FEATURE_LABELS,
  fitGarch11,
  ML_FEATURE_COLUMNS,
  predictProbabilityForRowIndex,
  trainChronologicalModelWithOptions,
} from './quantMath.ts';
import { mlStore } from './mlStore.ts';

const FEATURE_META: Record<
  string,
  { formula: string; tellsModel: string; tradingUsefulness: string }
> = {
  daily_return: {
    formula: '(Close_t − Close_{t−1}) / Close_{t−1}',
    tellsModel: 'Captures single-session price momentum and short-term return shocks.',
    tradingUsefulness: 'Identifies continuation bursts or immediate overreaction mean-reversion.',
  },
  sma_20: {
    formula: '(1/20) · Σ_{i=0..19} Close_{t−i}',
    tellsModel: 'Measures the 1-month medium trend price baseline.',
    tradingUsefulness: 'Acts as dynamic trend support/resistance for swing positioning.',
  },
  sma_50: {
    formula: '(1/50) · Σ_{i=0..49} Close_{t−i}',
    tellsModel: 'Captures the intermediate ~2.5-month institutional trend direction.',
    tradingUsefulness: 'Provides Golden/Death Cross structural regime filtering with SMA 20.',
  },
  ema_12: {
    formula: 'Price_t·k + EMA_{t−1}·(1−k), k = 2/13',
    tellsModel: 'Fast exponentially decaying price anchor weighting recent bars higher.',
    tradingUsefulness: 'Reacts rapidly to shifts in short-term buyer/seller aggression.',
  },
  ema_26: {
    formula: 'Price_t·k + EMA_{t−1}·(1−k), k = 2/27',
    tellsModel: 'Medium exponentially weighted trend anchor for MACD divergence.',
    tradingUsefulness: 'Separates genuine trend acceleration from noisy single-bar bounces.',
  },
  rsi_14: {
    formula: '100 − 100 / (1 + AvgGain_{14} / AvgLoss_{14})',
    tellsModel: 'Bounded 0–100 momentum oscillator comparing upside vs downside magnitude.',
    tradingUsefulness: 'Flags overbought (>70) or oversold (<30) exhaustion zones.',
  },
  macd: {
    formula: 'EMA_{12}(Close) − EMA_{26}(Close)',
    tellsModel: 'Spread between fast and slow exponential trend curves.',
    tradingUsefulness: 'Quantifies directional trend velocity and momentum inflection.',
  },
  macd_signal: {
    formula: 'EMA_9(MACD)',
    tellsModel: 'Smoothed 9-day trigger line tracking MACD trend persistence.',
    tradingUsefulness: 'MACD crossing above/below signal marks regime shifts.',
  },
  bb_upper: {
    formula: 'SMA_{20}(Close) + 2 · σ_{20}(Close)',
    tellsModel: 'Upper 2-standard-deviation statistical price envelope.',
    tradingUsefulness: 'Identifies upper volatility breakouts or stretched upside extensions.',
  },
  bb_lower: {
    formula: 'SMA_{20}(Close) − 2 · σ_{20}(Close)',
    tellsModel: 'Lower 2-standard-deviation statistical price envelope.',
    tradingUsefulness: 'Highlights downside capitulation extremes or breakdown alerts.',
  },
  atr_14: {
    formula: 'SMA_{14}(max(H−L, |H−C_{t−1}|, |L−C_{t−1}|))',
    tellsModel: 'Measures average daily true price range in ₹ including overnight gaps.',
    tradingUsefulness: 'Sets objective stop-loss distances and volatility-normalized sizing.',
  },
  volume_sma_20: {
    formula: '(1/20) · Σ_{i=0..19} Volume_{t−i}',
    tellsModel: 'Baseline 20-day share turnover representing institutional liquidity.',
    tradingUsefulness: 'Filters out illiquid low-conviction price moves.',
  },
  volume_ratio: {
    formula: 'Volume_t / Volume_SMA_{20}',
    tellsModel: 'Normalized relative participation spike compared to 20-day average.',
    tradingUsefulness: 'Confirms breakouts (>1.25x) vs low-conviction drift.',
  },
};

export function inspectDatasetForSymbol(
  symbol: string,
  limit = 25,
  offset = 0,
): DatasetInspectionResponse {
  const sym = symbol.trim().toUpperCase();
  const ds = loadDatasets();
  const rawRows = ds.combinedBySymbol.get(sym) ?? [];
  const featRows = ds.featuresBySymbol.get(sym) ?? [];
  if (featRows.length === 0) {
    throw new Error(`No feature records found for ${sym}.`);
  }

  const safeLimit = Math.min(100, Math.max(5, limit));
  const safeOffset = Math.max(0, Math.min(Math.max(0, featRows.length - safeLimit), offset));
  // Default when offset=0: return most recent rows first for immediate inspection, or sliced chronologically
  const sliceStart = offset === 0 ? Math.max(0, featRows.length - safeLimit) : safeOffset;
  const previewRows = featRows.slice(sliceStart, sliceStart + safeLimit).reverse();

  const vectors = featRows.map(extractFeatureVector);
  const featureStats: DatasetFeatureStat[] = ML_FEATURE_COLUMNS.map((feat, colIdx) => {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let missing = 0;
    const vals: number[] = [];
    for (let i = 0; i < vectors.length; i++) {
      const v = vectors[i][colIdx];
      if (!Number.isFinite(v)) {
        missing++;
        continue;
      }
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
      vals.push(v);
    }
    const mean = vals.length > 0 ? sum / vals.length : 0;
    const variance =
      vals.length > 1
        ? vals.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / (vals.length - 1)
        : 0;
    const meta = FEATURE_META[feat];
    return {
      feature: feat,
      label: FEATURE_LABELS[feat] ?? feat,
      formula: meta.formula,
      tellsModel: meta.tellsModel,
      tradingUsefulness: meta.tradingUsefulness,
      latestValue: vectors[vectors.length - 1][colIdx],
      min: Number.isFinite(min) ? min : 0,
      mean,
      std: Math.sqrt(Math.max(0, variance)),
      max: Number.isFinite(max) ? max : 0,
      missingCount: missing,
    };
  });

  const missingValuesTotal = Object.values(ds.validation.combinedMissingValues).reduce(
    (a, b) => a + b,
    0,
  );

  return {
    symbol: sym,
    rawRowCount: rawRows.length,
    featureRowCount: featRows.length,
    dateRange: {
      start: featRows[0].date,
      end: featRows[featRows.length - 1].date,
    },
    excludedLeakageColumns: [...EXCLUDED_LEAKAGE_COLUMNS],
    leakageVerified: ds.validation.leakageCheckPassed,
    chronologicalSorted: ds.validation.chronologicalSorted,
    missingValuesTotal,
    duplicatesTotal: ds.validation.combinedDuplicates,
    previewRows,
    featureStats,
  };
}

export function buildSymbolFeaturesCsv(symbol: string, maxRows = 500): string {
  const sym = symbol.trim().toUpperCase();
  const ds = loadDatasets();
  const rows = ds.featuresBySymbol.get(sym) ?? [];
  if (rows.length === 0) {
    throw new Error(`No feature rows available for ${sym}`);
  }
  const sliced = rows.slice(-Math.max(10, Math.min(rows.length, maxRows)));
  const header = [
    'date',
    'symbol',
    'open',
    'high',
    'low',
    'close',
    'volume',
    ...ML_FEATURE_COLUMNS,
    'next_day_return',
    'target_direction',
  ].join(',');
  const lines = sliced.map((r) =>
    [
      r.date,
      r.symbol,
      r.open,
      r.high,
      r.low,
      r.close,
      r.volume,
      r.daily_return,
      r.sma_20,
      r.sma_50,
      r.ema_12,
      r.ema_26,
      r.rsi_14,
      r.macd,
      r.macd_signal,
      r.bb_upper,
      r.bb_lower,
      r.atr_14,
      r.volume_sma_20,
      r.volume_ratio,
      r.next_day_return,
      r.target_direction,
    ].join(','),
  );
  return [header, ...lines].join('\n');
}

export function computePearsonCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 5) return 0;
  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < n; i++) {
    meanA += a[i];
    meanB += b[i];
  }
  meanA /= n;
  meanB /= n;
  let num = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    varA += da * da;
    varB += db * db;
  }
  const denom = Math.sqrt(varA * varB);
  return denom > 1e-12 ? Math.max(-1, Math.min(1, num / denom)) : 0;
}

export function computeAlignedCorrelationMatrix(symbols: string[]): {
  symbols: string[];
  matrix: number[][];
} {
  const ds = loadDatasets();
  const cleanSymbols = Array.from(
    new Set(symbols.map((s) => s.trim().toUpperCase()).filter((s) => ds.featuresBySymbol.has(s))),
  ).slice(0, 6);

  if (cleanSymbols.length === 0) {
    return { symbols: [], matrix: [] };
  }

  // Align returns by common trading dates
  const maps = cleanSymbols.map((sym) => {
    const rows = ds.featuresBySymbol.get(sym) ?? [];
    return new Map(rows.map((r) => [r.date, r.daily_return]));
  });

  const firstDates = Array.from(maps[0].keys());
  const commonDates = firstDates.filter((d) => maps.every((m) => m.has(d))).sort();
  const seriesBySym = maps.map((m) => commonDates.map((d) => m.get(d)!));

  const k = cleanSymbols.length;
  const matrix: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(1));
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const corr = computePearsonCorrelation(seriesBySym[i], seriesBySym[j]);
      const rounded = Math.round(corr * 1000) / 1000;
      matrix[i][j] = rounded;
      matrix[j][i] = rounded;
    }
  }
  return { symbols: cleanSymbols, matrix };
}

function computeSmaSeries(closes: number[], period: number): Array<number | null> {
  const out = new Array<number | null>(closes.length).fill(null);
  if (period < 1) return out;
  let sum = 0;
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i];
    if (i >= period) sum -= closes[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

function computeEmaSeries(closes: number[], period: number): Array<number | null> {
  const out = new Array<number | null>(closes.length).fill(null);
  if (closes.length === 0 || period < 1) return out;
  const k = 2 / (period + 1);
  let ema = closes[0];
  out[0] = ema;
  for (let i = 1; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

function computeWilderRsiSeries(closes: number[], period: number): Array<number | null> {
  const out = new Array<number | null>(closes.length).fill(null);
  if (closes.length <= period) return out;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const chg = closes[i] - closes[i - 1];
    if (chg > 0) avgGain += chg;
    else avgLoss -= chg;
  }
  avgGain /= period;
  avgLoss /= period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const chg = closes[i] - closes[i - 1];
    const gain = chg > 0 ? chg : 0;
    const loss = chg < 0 ? -chg : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

function computeAtrSeries(rows: FeatureRow[], period: number): Array<number | null> {
  const out = new Array<number | null>(rows.length).fill(null);
  if (rows.length < period + 1) return out;
  const trs: number[] = [rows[0].high - rows[0].low];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const prevC = rows[i - 1].close;
    trs.push(Math.max(r.high - r.low, Math.abs(r.high - prevC), Math.abs(r.low - prevC)));
  }
  let sum = 0;
  for (let i = 0; i < trs.length; i++) {
    sum += trs[i];
    if (i >= period) sum -= trs[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

function computeRollingAnnualVol(returns: number[], window: number): Array<number | null> {
  const out = new Array<number | null>(returns.length).fill(null);
  if (window < 5) return out;
  for (let i = window - 1; i < returns.length; i++) {
    const slice = returns.slice(i - window + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance =
      slice.reduce((acc, r) => acc + (r - mean) * (r - mean), 0) / Math.max(1, slice.length - 1);
    out[i] = Math.sqrt(variance) * Math.sqrt(252) * 100;
  }
  return out;
}

export function computeMathLabAnalysis(params: {
  symbol: string;
  compareSymbols?: string[];
  smaPeriod?: number;
  rsiPeriod?: number;
  volWindow?: number;
  atrPeriod?: number;
}): MathLabResponse {
  const sym = params.symbol.trim().toUpperCase();
  const ds = loadDatasets();
  const rows = ds.featuresBySymbol.get(sym) ?? [];
  if (rows.length < 60) {
    throw new Error(`Insufficient history for ${sym} mathematical modeling.`);
  }

  const smaPeriod = Math.max(5, Math.min(200, Math.round(params.smaPeriod ?? 20)));
  const rsiPeriod = Math.max(5, Math.min(50, Math.round(params.rsiPeriod ?? 14)));
  const volWindow = Math.max(10, Math.min(120, Math.round(params.volWindow ?? 20)));
  const atrPeriod = Math.max(5, Math.min(50, Math.round(params.atrPeriod ?? 14)));

  const closes = rows.map((r) => r.close);
  const returns = rows.map((r) => r.daily_return);

  const smaCustom = computeSmaSeries(closes, smaPeriod);
  const emaCustom = computeEmaSeries(closes, smaPeriod);
  const rsiCustom = computeWilderRsiSeries(closes, rsiPeriod);
  const atrCustom = computeAtrSeries(rows, atrPeriod);
  const rollingVol = computeRollingAnnualVol(returns, volWindow);
  const garch = fitGarch11(sym, rows);

  const latest = rows[rows.length - 1];
  const latestSma = smaCustom[rows.length - 1] ?? latest.sma_20;
  const latestEma = emaCustom[rows.length - 1] ?? latest.ema_12;
  const latestRsi = rsiCustom[rows.length - 1] ?? latest.rsi_14;
  const latestAtr = atrCustom[rows.length - 1] ?? latest.atr_14;
  const latestRollingVol = rollingVol[rows.length - 1] ?? 0;

  // Bollinger Band (20-day sample sigma)
  const last20 = closes.slice(-20);
  const sma20Val = last20.reduce((a, b) => a + b, 0) / last20.length;
  const std20 = Math.sqrt(
    last20.reduce((acc, c) => acc + (c - sma20Val) * (c - sma20Val), 0) / last20.length,
  );
  const bbWidthPct = ((latest.bb_upper - latest.bb_lower) / Math.max(1, latest.sma_20)) * 100;

  const peerList =
    params.compareSymbols && params.compareSymbols.length > 1
      ? params.compareSymbols
      : [sym, 'RELIANCE', 'TCS', 'HDFCBANK', 'INFY'];
  const corr = computeAlignedCorrelationMatrix(peerList);

  const peerCorrs = corr.symbols
    .map((s, idx) => (s === sym ? null : `${s}: ${(corr.matrix[0]?.[idx] ?? 0).toFixed(2)}`))
    .filter(Boolean)
    .join(', ');

  const garchMap = new Map(garch.series.map((pt) => [pt.date, pt.conditionalVolAnnualPct]));
  const tailStart = Math.max(0, rows.length - 120);
  const rollingVsGarchSeries = rows.slice(tailStart).map((r, localIdx) => {
    const idx = tailStart + localIdx;
    return {
      date: r.date,
      dailyReturnPct: Math.round(r.daily_return * 10000) / 100,
      rollingVolAnnualPct: Math.round((rollingVol[idx] ?? 0) * 100) / 100,
      garchVolAnnualPct: garchMap.has(r.date) ? Math.round(garchMap.get(r.date)! * 100) / 100 : null,
      customSma: smaCustom[idx] !== null ? Math.round(smaCustom[idx]! * 100) / 100 : null,
      customRsi: rsiCustom[idx] !== null ? Math.round(rsiCustom[idx]! * 100) / 100 : null,
    };
  });

  const calculations: MathLabCalculationItem[] = [
    {
      id: 'daily_return',
      name: '1. Daily Percentage Return',
      formula: 'r_t = (Close_t − Close_{t−1}) / Close_{t−1}',
      variablesExplanation: `Close_t = ₹${latest.close.toFixed(2)}, Close_{t−1} = ₹${rows[rows.length - 2].close.toFixed(2)}`,
      periodLabel: '1 trading day',
      latestOutput: `${(latest.daily_return * 100 >= 0 ? '+' : '')}${(latest.daily_return * 100).toFixed(3)}%`,
      interpretation: `Measures single-session log-free close-to-close return; used to estimate volatility and label next_day_return (never used as input X for same day t+1).`,
      category: 'technical',
    },
    {
      id: 'sma',
      name: `2. Simple Moving Average (SMA ${smaPeriod})`,
      formula: `SMA_${smaPeriod}(t) = (1/${smaPeriod}) · Σ_{i=0..${smaPeriod - 1}} Close_{t−i}`,
      variablesExplanation: `Equal arithmetic weight 1/${smaPeriod} across the trailing ${smaPeriod} daily closes.`,
      periodLabel: `${smaPeriod} sessions`,
      latestOutput: `₹${latestSma.toFixed(2)} (Close is ${latest.close >= latestSma ? 'above' : 'below'} by ${Math.abs(((latest.close - latestSma) / latestSma) * 100).toFixed(2)}%)`,
      interpretation:
        latest.close >= latestSma
          ? `Price trading above SMA(${smaPeriod}) indicates positive trend support.`
          : `Price below SMA(${smaPeriod}) reflects downward drift relative to recent baseline.`,
      category: 'technical',
    },
    {
      id: 'ema',
      name: `3. Exponential Moving Average (EMA ${smaPeriod})`,
      formula: `EMA_t = Close_t · k + EMA_{t−1} · (1 − k),  k = 2 / (${smaPeriod} + 1) = ${(2 / (smaPeriod + 1)).toFixed(4)}`,
      variablesExplanation: `Smoothing constant k weights the latest session higher than older observations.`,
      periodLabel: `${smaPeriod}-day span`,
      latestOutput: `₹${latestEma.toFixed(2)}`,
      interpretation: `Responds faster to recent breakouts/reversals than unweighted SMA(${smaPeriod}).`,
      category: 'technical',
    },
    {
      id: 'rsi',
      name: `4. Relative Strength Index (RSI ${rsiPeriod})`,
      formula: `RSI = 100 − [100 / (1 + AvgGain_${rsiPeriod} / AvgLoss_${rsiPeriod})]`,
      variablesExplanation: `Wilder smoothed average gains vs losses over ${rsiPeriod} sessions.`,
      periodLabel: `${rsiPeriod} sessions`,
      latestOutput: `${latestRsi.toFixed(2)}`,
      interpretation:
        latestRsi >= 70
          ? `Overbought region (>70): upside momentum stretched; elevated pullback risk.`
          : latestRsi <= 30
            ? `Oversold region (<30): selling pressure extended; watch for stabilization.`
            : `Neutral/trending band (30–70): ${latestRsi >= 55 ? 'bullish tilt' : latestRsi <= 45 ? 'bearish tilt' : 'balanced momentum'}.`,
      category: 'technical',
    },
    {
      id: 'macd',
      name: '5. MACD & 9-Day Signal Line',
      formula: 'MACD = EMA_{12}(Close) − EMA_{26}(Close);  Signal = EMA_9(MACD)',
      variablesExplanation: `Fast EMA(12) = ₹${latest.ema_12.toFixed(2)}, Slow EMA(26) = ₹${latest.ema_26.toFixed(2)}`,
      periodLabel: '12 / 26 / 9',
      latestOutput: `MACD ${latest.macd.toFixed(2)} vs Signal ${latest.macd_signal.toFixed(2)} (Hist ${(latest.macd - latest.macd_signal).toFixed(2)})`,
      interpretation:
        latest.macd >= latest.macd_signal
          ? 'MACD above signal line indicates positive trend acceleration.'
          : 'MACD below signal line signals decelerating momentum or bearish crossover.',
      category: 'technical',
    },
    {
      id: 'bollinger',
      name: '6. Bollinger Bands (20, 2σ)',
      formula: 'Upper = SMA_{20} + 2σ_{20};  Lower = SMA_{20} − 2σ_{20}',
      variablesExplanation: `SMA(20) = ₹${latest.sma_20.toFixed(2)}, σ(20) ≈ ₹${std20.toFixed(2)}, Band Width = ${bbWidthPct.toFixed(2)}%`,
      periodLabel: '20 sessions · ±2σ',
      latestOutput: `₹${latest.bb_lower.toFixed(2)} — ₹${latest.bb_upper.toFixed(2)}`,
      interpretation: `Measures dynamic price dispersion around 20-day fair value; narrow band widths often precede volatility expansion.`,
      category: 'technical',
    },
    {
      id: 'atr',
      name: `7. Average True Range (ATR ${atrPeriod})`,
      formula: `ATR = SMA_${atrPeriod}(max(H − L, |H − C_{t−1}|, |L − C_{t−1}|))`,
      variablesExplanation: `True range captures both intraday high-low spread and overnight opening gaps.`,
      periodLabel: `${atrPeriod} sessions`,
      latestOutput: `₹${latestAtr.toFixed(2)} (${((latestAtr / latest.close) * 100).toFixed(2)}% of Close)`,
      interpretation: `Non-directional volatility magnitude used strictly for ATR stop-loss & position sizing — never to predict UP/DOWN direction.`,
      category: 'volatility_statistical',
    },
    {
      id: 'rolling_vol',
      name: `8. Rolling Sample Return Volatility (${volWindow}d)`,
      formula: `σ_{ann}(t) = √252 · √[ (1/(${volWindow}−1)) · Σ (r_{t−i} − r̄)² ]`,
      variablesExplanation: `Equal-weighted historical standard deviation of daily returns (distinct from GARCH(1,1)).`,
      periodLabel: `${volWindow} trading days (Annualized)`,
      latestOutput: `${latestRollingVol.toFixed(2)}% annualized`,
      interpretation: `Backward-looking realized return dispersion. Unlike GARCH(1,1), weights all ${volWindow} trailing shocks equally without mean-reverting conditional variance recursion.`,
      category: 'volatility_statistical',
    },
    {
      id: 'correlation',
      name: '9. Cross-Stock Pearson Return Correlation',
      formula: 'ρ(X, Y) = Cov(r_X, r_Y) / (σ_{r_X} · σ_{r_Y})',
      variablesExplanation: `Computed on date-aligned daily return vectors across ${corr.symbols.length} NIFTY 50 stocks.`,
      periodLabel: 'Full overlapping window (2020–2025)',
      latestOutput: peerCorrs || 'Single stock selected',
      interpretation: `Quantifies linear co-movement (−1 to +1) for portfolio diversification; correlation does not imply causation or ML feature importance.`,
      category: 'volatility_statistical',
    },
    {
      id: 'garch',
      name: '10. GARCH(1,1) Conditional Variance Forecast',
      formula: 'σ²_t = ω + α · ε²_{t−1} + β · σ²_{t−1}',
      variablesExplanation: `ω = ${garch.omega.toExponential(2)}, α = ${garch.alpha.toFixed(4)} (ARCH shock), β = ${garch.beta.toFixed(4)} (persistence), α+β = ${garch.persistence.toFixed(4)}`,
      periodLabel: `${garch.sampleSize} sessions (Variance-Targeted MLE)`,
      latestOutput: `Next-Day Vol Forecast: ${garch.nextDayForecastAnnualVolPct.toFixed(2)}% ann. (Long-Run: ${garch.longRunAnnualVolPct.toFixed(2)}%)`,
      interpretation: `Dedicated volatility-clustering econometric model. Forecasts variance magnitude σ_t, NOT directional BUY/SELL equity returns.`,
      category: 'garch',
    },
  ];

  return {
    symbol: sym,
    latestDate: latest.date,
    rowCount: rows.length,
    periods: { sma: smaPeriod, rsi: rsiPeriod, vol: volWindow, atr: atrPeriod },
    calculations,
    rollingVsGarchSeries,
    correlationSymbols: corr.symbols,
    correlationMatrix: corr.matrix,
  };
}

function buildClassificationReport(
  yTrue: number[],
  probs: number[],
  threshold: number,
): OptimizationResult['classificationReport'] {
  const ev = evaluatePredictions(yTrue, probs, threshold);
  const { tn, fp, fn, tp } = ev.confusionMatrix;
  const downSupport = tn + fp;
  const upSupport = fn + tp;
  const downPrec = tn + fn > 0 ? tn / (tn + fn) : 0;
  const downRec = downSupport > 0 ? tn / downSupport : 0;
  const downF1 = downPrec + downRec > 0 ? (2 * downPrec * downRec) / (downPrec + downRec) : 0;

  return [
    {
      className: 'Class 0 (Down / Flat ≤ 0%)',
      precision: downPrec,
      recall: downRec,
      f1Score: downF1,
      support: downSupport,
    },
    {
      className: 'Class 1 (Positive Next-Day Return > 0%)',
      precision: ev.precision,
      recall: ev.recall,
      f1Score: ev.f1Score,
      support: upSupport,
    },
  ];
}

export function runHyperparameterOptimization(params: {
  symbol: string;
  modelType: ModelType;
  trainPct?: number;
  valPct?: number;
  startDate?: string;
  endDate?: string;
}): OptimizationResult {
  const sym = params.symbol.trim().toUpperCase();
  const ds = loadDatasets();
  let rows = ds.featuresBySymbol.get(sym) ?? [];
  if (params.startDate) rows = rows.filter((r) => r.date >= params.startDate!);
  if (params.endDate) rows = rows.filter((r) => r.date <= params.endDate!);

  if (rows.length < 150) {
    throw new Error(`Need at least 150 chronological rows for Train/Val/Test search on ${sym}.`);
  }

  const trainFrac = Math.min(0.75, Math.max(0.45, params.trainPct ?? 0.6));
  const valFrac = Math.min(0.25, Math.max(0.12, params.valPct ?? 0.2));
  const trainEndIdx = Math.floor(rows.length * trainFrac);
  const valEndIdx = Math.floor(rows.length * (trainFrac + valFrac));

  const trainRows = rows.slice(0, trainEndIdx);
  const valRows = rows.slice(trainEndIdx, valEndIdx);
  const testRows = rows.slice(valEndIdx);
  if (trainRows.length < 50 || valRows.length < 20 || testRows.length < 20) {
    throw new Error(`Date range partition too small for Train/Val/Test split on ${sym}.`);
  }

  const candidates: Array<Record<string, number>> =
    params.modelType === 'logistic_regression'
      ? [
          { l2: 0.01, learningRate: 0.12, epochs: 220 },
          { l2: 0.05, learningRate: 0.12, epochs: 260 },
          { l2: 0.2, learningRate: 0.08, epochs: 300 },
        ]
      : params.modelType === 'random_forest'
        ? [
            { numTrees: 20, maxDepth: 3 },
            { numTrees: 25, maxDepth: 4 },
            { numTrees: 35, maxDepth: 5 },
          ]
        : params.modelType === 'gradient_boosting'
          ? [
              { numTrees: 18, maxDepth: 2, learningRate: 0.06 },
              { numTrees: 24, maxDepth: 3, learningRate: 0.08 },
              { numTrees: 30, maxDepth: 3, learningRate: 0.1 },
            ]
          : [
              { windowSize: 5, hiddenSize: 10, epochs: 35, learningRate: 0.05, l2: 0.02 },
              { windowSize: 5, hiddenSize: 14, epochs: 45, learningRate: 0.06, l2: 0.015 },
              { windowSize: 7, hiddenSize: 16, epochs: 50, learningRate: 0.05, l2: 0.02 },
            ];

  const thresholdGrid = [0.46, 0.48, 0.5, 0.52, 0.55];
  const trainPlusVal = [...trainRows, ...valRows];
  const yVal = valRows.map((r) => (r.target_direction >= 0.5 ? 1 : 0));

  let bestScore = -1;
  let bestCandidate = candidates[0];
  let bestThreshold = 0.5;
  const gridTested: OptimizationResult['gridCandidatesTested'] = [];

  for (const cand of candidates) {
    const art = trainChronologicalModelWithOptions(sym, rows, params.modelType, {
      ...cand,
      trainRowsOverride: trainRows,
      testRowsOverride: valRows,
    });
    const valProbs = valRows.map((_, i) =>
      predictProbabilityForRowIndex(art, trainPlusVal, trainRows.length + i),
    );

    // Threshold search strictly on VALIDATION set (zero test leakage)
    let localBestTh = 0.5;
    let localBestF1 = 0;
    let localBestAcc = 0;
    let localBestScore = -1;
    for (const th of thresholdGrid) {
      const ev = evaluatePredictions(yVal, valProbs, th);
      // Penalize degenerate all-0 or all-1 predictions; reward F1 + accuracy balance
      const isNonDegenerate = ev.predictedPositiveRate > 0.05 && ev.predictedPositiveRate < 0.95;
      const score = isNonDegenerate
        ? ev.f1Score * 0.7 + ev.accuracy * 0.3
        : ev.accuracy * 0.15;
      if (score > localBestScore) {
        localBestScore = score;
        localBestF1 = ev.f1Score;
        localBestAcc = ev.accuracy;
        localBestTh = th;
      }
    }

    const label = Object.entries(cand)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    gridTested.push({
      paramsLabel: label,
      valAccuracy: localBestAcc,
      valF1: localBestF1,
      selectedThreshold: localBestTh,
    });

    const combinedScore = localBestF1 * 0.65 + localBestAcc * 0.35;
    if (combinedScore > bestScore) {
      bestScore = combinedScore;
      bestCandidate = cand;
      bestThreshold = localBestTh;
    }
  }

  // Final evaluation once on unseen chronological TEST fold using best hyperparams & best threshold
  const finalArtifact = trainChronologicalModelWithOptions(sym, rows, params.modelType, {
    ...bestCandidate,
    trainRowsOverride: trainPlusVal,
    testRowsOverride: testRows,
  });

  const allSeq = [...trainPlusVal, ...testRows];
  const yTest = testRows.map((r) => (r.target_direction >= 0.5 ? 1 : 0));
  const testProbs = testRows.map((_, i) =>
    predictProbabilityForRowIndex(finalArtifact, allSeq, trainPlusVal.length + i),
  );
  const testEvaluation = evaluatePredictions(yTest, testProbs, bestThreshold);
  finalArtifact.evaluation = testEvaluation;

  // Store tuned artifact in active mlStore cache so predictions/registry reflect real run
  mlStore.setArtifact(sym, params.modelType, finalArtifact);

  const actualVsPredictedSample = testRows.slice(-20).map((row, localIdx) => {
    const absIdx = Math.max(0, testRows.length - 20) + localIdx;
    const prob = testProbs[absIdx];
    const predDir = prob >= bestThreshold ? 1 : 0;
    const actDir = yTest[absIdx];
    return {
      date: row.date,
      close: row.close,
      actualDirection: actDir,
      predictedProb: prob,
      predictedDirection: predDir,
      correct: predDir === actDir,
    };
  });

  const expId = `EXP-${sym}-${params.modelType.slice(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  return {
    symbol: sym,
    modelType: params.modelType,
    modelLabel: finalArtifact.modelLabel,
    experimentId: expId,
    trainDateRange: { start: trainRows[0].date, end: trainRows[trainRows.length - 1].date },
    valDateRange: { start: valRows[0].date, end: valRows[valRows.length - 1].date },
    testDateRange: { start: testRows[0].date, end: testRows[testRows.length - 1].date },
    trainSize: trainRows.length,
    valSize: valRows.length,
    testSize: testRows.length,
    bestParams: bestCandidate,
    selectedThreshold: bestThreshold,
    gridCandidatesTested: gridTested,
    testEvaluation,
    classificationReport: buildClassificationReport(yTest, testProbs, bestThreshold),
    actualVsPredictedSample: actualVsPredictedSample.reverse(),
    lossHistory: finalArtifact.mlpNetwork?.trainLossHistory,
    trainingDurationMs: finalArtifact.trainingDurationMs,
  };
}

export function compareModelsOnPeriod(params: {
  symbol: string;
  models?: ModelType[];
  splitRatio?: number;
  startDate?: string;
  endDate?: string;
  rankBy?: 'f1Score' | 'accuracy' | 'precision' | 'recall';
}): ModelComparisonResponse {
  const sym = params.symbol.trim().toUpperCase();
  const ds = loadDatasets();
  let rows = ds.featuresBySymbol.get(sym) ?? [];
  if (params.startDate) rows = rows.filter((r) => r.date >= params.startDate!);
  if (params.endDate) rows = rows.filter((r) => r.date <= params.endDate!);

  if (rows.length < 120) {
    throw new Error(`Need at least 120 chronological rows in selected window for ${sym}.`);
  }

  const split = Math.min(0.9, Math.max(0.6, params.splitRatio ?? 0.8));
  const splitIdx = Math.floor(rows.length * split);
  const trainRows = rows.slice(0, splitIdx);
  const testRows = rows.slice(splitIdx);

  const selectedModels: ModelType[] =
    params.models && params.models.length > 0
      ? params.models
      : ['logistic_regression', 'random_forest', 'gradient_boosting', 'sequence_mlp'];

  const items: ModelComparisonItem[] = [];
  for (const mType of selectedModels) {
    const artifact = trainChronologicalModelWithOptions(sym, rows, mType, {
      trainRowsOverride: trainRows,
      testRowsOverride: testRows,
    });
    mlStore.setArtifact(sym, mType, artifact);

    const tInf0 = performance.now();
    predictProbabilityForRowIndex(artifact, rows, rows.length - 1);
    const infMs = Math.max(0.05, Math.round((performance.now() - tInf0) * 100) / 100);

    const rationale =
      mType === 'logistic_regression'
        ? 'Linear log-odds hyperplane with L2 regularization; fastest training & exact linear SHAP explainability, sensitive to non-linear interactions.'
        : mType === 'random_forest'
          ? 'Bagged 25 decision trees reducing variance across noisy daily indicator regimes; captures non-linear thresholds cleanly.'
          : mType === 'gradient_boosting'
            ? 'Sequential stage-wise residual trees fitting residual log-odds; strong precision on structured momentum & volatility combinations.'
            : '5-day temporal window tanh MLP optimizing BCE loss chronologically; captures multi-day sequential lag patterns.';

    items.push({
      modelType: mType,
      modelLabel: artifact.modelLabel,
      accuracy: artifact.evaluation.accuracy,
      precision: artifact.evaluation.precision,
      recall: artifact.evaluation.recall,
      f1Score: artifact.evaluation.f1Score,
      confusionMatrix: artifact.evaluation.confusionMatrix,
      trainingDurationMs: artifact.trainingDurationMs,
      inferenceLatencyMs: infMs,
      trainSize: artifact.trainSize,
      testSize: artifact.testSize,
      lossHistoryLength: artifact.mlpNetwork?.trainLossHistory.length ?? 0,
      rationale,
    });
  }

  const rankBy = params.rankBy ?? 'f1Score';
  items.sort((a, b) => b[rankBy] - a[rankBy]);
  const best = items[0];

  return {
    symbol: sym,
    metricRankBy: rankBy,
    trainDateRange: { start: trainRows[0].date, end: trainRows[trainRows.length - 1].date },
    testDateRange: { start: testRows[0].date, end: testRows[testRows.length - 1].date },
    bestModelType: best.modelType,
    bestModelLabel: best.modelLabel,
    comparisonSummary: `${best.modelLabel} ranked #1 on ${sym} (${testRows[0].date} → ${testRows[testRows.length - 1].date}) by ${rankBy} at ${(best[rankBy] * 100).toFixed(2)}% with ${best.trainingDurationMs} ms training time.`,
    models: items,
  };
}

export function runWalkForwardValidation(params: {
  symbol: string;
  modelType: ModelType;
  initialTrainPct?: number;
  numWindows?: number;
  mode?: 'expanding' | 'rolling';
}): WalkForwardResponse {
  const sym = params.symbol.trim().toUpperCase();
  const ds = loadDatasets();
  const rows = ds.featuresBySymbol.get(sym) ?? [];
  if (rows.length < 200) {
    throw new Error(`Insufficient rows for walk-forward validation on ${sym}.`);
  }

  const initPct = Math.min(0.75, Math.max(0.4, params.initialTrainPct ?? 0.55));
  const numWindows = Math.max(2, Math.min(8, Math.round(params.numWindows ?? 5)));
  const mode = params.mode === 'rolling' ? 'rolling' : 'expanding';

  const initTrainEnd = Math.floor(rows.length * initPct);
  const remaining = rows.length - initTrainEnd;
  const foldSize = Math.max(20, Math.floor(remaining / numWindows));

  const windows: WalkForwardWindowResult[] = [];
  for (let w = 0; w < numWindows; w++) {
    const testStart = initTrainEnd + w * foldSize;
    const testEnd = w === numWindows - 1 ? rows.length : Math.min(rows.length, testStart + foldSize);
    if (testEnd - testStart < 15) break;

    const trainStart = mode === 'rolling' ? Math.max(0, testStart - initTrainEnd) : 0;
    const trainSlice = rows.slice(trainStart, testStart);
    const testSlice = rows.slice(testStart, testEnd);

    const art = trainChronologicalModelWithOptions(sym, rows, params.modelType, {
      trainRowsOverride: trainSlice,
      testRowsOverride: testSlice,
    });

    windows.push({
      windowIndex: w + 1,
      trainRange: { start: trainSlice[0].date, end: trainSlice[trainSlice.length - 1].date },
      testRange: { start: testSlice[0].date, end: testSlice[testSlice.length - 1].date },
      trainSize: trainSlice.length,
      testSize: testSlice.length,
      accuracy: art.evaluation.accuracy,
      precision: art.evaluation.precision,
      recall: art.evaluation.recall,
      f1Score: art.evaluation.f1Score,
      confusionMatrix: art.evaluation.confusionMatrix,
    });
  }

  const count = Math.max(1, windows.length);
  return {
    symbol: sym,
    modelType: params.modelType,
    mode,
    totalRows: rows.length,
    windows,
    averageMetrics: {
      accuracy: windows.reduce((s, x) => s + x.accuracy, 0) / count,
      precision: windows.reduce((s, x) => s + x.precision, 0) / count,
      recall: windows.reduce((s, x) => s + x.recall, 0) / count,
      f1Score: windows.reduce((s, x) => s + x.f1Score, 0) / count,
    },
    leakageNote: `Zero look-ahead leakage: ${mode} window re-fits feature standardization (μ, σ) strictly on each fold's training slice before evaluating future dates.`,
  };
}

function evaluateTechnicalBias(row: FeatureRow, strategy: TradingStrategyId): SignalDirection {
  if (strategy === 'sma_crossover') {
    if (row.close > row.sma_20 && row.sma_20 > row.sma_50) return 'BUY';
    if (row.close < row.sma_20 && row.sma_20 < row.sma_50) return 'SELL';
    return 'HOLD';
  }
  // RSI + MACD confirmation rule
  const bullRsi = row.rsi_14 >= 50 && row.rsi_14 < 72;
  const bearRsi = row.rsi_14 <= 48 && row.rsi_14 > 28;
  if (row.macd > row.macd_signal && (bullRsi || row.rsi_14 < 34)) return 'BUY';
  if (row.macd < row.macd_signal && (bearRsi || row.rsi_14 > 74)) return 'SELL';
  return 'HOLD';
}

export function generateStrategySignals(params: {
  symbol: string;
  strategy: TradingStrategyId;
  modelType?: ModelType;
  threshold?: number;
  lookbackDays?: number;
}): StrategySignalResponse {
  const sym = params.symbol.trim().toUpperCase();
  const ds = loadDatasets();
  const rows = ds.featuresBySymbol.get(sym) ?? [];
  if (rows.length < 60) {
    throw new Error(`Insufficient feature history for ${sym}.`);
  }

  const threshold = Math.min(0.95, Math.max(0.5, params.threshold ?? 0.55));
  const lookback = Math.min(rows.length, Math.max(30, params.lookbackDays ?? 120));
  const usesMl = params.strategy === 'ml_model' || params.strategy === 'combined_ml_tech';

  let artifact = mlStore.getArtifact(sym, params.modelType);
  if (usesMl && !artifact) {
    artifact = mlStore.train(sym, params.modelType ?? 'logistic_regression', 0.8);
  }

  const tailOffset = rows.length - lookback;
  const records: StrategySignalRecord[] = [];
  const distribution = { BUY: 0, SELL: 0, HOLD: 0, totalSessions: lookback };

  for (let i = tailOffset; i < rows.length; i++) {
    const r = rows[i];
    const techSig = evaluateTechnicalBias(r, params.strategy === 'sma_crossover' ? 'sma_crossover' : 'rsi_macd');
    let mlProb: number | null = null;
    let mlSig: SignalDirection | null = null;

    if (usesMl && artifact) {
      mlProb = predictProbabilityForRowIndex(artifact, rows, i);
      mlSig = classifySignal(mlProb, threshold);
    }

    let finalDecision: SignalDirection = 'HOLD';
    if (params.strategy === 'sma_crossover' || params.strategy === 'rsi_macd') {
      finalDecision = techSig;
    } else if (params.strategy === 'ml_model') {
      finalDecision = mlSig ?? 'HOLD';
    } else {
      // Combined deterministic gating: requires unanimous directional agreement (never arbitrary weights)
      if (mlSig === 'BUY' && techSig === 'BUY') finalDecision = 'BUY';
      else if (mlSig === 'SELL' && techSig === 'SELL') finalDecision = 'SELL';
      else finalDecision = 'HOLD';
    }

    distribution[finalDecision]++;
    records.push({
      date: r.date,
      close: r.close,
      mlSignal: mlSig,
      buyProbability: mlProb,
      technicalSignal: techSig,
      finalDecision,
      rsi14: r.rsi_14,
      sma20: r.sma_20,
      sma50: r.sma_50,
      macd: r.macd,
      macdSignal: r.macd_signal,
    });
  }

  const latestRec = records[records.length - 1];
  const latestRow = rows[rows.length - 1];
  const risk = calculateRiskMetrics({
    symbol: sym,
    entryPrice: latestRow.close,
    atr14: latestRow.atr_14,
  });

  const combinationRule =
    params.strategy === 'combined_ml_tech'
      ? 'Deterministic Consensus Gate: Emits BUY only if BOTH ML Probability >= threshold AND Technical Indicators (SMA/MACD/RSI) confirm bullish alignment; emits SELL only if BOTH confirm bearish alignment; otherwise HOLD.'
      : params.strategy === 'ml_model'
        ? `Threshold Probability Classifier: BUY if P(Up) >= ${(threshold * 100).toFixed(0)}%, SELL if 1 − P(Up) >= ${(threshold * 100).toFixed(0)}%, else HOLD.`
        : params.strategy === 'sma_crossover'
          ? 'Rule-Based Trend Filter: BUY when Close > SMA(20) > SMA(50); SELL when Close < SMA(20) < SMA(50); else HOLD.'
          : 'Rule-Based Momentum Filter: BUY when MACD > Signal and RSI constructive (<72); SELL when MACD < Signal and RSI weakening; else HOLD.';

  const invalidationConditions: string[] = [
    `Stop-Loss / Risk Invalidation: Close below ATR(14) 1.5× stop at ₹${risk.stopLoss.toFixed(2)}.`,
    latestRec.technicalSignal === 'BUY'
      ? `Trend Invalidation: MACD (${latestRow.macd.toFixed(2)}) crossing below Signal (${latestRow.macd_signal.toFixed(2)}) or Close slipping under SMA(20) (₹${latestRow.sma_20.toFixed(2)}).`
      : `Reversal Invalidation: Close reclaiming SMA(20) (₹${latestRow.sma_20.toFixed(2)}) with MACD crossing positive.`,
    `Overextension Guard: RSI(14) currently ${latestRow.rsi_14.toFixed(1)} — readings above 75 signal overbought mean-reversion risk.`,
  ];

  const strategyLabel =
    params.strategy === 'sma_crossover'
      ? 'SMA 20 / 50 Crossover'
      : params.strategy === 'rsi_macd'
        ? 'RSI(14) + MACD Filter'
        : params.strategy === 'ml_model'
          ? `ML-Based (${artifact?.modelLabel ?? 'Model'})`
          : `Combined ML (${artifact?.modelLabel ?? 'Model'}) + Technical Gate`;

  const explanation =
    params.strategy === 'combined_ml_tech'
      ? `On ${latestRow.date}, ML classifier (${artifact?.modelLabel}) output ${latestRec.mlSignal} (${((latestRec.buyProbability ?? 0.5) * 100).toFixed(1)}% UP probability) while Technical Filter read ${latestRec.technicalSignal}. consensus gate produced ${latestRec.finalDecision}.`
      : params.strategy === 'ml_model'
        ? `On ${latestRow.date}, ${artifact?.modelLabel} assigned ${((latestRec.buyProbability ?? 0.5) * 100).toFixed(1)}% probability of next-session gain against a ${(threshold * 100).toFixed(0)}% filter threshold → ${latestRec.finalDecision}.`
        : `On ${latestRow.date}, ${strategyLabel} evaluated Close ₹${latestRow.close.toFixed(2)}, RSI ${latestRow.rsi_14.toFixed(1)}, and MACD ${latestRow.macd.toFixed(2)} → ${latestRec.finalDecision}.`;

  return {
    symbol: sym,
    strategy: params.strategy,
    strategyLabel,
    modelType: usesMl ? artifact?.modelType ?? null : null,
    modelTrained: Boolean(artifact),
    threshold,
    observationDate: latestRow.date,
    historicalClose: latestRow.close,
    isHistoricalOnlyLabel: `Historical NSE close through ${latestRow.date} — educational quant research signal only, not live NSE feed.`,
    latestDecision: {
      finalDecision: latestRec.finalDecision,
      mlSignal: latestRec.mlSignal,
      buyProbability: latestRec.buyProbability,
      sellProbability:
        latestRec.buyProbability !== null ? 1 - latestRec.buyProbability : null,
      technicalBias: latestRec.technicalSignal,
      rsiInterpretation:
        latestRow.rsi_14 > 70
          ? `Overbought (${latestRow.rsi_14.toFixed(1)})`
          : latestRow.rsi_14 < 30
            ? `Oversold (${latestRow.rsi_14.toFixed(1)})`
            : `Neutral/Active (${latestRow.rsi_14.toFixed(1)})`,
      smaTrend:
        latestRow.close > latestRow.sma_20 && latestRow.sma_20 > latestRow.sma_50
          ? 'Bullish Alignment (Close > SMA20 > SMA50)'
          : latestRow.close < latestRow.sma_20 && latestRow.sma_20 < latestRow.sma_50
            ? 'Bearish Alignment (Close < SMA20 < SMA50)'
            : 'Mixed / Consolidation',
      macdDirection:
        latestRow.macd >= latestRow.macd_signal
          ? `Bullish (${latestRow.macd.toFixed(2)} >= ${latestRow.macd_signal.toFixed(2)})`
          : `Bearish (${latestRow.macd.toFixed(2)} < ${latestRow.macd_signal.toFixed(2)})`,
      riskContext: {
        atr14: risk.atr14,
        stopLoss: risk.stopLoss,
        targetPrice: risk.targetPrice,
        volatilityCategory: risk.volatilityCategory,
      },
      explanation,
      combinationRule,
      invalidationConditions,
    },
    distribution,
    recentSignals: records.slice(-30).reverse(),
  };
}

export function computeAdvancedRiskMonitor(params: {
  symbol: string;
  capital?: number;
  riskPct?: number;
  confidenceLevel?: number;
  holdingPeriodDays?: number;
  selectedSymbols?: string[];
  allocations?: Array<{ symbol: string; weightPct: number }>;
  useRealInvestorHoldings?: boolean;
}): AdvancedRiskResponse {
  const sym = params.symbol.trim().toUpperCase();
  const ds = loadDatasets();
  const rows = ds.featuresBySymbol.get(sym) ?? [];
  if (rows.length < 60) {
    throw new Error(`Insufficient history for ${sym} risk evaluation.`);
  }

  const capital = Math.max(10000, params.capital ?? 1000000);
  const riskPct = Math.max(0.25, Math.min(10, params.riskPct ?? 1.5));
  const confidenceLevel = params.confidenceLevel === 0.99 ? 0.99 : 0.95;
  const holdingDays = Math.max(1, Math.min(30, Math.round(params.holdingPeriodDays ?? 1)));

  const returns = rows.map((r) => r.daily_return);
  const closes = rows.map((r) => r.close);
  const n = returns.length;
  const meanDaily = returns.reduce((a, b) => a + b, 0) / n;
  const varianceDaily =
    returns.reduce((acc, r) => acc + (r - meanDaily) * (r - meanDaily), 0) / Math.max(1, n - 1);
  const dailyStd = Math.sqrt(varianceDaily);
  const annualizedReturnPct = meanDaily * 252 * 100;
  const annualizedVolatilityPct = dailyStd * Math.sqrt(252) * 100;

  // Empirical Historical VaR & CVaR
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const tailIdx = Math.max(0, Math.floor((1 - confidenceLevel) * sortedReturns.length) - 1);
  const dailyVarLoss = Math.max(0, -sortedReturns[tailIdx]);
  const tailSlice = sortedReturns.slice(0, Math.max(1, tailIdx + 1));
  const dailyCvarLoss = Math.max(
    0,
    -tailSlice.reduce((a, b) => a + b, 0) / tailSlice.length,
  );
  const horizonScale = Math.sqrt(holdingDays);
  const varPct = dailyVarLoss * horizonScale * 100;
  const cvarPct = dailyCvarLoss * horizonScale * 100;
  const varRupees = (capital * varPct) / 100;
  const cvarRupees = (capital * cvarPct) / 100;

  // Max Drawdown
  let peak = closes[0];
  let maxDrawdownPct = 0;
  for (const c of closes) {
    if (c > peak) peak = c;
    const dd = ((peak - c) / peak) * 100;
    if (dd > maxDrawdownPct) maxDrawdownPct = dd;
  }

  // Sharpe & Sortino (6% risk-free Indian T-bill baseline)
  const dailyRf = 0.06 / 252;
  const excessMean = returns.reduce((a, r) => a + (r - dailyRf), 0) / n;
  const sharpeRatio = dailyStd > 1e-9 ? (excessMean / dailyStd) * Math.sqrt(252) : 0;

  const downsideSq = returns.reduce((acc, r) => {
    const diff = r - dailyRf;
    return diff < 0 ? acc + diff * diff : acc;
  }, 0);
  const downsideDev = Math.sqrt(downsideSq / n);
  const sortinoRatio = downsideDev > 1e-9 ? (excessMean / downsideDev) * Math.sqrt(252) : 0;

  const latest = rows[rows.length - 1];
  const atrRisk = calculateRiskMetrics({
    symbol: sym,
    entryPrice: latest.close,
    atr14: latest.atr_14,
    availableCapital: capital,
    riskPercentage: riskPct,
  });
  const garch = fitGarch11(sym, rows);

  const peers =
    params.selectedSymbols && params.selectedSymbols.length >= 2
      ? params.selectedSymbols
      : [sym, 'RELIANCE', 'TCS', 'HDFCBANK', 'INFY'];
  const corr = computeAlignedCorrelationMatrix(peers);

  // Portfolio concentration strictly from real SQLite holdings OR explicit user input — NEVER invented
  let source: AdvancedRiskResponse['portfolioConcentration']['source'] = 'none_entered';
  let sourceDescription =
    'No hypothetical allocation submitted and no holdings selected. Enter custom weights or load tracked Investor SQLite holdings to inspect portfolio concentration.';
  let positions: AdvancedRiskResponse['portfolioConcentration']['positions'] = [];

  if (params.allocations && params.allocations.length > 0) {
    const valid = params.allocations
      .map((a) => ({ symbol: a.symbol.trim().toUpperCase(), weightPct: Number(a.weightPct) }))
      .filter((a) => ds.featuresBySymbol.has(a.symbol) && a.weightPct > 0);
    const totalW = valid.reduce((s, x) => s + x.weightPct, 0);
    if (totalW > 0) {
      source = 'user_hypothetical_allocation';
      sourceDescription = `Explicitly entered hypothetical portfolio across ${valid.length} equities (weights normalized to 100% of ₹${capital.toLocaleString('en-IN')}).`;
      positions = valid.map((item) => {
        const wNorm = (item.weightPct / totalW) * 100;
        const pRows = ds.featuresBySymbol.get(item.symbol) ?? [];
        const pRet = pRows.map((r) => r.daily_return);
        const pMean = pRet.reduce((a, b) => a + b, 0) / Math.max(1, pRet.length);
        const pStd = Math.sqrt(
          pRet.reduce((acc, r) => acc + (r - pMean) ** 2, 0) / Math.max(1, pRet.length - 1),
        );
        const sortedP = [...pRet].sort((a, b) => a - b);
        const qIdx = Math.max(0, Math.floor(0.05 * sortedP.length) - 1);
        const posVar95 = Math.max(0, -(sortedP[qIdx] ?? 0));
        const allocAmt = (capital * wNorm) / 100;
        return {
          symbol: item.symbol,
          weightPct: Math.round(wNorm * 100) / 100,
          allocatedRupees: Math.round(allocAmt * 100) / 100,
          annualVolPct: Math.round(pStd * Math.sqrt(252) * 10000) / 100,
          var95Rupees: Math.round(allocAmt * posVar95 * horizonScale * 100) / 100,
        };
      });
    }
  } else if (params.useRealInvestorHoldings) {
    const realHoldings = listRealInvestorAggregateHoldings();
    if (realHoldings.length > 0) {
      const valued = realHoldings
        .map((h) => {
          const pRows = ds.featuresBySymbol.get(h.symbol);
          const price = pRows && pRows.length > 0 ? pRows[pRows.length - 1].close : h.avgCostBasis;
          return { symbol: h.symbol, value: h.totalQuantity * price, rows: pRows ?? [] };
        })
        .filter((v) => v.value > 0 && v.rows.length > 0);
      const totalVal = valued.reduce((s, x) => s + x.value, 0);
      if (totalVal > 0) {
        source = 'real_investor_holdings';
        sourceDescription = `Derived directly from real registered Investor SQLite holdings (${valued.length} tickers, valued at 30 Sep 2025 close ₹${totalVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}).`;
        positions = valued.map((item) => {
          const wNorm = (item.value / totalVal) * 100;
          const pRet = item.rows.map((r) => r.daily_return);
          const pMean = pRet.reduce((a, b) => a + b, 0) / Math.max(1, pRet.length);
          const pStd = Math.sqrt(
            pRet.reduce((acc, r) => acc + (r - pMean) ** 2, 0) / Math.max(1, pRet.length - 1),
          );
          const sortedP = [...pRet].sort((a, b) => a - b);
          const qIdx = Math.max(0, Math.floor(0.05 * sortedP.length) - 1);
          const posVar95 = Math.max(0, -(sortedP[qIdx] ?? 0));
          return {
            symbol: item.symbol,
            weightPct: Math.round(wNorm * 100) / 100,
            allocatedRupees: Math.round(item.value * 100) / 100,
            annualVolPct: Math.round(pStd * Math.sqrt(252) * 10000) / 100,
            var95Rupees: Math.round(item.value * posVar95 * horizonScale * 100) / 100,
          };
        });
      }
    }
  }

  const herfindahlIndex = positions.reduce((s, p) => s + (p.weightPct / 100) ** 2, 0);
  const maxSingleWeightPct = positions.reduce((m, p) => Math.max(m, p.weightPct), 0);

  return {
    primarySymbol: sym,
    latestDate: latest.date,
    capital,
    riskPct,
    confidenceLevel,
    holdingPeriodDays: holdingDays,
    varPct,
    varRupees,
    cvarPct,
    cvarRupees,
    annualizedReturnPct,
    annualizedVolatilityPct,
    maxDrawdownPct,
    sharpeRatio,
    sortinoRatio,
    atrRisk,
    garch,
    correlationSymbols: corr.symbols,
    correlationMatrix: corr.matrix,
    portfolioConcentration: {
      source,
      sourceDescription,
      herfindahlIndex: Math.round(herfindahlIndex * 1000) / 1000,
      maxSingleWeightPct: Math.round(maxSingleWeightPct * 100) / 100,
      positions,
    },
    assumptions: [
      `Historical VaR & CVaR use non-parametric empirical quantiles of ${n} historical NSE daily returns (2020–2025) scaled by √${holdingDays} trading-day horizon.`,
      `Sharpe & Sortino ratios assume 252 trading sessions/year and a 6.0% annual risk-free rate baseline.`,
      `GARCH(1,1) models conditional variance persistence (α + β < 1) independently of directional equity predictions.`,
      `Portfolio concentration strictly reflects persisted SQLite Investor holdings or explicitly submitted allocations — never fabricated weights.`,
    ],
  };
}

export function computeFinalPerformanceSummary(params: {
  symbol: string;
  modelType?: ModelType;
  confidenceLevel?: number;
  holdingPeriodDays?: number;
}): FinalPerformanceResponse {
  const sym = params.symbol.trim().toUpperCase();
  const ds = loadDatasets();
  const rows = ds.featuresBySymbol.get(sym) ?? [];
  if (rows.length < 60) {
    throw new Error(`Insufficient historical rows for ${sym}.`);
  }

  const artifact = mlStore.getArtifact(sym, params.modelType);
  const hasModelData = Boolean(artifact);

  // Measure real server-side local inference latency & throughput across 200 sequential calls
  const sampleCount = 200;
  let avgInferenceLatencyMs: number | null = null;
  let minInferenceLatencyMs: number | null = null;
  let maxInferenceLatencyMs: number | null = null;
  let throughputPredictionsPerSec: number | null = null;

  if (artifact) {
    const latencies: number[] = [];
    const totalStart = performance.now();
    const minIdx = Math.max(5, rows.length - 50);
    for (let i = 0; i < sampleCount; i++) {
      const targetIdx = minIdx + (i % (rows.length - minIdx));
      const t0 = performance.now();
      predictProbabilityForRowIndex(artifact, rows, targetIdx);
      latencies.push(performance.now() - t0);
    }
    const totalMs = Math.max(0.05, performance.now() - totalStart);
    const sumMs = latencies.reduce((a, b) => a + b, 0);
    avgInferenceLatencyMs = Math.round((sumMs / sampleCount) * 10000) / 10000;
    minInferenceLatencyMs = Math.round(Math.min(...latencies) * 10000) / 10000;
    maxInferenceLatencyMs = Math.round(Math.max(...latencies) * 10000) / 10000;
    throughputPredictionsPerSec = Math.round((sampleCount / (totalMs / 1000)) * 10) / 10;
  }

  // Risk metrics from real historical dataset returns
  const riskSnapshot = computeAdvancedRiskMonitor({
    symbol: sym,
    capital: 1000000,
    riskPct: 1.5,
    confidenceLevel: params.confidenceLevel === 0.99 ? 0.99 : 0.95,
    holdingPeriodDays: Math.max(1, Math.min(30, Math.round(params.holdingPeriodDays ?? 1))),
    useRealInvestorHoldings: false,
  });

  // Latest persisted SQLite backtest for this symbol
  const symBacktest = listBacktestRuns(40).find((r) => r.symbol.toUpperCase() === sym) ?? null;
  let parsedParams: Record<string, unknown> = {};
  if (symBacktest?.paramsJson) {
    try {
      parsedParams = JSON.parse(symBacktest.paramsJson) as Record<string, unknown>;
    } catch {
      parsedParams = {};
    }
  }

  const numOrNull = (val: unknown): number | null =>
    typeof val === 'number' && Number.isFinite(val) ? val : null;
  const boolOrNull = (val: unknown): boolean | null =>
    typeof val === 'boolean' ? val : null;
  const strOrNull = (val: unknown): string | null =>
    typeof val === 'string' && val.length > 0 ? val : null;

  const hasBacktestData = Boolean(symBacktest);
  const initialCap = numOrNull(parsedParams.initialCapital) ?? (symBacktest ? 1000000 : null);
  const finalEq =
    numOrNull(parsedParams.finalEquity) ??
    (symBacktest && initialCap !== null
      ? Math.round(initialCap * (1 + symBacktest.totalReturnPct / 100) * 100) / 100
      : null);
  const netProfit =
    numOrNull(parsedParams.netProfit) ??
    (finalEq !== null && initialCap !== null ? Math.round((finalEq - initialCap) * 100) / 100 : null);

  return {
    symbol: sym,
    generatedAt: new Date().toISOString(),
    hasModelData,
    hasBacktestData,
    modelPerformance: {
      modelType: artifact?.modelType ?? null,
      modelLabel: artifact?.modelLabel ?? null,
      accuracy: artifact ? artifact.evaluation.accuracy : null,
      precision: artifact ? artifact.evaluation.precision : null,
      recall: artifact ? artifact.evaluation.recall : null,
      f1Score: artifact ? artifact.evaluation.f1Score : null,
      confusionMatrix: artifact ? artifact.evaluation.confusionMatrix : null,
      trainDateRange: artifact
        ? `${artifact.trainDateRange.start} → ${artifact.trainDateRange.end}`
        : null,
      testDateRange: artifact
        ? `${artifact.testDateRange.start} → ${artifact.testDateRange.end}`
        : null,
      trainSize: artifact?.trainSize ?? null,
      testSize: artifact?.testSize ?? null,
    },
    tradingPerformance: {
      runCode: symBacktest?.runCode ?? null,
      strategy: symBacktest?.strategy ?? null,
      startDate: strOrNull(parsedParams.startDate),
      endDate: strOrNull(parsedParams.endDate),
      initialCapital: initialCap,
      finalEquity: finalEq,
      netProfit,
      roiPct: symBacktest ? symBacktest.totalReturnPct : null,
      winRatePct: numOrNull(parsedParams.winRatePct),
      profitFactor:
        parsedParams.profitFactor === null ? null : numOrNull(parsedParams.profitFactor),
      totalTrades: symBacktest ? symBacktest.numberOfTrades : null,
      winningTrades: numOrNull(parsedParams.winningTrades),
      losingTrades: numOrNull(parsedParams.losingTrades),
      avgWinningTrade: numOrNull(parsedParams.avgWinningTrade),
      avgLosingTrade: numOrNull(parsedParams.avgLosingTrade),
      benchmarkReturnPct: symBacktest ? symBacktest.benchmarkReturnPct : null,
      walkForwardLeakageFree: boolOrNull(parsedParams.walkForwardLeakageFree),
      retrainCount: numOrNull(parsedParams.retrainCount),
      createdAt: symBacktest?.createdAt ?? null,
    },
    risk: {
      confidenceLevel: riskSnapshot.confidenceLevel,
      holdingPeriodDays: riskSnapshot.holdingPeriodDays,
      maxDrawdownPct: riskSnapshot.maxDrawdownPct,
      backtestMaxDrawdownPct: symBacktest ? symBacktest.maxDrawdownPct : null,
      annualizedVolatilityPct: riskSnapshot.annualizedVolatilityPct,
      sharpeRatio: riskSnapshot.sharpeRatio,
      backtestSharpeRatio: symBacktest ? symBacktest.sharpeRatio : null,
      historicalVarPct: riskSnapshot.varPct,
      historicalVarRupees: riskSnapshot.varRupees,
      historicalCvarPct: riskSnapshot.cvarPct,
      historicalCvarRupees: riskSnapshot.cvarRupees,
    },
    efficiency: {
      trainingDurationMs: artifact?.trainingDurationMs ?? null,
      measuredSampleCount: artifact ? sampleCount : 0,
      avgInferenceLatencyMs,
      minInferenceLatencyMs,
      maxInferenceLatencyMs,
      throughputPredictionsPerSec,
      measurementMethod: artifact
        ? `Real wall-clock timing over ${sampleCount} sequential single-row predictions on ${sym} test features (no simulated values).`
        : 'No trained model artifact active for this symbol yet.',
    },
    transactionCosts: {
      brokeragePct: numOrNull(parsedParams.brokeragePct),
      slippagePct: numOrNull(parsedParams.slippagePct),
      totalTransactionCosts: numOrNull(parsedParams.totalTransactionCosts),
      grossProfit: numOrNull(parsedParams.grossProfit),
      grossLoss: numOrNull(parsedParams.grossLoss),
      netProfit,
    },
  };
}

