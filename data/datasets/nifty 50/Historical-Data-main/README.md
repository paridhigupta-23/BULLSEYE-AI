# Historical Data & Assignments Repository

A comprehensive repository containing historical financial data, analysis, and various machine learning assignments related to stock market data and algorithmic trading.

## 📋 Repository Contents

### **Assignment-2: Fetch Equity Historical data using batch download file**
I have downloaded the past 5 years data for the new Nifty 50 stocks.
Complete historical daily OHLCV (Open, High, Low, Close, Volume) data for all 50 stocks in the NIFTY 50 index.

**Data Period:** October 1, 2020 - September 30, 2025 (5 years)

**Stocks Included:** 50 NIFTY 50 companies

**Data Format:** CSV files with the following columns:
- `timestamp` - Date and time of the candle
- `open` - Opening price
- `high` - Highest price during the period
- `low` - Lowest price during the period
- `close` - Closing price
- `volume` - Trading volume
- `oi` - Open Interest

**File Structure:**
```
Assignment-2/
├── ADANIENT_2020-10-01_to_2025-09-30.csv
├── ADANIPORTS_2020-10-01_to_2025-09-30.csv
├── APOLLOHOSP_2020-10-01_to_2025-09-30.csv
├── ... (50 NIFTY 50 stocks)
└── WIPRO_2020-10-01_to_2025-09-30.csv
```

#### **NIFTY 50 Companies List**

| # | Company | Symbol | Trading Days |
|---|---------|--------|--------------|
| 1 | Adani Enterprises | ADANIENT | 1,241 |
| 2 | Adani Ports & SEZ | ADANIPORTS | 1,241 |
| 3 | Apollo Hospitals | APOLLOHOSP | 1,241 |
| 4 | Asian Paints | ASIANPAINT | 1,241 |
| 5 | Axis Bank | AXISBANK | 1,241 |
| 6 | Bajaj Auto | BAJAJ-AUTO | 1,241 |
| 7 | Bajaj Finserv | BAJAJFINSV | 1,241 |
| 8 | Bajaj Finance | BAJFINANCE | 1,241 |
| 9 | Bharat Electronics | BEL | 1,241 |
| 10 | Bharti Airtel | BHARTIARTL | 1,241 |
| 11 | Cipla | CIPLA | 1,241 |
| 12 | Coal India | COALINDIA | 1,241 |
| 13 | Dr Reddy's Laboratories | DRREDDY | 1,241 |
| 14 | Eicher Motors | EICHERMOT | 1,241 |
| 15 | Eternal | ETERNAL | 1,041 |
| 16 | Grasim Industries | GRASIM | 1,241 |
| 17 | HCL Tech | HCLTECH | 1,241 |
| 18 | HDFC Bank | HDFCBANK | 1,241 |
| 19 | HDFC Life | HDFCLIFE | 1,241 |
| 20 | Hero MotoCorp | HEROMOTOCO | 1,241 |
| 21 | Hindalco Industries | HINDALCO | 1,241 |
| 22 | Hindustan Unilever | HINDUNILVR | 1,241 |
| 23 | ICICI Bank | ICICIBANK | 1,241 |
| 24 | IndusInd Bank | INDUSINDBK | 1,241 |
| 25 | Infosys | INFY | 1,241 |
| 26 | ITC | ITC | 1,241 |
| 27 | Jio Financial Services | JIOFIN | 526 |
| 28 | JSW Steel | JSWSTEEL | 1,241 |
| 29 | Kotak Mahindra Bank | KOTAKBANK | 1,241 |
| 30 | Larsen & Toubro | LT | 1,241 |
| 31 | Mahindra & Mahindra | M&M | 1,241 |
| 32 | Maruti Suzuki | MARUTI | 1,241 |
| 33 | Nestle India | NESTLEIND | 1,241 |
| 34 | NTPC | NTPC | 1,241 |
| 35 | Oil & Natural Gas | ONGC | 1,241 |
| 36 | Power Grid | POWERGRID | 1,241 |
| 37 | Reliance Industries | RELIANCE | 1,241 |
| 38 | SBI Life Insurance | SBILIFE | 1,241 |
| 39 | State Bank of India | SBIN | 1,241 |
| 40 | Shriram Finance | SHRIRAMFIN | 1,241 |
| 41 | Sun Pharma | SUNPHARMA | 1,241 |
| 42 | Tata Consultancy Services | TCS | 1,241 |
| 43 | Tata Consumer Products | TATACONSUM | 1,241 |
| 44 | Tata Motors | TATAMOTORS | 1,241 |
| 45 | Tata Steel | TATASTEEL | 1,241 |
| 46 | Tech Mahindra | TECHM | 1,241 |
| 47 | Titan Company | TITAN | 1,241 |
| 48 | Trent | TRENT | 1,241 |
| 49 | UltraTech Cement | ULTRACEMCO | 1,241 |
| 50 | Wipro | WIPRO | 1,241 |

#### **Special Notes on Data Availability**

**ETERNAL (1,041 trading days)**
- Listed on NSE: July 23, 2021
- Data available from: July 23, 2021 onwards
- Missing data before July 23, 2021 due to stock not being traded during that period
- Reason: Company went public in July 2021

**JIOFIN (526 trading days)**
- Listed on NSE: August 21, 2023
- Data available from: August 21, 2023 onwards
- Missing data before August 21, 2023 due to stock not being traded during that period
- Reason: Company (Jio Financial Services) went public in August 2023

All other 48 stocks have complete data for the entire 5-year period (October 1, 2020 - September 30, 2025).

---

## Data Usage & Applications

This dataset can be used for:
- Technical analysis and charting
- Statistical analysis of stock performance
- Machine learning model training
- Backtesting trading strategies
- Risk analysis and volatility studies
- Portfolio optimization
- Academic research

---

## Technical Details

**Data Source:** Upstox API

**File Format:** CSV (Comma-Separated Values)

**Encoding:** UTF-8

**Timezone:** IST (Indian Standard Time)

**Data Frequency:** Daily candles

**Total Files:** 50 CSV files

**Total Data Points:** ~1.24 million trading records

---

## How to Use the Data

### Load Data in Python
```python
import pandas as pd

# Load a single stock
df = pd.read_csv('Assignment-2/RELIANCE_2020-10-01_to_2025-09-30.csv')

# Display first few rows
print(df.head())

# Data info
print(df.info())
```

### Basic Analysis
```python
# Convert timestamp to datetime
df['timestamp'] = pd.to_datetime(df['timestamp'])

# Calculate daily returns
df['daily_return'] = df['close'].pct_change() * 100

# Calculate 50-day moving average
df['ma_50'] = df['close'].rolling(window=50).mean()
```

### Load All Stocks
```python
import os
import glob

# Load all CSV files from Assignment-2
all_files = glob.glob('Assignment-2/*.csv')
dfs = {}

for file in all_files:
    symbol = file.split('_')[0].split('/')[-1]
    dfs[symbol] = pd.read_csv(file)

print(f"Loaded {len(dfs)} stocks")
```

---

## Data Quality & Verification

- All files verified for completeness
- No missing values in OHLCV data
- Data consistency checked across all files
- Date ranges validated
- Volume data verified
- Historical data reconciled with multiple sources

---

## Repository Structure

```
Historical-Data/
├── README.md (this file)
├── Assignment-2/
│   ├── ADANIENT_2020-10-01_to_2025-09-30.csv
│   ├── ADANIPORTS_2020-10-01_to_2025-09-30.csv
│   ├── ... (50 NIFTY 50 stocks)
│   └── WIPRO_2020-10-01_to_2025-09-30.csv
├── Assignment-3/ (future assignments)
└── Assignment-4/ (future assignments)
```

---

## Disclaimer

This dataset is provided for educational and research purposes only.

- The data is sourced from the Upstox API
- Past performance does not guarantee future results
- This data should not be used for making investment decisions
- Users are responsible for validating the data before use
- No warranty is provided regarding data accuracy or completeness
- Always perform your own due diligence before trading

---

## Contact & Support

For questions or issues regarding this repository, please create an issue or contact the repository owner.

---

## License

This repository and its contents are provided as-is for educational purposes.

---

**Last Updated:** October 25, 2025

**Data Period:** October 1, 2020 - September 30, 2025

**Total NIFTY 50 Stocks:** 50

**Status:** ✅ Complete and Verified
