import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { BacktestRunLog, ModelType, TrainingRunLog, UserRole } from './types.ts';

let dbInstance: DatabaseSync | null = null;
let currentDbPath: string | null = null;

export function getDbPath(): string {
  if (process.env.BULLSEYE_DB_PATH) {
    return path.resolve(process.cwd(), process.env.BULLSEYE_DB_PATH);
  }
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpDir = os.tmpdir();
    const tmpDbPath = path.join(tmpDir, 'bullseye.db');
    const localDbPath = path.resolve(process.cwd(), 'data', 'bullseye.db');
    if (fs.existsSync(localDbPath) && !fs.existsSync(tmpDbPath)) {
      try {
        fs.copyFileSync(localDbPath, tmpDbPath);
      } catch {
        // initializeSchema will initialize tables if copy fails
      }
    }
    return tmpDbPath;
  }
  return path.resolve(process.cwd(), 'data', 'bullseye.db');
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
      preferred_language TEXT NOT NULL DEFAULT 'en',
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

    CREATE TABLE IF NOT EXISTS investor_orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
      order_type TEXT NOT NULL CHECK (order_type IN ('MARKET', 'LIMIT')),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      price REAL NOT NULL CHECK (price > 0),
      total_value REAL NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('EXECUTED', 'PLANNED', 'CANCELLED')),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
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

    CREATE TABLE IF NOT EXISTS broker_clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      broker_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active',
      linked_at TEXT NOT NULL,
      UNIQUE (broker_id, client_id),
      FOREIGN KEY (broker_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS client_requests (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      broker_id TEXT NOT NULL,
      category TEXT NOT NULL,
      symbol TEXT,
      message TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Pending', 'Under Review', 'Responded', 'Closed')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (broker_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS request_responses (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      broker_id TEXT NOT NULL,
      response_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (request_id) REFERENCES client_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (broker_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expert_advice (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      broker_id TEXT NOT NULL,
      request_id TEXT,
      symbol TEXT,
      category TEXT NOT NULL,
      analysis TEXT NOT NULL,
      recommendation TEXT NOT NULL,
      supporting_metrics_json TEXT NOT NULL,
      risk_level TEXT NOT NULL CHECK (risk_level IN ('Low', 'Moderate', 'Elevated', 'High')),
      disclaimer TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Draft', 'Sent', 'Read')),
      generated_at TEXT NOT NULL,
      sent_at TEXT,
      read_at TEXT,
      FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (broker_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS broker_messages (
      id TEXT PRIMARY KEY,
      broker_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      sender_role TEXT NOT NULL,
      message_text TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (broker_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS translation_cache (
      cache_key TEXT PRIMARY KEY,
      target_lang TEXT NOT NULL,
      source_text TEXT NOT NULL,
      translated_text TEXT NOT NULL,
      provider TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_broker_clients_broker ON broker_clients(broker_id);
    CREATE INDEX IF NOT EXISTS idx_broker_clients_client ON broker_clients(client_id);
    CREATE INDEX IF NOT EXISTS idx_client_requests_broker ON client_requests(broker_id, status);
    CREATE INDEX IF NOT EXISTS idx_client_requests_client ON client_requests(client_id);
    CREATE INDEX IF NOT EXISTS idx_expert_advice_client ON expert_advice(client_id, status);
    CREATE INDEX IF NOT EXISTS idx_broker_messages_pair ON broker_messages(broker_id, client_id, created_at);
  `);

  // Safe migration for pre-existing users table without preferred_language column
  const cols = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === 'preferred_language')) {
    db.exec(`ALTER TABLE users ADD COLUMN preferred_language TEXT NOT NULL DEFAULT 'en';`);
  }

  // Safe migrations for existing ml_training_runs table (Model Registry & Experiment History)
  const mlCols = new Set(
    (db.prepare('PRAGMA table_info(ml_training_runs)').all() as Array<{ name: string }>).map(
      (c) => c.name,
    ),
  );
  if (!mlCols.has('experiment_id')) db.exec(`ALTER TABLE ml_training_runs ADD COLUMN experiment_id TEXT;`);
  if (!mlCols.has('train_date_range')) db.exec(`ALTER TABLE ml_training_runs ADD COLUMN train_date_range TEXT DEFAULT '';`);
  if (!mlCols.has('test_date_range')) db.exec(`ALTER TABLE ml_training_runs ADD COLUMN test_date_range TEXT DEFAULT '';`);
  if (!mlCols.has('params_json')) db.exec(`ALTER TABLE ml_training_runs ADD COLUMN params_json TEXT DEFAULT '{}';`);
  if (!mlCols.has('confusion_matrix_json')) db.exec(`ALTER TABLE ml_training_runs ADD COLUMN confusion_matrix_json TEXT DEFAULT '{}';`);
  if (!mlCols.has('status')) db.exec(`ALTER TABLE ml_training_runs ADD COLUMN status TEXT DEFAULT 'COMPLETED';`);
  if (!mlCols.has('backtest_run_id')) db.exec(`ALTER TABLE ml_training_runs ADD COLUMN backtest_run_id INTEGER;`);

  // Safe migrations for existing backtest_runs table
  const btCols = new Set(
    (db.prepare('PRAGMA table_info(backtest_runs)').all() as Array<{ name: string }>).map(
      (c) => c.name,
    ),
  );
  if (!btCols.has('run_code')) db.exec(`ALTER TABLE backtest_runs ADD COLUMN run_code TEXT;`);
  if (!btCols.has('experiment_id')) db.exec(`ALTER TABLE backtest_runs ADD COLUMN experiment_id TEXT;`);
  if (!btCols.has('params_json')) db.exec(`ALTER TABLE backtest_runs ADD COLUMN params_json TEXT DEFAULT '{}';`);
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

  const invOrderCount = db
    .prepare('SELECT COUNT(*) as cnt FROM investor_orders WHERE user_id = ?')
    .get('usr-investor-01') as { cnt: number };

  if (invOrderCount.cnt === 0) {
    const insertInvOrder = db.prepare(`
      INSERT OR IGNORE INTO investor_orders
        (id, user_id, symbol, side, order_type, quantity, price, total_value, status, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertInvOrder.run(
      'INV-ORD-1001',
      'usr-investor-01',
      'RELIANCE',
      'BUY',
      'MARKET',
      25,
      1340.0,
      33500.0,
      'EXECUTED',
      'Initial NIFTY 50 core allocation lot',
      now,
    );
    insertInvOrder.run(
      'INV-ORD-1002',
      'usr-investor-01',
      'TCS',
      'BUY',
      'LIMIT',
      10,
      2888.4,
      28884.0,
      'PLANNED',
      'IT sector accumulation limit reference',
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

  // Link seeded demo Investor (usr-investor-01) with seeded demo Broker (usr-broker-01)
  db.prepare(`
    INSERT OR IGNORE INTO broker_clients (broker_id, client_id, status, linked_at)
    VALUES ('usr-broker-01', 'usr-investor-01', 'Active', ?)
  `).run(now);
}

export function recordTrainingRun(entry: {
  experimentId?: string;
  symbol: string;
  modelType: ModelType;
  accuracy: number;
  precisionScore: number;
  recallScore: number;
  f1Score: number;
  trainSize: number;
  testSize: number;
  trainDateRange?: string;
  testDateRange?: string;
  paramsJson?: string;
  confusionMatrixJson?: string;
  status?: string;
  backtestRunId?: number | null;
  durationMs: number;
  triggeredBy: string;
}): { id: number; experimentId: string } {
  const db = getDb();
  const expId =
    entry.experimentId ||
    `EXP-${entry.symbol.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  const info = db
    .prepare(
      `
    INSERT INTO ml_training_runs
      (experiment_id, symbol, model_type, accuracy, precision_score, recall_score, f1_score,
       train_size, test_size, train_date_range, test_date_range, params_json, confusion_matrix_json,
       status, backtest_run_id, duration_ms, triggered_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      expId,
      entry.symbol,
      entry.modelType,
      entry.accuracy,
      entry.precisionScore,
      entry.recallScore,
      entry.f1Score,
      entry.trainSize,
      entry.testSize,
      entry.trainDateRange ?? '',
      entry.testDateRange ?? '',
      entry.paramsJson ?? '{}',
      entry.confusionMatrixJson ?? '{}',
      entry.status ?? 'COMPLETED',
      entry.backtestRunId ?? null,
      entry.durationMs,
      entry.triggeredBy,
      new Date().toISOString(),
    );
  return { id: Number(info.lastInsertRowid), experimentId: expId };
}

export function listTrainingRuns(limit = 30): TrainingRunLog[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, experiment_id, symbol, model_type, accuracy, precision_score, recall_score, f1_score,
              train_size, test_size, train_date_range, test_date_range, params_json,
              confusion_matrix_json, status, backtest_run_id, duration_ms, triggered_by, created_at
       FROM ml_training_runs
       ORDER BY id DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{
    id: number;
    experiment_id: string | null;
    symbol: string;
    model_type: ModelType;
    accuracy: number;
    precision_score: number;
    recall_score: number;
    f1_score: number;
    train_size: number;
    test_size: number;
    train_date_range: string | null;
    test_date_range: string | null;
    params_json: string | null;
    confusion_matrix_json: string | null;
    status: string | null;
    backtest_run_id: number | null;
    duration_ms: number;
    triggered_by: string;
    created_at: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    experimentId: r.experiment_id || `EXP-LEGACY-${r.id}`,
    symbol: r.symbol,
    modelType: r.model_type,
    accuracy: r.accuracy,
    precisionScore: r.precision_score,
    recallScore: r.recall_score,
    f1Score: r.f1_score,
    trainSize: r.train_size,
    testSize: r.test_size,
    trainDateRange: r.train_date_range || '',
    testDateRange: r.test_date_range || '',
    paramsJson: r.params_json || '{}',
    confusionMatrixJson: r.confusion_matrix_json || '{}',
    status: r.status || 'COMPLETED',
    backtestRunId: r.backtest_run_id ?? null,
    durationMs: r.duration_ms,
    triggeredBy: r.triggered_by,
    createdAt: r.created_at,
  }));
}

export function recordBacktestRun(entry: {
  runCode?: string;
  experimentId?: string | null;
  symbol: string;
  strategy: string;
  totalReturnPct: number;
  benchmarkReturnPct: number;
  sharpeRatio: number;
  maxDrawdownPct: number;
  numberOfTrades: number;
  paramsJson?: string;
  triggeredBy: string;
}): { id: number; runCode: string } {
  const db = getDb();
  const code =
    entry.runCode || `BT-${entry.symbol.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  const info = db
    .prepare(
      `
    INSERT INTO backtest_runs
      (run_code, experiment_id, symbol, strategy, total_return_pct, benchmark_return_pct,
       sharpe_ratio, max_drawdown_pct, number_of_trades, params_json, triggered_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      code,
      entry.experimentId ?? null,
      entry.symbol,
      entry.strategy,
      entry.totalReturnPct,
      entry.benchmarkReturnPct,
      entry.sharpeRatio,
      entry.maxDrawdownPct,
      entry.numberOfTrades,
      entry.paramsJson ?? '{}',
      entry.triggeredBy,
      new Date().toISOString(),
    );

  const btId = Number(info.lastInsertRowid);
  if (entry.experimentId) {
    db.prepare(`UPDATE ml_training_runs SET backtest_run_id = ? WHERE experiment_id = ?`).run(
      btId,
      entry.experimentId,
    );
  } else {
    // Link latest matching symbol training run if none linked yet
    const latestRun = db
      .prepare(
        `SELECT id FROM ml_training_runs WHERE symbol = ? AND backtest_run_id IS NULL ORDER BY id DESC LIMIT 1`,
      )
      .get(entry.symbol) as { id: number } | undefined;
    if (latestRun) {
      db.prepare(`UPDATE ml_training_runs SET backtest_run_id = ? WHERE id = ?`).run(
        btId,
        latestRun.id,
      );
    }
  }

  return { id: btId, runCode: code };
}

export function listBacktestRuns(limit = 25): BacktestRunLog[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, run_code, experiment_id, symbol, strategy, total_return_pct, benchmark_return_pct,
              sharpe_ratio, max_drawdown_pct, number_of_trades, params_json, triggered_by, created_at
       FROM backtest_runs
       ORDER BY id DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{
    id: number;
    run_code: string | null;
    experiment_id: string | null;
    symbol: string;
    strategy: string;
    total_return_pct: number;
    benchmark_return_pct: number;
    sharpe_ratio: number;
    max_drawdown_pct: number;
    number_of_trades: number;
    params_json: string | null;
    triggered_by: string;
    created_at: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    runCode: r.run_code || `BT-LEGACY-${r.id}`,
    experimentId: r.experiment_id ?? null,
    symbol: r.symbol,
    strategy: r.strategy,
    totalReturnPct: r.total_return_pct,
    benchmarkReturnPct: r.benchmark_return_pct,
    sharpeRatio: r.sharpe_ratio,
    maxDrawdownPct: r.max_drawdown_pct,
    numberOfTrades: r.number_of_trades,
    paramsJson: r.params_json || '{}',
    triggeredBy: r.triggered_by,
    createdAt: r.created_at,
  }));
}

export function listRealInvestorAggregateHoldings(): Array<{
  symbol: string;
  totalQuantity: number;
  avgCostBasis: number;
}> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT symbol, SUM(quantity) as total_qty,
              SUM(quantity * avg_buy_price) / NULLIF(SUM(quantity), 0) as weighted_avg
       FROM investor_holdings
       GROUP BY symbol
       HAVING total_qty > 0`,
    )
    .all() as Array<{ symbol: string; total_qty: number; weighted_avg: number }>;
  return rows.map((r) => ({
    symbol: r.symbol,
    totalQuantity: Number(r.total_qty),
    avgCostBasis: Number(r.weighted_avg),
  }));
}

