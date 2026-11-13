# BULLSEYE AI — Architecture & Design

## 1. System Overview
BULLSEYE AI is a unified full-stack TypeScript web application powered by a Node.js + Express backend (`server.ts`), native SQLite persistence (`node:sqlite` in `server/db.ts`), chronological machine learning & quantitative analytics (`server/quantMath.ts`, `server/mlStore.ts`), and a React + Tailwind + TradingView Lightweight Charts frontend (`src/`).

```text
React Frontend (src/)
  ├── LandingPage (Public NIFTY 50 Showcase)
  ├── Investor Portal -> PortalLoginView (Investor) -> InvestorPortal (Charts, Indicators, ML, Risk, Watchlist, Portfolio)
  ├── Broker / Quant Portal -> PortalLoginView (Broker / Quant) -> BrokerPortal (9-Stage Pipeline, ML Train/Eval, GARCH, Backtest, SQLite Audit Monitor)
  ├── Practice Trading Portal -> PortalLoginView (Practice Trader) -> PracticePortal (₹10,00,000 Paper Trading Simulator)
  └── Global AiAssistant Drawer -> /api/ai/chat (@google/genai)
          │
          ▼  Bearer Token Auth & Role-Based Middleware (server/auth.ts)
Express REST API (server.ts)
  ├── /api/auth/*            (Scrypt-hashed passwords + SQLite session tokens)
  ├── /api/investor/*        (Role: Investor ONLY)
  ├── /api/dataset/* & /api/ml/train & /api/quant/backtest & /api/quant/monitoring (Role: Broker / Quant ONLY)
  ├── /api/practice/*        (Role: Practice Trader ONLY)
  └── /api/stocks/:symbol*   (Authenticated role access)
          │
          ├──► SQLite Database (data/bullseye.db via server/db.ts)
          │      users, sessions, investor_watchlist, investor_holdings,
          │      practice_accounts, practice_holdings, practice_orders, practice_trades,
          │      practice_equity_history, ml_training_runs, backtest_runs
          │
          └──► Verified Historical Datasets (data/datasets/processed/)
                 nifty50_combined_2020_2025.csv (61,135 rows)
                 nifty50_features_2020_2025.csv (58,635 rows)
```

## 2. Authentication & Role-Based Access Control (RBAC)
- Passwords are hashed using `crypto.scryptSync` with a random 16-byte salt per user and verified via `crypto.timingSafeEqual`.
- Login verifies credentials and enforces `expectedRole` so each portal's login screen only grants access to accounts belonging to that portal role (`Investor`, `Broker / Quant`, or `Practice Trader`).
- Every protected route uses `requireRole([...])` middleware reading the `Authorization: Bearer <token>` header (or `bullseye_token` HttpOnly cookie) and validating non-expired rows in SQLite `sessions`.

## 3. Leakage-Free Machine Learning & Quantitative Engine
- **Inputs (13 features)**: `daily_return`, `sma_20`, `sma_50`, `ema_12`, `ema_26`, `rsi_14`, `macd`, `macd_signal`, `bb_upper`, `bb_lower`, `atr_14`, `volume_sma_20`, `volume_ratio`.
- **Target & Leakage Prevention**: `target_direction` (`1` when `next_day_return > 0`, else `0`) is strictly separated from input features; `next_day_return` and `target_direction` are explicitly excluded from `ML_FEATURE_COLUMNS`.
- **Chronological Split**: Training/test splits preserve strict date ascending order (`0` lookahead), with feature standardization (`mean`, `std`) computed solely on the training slice.
- **Models**: Logistic Regression (L2-regularized gradient descent), Random Forest (bagged Gini decision trees), and Gradient Boosted Trees.
- **Volatility & Risk**: Stationary GARCH(1,1) MLE with variance targeting (`α + β < 1`) and dynamic ATR(14) stop-loss/position-sizing calculation.
