"""Configuration constants for BULLSEYE AI Python quant pipeline."""

from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data" / "datasets" / "processed"
COMBINED_CSV = DATA_DIR / "nifty50_combined_2020_2025.csv"
FEATURES_CSV = DATA_DIR / "nifty50_features_2020_2025.csv"
ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"

# Strictly approved 13 input features (chronologically safe at close t)
ML_FEATURE_COLUMNS = [
    "daily_return",
    "sma_20",
    "sma_50",
    "ema_12",
    "ema_26",
    "rsi_14",
    "macd",
    "macd_signal",
    "bb_upper",
    "bb_lower",
    "atr_14",
    "volume_sma_20",
    "volume_ratio",
]

# Columns strictly excluded from X matrices to guarantee zero target leakage
EXCLUDED_LEAKAGE_COLUMNS = ["next_day_return", "target_direction"]
TARGET_COLUMN = "target_direction"

DEFAULT_BROKERAGE_PCT = 0.05
DEFAULT_SLIPPAGE_PCT = 0.02
RISK_FREE_ANNUAL_RATE = 0.06
TRADING_DAYS_PER_YEAR = 252
