import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { BacktestRunLog, ModelType, TrainingRunLog, UserRole } from './types.ts';

let dbInstance: DatabaseSync | null = null;
let currentDbPath: string | null = null;

export function getDbPath(): string {
  return process.env.BULLSEYE_DB_PATH
    ? path.resolve(process.cwd(), process.env.BULLSEYE_DB_PATH)
    : path.resolve(process.cwd(), 'data', 'bullseye.db');
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  try {
    const keyBuf = Buffer.from(keyHex, 'hex');
    const derived = crypto.scryptSync(password, salt, 64);
    if (keyBuf.length !== derived.length) return false;
    return crypto.timingSafeEqual(keyBuf, derived);
  } catch {
    return false;
  }
}

export function getDb(customPath?: string): DatabaseSync {
  const targetPath = customPath ? path.resolve(process.cwd(), customPath) : getDbPath();
  if (dbInstance && currentDbPath === targetPath) {
    return dbInstance;
  }
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore close errors during test re-targeting
    }
    dbInstance = null;
  }

  const dir = path.dirname(targetPath);
  if (targetPath !== ':memory:' && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new DatabaseSync(targetPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  initializeSchema(db);
  seedDemoAccounts(db);

  dbInstance = db;
  currentDbPath = targetPath;
  return db;
}

export function closeDb(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore
    }
    dbInstance = null;
    currentDbPath = null;
  }
}

function initializeSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      user_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('Investor', 'Broker / Quant', 'Practice Trader')),
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS investor_watchlist (
      user_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      added_at TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (user_id, symbol),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS investor_holdings (
      user_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      avg_buy_price REAL NOT NULL CHECK (avg_buy_price > 0),
      target_price REAL,
      stop_loss REAL,
      notes TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, symbol),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS practice_accounts (
      user_id TEXT PRIMARY KEY,
      starting_capital REAL NOT NULL,
      cash_balance REAL NOT NULL,
      realized_pnl REAL NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS practice_holdings (
      user_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      avg_buy_price REAL NOT NULL CHECK (avg_buy_price > 0),
      PRIMARY KEY (user_id, symbol),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS practice_orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      dataset_price_date TEXT NOT NULL,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL,
      order_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      requested_price REAL NOT NULL,
      executed_price REAL NOT NULL,
      total_value REAL NOT NULL,
      status TEXT NOT NULL,
      note TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS practice_trades (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      dataset_price_date TEXT NOT NULL,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      total_value REAL NOT NULL,
      realized_pnl REAL NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS practice_equity_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      portfolio_value REAL NOT NULL,
      cash_balance REAL NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ml_training_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      model_type TEXT NOT NULL,
      accuracy REAL NOT NULL,
      precision_score REAL NOT NULL,
      recall_score REAL NOT NULL,
      f1_score REAL NOT NULL,
      train_size INTEGER NOT NULL,
      test_size INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      triggered_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS backtest_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      strategy TEXT NOT NULL,
      total_return_pct REAL NOT NULL,
      benchmark_return_pct REAL NOT NULL,
      sharpe_ratio REAL NOT NULL,
      max_drawdown_pct REAL NOT NULL,
      number_of_trades INTEGER NOT NULL,
      triggered_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

export interface DemoAccountSeed {
  id: string;
  userCode: string;
  name: string;
  email: string;
  role: UserRole;
  password: string;
}

export const DEMO_ACCOUNTS: DemoAccountSeed[] = [
  {
    id: 'usr-investor-01',
    userCode: 'INV-DEMO-01',
    name: 'Aarav Mehta (Investor)',
    email: 'investor@bullseye.ai',
    role: 'Investor',
    password: process.env.DEMO_INVESTOR_PASSWORD || 'Investor@2026',
  },
  {
    id: 'usr-broker-01',
    userCode: 'BRK-QUANT-01',
    name: 'Priya Sharma (Quant Desk)',
    email: 'quant@bullseye.ai',
    role: 'Broker / Quant',
    password: process.env.DEMO_BROKER_PASSWORD || 'Quant@2026',
  },
  {
    id: 'usr-practice-01',
    userCode: 'PRC-TRADE-01',
    name: 'Rohan Nair (Practice Trader)',
    email: 'trader@bullseye.ai',
    role: 'Practice Trader',
    password: process.env.DEMO_PRACTICE_PASSWORD || 'Trade@2026',
  },
];

function seedDemoAccounts(db: DatabaseSync): void {
  const now = new Date().toISOString();
  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (id, user_code, name, email, role, password_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const acc of DEMO_ACCOUNTS) {
    insertUser.run(
      acc.id,
      acc.userCode,
      acc.name,
      acc.email.toLowerCase(),
      acc.role,
      hashPassword(acc.password),
      now,
    );
  }

  // Seed default investor watchlist & starter tracked holding if investor has none yet
  const watchCount = db
    .prepare('SELECT COUNT(*) as cnt FROM investor_watchlist WHERE user_id = ?')
    .get('usr-investor-01') as { cnt: number };

  if (watchCount.cnt === 0) {
    const insertWatch = db.prepare(`
      INSERT OR IGNORE INTO investor_watchlist (user_id, symbol, added_at, note)
      VALUES (?, ?, ?, ?)
    `);
    insertWatch.run('usr-investor-01', 'RELIANCE', now, 'Core Energy & Telecom benchmark');
    insertWatch.run('usr-investor-01', 'TCS', now, 'IT services momentum monitor');
    insertWatch.run('usr-investor-01', 'TATASTEEL', now, 'Cyclical metals ATR tracking');
  }

  const holdingCount = db
    .prepare('SELECT COUNT(*) as cnt FROM investor_holdings WHERE user_id = ?')
    .get('usr-investor-01') as { cnt: number };

  if (holdingCount.cnt === 0) {
    db.prepare(`
      INSERT OR IGNORE INTO investor_holdings
        (user_id, symbol, quantity, avg_buy_price, target_price, stop_loss, notes, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'usr-investor-01',
      'RELIANCE',
      25,
      1340.0,
      1480.0,
      1290.0,
      'Starter NIFTY 50 showcase tracking lot',
      now,
    );
  }

  // Ensure seeded practice trader has initial ₹10,00,000 wallet
  const acct = db
    .prepare('SELECT user_id FROM practice_accounts WHERE user_id = ?')
    .get('usr-practice-01') as { user_id: string } | undefined;

  if (!acct) {
    db.prepare(`
      INSERT INTO practice_accounts (user_id, starting_capital, cash_balance, realized_pnl, updated_at)
      VALUES (?, 1000000, 1000000, 0, ?)
    `).run('usr-practice-01', now);
    db.prepare(`
      INSERT INTO practice_equity_history (user_id, timestamp, portfolio_value, cash_balance)
      VALUES (?, ?, 1000000, 1000000)
    `).run('usr-practice-01', now);
  }
}

export function recordTrainingRun(entry: {
  symbol: string;
  modelType: ModelType;
  accuracy: number;
  precisionScore: number;
  recallScore: number;
  f1Score: number;
  trainSize: number;
  testSize: number;
  durationMs: number;
  triggeredBy: string;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO ml_training_runs
      (symbol, model_type, accuracy, precision_score, recall_score, f1_score, train_size, test_size, duration_ms, triggered_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.symbol,
    entry.modelType,
    entry.accuracy,
    entry.precisionScore,
    entry.recallScore,
    entry.f1Score,
    entry.trainSize,
    entry.testSize,
    entry.durationMs,
    entry.triggeredBy,
    new Date().toISOString(),
  );
}

export function listTrainingRuns(limit = 20): TrainingRunLog[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, symbol, model_type, accuracy, precision_score, recall_score, f1_score,
              train_size, test_size, duration_ms, triggered_by, created_at
       FROM ml_training_runs
       ORDER BY id DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{
    id: number;
    symbol: string;
    model_type: ModelType;
    accuracy: number;
    precision_score: number;
    recall_score: number;
    f1_score: number;
    train_size: number;
    test_size: number;
    duration_ms: number;
    triggered_by: string;
    created_at: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    modelType: r.model_type,
    accuracy: r.accuracy,
    precisionScore: r.precision_score,
    recallScore: r.recall_score,
    f1Score: r.f1_score,
    trainSize: r.train_size,
    testSize: r.test_size,
    durationMs: r.duration_ms,
    triggeredBy: r.triggered_by,
    createdAt: r.created_at,
  }));
}

export function recordBacktestRun(entry: {
  symbol: string;
  strategy: string;
  totalReturnPct: number;
  benchmarkReturnPct: number;
  sharpeRatio: number;
  maxDrawdownPct: number;
  numberOfTrades: number;
  triggeredBy: string;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO backtest_runs
      (symbol, strategy, total_return_pct, benchmark_return_pct, sharpe_ratio, max_drawdown_pct, number_of_trades, triggered_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.symbol,
    entry.strategy,
    entry.totalReturnPct,
    entry.benchmarkReturnPct,
    entry.sharpeRatio,
    entry.maxDrawdownPct,
    entry.numberOfTrades,
    entry.triggeredBy,
    new Date().toISOString(),
  );
}

export function listBacktestRuns(limit = 15): BacktestRunLog[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, symbol, strategy, total_return_pct, benchmark_return_pct, sharpe_ratio,
              max_drawdown_pct, number_of_trades, triggered_by, created_at
       FROM backtest_runs
       ORDER BY id DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{
    id: number;
    symbol: string;
    strategy: string;
    total_return_pct: number;
    benchmark_return_pct: number;
    sharpe_ratio: number;
    max_drawdown_pct: number;
    number_of_trades: number;
    triggered_by: string;
    created_at: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    strategy: r.strategy,
    totalReturnPct: r.total_return_pct,
    benchmarkReturnPct: r.benchmark_return_pct,
    sharpeRatio: r.sharpe_ratio,
    maxDrawdownPct: r.max_drawdown_pct,
    numberOfTrades: r.number_of_trades,
    triggeredBy: r.triggered_by,
    createdAt: r.created_at,
  }));
}
