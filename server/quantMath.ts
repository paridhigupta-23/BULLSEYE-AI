import type {
  BacktestResult,
  BacktestTrade,
  DecisionTreeNode,
  FeatureContribution,
  FeatureRow,
  GarchResult,
  ModelEvaluation,
  ModelType,
  RiskMetrics,
  SignalDirection,
  TrainedModelArtifact,
} from './types.ts';

export const ML_FEATURE_COLUMNS = [
  'daily_return',
  'sma_20',
  'sma_50',
  'ema_12',
  'ema_26',
  'rsi_14',
  'macd',
  'macd_signal',
  'bb_upper',
  'bb_lower',
  'atr_14',
  'volume_sma_20',
  'volume_ratio',
] as const;

export const EXCLUDED_LEAKAGE_COLUMNS = ['next_day_return', 'target_direction'] as const;

export const FEATURE_LABELS: Record<string, string> = {
  daily_return: 'Daily Return',
  sma_20: 'SMA (20)',
  sma_50: 'SMA (50)',
  ema_12: 'EMA (12)',
  ema_26: 'EMA (26)',
  rsi_14: 'RSI (14)',
  macd: 'MACD Line',
  macd_signal: 'MACD Signal',
  bb_upper: 'Bollinger Upper',
  bb_lower: 'Bollinger Lower',
  atr_14: 'ATR (14)',
  volume_sma_20: 'Volume SMA (20)',
  volume_ratio: 'Volume Ratio',
};

export function sigmoid(z: number): number {
  if (z > 35) return 1 - 1e-15;
  if (z < -35) return 1e-15;
  return 1 / (1 + Math.exp(-z));
}

export function extractFeatureVector(row: FeatureRow): number[] {
  return [
    row.daily_return,
    row.sma_20,
    row.sma_50,
    row.ema_12,
    row.ema_26,
    row.rsi_14,
    row.macd,
    row.macd_signal,
    row.bb_upper,
    row.bb_lower,
    row.atr_14,
    row.volume_sma_20,
    row.volume_ratio,
  ];
}

export function computeStandardization(matrix: number[][]): { means: number[]; stds: number[] } {
  const n = matrix.length;
  const p = matrix[0]?.length ?? 0;
  const means = new Array<number>(p).fill(0);
  const stds = new Array<number>(p).fill(1);

  if (n === 0 || p === 0) return { means, stds };

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      means[j] += matrix[i][j];
    }
  }
  for (let j = 0; j < p; j++) {
    means[j] /= n;
  }

  const vars = new Array<number>(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      const diff = matrix[i][j] - means[j];
      vars[j] += diff * diff;
    }
  }
  for (let j = 0; j < p; j++) {
    const sd = Math.sqrt(vars[j] / Math.max(1, n));
    stds[j] = sd > 1e-9 ? sd : 1;
  }

  return { means, stds };
}

export function applyStandardization(
  matrix: number[][],
  means: number[],
  stds: number[],
): number[][] {
  return matrix.map((row) => row.map((val, j) => (val - means[j]) / stds[j]));
}

export function evaluatePredictions(yTrue: number[], probs: number[], threshold = 0.5): ModelEvaluation {
  let tn = 0;
  let fp = 0;
  let fn = 0;
  let tp = 0;
  let posTrue = 0;
  let posPred = 0;

  for (let i = 0; i < yTrue.length; i++) {
    const actual = yTrue[i] >= 0.5 ? 1 : 0;
    const pred = probs[i] >= threshold ? 1 : 0;
    if (actual === 1) posTrue++;
    if (pred === 1) posPred++;
    if (actual === 1 && pred === 1) tp++;
    else if (actual === 0 && pred === 1) fp++;
    else if (actual === 1 && pred === 0) fn++;
    else tn++;
  }

  const total = Math.max(1, yTrue.length);
  const accuracy = (tp + tn) / total;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    accuracy,
    precision,
    recall,
    f1Score,
    confusionMatrix: { tn, fp, fn, tp },
    testPositiveRate: posTrue / total,
    predictedPositiveRate: posPred / total,
  };
}

function trainLogisticWeights(
  X: number[][],
  y: number[],
  l2 = 0.05,
  epochs = 260,
  lr = 0.12,
): { weights: number[]; bias: number } {
  const n = X.length;
  const p = X[0]?.length ?? 0;
  const weights = new Array<number>(p).fill(0);
  let bias = 0;

  // Momentum gradient descent for smooth deterministic convergence
  const vW = new Array<number>(p).fill(0);
  let vB = 0;
  const beta = 0.85;

  for (let epoch = 0; epoch < epochs; epoch++) {
    const gradW = new Array<number>(p).fill(0);
    let gradB = 0;

    for (let i = 0; i < n; i++) {
      let z = bias;
      const row = X[i];
      for (let j = 0; j < p; j++) {
        z += weights[j] * row[j];
      }
      const err = sigmoid(z) - y[i];
      gradB += err;
      for (let j = 0; j < p; j++) {
        gradW[j] += err * row[j];
      }
    }

    const invN = 1 / Math.max(1, n);
    vB = beta * vB + lr * gradB * invN;
    bias -= vB;

    for (let j = 0; j < p; j++) {
      const g = gradW[j] * invN + l2 * weights[j] * invN;
      vW[j] = beta * vW[j] + lr * g;
      weights[j] -= vW[j];
    }
  }

  return { weights, bias };
}

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function giniImpurity(posCount: number, totalCount: number): number {
  if (totalCount === 0) return 0;
  const p = posCount / totalCount;
  return 2 * p * (1 - p);
}

function buildClassificationTree(
  X: number[][],
  y: number[],
  indices: number[],
  depth: number,
  maxDepth: number,
  minSamplesLeaf: number,
  featureSubsetCount: number,
  rng: () => number,
  featureGainAccumulator: number[],
): DecisionTreeNode {
  let pos = 0;
  for (const idx of indices) {
    if (y[idx] >= 0.5) pos++;
  }
  const n = indices.length;
  const prob = n > 0 ? pos / n : 0.5;

  if (depth >= maxDepth || n < minSamplesLeaf * 2 || pos === 0 || pos === n) {
    return { isLeaf: true, prob };
  }

  const p = X[0].length;
  const featIndices = Array.from({ length: p }, (_, i) => i);
  for (let i = featIndices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [featIndices[i], featIndices[j]] = [featIndices[j], featIndices[i]];
  }
  const candidateFeats = featIndices.slice(0, Math.min(p, featureSubsetCount));

  const parentGini = giniImpurity(pos, n);
  let bestGain = 0;
  let bestFeat = -1;
  let bestThreshold = 0;
  let bestLeft: number[] = [];
  let bestRight: number[] = [];

  for (const f of candidateFeats) {
    const vals = indices.map((idx) => ({ val: X[idx][f], target: y[idx] }));
    vals.sort((a, b) => a.val - b.val);

    // Evaluate up to 16 quantile candidate splits for fast deterministic training
    const steps = Math.min(16, vals.length - 1);
    if (steps <= 0) continue;

    for (let s = 1; s <= steps; s++) {
      const splitIdx = Math.floor((s * vals.length) / (steps + 1));
      if (splitIdx < minSamplesLeaf || vals.length - splitIdx < minSamplesLeaf) continue;
      if (vals[splitIdx - 1].val === vals[splitIdx].val) continue;

      const threshold = 0.5 * (vals[splitIdx - 1].val + vals[splitIdx].val);
      let leftPos = 0;
      let leftCount = 0;
      let rightPos = 0;
      let rightCount = 0;

      for (const idx of indices) {
        if (X[idx][f] <= threshold) {
          leftCount++;
          if (y[idx] >= 0.5) leftPos++;
        } else {
          rightCount++;
          if (y[idx] >= 0.5) rightPos++;
        }
      }

      if (leftCount < minSamplesLeaf || rightCount < minSamplesLeaf) continue;

      const weightedGini =
        (leftCount / n) * giniImpurity(leftPos, leftCount) +
        (rightCount / n) * giniImpurity(rightPos, rightCount);
      const gain = parentGini - weightedGini;

      if (gain > bestGain) {
        bestGain = gain;
        bestFeat = f;
        bestThreshold = threshold;
      }
    }
  }

  if (bestFeat === -1 || bestGain <= 1e-6) {
    return { isLeaf: true, prob };
  }

  featureGainAccumulator[bestFeat] += bestGain * n;

  for (const idx of indices) {
    if (X[idx][bestFeat] <= bestThreshold) bestLeft.push(idx);
    else bestRight.push(idx);
  }

  return {
    isLeaf: false,
    featureIndex: bestFeat,
    threshold: bestThreshold,
    left: buildClassificationTree(
      X,
      y,
      bestLeft,
      depth + 1,
      maxDepth,
      minSamplesLeaf,
      featureSubsetCount,
      rng,
      featureGainAccumulator,
    ),
    right: buildClassificationTree(
      X,
      y,
      bestRight,
      depth + 1,
      maxDepth,
      minSamplesLeaf,
      featureSubsetCount,
      rng,
      featureGainAccumulator,
    ),
  };
}

function buildRegressionTree(
  X: number[][],
  residuals: number[],
  indices: number[],
  depth: number,
  maxDepth: number,
  minSamplesLeaf: number,
  featureGainAccumulator: number[],
): DecisionTreeNode {
  const n = indices.length;
  let sum = 0;
  for (const idx of indices) sum += residuals[idx];
  const meanVal = n > 0 ? sum / n : 0;

  if (depth >= maxDepth || n < minSamplesLeaf * 2) {
    return { isLeaf: true, value: meanVal };
  }

  const p = X[0].length;
  let totalSqErr = 0;
  for (const idx of indices) {
    const d = residuals[idx] - meanVal;
    totalSqErr += d * d;
  }

  let bestGain = 0;
  let bestFeat = -1;
  let bestThreshold = 0;

  for (let f = 0; f < p; f++) {
    const vals = indices.map((idx) => X[idx][f]).sort((a, b) => a - b);
    const steps = Math.min(12, vals.length - 1);
    for (let s = 1; s <= steps; s++) {
      const splitPos = Math.floor((s * vals.length) / (steps + 1));
      if (splitPos < minSamplesLeaf || vals.length - splitPos < minSamplesLeaf) continue;
      if (vals[splitPos - 1] === vals[splitPos]) continue;

      const threshold = 0.5 * (vals[splitPos - 1] + vals[splitPos]);
      let leftSum = 0;
      let leftN = 0;
      let rightSum = 0;
      let rightN = 0;

      for (const idx of indices) {
        if (X[idx][f] <= threshold) {
          leftSum += residuals[idx];
          leftN++;
        } else {
          rightSum += residuals[idx];
          rightN++;
        }
      }
      if (leftN < minSamplesLeaf || rightN < minSamplesLeaf) continue;

      const leftMean = leftSum / leftN;
      const rightMean = rightSum / rightN;
      let splitErr = 0;
      for (const idx of indices) {
        const diff =
          X[idx][f] <= threshold ? residuals[idx] - leftMean : residuals[idx] - rightMean;
        splitErr += diff * diff;
      }

      const gain = totalSqErr - splitErr;
      if (gain > bestGain) {
        bestGain = gain;
        bestFeat = f;
        bestThreshold = threshold;
      }
    }
  }

  if (bestFeat === -1 || bestGain <= 1e-6) {
    return { isLeaf: true, value: meanVal };
  }

  featureGainAccumulator[bestFeat] += bestGain;
  const leftIdx: number[] = [];
  const rightIdx: number[] = [];
  for (const idx of indices) {
    if (X[idx][bestFeat] <= bestThreshold) leftIdx.push(idx);
    else rightIdx.push(idx);
  }

  return {
    isLeaf: false,
    featureIndex: bestFeat,
    threshold: bestThreshold,
    left: buildRegressionTree(
      X,
      residuals,
      leftIdx,
      depth + 1,
      maxDepth,
      minSamplesLeaf,
      featureGainAccumulator,
    ),
    right: buildRegressionTree(
      X,
      residuals,
      rightIdx,
      depth + 1,
      maxDepth,
      minSamplesLeaf,
      featureGainAccumulator,
    ),
  };
}

function predictTreeProb(node: DecisionTreeNode, x: number[]): number {
  let curr = node;
  while (!curr.isLeaf) {
    const f = curr.featureIndex ?? 0;
    const th = curr.threshold ?? 0;
    curr = x[f] <= th ? curr.left! : curr.right!;
  }
  return curr.prob ?? 0.5;
}

function predictTreeValue(node: DecisionTreeNode, x: number[]): number {
  let curr = node;
  while (!curr.isLeaf) {
    const f = curr.featureIndex ?? 0;
    const th = curr.threshold ?? 0;
    curr = x[f] <= th ? curr.left! : curr.right!;
  }
  return curr.value ?? 0;
}

export function predictProbabilityWithArtifact(
  artifact: TrainedModelArtifact,
  rawFeatureVector: number[],
): number {
  const stdX = rawFeatureVector.map((v, j) => (v - artifact.means[j]) / artifact.stds[j]);

  if (artifact.modelType === 'logistic_regression' && artifact.weights) {
    let z = artifact.bias ?? 0;
    for (let j = 0; j < stdX.length; j++) {
      z += artifact.weights[j] * stdX[j];
    }
    return sigmoid(z);
  }

  if (artifact.modelType === 'random_forest' && artifact.forest) {
    let sum = 0;
    for (const tree of artifact.forest) {
      sum += predictTreeProb(tree, stdX);
    }
    return sum / Math.max(1, artifact.forest.length);
  }

  if (artifact.modelType === 'gradient_boosting' && artifact.gbTrees) {
    let logOdds = artifact.gbBaseLogOdds ?? 0;
    for (const { tree, weight } of artifact.gbTrees) {
      logOdds += weight * predictTreeValue(tree, stdX);
    }
    return sigmoid(logOdds);
  }

  return 0.5;
}

export function trainChronologicalModel(
  symbol: string,
  rows: FeatureRow[],
  modelType: ModelType,
  splitRatio = 0.8,
): TrainedModelArtifact {
  if (rows.length < 120) {
    throw new Error(`Insufficient chronological history for ${symbol} (${rows.length} rows; need at least 120).`);
  }

  const startMs = performance.now();
  const clampedSplit = Math.min(0.9, Math.max(0.6, splitRatio));
  const splitIdx = Math.floor(rows.length * clampedSplit);

  const trainRows = rows.slice(0, splitIdx);
  const testRows = rows.slice(splitIdx);

  const XTrainRaw = trainRows.map(extractFeatureVector);
  const yTrain = trainRows.map((r) => (r.target_direction >= 0.5 ? 1 : 0));
  const XTestRaw = testRows.map(extractFeatureVector);
  const yTest = testRows.map((r) => (r.target_direction >= 0.5 ? 1 : 0));

  // Standardize strictly from training partition to prevent look-ahead leakage
  const { means, stds } = computeStandardization(XTrainRaw);
  const XTrain = applyStandardization(XTrainRaw, means, stds);
  const XTest = applyStandardization(XTestRaw, means, stds);

  const p = ML_FEATURE_COLUMNS.length;
  let weights: number[] | undefined;
  let bias: number | undefined;
  let forest: DecisionTreeNode[] | undefined;
  let gbTrees: Array<{ tree: DecisionTreeNode; weight: number }> | undefined;
  let gbBaseLogOdds: number | undefined;
  const rawImportances = new Array<number>(p).fill(0);
  let modelLabel = 'Logistic Regression (L2 Baseline)';

  if (modelType === 'logistic_regression') {
    const fitted = trainLogisticWeights(XTrain, yTrain);
    weights = fitted.weights;
    bias = fitted.bias;
    for (let j = 0; j < p; j++) {
      rawImportances[j] = Math.abs(weights[j]);
    }
  } else if (modelType === 'random_forest') {
    modelLabel = 'Random Forest Classifier (25 Trees)';
    const numTrees = 25;
    const maxDepth = 4;
    const minSamplesLeaf = Math.max(8, Math.floor(XTrain.length * 0.015));
    const rng = createSeededRng(4201 + symbol.charCodeAt(0) * 17);
    forest = [];

    for (let t = 0; t < numTrees; t++) {
      const bootIdx: number[] = [];
      for (let i = 0; i < XTrain.length; i++) {
        bootIdx.push(Math.floor(rng() * XTrain.length));
      }
      const tree = buildClassificationTree(
        XTrain,
        yTrain,
        bootIdx,
        0,
        maxDepth,
        minSamplesLeaf,
        Math.max(3, Math.round(Math.sqrt(p))),
        rng,
        rawImportances,
      );
      forest.push(tree);
    }
  } else {
    modelLabel = 'Gradient Boosted Trees (XGBoost-Style)';
    const numTrees = 24;
    const learningRate = 0.08;
    const maxDepth = 3;
    const minSamplesLeaf = Math.max(10, Math.floor(XTrain.length * 0.02));

    const posRate = Math.min(0.95, Math.max(0.05, yTrain.reduce<number>((a, b) => a + b, 0) / yTrain.length));
    gbBaseLogOdds = Math.log(posRate / (1 - posRate));
    const currentPreds = new Array<number>(XTrain.length).fill(gbBaseLogOdds);
    const allIndices = Array.from({ length: XTrain.length }, (_, i) => i);
    gbTrees = [];

    for (let t = 0; t < numTrees; t++) {
      const residuals = currentPreds.map((lo, i) => yTrain[i] - sigmoid(lo));
      const tree = buildRegressionTree(
        XTrain,
        residuals,
        allIndices,
        0,
        maxDepth,
        minSamplesLeaf,
        rawImportances,
      );
      for (let i = 0; i < XTrain.length; i++) {
        currentPreds[i] += learningRate * predictTreeValue(tree, XTrain[i]);
      }
      gbTrees.push({ tree, weight: learningRate });
    }
  }

  const importanceSum = rawImportances.reduce((a, b) => a + b, 0) || 1;
  const featureImportance = ML_FEATURE_COLUMNS.map((feat, j) => ({
    feature: feat,
    label: FEATURE_LABELS[feat] ?? feat,
    importance: rawImportances[j] / importanceSum,
  })).sort((a, b) => b.importance - a.importance);

  const partialArtifact: TrainedModelArtifact = {
    symbol,
    modelType,
    modelLabel,
    trainedAt: new Date().toISOString(),
    trainingDurationMs: 0,
    trainSize: trainRows.length,
    testSize: testRows.length,
    splitRatio: clampedSplit,
    trainDateRange: { start: trainRows[0].date, end: trainRows[trainRows.length - 1].date },
    testDateRange: { start: testRows[0].date, end: testRows[testRows.length - 1].date },
    featuresUsed: [...ML_FEATURE_COLUMNS],
    excludedLeakageColumns: [...EXCLUDED_LEAKAGE_COLUMNS],
    targetVariable: 'target_direction',
    evaluation: {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      confusionMatrix: { tn: 0, fp: 0, fn: 0, tp: 0 },
      testPositiveRate: 0,
      predictedPositiveRate: 0,
    },
    featureImportance,
    means,
    stds,
    weights,
    bias,
    forest,
    gbTrees,
    gbBaseLogOdds,
  };

  const testProbs = XTest.map((_, idx) =>
    predictProbabilityWithArtifact(partialArtifact, XTestRaw[idx]),
  );
  partialArtifact.evaluation = evaluatePredictions(yTest, testProbs, 0.5);
  partialArtifact.trainingDurationMs = Math.max(1, Math.round(performance.now() - startMs));

  return partialArtifact;
}

export function explainSinglePrediction(
  artifact: TrainedModelArtifact,
  row: FeatureRow,
): { explanationMethod: string; contributions: FeatureContribution[] } {
  const raw = extractFeatureVector(row);
  const stdX = raw.map((v, j) => (v - artifact.means[j]) / artifact.stds[j]);
  const baseProb = predictProbabilityWithArtifact(artifact, raw);

  const importanceMap = new Map(artifact.featureImportance.map((item) => [item.feature, item.importance]));

  let rawContribs: number[] = [];
  let explanationMethod = '';

  if (artifact.modelType === 'logistic_regression' && artifact.weights) {
    // Exact Linear SHAP: phi_j = w_j * (z_j - E[z_j]) = w_j * z_j (mean of standardized train feature is 0)
    explanationMethod = 'Exact Linear SHAP (log-odds attribution φ_j = w_j · (x_j − μ_j)/σ_j)';
    rawContribs = artifact.weights.map((w, j) => w * stdX[j]);
  } else {
    explanationMethod =
      artifact.modelType === 'random_forest'
        ? 'Tree Ensemble Feature Importance & Local Perturbation Attribution (Baseline-Replaced)'
        : 'Gradient Boosting Gain Importance & Local Perturbation Attribution (Baseline-Replaced)';
    // Replace each feature with its training mean (baseline) to measure marginal probability impact
    rawContribs = raw.map((_, j) => {
      const perturbed = [...raw];
      perturbed[j] = artifact.means[j];
      const withoutFeatureProb = predictProbabilityWithArtifact(artifact, perturbed);
      return baseProb - withoutFeatureProb;
    });
  }

  const contributions: FeatureContribution[] = ML_FEATURE_COLUMNS.map((feat, j) => {
    const val = raw[j];
    const contrib = rawContribs[j];
    const direction: 'positive' | 'negative' | 'neutral' =
      contrib > 0.002 ? 'positive' : contrib < -0.002 ? 'negative' : 'neutral';

    return {
      feature: feat,
      label: FEATURE_LABELS[feat] ?? feat,
      rawValue: val,
      importance: importanceMap.get(feat) ?? 0,
      contribution: contrib,
      direction,
      explanation: buildFeatureExplanationText(feat, val, row, direction),
    };
  }).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  return { explanationMethod, contributions };
}

function buildFeatureExplanationText(
  feature: string,
  val: number,
  row: FeatureRow,
  direction: 'positive' | 'negative' | 'neutral',
): string {
  const lean =
    direction === 'positive'
      ? 'pushes model toward BUY'
      : direction === 'negative'
        ? 'pushes model toward SELL'
        : 'has neutral impact';

  switch (feature) {
    case 'rsi_14':
      return `RSI(14) at ${val.toFixed(1)} (${val > 70 ? 'overbought' : val < 30 ? 'oversold' : 'neutral zone'}) ${lean}.`;
    case 'daily_return':
      return `Session return of ${(val * 100).toFixed(2)}% ${lean}.`;
    case 'sma_20':
      return `Close ₹${row.close.toFixed(1)} is ${row.close >= val ? 'above' : 'below'} SMA(20) ₹${val.toFixed(1)}, which ${lean}.`;
    case 'sma_50':
      return `Close ₹${row.close.toFixed(1)} is ${row.close >= val ? 'above' : 'below'} SMA(50) ₹${val.toFixed(1)}, which ${lean}.`;
    case 'macd':
      return `MACD (${val.toFixed(2)}) vs Signal (${row.macd_signal.toFixed(2)}) ${lean}.`;
    case 'volume_ratio':
      return `Volume ratio ${val.toFixed(2)}x vs 20-day avg ${lean}.`;
    case 'atr_14':
      return `ATR(14) volatility ₹${val.toFixed(2)} (${((val / row.close) * 100).toFixed(2)}% of price) ${lean}.`;
    default:
      return `${FEATURE_LABELS[feature] ?? feature} at ${val.toFixed(2)} ${lean}.`;
  }
}

export function classifySignal(buyProb: number, threshold = 0.75): SignalDirection {
  const clamped = Math.min(0.95, Math.max(0.5, threshold));
  if (buyProb >= clamped) return 'BUY';
  if (1 - buyProb >= clamped) return 'SELL';
  return 'HOLD';
}

export function fitGarch11(symbol: string, rows: FeatureRow[]): GarchResult {
  if (rows.length < 60) {
    return {
      symbol,
      fitted: false,
      statusMessage: 'Insufficient return history (minimum 60 observations required for GARCH(1,1)).',
      sampleSize: rows.length,
      omega: 0,
      alpha: 0,
      beta: 0,
      persistence: 0,
      longRunDailyVolPct: 0,
      longRunAnnualVolPct: 0,
      nextDayForecastDailyVolPct: 0,
      nextDayForecastAnnualVolPct: 0,
      logLikelihood: 0,
      series: [],
    };
  }

  const returns = rows.map((r) => r.daily_return);
  const n = returns.length;
  const meanRet = returns.reduce((a, b) => a + b, 0) / n;
  const eps = returns.map((r) => r - meanRet);
  const sampleVar = Math.max(
    1e-7,
    eps.reduce((acc, e) => acc + e * e, 0) / Math.max(1, n - 1),
  );

  // Grid + coordinate refinement maximizing Gaussian log-likelihood via variance targeting:
  // omega = sampleVar * (1 - alpha - beta)
  let bestAlpha = 0.08;
  let bestBeta = 0.85;
  let bestLl = -Infinity;

  const evalLogLik = (alpha: number, beta: number): number => {
    if (alpha < 0.005 || beta < 0.05 || alpha + beta >= 0.992) return -Infinity;
    const omega = sampleVar * (1 - alpha - beta);
    if (omega <= 0) return -Infinity;
    let h = sampleVar;
    let ll = 0;
    for (let t = 1; t < n; t++) {
      h = omega + alpha * eps[t - 1] * eps[t - 1] + beta * h;
      if (h <= 1e-12) return -Infinity;
      ll += -0.5 * (Math.log(2 * Math.PI) + Math.log(h) + (eps[t] * eps[t]) / h);
    }
    return ll;
  };

  for (let a = 0.02; a <= 0.30; a += 0.02) {
    for (let b = 0.50; b <= 0.95; b += 0.03) {
      if (a + b >= 0.985) continue;
      const ll = evalLogLik(a, b);
      if (ll > bestLl) {
        bestLl = ll;
        bestAlpha = a;
        bestBeta = b;
      }
    }
  }

  // Fine local refinement
  let step = 0.008;
  for (let iter = 0; iter < 5; iter++) {
    for (const da of [-step, 0, step]) {
      for (const db of [-step, 0, step]) {
        const na = bestAlpha + da;
        const nb = bestBeta + db;
        const ll = evalLogLik(na, nb);
        if (ll > bestLl) {
          bestLl = ll;
          bestAlpha = na;
          bestBeta = nb;
        }
      }
    }
    step *= 0.5;
  }

  const omega = sampleVar * (1 - bestAlpha - bestBeta);
  const series: GarchResult['series'] = [];
  let h = sampleVar;

  for (let t = 0; t < n; t++) {
    if (t > 0) {
      h = omega + bestAlpha * eps[t - 1] * eps[t - 1] + bestBeta * h;
    }
    series.push({
      date: rows[t].date,
      dailyReturnPct: returns[t] * 100,
      conditionalVolAnnualPct: Math.sqrt(h) * Math.sqrt(252) * 100,
    });
  }

  const lastEps = eps[n - 1];
  const nextVar = omega + bestAlpha * lastEps * lastEps + bestBeta * h;
  const longRunDailyVol = Math.sqrt(sampleVar);
  const nextDailyVol = Math.sqrt(nextVar);

  return {
    symbol,
    fitted: true,
    statusMessage: 'GARCH(1,1) stationary variance-targeted MLE converged.',
    sampleSize: n,
    omega,
    alpha: bestAlpha,
    beta: bestBeta,
    persistence: bestAlpha + bestBeta,
    longRunDailyVolPct: longRunDailyVol * 100,
    longRunAnnualVolPct: longRunDailyVol * Math.sqrt(252) * 100,
    nextDayForecastDailyVolPct: nextDailyVol * 100,
    nextDayForecastAnnualVolPct: nextDailyVol * Math.sqrt(252) * 100,
    logLikelihood: bestLl,
    series: series.slice(-120),
  };
}

export function calculateRiskMetrics(params: {
  symbol: string;
  entryPrice: number;
  atr14: number;
  atrMultiplier?: number;
  availableCapital?: number;
  riskPercentage?: number;
  riskRewardMultiple?: number;
}): RiskMetrics {
  const entryPrice = Math.max(0.01, params.entryPrice);
  const atr14 = Math.max(0.01, params.atr14);
  const atrMultiplier = Math.max(0.5, Math.min(5, params.atrMultiplier ?? 1.5));
  const availableCapital = Math.max(1000, params.availableCapital ?? 100000);
  const riskPercentage = Math.max(0.1, Math.min(10, params.riskPercentage ?? 1.5));
  const riskRewardMultiple = Math.max(1, Math.min(5, params.riskRewardMultiple ?? 2));

  const riskPerShare = atrMultiplier * atr14;
  const stopLoss = Math.max(0.01, entryPrice - riskPerShare);
  const actualRiskPerShare = Math.max(0.01, entryPrice - stopLoss);
  const rewardPerShare = actualRiskPerShare * riskRewardMultiple;
  const targetPrice = entryPrice + rewardPerShare;

  const riskFraction = riskPercentage / 100;
  const maxRiskAmount = availableCapital * riskFraction;
  const positionSizeShares = Math.max(0, Math.floor(maxRiskAmount / actualRiskPerShare));
  const suggestedCapitalAllocation = positionSizeShares * entryPrice;
  const capitalExposurePct = (suggestedCapitalAllocation / availableCapital) * 100;

  const atrPctOfPrice = (atr14 / entryPrice) * 100;
  let volatilityCategory: RiskMetrics['volatilityCategory'] = 'Moderate';
  if (atrPctOfPrice < 1.3) volatilityCategory = 'Low';
  else if (atrPctOfPrice < 2.2) volatilityCategory = 'Moderate';
  else if (atrPctOfPrice < 3.2) volatilityCategory = 'Elevated';
  else volatilityCategory = 'High';

  return {
    symbol: params.symbol,
    entryPrice,
    atr14,
    atrMultiplier,
    availableCapital,
    riskPercentage,
    riskRewardMultiple,
    stopLoss,
    targetPrice,
    riskPerShare: actualRiskPerShare,
    rewardPerShare,
    riskRewardRatio: rewardPerShare / actualRiskPerShare,
    maxRiskAmount,
    positionSizeShares,
    suggestedCapitalAllocation,
    capitalExposurePct,
    volatilityCategory,
    atrPctOfPrice,
  };
}

export function runChronologicalBacktest(params: {
  symbol: string;
  rows: FeatureRow[];
  strategy: 'ml_model' | 'sma_crossover' | 'rsi_mean_reversion';
  artifact?: TrainedModelArtifact;
  initialCapital?: number;
  brokeragePct?: number;
  slippagePct?: number;
  buyThreshold?: number;
}): BacktestResult {
  const {
    symbol,
    rows,
    strategy,
    artifact,
    initialCapital = 1000000,
    brokeragePct = 0.05,
    slippagePct = 0.02,
    buyThreshold = 0.55,
  } = params;

  if (rows.length < 30) {
    throw new Error(`Insufficient rows for backtesting ${symbol}.`);
  }

  const costRate = (brokeragePct + slippagePct) / 100;
  let cash = initialCapital;
  let shares = 0;
  let entryPrice = 0;
  let entryDate = '';
  let entryCost = 0;
  let entryReason = '';
  let totalTransactionCosts = 0;
  const trades: BacktestTrade[] = [];

  const firstClose = rows[0].close;
  const benchmarkShares = initialCapital / firstClose;
  let peakEquity = initialCapital;
  let maxDrawdownPct = 0;
  const dailyPortfolioReturns: number[] = [];
  let prevEquity = initialCapital;

  const equityCurve: BacktestResult['equityCurve'] = [];

  // Signal computed on bar t-1 close, executed on bar t open (zero look-ahead bias!)
  for (let t = 0; t < rows.length; t++) {
    const bar = rows[t];

    if (t > 0) {
      const prevBar = rows[t - 1];
      let desireLong = false;
      let reason = '';

      if (strategy === 'ml_model' && artifact) {
        const prob = predictProbabilityWithArtifact(artifact, extractFeatureVector(prevBar));
        desireLong = prob >= buyThreshold;
        reason = `Model BUY prob ${(prob * 100).toFixed(1)}%`;
      } else if (strategy === 'sma_crossover') {
        desireLong = prevBar.sma_20 > prevBar.sma_50;
        reason = 'SMA 20 > SMA 50 trend filter';
      } else {
        // RSI mean reversion + trend guard
        desireLong = prevBar.rsi_14 < 42 || (prevBar.rsi_14 < 65 && prevBar.macd > prevBar.macd_signal);
        reason = 'RSI + MACD momentum filter';
      }

      const execPrice = bar.open > 0 ? bar.open : bar.close;

      if (desireLong && shares === 0) {
        const effectiveBuyPrice = execPrice * (1 + costRate);
        const affordable = Math.floor(cash / effectiveBuyPrice);
        if (affordable > 0) {
          const grossValue = affordable * execPrice;
          const txCost = grossValue * costRate;
          cash -= grossValue + txCost;
          shares = affordable;
          entryPrice = execPrice;
          entryDate = bar.date;
          entryCost = txCost;
          entryReason = reason;
          totalTransactionCosts += txCost;
        }
      } else if (!desireLong && shares > 0) {
        const grossValue = shares * execPrice;
        const txCost = grossValue * costRate;
        cash += grossValue - txCost;
        totalTransactionCosts += txCost;
        const totalTradeCost = entryCost + txCost;
        const grossPnl = (execPrice - entryPrice) * shares;
        const netPnl = grossPnl - totalTradeCost;
        trades.push({
          entryDate,
          exitDate: bar.date,
          entryPrice,
          exitPrice: execPrice,
          shares,
          grossPnl,
          transactionCost: totalTradeCost,
          netPnl,
          returnPct: ((execPrice - entryPrice) / entryPrice) * 100,
          signalReason: entryReason,
        });
        shares = 0;
      }
    }

    const equity = cash + shares * bar.close;
    const benchmarkEquity = benchmarkShares * bar.close;
    if (equity > peakEquity) peakEquity = equity;
    const ddPct = peakEquity > 0 ? ((peakEquity - equity) / peakEquity) * 100 : 0;
    if (ddPct > maxDrawdownPct) maxDrawdownPct = ddPct;

    if (t > 0 && prevEquity > 0) {
      dailyPortfolioReturns.push((equity - prevEquity) / prevEquity);
    }
    prevEquity = equity;

    equityCurve.push({
      date: bar.date,
      strategyEquity: Math.round(equity * 100) / 100,
      benchmarkEquity: Math.round(benchmarkEquity * 100) / 100,
      drawdownPct: Math.round(ddPct * 100) / 100,
    });
  }

  // Close open position at final close for complete accounting
  const lastBar = rows[rows.length - 1];
  if (shares > 0) {
    const grossValue = shares * lastBar.close;
    const txCost = grossValue * costRate;
    cash += grossValue - txCost;
    totalTransactionCosts += txCost;
    const totalTradeCost = entryCost + txCost;
    const grossPnl = (lastBar.close - entryPrice) * shares;
    trades.push({
      entryDate,
      exitDate: lastBar.date,
      entryPrice,
      exitPrice: lastBar.close,
      shares,
      grossPnl,
      transactionCost: totalTradeCost,
      netPnl: grossPnl - totalTradeCost,
      returnPct: ((lastBar.close - entryPrice) / entryPrice) * 100,
      signalReason: `${entryReason} (marked to close)`,
    });
    shares = 0;
  }

  const finalEquity = cash;
  const netProfit = finalEquity - initialCapital;
  const totalReturnPct = (netProfit / initialCapital) * 100;
  const benchmarkFinalEquity = benchmarkShares * lastBar.close;
  const benchmarkReturnPct = ((benchmarkFinalEquity - initialCapital) / initialCapital) * 100;

  const winningTrades = trades.filter((t) => t.netPnl > 0).length;
  const winRatePct = trades.length > 0 ? (winningTrades / trades.length) * 100 : 0;

  // Annualized Sharpe ratio assuming 252 NSE trading days per year and 6% Indian risk-free rate
  const dailyRf = 0.06 / 252;
  const meanDailyExcess =
    dailyPortfolioReturns.length > 0
      ? dailyPortfolioReturns.reduce((a, b) => a + (b - dailyRf), 0) / dailyPortfolioReturns.length
      : 0;
  const stdDaily =
    dailyPortfolioReturns.length > 1
      ? Math.sqrt(
          dailyPortfolioReturns.reduce(
            (acc, r) => acc + Math.pow(r - dailyRf - meanDailyExcess, 2),
            0,
          ) /
            (dailyPortfolioReturns.length - 1),
        )
      : 0;
  const sharpeRatio = stdDaily > 1e-9 ? (meanDailyExcess / stdDaily) * Math.sqrt(252) : 0;

  const strategyLabel =
    strategy === 'ml_model'
      ? artifact
        ? `${artifact.modelLabel} (Signal ≥ ${(buyThreshold * 100).toFixed(0)}%)`
        : 'ML Model Strategy'
      : strategy === 'sma_crossover'
        ? 'SMA 20 / SMA 50 Trend Crossover'
        : 'RSI(14) + MACD Momentum Strategy';

  return {
    symbol,
    strategyLabel,
    startDate: rows[0].date,
    endDate: lastBar.date,
    tradingDays: rows.length,
    initialCapital,
    finalEquity,
    netProfit,
    totalReturnPct,
    benchmarkFinalEquity,
    benchmarkReturnPct,
    numberOfTrades: trades.length,
    winningTrades,
    winRatePct,
    maxDrawdownPct,
    sharpeRatio,
    totalTransactionCosts,
    brokeragePct,
    slippagePct,
    assumptionsNote: `Configurable simulation assumptions: ${brokeragePct}% brokerage + ${slippagePct}% slippage per side, executed at next-session open (zero look-ahead bias). Sharpe annualized at 252 trading days with 6.0% risk-free rate.`,
    equityCurve,
    recentTrades: trades.slice(-20).reverse(),
  };
}
