# BULLSEYE AI — Modular Python Quantitative Research Package (`python_quant`)

Clean, leakage-safe Python implementation of the BULLSEYE AI quantitative pipeline reading the authentic NIFTY 50 historical datasets (`data/datasets/processed/nifty50_combined_2020_2025.csv` and `nifty50_features_2020_2025.csv`).

## Module Architecture

1. `config.py` — Dataset paths, 13 approved input features, zero-leakage target exclusions (`next_day_return`, `target_direction`), brokerage/slippage defaults.
2. `data_loader.py` — Loads historical OHLCV & feature CSVs, normalizes dates, audits duplicates and missing values.
3. `preprocessing.py` — Enforces chronological ascending sort per stock, prevents target leakage, fits Z-score `(mean, std)` strictly on training partition.
4. `features.py` — Independent per-stock technical indicator calculation & verification (Daily Return, SMA 20/50, EMA 12/26, RSI 14, MACD, Bollinger Bands, ATR 14, Volume Ratio).
5. `math_models.py` — Daily returns, rolling volatility, Pearson stock correlation, Historical VaR/CVaR, and GARCH(1,1) variance-targeted MLE.
6. `ml_models.py` — Logistic Regression & Random Forest models using `scikit-learn` when installed, with verified pure-Python fallback for constrained runtimes.
7. `dl_lstm.py` — Optional TensorFlow/Keras LSTM sequence classifier template (raises explicit dependency notice if TensorFlow is absent; never fabricates training results).
8. `evaluation.py` — Accuracy, Precision, Recall, F1, Confusion Matrix, and chronological Walk-Forward validation.
9. `signals.py` — Explainable `BUY` / `SELL` / `HOLD` signal engine across SMA 20/50 Crossover, RSI+MACD, ML Model, and Consensus Gate.
10. `backtester.py` — Chronological next-session open execution backtester deducting `0.05%` brokerage + `0.02%` slippage.
11. `run_pipeline.py` — End-to-end CLI runner printing JSON summary and optionally saving output artifacts.
12. `test_quant.py` — `unittest` suite verifying leakage prevention, chronological splitting, VaR, signals, and backtesting.

## Local Execution

```bash
# 1. Create virtual environment & install scientific stack
python3 -m venv .venv
source .venv/bin/activate
pip install -r python_quant/requirements.txt

# 2. Run end-to-end quantitative pipeline for RELIANCE
python3 python_quant/run_pipeline.py --symbol RELIANCE --model logistic_regression --save

# 3. Run automated Python unit tests
python3 -m unittest python_quant/test_quant.py
```

Note: In sandboxed environments without external packages installed, `ml_models.py` and `data_loader.py` fall back cleanly to Python 3 standard library math & CSV parsing and explicitly report `"engine": "python_stdlib"` in output metadata.
