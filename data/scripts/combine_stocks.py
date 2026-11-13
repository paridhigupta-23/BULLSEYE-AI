
import pandas as pd
from pathlib import Path

# Project directory
BASE_DIR = Path(__file__).resolve().parent.parent

# Folder containing the 50 individual stock CSV files
INPUT_DIR = (
    BASE_DIR
    / "datasets"
    / "nifty 50"
    / "Historical-Data-main"
    / "Assignment-2"
)

# Output directory
OUTPUT_DIR = BASE_DIR / "datasets" / "processed"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

all_stocks = []

csv_files = list(INPUT_DIR.glob("*.csv"))

print(f"Found {len(csv_files)} stock files.")

for file in csv_files:
    try:
        df = pd.read_csv(file)

        # Get stock symbol from filename
        symbol = file.name.split("_2020-")[0]

        # Add stock symbol
        df["symbol"] = symbol

        # Convert timestamp to date
        df["timestamp"] = pd.to_datetime(
            df["timestamp"], errors="coerce"
        )

        # Keep required columns
        required_columns = [
            "timestamp", "symbol",
            "open", "high", "low",
            "close", "volume", "oi"
        ]

        df = df[required_columns]

        all_stocks.append(df)

        print(f"Loaded: {symbol} - {len(df)} rows")

    except Exception as e:
        print(f"Error loading {file.name}: {e}")

# Combine all stocks
if all_stocks:
    combined = pd.concat(all_stocks, ignore_index=True)

    # Remove duplicate records
    combined.drop_duplicates(
        subset=["timestamp", "symbol"],
        inplace=True
    )

    # Sort by date and stock
    combined.sort_values(
        by=["timestamp", "symbol"],
        inplace=True
    )

    # Save master dataset
    output_file = (
        OUTPUT_DIR / "nifty50_combined_2020_2025.csv"
    )

    combined.to_csv(output_file, index=False)

    print("\nDataset successfully created!")
    print("Total records:", len(combined))
    print("Unique stocks:", combined["symbol"].nunique())
    print("Date range:")
    print(combined["timestamp"].min())
    print(combined["timestamp"].max())
    print("Saved at:", output_file)

else:
    print("No stock data was loaded. Check the input folder.")
