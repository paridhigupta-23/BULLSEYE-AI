import pandas as pd

df = pd.read_csv(
    "datasets/processed/nifty50_features_2020_2025.csv"
)

print("Total rows:", len(df))
print("Total columns:", len(df.columns))

print("\nAll columns:")
print(df.columns.tolist())

print("\nStock count:", df["symbol"].nunique())

print("\nMissing values:")
print(df.isnull().sum())

print("\nTarget distribution:")
print(df["target_direction"].value_counts())