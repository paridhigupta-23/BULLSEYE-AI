
import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

FILE = (
    BASE_DIR
    / "datasets"
    / "processed"
    / "nifty50_combined_2020_2025.csv"
)

df = pd.read_csv(FILE)

print("\n========== DATASET OVERVIEW ==========")

print("Total rows:", len(df))
print("Total columns:", len(df.columns))
print("Unique stocks:", df["symbol"].nunique())

print("\nColumns:")
print(df.columns.tolist())

print("\nDate range:")
print("Start:", df["timestamp"].min())
print("End:", df["timestamp"].max())

print("\n========== MISSING VALUES ==========")
print(df.isnull().sum())

print("\n========== DUPLICATE RECORDS ==========")
print(
    df.duplicated(
        subset=["timestamp", "symbol"]
    ).sum()
)

print("\n========== STOCK-WISE RECORDS ==========")
print(df.groupby("symbol").size())

print("\n========== INVALID PRICE CHECK ==========")

invalid = df[
    (df["high"] < df["low"]) |
    (df["open"] <= 0) |
    (df["high"] <= 0) |
    (df["low"] <= 0) |
    (df["close"] <= 0) |
    (df["volume"] < 0)
]

print("Invalid records:", len(invalid))

print("\n========== VALIDATION COMPLETE ==========")
