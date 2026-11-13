
import pandas as pd
import numpy as np
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

INPUT_FILE = (
    BASE_DIR / "datasets" / "processed"
    / "nifty50_combined_2020_2025.csv"
)

OUTPUT_DIR = BASE_DIR / "datasets" / "processed"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

df = pd.read_csv(INPUT_FILE)
df["timestamp"] = pd.to_datetime(df["timestamp"])

all_features = []

# Calculate indicators separately for every stock
for symbol, stock in df.groupby("symbol"):

    stock = stock.sort_values("timestamp").copy()

    # 1. Daily returns
    stock["daily_return"] = stock["close"].pct_change()

    # 2. Simple Moving Averages
    stock["sma_20"] = stock["close"].rolling(20).mean()
    stock["sma_50"] = stock["close"].rolling(50).mean()

    # 3. Exponential Moving Averages
    stock["ema_12"] = stock["close"].ewm(
        span=12, adjust=False
    ).mean()

    stock["ema_26"] = stock["close"].ewm(
        span=26, adjust=False
    ).mean()

    # 4. RSI (14 periods)
    delta = stock["close"].diff()

    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)

    avg_gain = gain.ewm(
        alpha=1/14, adjust=False, min_periods=14
    ).mean()

    avg_loss = loss.ewm(
        alpha=1/14, adjust=False, min_periods=14
    ).mean()

    rs = avg_gain / avg_loss.replace(0, np.nan)

    stock["rsi_14"] = 100 - (100 / (1 + rs))

    # Handle periods with no losses
    stock.loc[
        (avg_loss == 0) & (avg_gain > 0), "rsi_14"
    ] = 100

    # 5. MACD
    stock["macd"] = stock["ema_12"] - stock["ema_26"]

    stock["macd_signal"] = stock["macd"].ewm(
        span=9, adjust=False
    ).mean()

    # 6. Bollinger Bands
    rolling_std = stock["close"].rolling(20).std()

    stock["bb_upper"] = stock["sma_20"] + 2 * rolling_std
    stock["bb_lower"] = stock["sma_20"] - 2 * rolling_std

    # 7. Average True Range (ATR)
    previous_close = stock["close"].shift(1)

    true_range = pd.concat(
        [
            stock["high"] - stock["low"],
            (stock["high"] - previous_close).abs(),
            (stock["low"] - previous_close).abs()
        ],
        axis=1
    ).max(axis=1)

    stock["atr_14"] = true_range.rolling(14).mean()

    # 8. Volume indicators
    stock["volume_sma_20"] = stock["volume"].rolling(20).mean()

    stock["volume_ratio"] = (
        stock["volume"] /
        stock["volume_sma_20"].replace(0, np.nan)
    )

    # 9. Prediction target: next trading day's direction
    stock["next_day_return"] = (
        stock["close"].shift(-1) / stock["close"] - 1
    )

    stock["target_direction"] = np.where(
        stock["next_day_return"].isna(),
        np.nan,
        (stock["next_day_return"] > 0).astype(int)
    )

    all_features.append(stock)

# Combine all stocks
final_df = pd.concat(all_features, ignore_index=True)

# Remove rows without sufficient indicator history or target
feature_columns = [
    "daily_return", "sma_20", "sma_50",
    "ema_12", "ema_26", "rsi_14",
    "macd", "macd_signal",
    "bb_upper", "bb_lower", "atr_14",
    "volume_sma_20", "volume_ratio",
    "next_day_return", "target_direction"
]

final_df = final_df.dropna(subset=feature_columns)

final_df = final_df.sort_values(
    ["timestamp", "symbol"]
).reset_index(drop=True)

# Save engineered dataset
output_file = OUTPUT_DIR / "nifty50_features_2020_2025.csv"

final_df.to_csv(output_file, index=False)

print("\n========== FEATURE ENGINEERING COMPLETE ==========")
print("Total records:", len(final_df))
print("Unique stocks:", final_df["symbol"].nunique())

print("\nFeatures created:")
print(feature_columns)

print("\nTarget distribution:")
print(final_df["target_direction"].value_counts())

print("\nMissing values:")
print(final_df[feature_columns].isnull().sum())

print("\nSaved at:", output_file)
