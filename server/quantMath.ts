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

function buildWindowedFlatVector(stdMatrix: number[][], endIdx: number, windowSize: number): number[] {
  const p = stdMatrix[0]?.length ?? 13;
  const flat: number[] = [];
  for (let lag = windowSize - 1; lag >= 0; lag--) {
    const srcIdx = Math.max(0, endIdx - lag);
    const row = stdMatrix[srcIdx];
    for (let j = 0; j < p; j++) {
      flat.push(row[j]);
    }
  }
  return flat;
}

function forwardMlpSingle(
  x: number[],
  w1: number[][],
  b1: number[],
  w2: number[],
  b2: number,
): { hidden: number[]; prob: number } {
  const hCount = b1.length;
  const hidden = new Array<number>(hCount);
  let outZ = b2;
  for (let h = 0; h < hCount; h++) {
    let sum = b1[h];
    const rowW = w1[h];
    for (let k = 0; k < x.length; k++) {
      sum += rowW[k] * x[k];
    }
    const act = Math.tanh(sum);
    hidden[h] = act;
    outZ += w2[h] * act;
  }
  return { hidden, prob: sigmoid(outZ) };
}

function computeBceLoss(
  XSeq: number[][],
  y: number[],
  w1: number[][],
  b1: number[],
  w2: number[],
  b2: number,
): number {
  if (XSeq.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < XSeq.length; i++) {
    const { prob } = forwardMlpSingle(XSeq[i], w1, b1, w2, b2);
    const pClamped = Math.min(1 - 1e-7, Math.max(1e-7, prob));
    total += -(y[i] * Math.log(pClamped) + (1 - y[i]) * Math.log(1 - pClamped));
  }
  return total / XSeq.length;
}

function trainSequenceMlp(
  XTrainStd: number[][],
  yTrain: number[],
  windowSize = 5,
  hiddenSize = 14,
  epochs = 45,
  lr = 0.06,
  l2 = 0.015,
): {
  windowSize: number;
  hiddenSize: number;
  w1: number[][];
  b1: number[];
  w2: number[];
  b2: number;
  trainLossHistory: Array<{ epoch: number; trainLoss: number; valLoss: number }>;
  featureImportances: number[];
} {
  const n = XTrainStd.length;
  const p = XTrainStd[0]?.length ?? 13;
  const inputDim = windowSize * p;

  // Chronological inner validation split (strictly inside XTrain — zero test leakage!)
  const innerSplit = Math.max(windowSize + 10, Math.floor(n * 0.85));
  const XSeqTrain: number[][] = [];
  const ySeqTrain: number[] = [];
  const XSeqVal: number[][] = [];
  const ySeqVal: number[] = [];

  for (let i = 0; i < n; i++) {
    const flat = buildWindowedFlatVector(XTrainStd, i, windowSize);
    if (i < innerSplit) {
      XSeqTrain.push(flat);
      ySeqTrain.push(yTrain[i]);
    } else {
      XSeqVal.push(flat);
      ySeqVal.push(yTrain[i]);
    }
  }

  const rng = createSeededRng(7331);
  const scale1 = Math.sqrt(2 / (inputDim + hiddenSize));
  const scale2 = Math.sqrt(2 / (hiddenSize + 1));
  const w1: number[][] = Array.from({ length: hiddenSize }, () =>
    Array.from({ length: inputDim }, () => (rng() * 2 - 1) * scale1),
  );
  const b1 = new Array<number>(hiddenSize).fill(0);
  const w2 = Array.from({ length: hiddenSize }, () => (rng() * 2 - 1) * scale2);
  let b2 = 0;

  const trainLossHistory: Array<{ epoch: number; trainLoss: number; valLoss: number }> = [];

  for (let ep = 1; ep <= epochs; ep++) {
    const dW1: number[][] = Array.from({ length: hiddenSize }, () =>
      new Array<number>(inputDim).fill(0),
    );
    const dB1 = new Array<number>(hiddenSize).fill(0);
    const dW2 = new Array<number>(hiddenSize).fill(0);
    let dB2 = 0;

    for (let i = 0; i < XSeqTrain.length; i++) {
      const x = XSeqTrain[i];
      const { hidden, prob } = forwardMlpSingle(x, w1, b1, w2, b2);
      const errOut = prob - ySeqTrain[i];
      dB2 += errOut;

      for (let h = 0; h < hiddenSize; h++) {
        const hAct = hidden[h];
        dW2[h] += errOut * hAct;
        const errHidden = errOut * w2[h] * (1 - hAct * hAct);
        dB1[h] += errHidden;
        const rowDW1 = dW1[h];
        for (let k = 0; k < inputDim; k++) {
          rowDW1[k] += errHidden * x[k];
        }
      }
    }

    const invN = 1 / Math.max(1, XSeqTrain.length);
    b2 -= lr * dB2 * invN;
    for (let h = 0; h < hiddenSize; h++) {
      w2[h] -= lr * (dW2[h] * invN + l2 * w2[h]);
      b1[h] -= lr * (dB1[h] * invN);
      for (let k = 0; k < inputDim; k++) {
        w1[h][k] -= lr * (dW1[h][k] * invN + l2 * w1[h][k]);
      }
    }

    if (ep === 1 || ep % 5 === 0 || ep === epochs) {
      const tLoss = computeBceLoss(XSeqTrain, ySeqTrain, w1, b1, w2, b2);
      const vLoss =
        XSeqVal.length > 0 ? computeBceLoss(XSeqVal, ySeqVal, w1, b1, w2, b2) : tLoss;
      trainLossHistory.push({
        epoch: ep,
        trainLoss: Math.round(tLoss * 10000) / 10000,
        valLoss: Math.round(vLoss * 10000) / 10000,
      });
    }
  }

  // Feature sensitivity aggregated across temporal lags
  const featImp = new Array<number>(p).fill(0);
  for (let h = 0; h < hiddenSize; h++) {
    const outMag = Math.abs(w2[h]) + 1e-6;
    for (let lag = 0; lag < windowSize; lag++) {
      for (let j = 0; j < p; j++) {
        featImp[j] += Math.abs(w1[h][lag * p + j]) * outMag;
      }
    }
  }

  return {
    windowSize,
    hiddenSize,
    w1,
    b1,
    w2,
    b2,
    trainLossHistory,
    featureImportances: featImp,
  };
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
  rawWindowVectors?: number[][],
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

  if (artifact.modelType === 'sequence_mlp' && artifact.mlpNetwork) {
    const net = artifact.mlpNetwork;
    const flat: number[] = [];
    if (rawWindowVectors && rawWindowVectors.length > 0) {
      const stdSeq = rawWindowVectors.map((vec) =>
        vec.map((v, j) => (v - artifact.means[j]) / artifact.stds[j]),
      );
      for (let lag = net.windowSize - 1; lag >= 0; lag--) {
        const idx = Math.max(0, stdSeq.length - 1 - lag);
        flat.push(...stdSeq[idx]);
      }
    } else {
      for (let lag = 0; lag < net.windowSize; lag++) {
        flat.push(...stdX);
      }
    }
    return forwardMlpSingle(flat, net.w1, net.b1, net.w2, net.b2).prob;
  }

  return 0.5;
}

export function predictProbabilityForRowIndex(
  artifact: TrainedModelArtifact,
  rows: FeatureRow[],
  rowIndex: number,
): number {
  const rawVec = extractFeatureVector(rows[rowIndex]);
  if (artifact.modelType === 'sequence_mlp' && artifact.mlpNetwork) {
    const w = artifact.mlpNetwork.windowSize;
    const start = Math.max(0, rowIndex - w + 1);
    const seq = rows.slice(start, rowIndex + 1).map(extractFeatureVector);
    return predictProbabilityWithArtifact(artifact, rawVec, seq);
  }
  return predictProbabilityWithArtifact(artifact, rawVec);
}

export interface TrainingCustomOptions {
  splitRatio?: number;
  l2?: number;
  learningRate?: number;
  epochs?: number;
  numTrees?: number;
  maxDepth?: number;
  hiddenSize?: number;
  windowSize?: number;
  trainRowsOverride?: FeatureRow[];
  testRowsOverride?: FeatureRow[];
}

export function trainChronologicalModelWithOptions(
  symbol: string,
  rows: FeatureRow[],
  modelType: ModelType,
  options: TrainingCustomOptions = {},
): TrainedModelArtifact {
  const trainRows =
    options.trainRowsOverride ??
    rows.slice(0, Math.floor(rows.length * Math.min(0.9, Math.max(0.5, options.splitRatio ?? 0.8))));
  const testRows =
    options.testRowsOverride ??
    rows.slice(Math.floor(rows.length * Math.min(0.9, Math.max(0.5, options.splitRatio ?? 0.8))));

  if (trainRows.length < 40 || testRows.length < 10) {
    throw new Error(
      `Insufficient chronological history for ${symbol} (train ${trainRows.length}, test ${testRows.length}).`,
    );
  }

  const startMs = performance.now();
  const clampedSplit =
    options.splitRatio ?? Number((trainRows.length / Math.max(1, trainRows.length + testRows.length)).toFixed(2));

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
  let mlpNetwork: TrainedModelArtifact['mlpNetwork'] | undefined;
  let hyperparameters: Record<string, string | number> = {};
  const rawImportances = new Array<number>(p).fill(0);
  let modelLabel = 'Logistic Regression (L2 Baseline)';

  if (modelType === 'logistic_regression') {
    const l2 = options.l2 ?? 0.05;
    const epochs = options.epochs ?? 260;
    const lr = options.learningRate ?? 0.12;
    hyperparameters = { l2, epochs, learningRate: lr };
    const fitted = trainLogisticWeights(XTrain, yTrain, l2, epochs, lr);
    weights = fitted.weights;
    bias = fitted.bias;
    for (let j = 0; j < p; j++) {
      rawImportances[j] = Math.abs(weights[j]);
    }
  } else if (modelType === 'random_forest') {
    const numTrees = options.numTrees ?? 25;
    const maxDepth = options.maxDepth ?? 4;
    modelLabel = `Random Forest Classifier (${numTrees} Trees)`;
    const minSamplesLeaf = Math.max(6, Math.floor(XTrain.length * 0.015));
    hyperparameters = { numTrees, maxDepth, minSamplesLeaf };
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
  } else if (modelType === 'gradient_boosting') {
    const numTrees = options.numTrees ?? 24;
    const learningRate = options.learningRate ?? 0.08;
    const maxDepth = options.maxDepth ?? 3;
    modelLabel = 'Gradient Boosted Trees (CART Residual Boosting)';
    const minSamplesLeaf = Math.max(8, Math.floor(XTrain.length * 0.02));
    hyperparameters = { numTrees, learningRate, maxDepth, minSamplesLeaf };

    const posRate = Math.min(
      0.95,
      Math.max(0.05, yTrain.reduce<number>((a, b) => a + b, 0) / yTrain.length),
    );
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
  } else {
    const windowSize = options.windowSize ?? 5;
    const hiddenSize = options.hiddenSize ?? 14;
    const epochs = options.epochs ?? 45;
    const lr = options.learningRate ?? 0.06;
    const l2 = options.l2 ?? 0.015;
    modelLabel = `Temporal Sequence Neural Net (${windowSize}d Window MLP)`;
    hyperparameters = { windowSize, hiddenSize, epochs, learningRate: lr, l2 };
    const net = trainSequenceMlp(XTrain, yTrain, windowSize, hiddenSize, epochs, lr, l2);
    mlpNetwork = {
      windowSize: net.windowSize,
      hiddenSize: net.hiddenSize,
      w1: net.w1,
      b1: net.b1,
      w2: net.w2,
      b2: net.b2,
      trainLossHistory: net.trainLossHistory,
    };
    for (let j = 0; j < p; j++) {
      rawImportances[j] = net.featureImportances[j];
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
    mlpNetwork,
    hyperparameters,
    trainLossHistory: mlpNetwork?.trainLossHistory,
  };

  const combinedSeqRows = [...trainRows, ...testRows];
  const offset = trainRows.length;
  const testProbs = XTest.map((_, idx) =>
    predictProbabilityForRowIndex(partialArtifact, combinedSeqRows, offset + idx),
  );
  partialArtifact.evaluation = evaluatePredictions(yTest, testProbs, 0.5);
  partialArtifact.trainingDurationMs = Math.max(1, Math.round(performance.now() - startMs));

  return partialArtifact;
}

export function trainChronologicalModel(
  symbol: string,
  rows: FeatureRow[],
  modelType: ModelType,
  splitRatio = 0.8,
): TrainedModelArtifact {
  if (rows.length < 120) {
    throw new Error(
      `Insufficient chronological history for ${symbol} (${rows.length} rows; need at least 120).`,
    );
  }
  return trainChronologicalModelWithOptions(symbol, rows, modelType, { splitRatio });
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
    explanationMethod = 'Feature Importance and Baseline-Replaced Perturbation Attribution';
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
  allSymbolRows?: FeatureRow[];
  strategy: 'ml_model' | 'sma_crossover' | 'rsi_mean_reversion' | 'rsi_macd' | 'combined_ml_tech';
  modelType?: ModelType;
  artifact?: TrainedModelArtifact;
  initialCapital?: number;
  brokeragePct?: number;
  slippagePct?: number;
  buyThreshold?: number;
  retrainIntervalBars?: number;
}): BacktestResult {
  const {
    symbol,
    rows,
    allSymbolRows,
    strategy,
    modelType,
    artifact,
    initialCapital = 1000000,
    brokeragePct = 0.05,
    slippagePct = 0.02,
    buyThreshold = 0.55,
  } = params;

  if (rows.length < 30) {
    throw new Error(`Insufficient rows for backtesting ${symbol}.`);
  }

  const usesMl = strategy === 'ml_model' || strategy === 'combined_ml_tech';
  const sourceRows = allSymbolRows && allSymbolRows.length > 0 ? allSymbolRows : rows;
  const dateToFullIdx = new Map<string, number>();
  for (let idx = 0; idx < sourceRows.length; idx++) {
    dateToFullIdx.set(sourceRows[idx].date, idx);
  }

  const activeModelType: ModelType = modelType ?? artifact?.modelType ?? 'logistic_regression';
  const retrainInterval = Math.max(21, Math.round(params.retrainIntervalBars ?? 63));
  const useStaticOutOfSampleArtifact =
    Boolean(artifact) &&
    !allSymbolRows &&
    artifact!.trainDateRange.end < rows[0].date;

  let wfArtifact: TrainedModelArtifact | undefined = useStaticOutOfSampleArtifact ? artifact : undefined;
  let lastRetrainFullIdx = -1;
  let retrainCount = 0;

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
  // For ML strategies, models only ever train on rows strictly BEFORE prevBar.date (so targets settled before execution day t).
  for (let t = 0; t < rows.length; t++) {
    const bar = rows[t];

    if (t > 0) {
      const prevBar = rows[t - 1];
      let desireLong = false;
      let reason = '';

      if (usesMl) {
        const prevFullIdx = dateToFullIdx.get(prevBar.date) ?? t - 1;

        if (!useStaticOutOfSampleArtifact) {
          // Strict walk-forward training on settled historical rows strictly before prevBar (< prevFullIdx)
          if (
            prevFullIdx >= 120 &&
            (!wfArtifact || prevFullIdx - lastRetrainFullIdx >= retrainInterval)
          ) {
            const trainSlice = sourceRows.slice(0, prevFullIdx);
            wfArtifact = trainChronologicalModelWithOptions(symbol, trainSlice, activeModelType, {
              trainRowsOverride: trainSlice,
              testRowsOverride: trainSlice.slice(-Math.min(10, trainSlice.length)),
            });
            lastRetrainFullIdx = prevFullIdx;
            retrainCount += 1;
          }
        }

        if (wfArtifact) {
          const prob = predictProbabilityForRowIndex(wfArtifact, sourceRows, prevFullIdx);
          if (strategy === 'ml_model') {
            desireLong = prob >= buyThreshold;
            reason = `Walk-Fwd ${wfArtifact.modelType} P(Up) ${(prob * 100).toFixed(1)}%`;
          } else {
            const techBullish =
              prevBar.sma_20 > prevBar.sma_50 &&
              prevBar.macd > prevBar.macd_signal &&
              prevBar.rsi_14 < 72;
            desireLong = prob >= buyThreshold && techBullish;
            reason = `Walk-Fwd ML ${(prob * 100).toFixed(1)}% + SMA/MACD/RSI Confirmation`;
          }
        } else {
          desireLong = false;
          reason = 'Walk-forward warmup (< 120 prior sessions)';
        }
      } else if (strategy === 'sma_crossover') {
        desireLong = prevBar.sma_20 > prevBar.sma_50;
        reason = 'SMA 20 > SMA 50 trend filter';
      } else {
        // RSI + MACD filter
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

  // Close open position at final close for complete accounting & reconcile final equity point
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

    if (equityCurve.length > 0) {
      if (cash > peakEquity) peakEquity = cash;
      const finalDd = peakEquity > 0 ? ((peakEquity - cash) / peakEquity) * 100 : 0;
      if (finalDd > maxDrawdownPct) maxDrawdownPct = finalDd;
      equityCurve[equityCurve.length - 1] = {
        ...equityCurve[equityCurve.length - 1],
        strategyEquity: Math.round(cash * 100) / 100,
        drawdownPct: Math.round(finalDd * 100) / 100,
      };
    }
  }

  const finalEquity = Math.round(cash * 100) / 100;
  const netProfit = finalEquity - initialCapital;
  const totalReturnPct = (netProfit / initialCapital) * 100;
  const benchmarkFinalEquity = benchmarkShares * lastBar.close;
  const benchmarkReturnPct = ((benchmarkFinalEquity - initialCapital) / initialCapital) * 100;

  const winningTradeList = trades.filter((t) => t.netPnl > 0);
  const losingTradeList = trades.filter((t) => t.netPnl <= 0);
  const winningTrades = winningTradeList.length;
  const losingTrades = losingTradeList.length;
  const winRatePct = trades.length > 0 ? (winningTrades / trades.length) * 100 : 0;

  const grossProfit = winningTradeList.reduce((acc, tr) => acc + tr.netPnl, 0);
  const grossLoss = Math.abs(losingTradeList.reduce((acc, tr) => acc + tr.netPnl, 0));
  const avgWinningTrade = winningTrades > 0 ? grossProfit / winningTrades : 0;
  const avgLosingTrade = losingTrades > 0 ? -(grossLoss / losingTrades) : 0;
  const profitFactor: number | null =
    grossLoss > 1e-6
      ? Math.round((grossProfit / grossLoss) * 10000) / 10000
      : grossProfit > 0
        ? null
        : 0;

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

  const resolvedModelLabel = wfArtifact?.modelLabel ?? activeModelType;
  const strategyLabel =
    strategy === 'ml_model'
      ? `Walk-Fwd ${resolvedModelLabel} (Signal ≥ ${(buyThreshold * 100).toFixed(0)}%)`
      : strategy === 'combined_ml_tech'
        ? `Walk-Fwd ${resolvedModelLabel} + SMA/MACD/RSI Gate`
        : strategy === 'sma_crossover'
          ? 'SMA 20 / SMA 50 Trend Crossover'
          : 'RSI(14) + MACD Momentum Strategy';

  const walkForwardNote = usesMl
    ? ` Walk-forward ML execution retrained strictly on prior settled bars (< trade date) across ${retrainCount} chronological fold(s) (${retrainInterval}-session cadence), eliminating future training leakage.`
    : '';

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
    losingTrades,
    winRatePct,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossLoss: Math.round(grossLoss * 100) / 100,
    profitFactor,
    avgWinningTrade: Math.round(avgWinningTrade * 100) / 100,
    avgLosingTrade: Math.round(avgLosingTrade * 100) / 100,
    maxDrawdownPct,
    sharpeRatio,
    totalTransactionCosts: Math.round(totalTransactionCosts * 100) / 100,
    brokeragePct,
    slippagePct,
    walkForwardLeakageFree: usesMl ? true : undefined,
    retrainCount: usesMl ? retrainCount : undefined,
    assumptionsNote: `Configurable simulation assumptions: ${brokeragePct}% brokerage + ${slippagePct}% slippage per side, executed at next-session open (zero look-ahead bias).${walkForwardNote} Sharpe annualized at 252 trading days with 6.0% risk-free rate.`,
    equityCurve,
    recentTrades: trades.slice(-20).reverse(),
  };
}
