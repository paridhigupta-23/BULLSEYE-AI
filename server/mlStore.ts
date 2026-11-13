import type {
  GarchResult,
  ModelType,
  PredictionResult,
  TrainedModelArtifact,
} from './types.ts';
import {
  classifySignal,
  explainSinglePrediction,
  extractFeatureVector,
  fitGarch11,
  predictProbabilityWithArtifact,
  trainChronologicalModel,
} from './quantMath.ts';
import { buildRuleExplanations, loadDatasets } from './dataLoader.ts';

class MlModelStore {
  private artifacts = new Map<string, TrainedModelArtifact>();
  private activeModelBySymbol = new Map<string, ModelType>();
  private garchCache = new Map<string, GarchResult>();

  public lastTrainingTimestamp: string | null = null;
  public lastPredictionTimestamp: string | null = null;
  public lastInferenceLatencyMs: number | null = null;
  public lastBacktestTimestamp: string | null = null;
  public lastBacktestStatus: string = 'Ready';
  public recentErrors: Array<{ timestamp: string; message: string }> = [];

  private key(symbol: string, modelType: ModelType): string {
    return `${symbol.toUpperCase()}:${modelType}`;
  }

  public recordError(message: string): void {
    this.recentErrors.unshift({ timestamp: new Date().toISOString(), message });
    if (this.recentErrors.length > 10) this.recentErrors.pop();
  }

  public bootstrapPrimaryModels(): void {
    const dataset = loadDatasets();
    const primary = ['RELIANCE', 'TCS', 'ADANIENT', 'TATASTEEL'];
    for (const sym of primary) {
      const rows = dataset.featuresBySymbol.get(sym);
      if (rows && rows.length >= 120) {
        try {
          this.train(sym, 'logistic_regression', 0.8);
        } catch (err) {
          this.recordError(err instanceof Error ? err.message : String(err));
        }
      }
    }
  }

  public train(
    symbol: string,
    modelType: ModelType = 'logistic_regression',
    splitRatio = 0.8,
  ): TrainedModelArtifact {
    const sym = symbol.toUpperCase();
    const dataset = loadDatasets();
    const rows = dataset.featuresBySymbol.get(sym);
    if (!rows || rows.length < 120) {
      const msg = `Insufficient feature data for ${sym} to train ${modelType}.`;
      this.recordError(msg);
      throw new Error(msg);
    }

    const artifact = trainChronologicalModel(sym, rows, modelType, splitRatio);
    this.artifacts.set(this.key(sym, modelType), artifact);
    this.activeModelBySymbol.set(sym, modelType);
    this.lastTrainingTimestamp = artifact.trainedAt;
    return artifact;
  }

  public getArtifact(symbol: string, modelType?: ModelType): TrainedModelArtifact | null {
    const sym = symbol.toUpperCase();
    const chosen = modelType ?? this.activeModelBySymbol.get(sym);
    if (!chosen) return null;
    return this.artifacts.get(this.key(sym, chosen)) ?? null;
  }

  public listTrainedModelsForSymbol(symbol: string): TrainedModelArtifact[] {
    const sym = symbol.toUpperCase();
    const types: ModelType[] = ['logistic_regression', 'random_forest', 'gradient_boosting'];
    const list: TrainedModelArtifact[] = [];
    for (const t of types) {
      const art = this.artifacts.get(this.key(sym, t));
      if (art) list.push(art);
    }
    return list;
  }

  public predictLatest(
    symbol: string,
    modelType?: ModelType,
    threshold = 0.75,
  ): PredictionResult {
    const sym = symbol.toUpperCase();
    const dataset = loadDatasets();
    const rows = dataset.featuresBySymbol.get(sym);
    if (!rows || rows.length === 0) {
      return {
        symbol: sym,
        modelTrained: false,
        modelType: null,
        modelName: null,
        predictionDate: null,
        inferenceTimestamp: null,
        inferenceLatencyMs: null,
        threshold,
        signal: null,
        buyProbability: null,
        sellProbability: null,
        confidence: null,
        explanationMethod: null,
        contributions: [],
        ruleExplanations: [],
        statusMessage: `No feature data available for ${sym}.`,
      };
    }

    const latestRow = rows[rows.length - 1];
    const ruleExplanations = buildRuleExplanations(latestRow);
    const artifact = this.getArtifact(sym, modelType);

    if (!artifact) {
      return {
        symbol: sym,
        modelTrained: false,
        modelType: modelType ?? null,
        modelName: null,
        predictionDate: latestRow.date,
        inferenceTimestamp: null,
        inferenceLatencyMs: null,
        threshold,
        signal: null,
        buyProbability: null,
        sellProbability: null,
        confidence: null,
        explanationMethod: null,
        contributions: [],
        ruleExplanations,
        statusMessage: 'Model not trained yet — prediction unavailable.',
      };
    }

    const t0 = performance.now();
    const rawVec = extractFeatureVector(latestRow);
    const buyProb = predictProbabilityWithArtifact(artifact, rawVec);
    const sellProb = 1 - buyProb;
    const signal = classifySignal(buyProb, threshold);
    const { explanationMethod, contributions } = explainSinglePrediction(artifact, latestRow);
    const latencyMs = Math.max(0.1, Math.round((performance.now() - t0) * 100) / 100);

    const ts = new Date().toISOString();
    this.lastPredictionTimestamp = ts;
    this.lastInferenceLatencyMs = latencyMs;

    return {
      symbol: sym,
      modelTrained: true,
      modelType: artifact.modelType,
      modelName: artifact.modelLabel,
      predictionDate: latestRow.date,
      inferenceTimestamp: ts,
      inferenceLatencyMs: latencyMs,
      threshold,
      signal,
      buyProbability: buyProb,
      sellProbability: sellProb,
      confidence: Math.max(buyProb, sellProb),
      explanationMethod,
      contributions,
      ruleExplanations,
      statusMessage: `Experimental output generated from ${artifact.modelLabel} using features up to ${latestRow.date} (not financial advice).`,
    };
  }

  public getGarch(symbol: string): GarchResult {
    const sym = symbol.toUpperCase();
    const cached = this.garchCache.get(sym);
    if (cached) return cached;

    const dataset = loadDatasets();
    const rows = dataset.featuresBySymbol.get(sym) ?? [];
    const res = fitGarch11(sym, rows);
    this.garchCache.set(sym, res);
    return res;
  }
}

export const mlStore = new MlModelStore();
