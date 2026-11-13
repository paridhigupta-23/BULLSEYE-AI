import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { PythonEnvironmentStatus } from './types.ts';

const execFileAsync = promisify(execFile);

const PYTHON_MODULES_META: Array<{ name: string; description: string }> = [
  {
    name: 'README.md',
    description: 'Local setup, pip install instructions, CLI options, and quantitative methodology guide.',
  },
  {
    name: 'requirements.txt',
    description: 'Exact Python dependencies (pandas, numpy, scikit-learn, matplotlib, optional tensorflow).',
  },
  {
    name: 'config.py',
    description: 'Centralized paths, 13 ML feature columns, leakage exclusions, and backtest assumptions.',
  },
  {
    name: 'data_loader.py',
    description: 'Loads nifty50_combined_2020_2025.csv & nifty50_features_2020_2025.csv with missing/duplicate checks.',
  },
  {
    name: 'preprocessing.py',
    description: 'Chronological sorting, zero-leakage target separation, and train-only Z-score standardization.',
  },
  {
    name: 'features.py',
    description: 'Independent per-ticker technical indicator calculation & verification (SMA, EMA, RSI, MACD, BB, ATR).',
  },
  {
    name: 'math_models.py',
    description: 'Daily returns, rolling volatility, Pearson correlation, VaR/CVaR, and GARCH(1,1) MLE.',
  },
  {
    name: 'ml_models.py',
    description: 'scikit-learn Logistic Regression, Random Forest, Gradient Boosting (with stdlib fallback).',
  },
  {
    name: 'dl_lstm.py',
    description: 'Optional TensorFlow/Keras 2-layer LSTM architecture with explicit ImportError guard if absent.',
  },
  {
    name: 'evaluation.py',
    description: 'Confusion matrix, precision/recall/F1 classification report, and chronological walk-forward folds.',
  },
  {
    name: 'signals.py',
    description: 'Explainable BUY / SELL / HOLD decision generator across SMA, RSI+MACD, ML, and combined consensus.',
  },
  {
    name: 'backtester.py',
    description: 'Next-session open chronological backtester deducting 0.05% brokerage + 0.02% slippage.',
  },
  {
    name: 'run_pipeline.py',
    description: 'End-to-end CLI entrypoint printing structured JSON metrics and writing reproducible artifacts.',
  },
  {
    name: 'test_quant.py',
    description: 'Automated unittest suite covering anti-leakage, split ordering, VaR, signals, and backtesting.',
  },
];

let lastRunCache: PythonEnvironmentStatus['lastRunResult'] = null;

async function inspectPythonProbe(): Promise<{
  pythonVersion: string | null;
  pythonAvailable: boolean;
  packages: Record<string, boolean>;
}> {
  const probeScript = `
import json, sys
pkgs = {}
for name in ['numpy', 'pandas', 'sklearn', 'matplotlib', 'scipy', 'tensorflow', 'torch']:
    try:
        __import__(name)
        pkgs[name] = True
    except ImportError:
        pkgs[name] = False
print(json.dumps({'version': sys.version.split()[0], 'packages': pkgs}))
`.trim();

  try {
    const { stdout } = await execFileAsync('python3', ['-c', probeScript], { timeout: 5000 });
    const parsed = JSON.parse(stdout.trim()) as {
      version: string;
      packages: Record<string, boolean>;
    };
    return {
      pythonVersion: parsed.version,
      pythonAvailable: true,
      packages: parsed.packages,
    };
  } catch {
    return {
      pythonVersion: null,
      pythonAvailable: false,
      packages: {
        numpy: false,
        pandas: false,
        sklearn: false,
        matplotlib: false,
        scipy: false,
        tensorflow: false,
        torch: false,
      },
    };
  }
}

export async function getPythonWorkspaceStatus(): Promise<PythonEnvironmentStatus> {
  const pyDir = path.resolve(process.cwd(), 'python_quant');
  const probe = await inspectPythonProbe();

  const files = PYTHON_MODULES_META.map((m) => {
    const fullPath = path.join(pyDir, m.name);
    let content = '';
    try {
      if (fs.existsSync(fullPath)) {
        content = fs.readFileSync(fullPath, 'utf-8');
      }
    } catch {
      content = '# Unable to read file';
    }
    return {
      name: m.name,
      path: `python_quant/${m.name}`,
      description: m.description,
      content,
    };
  }).filter((f) => f.content.length > 0);

  const deepLearningNote =
    probe.packages.tensorflow || probe.packages.torch
      ? 'Deep Learning runtime detected (TensorFlow/PyTorch available for LSTM sequence training).'
      : 'Runtime Audit: Python 3.10 stdlib is installed, whereas scikit-learn, pandas, numpy, TensorFlow, and PyTorch are NOT installed in this container runtime. The live TypeScript Sequence Neural Net (5-day window tanh MLP) & classical ML models execute live in Node.js, while python_quant/ runs end-to-end via stdlib fallback here and unlocks scikit-learn / TensorFlow locally after `pip install -r python_quant/requirements.txt`.';

  return {
    pythonVersion: probe.pythonVersion,
    pythonAvailable: probe.pythonAvailable,
    packages: probe.packages,
    deepLearningNote,
    files,
    lastRunResult: lastRunCache,
  };
}

export async function executePythonPipeline(
  symbol: string,
  model: 'logistic_regression' | 'random_forest' = 'logistic_regression',
): Promise<PythonEnvironmentStatus['lastRunResult']> {
  const cleanSym = symbol.trim().toUpperCase().replace(/[^A-Z0-9&-]/g, '');
  const safeModel = model === 'random_forest' ? 'random_forest' : 'logistic_regression';
  const scriptPath = path.resolve(process.cwd(), 'python_quant', 'run_pipeline.py');
  const command = `python3 python_quant/run_pipeline.py --symbol ${cleanSym} --model ${safeModel} --json`;

  if (!fs.existsSync(scriptPath)) {
    lastRunCache = {
      executed: false,
      executedAt: new Date().toISOString(),
      command,
      output: null,
      rawStdout: '',
      error: 'python_quant/run_pipeline.py not found.',
    };
    return lastRunCache;
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      'python3',
      ['-m', 'python_quant.run_pipeline', '--symbol', cleanSym, '--model', safeModel, '--json'],
      { cwd: process.cwd(), timeout: 15000, maxBuffer: 2 * 1024 * 1024 },
    );
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(stdout.trim()) as Record<string, unknown>;
    } catch {
      parsed = null;
    }
    lastRunCache = {
      executed: true,
      executedAt: new Date().toISOString(),
      command,
      output: parsed,
      rawStdout: stdout || stderr || '',
      error: null,
    };
  } catch (err) {
    lastRunCache = {
      executed: false,
      executedAt: new Date().toISOString(),
      command,
      output: null,
      rawStdout: '',
      error: err instanceof Error ? err.message : String(err),
    };
  }
  return lastRunCache;
}
