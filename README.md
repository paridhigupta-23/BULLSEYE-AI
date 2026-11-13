# BULLSEYE AI — Invest Smarter. Understand Deeper.

A full-stack AI-powered algorithmic trading, quantitative research, and paper-trading platform built on real historical **NSE NIFTY 50** datasets (`2020-10-01` to `2025-09-30`).

> **Historical Data Disclaimer**: All market candles, indicators, ML signals, backtests, and practice order reference prices come exclusively from the historical NIFTY 50 dataset ending **2025-09-30**. They are never fabricated or misrepresented as live 2026 market quotes.

---

## Architecture & Directory Structure

- `server.ts` — Unified Express REST API + Vite SSR/static host on port `3000`
- `server/db.ts` & `server/initDb.ts` — Native Node `node:sqlite` (`data/bullseye.db`) schema initialization & demo user seeding
- `server/auth.ts` — Scrypt password hashing, Bearer token sessions, and Role-Based Access Control (`requireAuth`, `requireRole`)
- `server/dataLoader.ts` — CSV ingestion, validation, deduplication, and 9-stage pipeline metadata
- `server/quantMath.ts` & `server/mlStore.ts` — Chronological ML (Logistic Regression, Random Forest, Gradient Boosting), SHAP/perturbation explainability, GARCH(1,1), ATR risk sizing, and chronological backtesting
- `server/investorStore.ts` — SQLite-backed Investor Watchlist, Long-Term Portfolio, Orders, IPO/SME snapshot & translated NSE filings
- `server/brokerStore.ts` — Unified Broker-Client roster (`broker_clients`), client portfolio analytics, advisory requests (`client_requests`), AI-grounded Expert Advice (`expert_advice`), and two-way messaging (`broker_messages`)
- `server/translationService.ts` — SQLite-cached (`translation_cache`) Hindi (`hi`) & Telugu (`te`) translation service with Gemini batch translation and deterministic financial fallback
- `server/tradingStore.ts` — SQLite-backed Practice Trading simulator (`₹10,00,000` starting virtual wallet)
- `server/geminiService.ts` — Server-side `@google/genai` assistant endpoint (`/api/ai/chat`)
- `server/*.test.ts` — Pure logic unit tests, broker/translation unit suite, and full Express HTTP API & RBAC test suite
- `src/` — React 19 + TypeScript + Tailwind CSS v4 + TradingView Lightweight Charts v5 + Recharts frontend featuring a **7-page Broker Portal** (`Home`, `My Clients`, `Client Portfolios`, `Client Requests`, `Expert Advice`, `Messages`, `Profile`) and a **fully multilingual Investor Portal** (`en`, `hi`, `te`)
- `data/datasets/` & `data/scripts/` — Preserved NIFTY 50 raw & processed CSV datasets and Python scripts
- `docs/` — `ARCHITECTURE.md` and executed `API_TEST_REPORT.md`

---

## Separate Portal Logins & Demo Credentials

Each portal enforces its own dedicated login screen and backend role verification (`403 Forbidden` if a different role attempts cross-portal access):

| Portal | User ID | Email | Password | Role |
|---|---|---|---|---|
| **Investor Portal** | `INV-DEMO-01` | `investor@bullseye.ai` | `Investor@2026` | `Investor` |
| **Broker / Quant Portal** | `BRK-QUANT-01` | `quant@bullseye.ai` | `Quant@2026` | `Broker / Quant` |
| **Practice Trading Portal** | `PRC-TRADE-01` | `trader@bullseye.ai` | `Trade@2026` | `Practice Trader` |

New accounts can also be registered per portal directly from each portal's Sign-In page (`POST /api/auth/register`).

---

## Setup & Execution

### 1. Environment Variables
Copy `.env.example` to `.env` and optionally set `GEMINI_API_KEY` for the AI Assistant drawer:
```bash
cp .env.example .env
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Initialize SQLite Database
The server initializes `data/bullseye.db` automatically on boot, or you can initialize and inspect it explicitly:
```bash
npm run db:init
```

### 4. Run Development or Production Server
```bash
# Development (Express API + Vite middleware on port 3000)
npm run dev

# Production build & start
npm run build
npm start
```

### 5. Run Tests & Type Checks
```bash
# TypeScript type-check
npm run lint

# Run all unit tests + full HTTP API/RBAC integration suite (regenerates docs/API_TEST_REPORT.md)
npm test

# Run only the API integration suite
npm run test:api
```

---

## API Overview

| Method | Endpoint | Required Role | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | Dataset, SQLite database, and Gemini status |
| `GET` | `/api/stocks` | Public | Summary market snapshot across 50 NIFTY stocks |
| `POST` | `/api/auth/login` | Public | Authenticate User ID/email + password + `expectedRole` |
| `POST` | `/api/auth/register` | Public | Register a new portal user account |
| `POST` | `/api/auth/logout` | Any Authenticated | Revoke Bearer session token in SQLite |
| `GET` | `/api/auth/me` | Any Authenticated | Return authenticated user profile |
| `GET` | `/api/stocks/:symbol` | Authenticated (`Investor`, `Broker / Quant`, `Practice Trader`) | Historical OHLCV series, indicators, risk & GARCH |
| `GET` | `/api/stocks/:symbol/indicators` | `Investor`, `Broker / Quant` | Latest 13 computed technical indicators & rule biases |
| `GET` | `/api/ml/predict/:symbol` | `Investor`, `Broker / Quant` | Latest trained ML prediction & SHAP feature contributions |
| `GET` | `/api/quant/garch/:symbol` | `Investor`, `Broker / Quant` | GARCH(1,1) conditional volatility parameters & forecast |
| `POST` | `/api/quant/risk` | `Investor`, `Broker / Quant` | Dynamic ATR(14) stop-loss & position sizing calculator |
| `GET` / `PATCH` | `/api/user/preferences` | Any Authenticated | Read or persist `preferredLanguage` (`en`, `hi`, `te`) in SQLite |
| `GET` / `POST` / `DELETE` | `/api/investor/portfolio`, `/api/investor/watchlist`, `/api/investor/holdings`, `/api/investor/orders` | `Investor` ONLY | Persistent SQLite investor watchlist, holdings & orders ledger |
| `GET` | `/api/investor/ipo`, `/api/investor/news?lang=` | `Investor` ONLY | Honest offline SME/IPO snapshot & translated NSE PR121126 filings (`en`, `hi`, `te`) |
| `GET` / `POST` | `/api/investor/broker`, `/api/investor/broker/link`, `/api/investor/requests`, `/api/investor/advice`, `/api/investor/advice/:id/read`, `/api/investor/messages` | `Investor` ONLY | Linked advisor profile, client requests, translated Expert Advice & direct messaging |
| `GET` / `POST` / `PATCH` | `/api/broker/clients`, `/api/broker/portfolios`, `/api/broker/requests`, `/api/broker/advice/*`, `/api/broker/messages/*` | `Broker / Quant` ONLY | Client roster, aggregate/stock portfolios, advisory queue, AI-grounded Expert Advice & messaging |
| `GET` / `POST` | `/api/dataset/summary`, `/api/dataset/reload`, `/api/ml/train`, `/api/quant/backtest`, `/api/quant/monitoring` | `Broker / Quant` ONLY | 9-stage pipeline, chronological ML training, backtesting & SQLite run logs |
| `GET` | `/api/quant/final-performance` | `Broker / Quant` ONLY | Consolidated 5-category Final Performance report (Model, Trading, Tail Risk, Latency, Costs) |
| `GET` / `POST` | `/api/practice/portfolio`, `/api/practice/order`, `/api/practice/order/:id/cancel`, `/api/practice/reset` | `Practice Trader` ONLY | Virtual ₹10,00,000 paper trading engine |
| `POST` | `/api/ai/chat` | Public / Contextual | Server-side `@google/genai` multilingual assistant |

See `docs/API_TEST_REPORT.md` for full executed request/response test verification results.
