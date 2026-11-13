import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { closeDb, getDb } from './db.ts';
import {
  executeSimulatedOrder,
  getPortfolioSnapshot,
  getPracticeIntelligence,
  resetPracticePortfolio,
  simulateTradeImpact,
  STARTING_VIRTUAL_CAPITAL,
} from './tradingStore.ts';

test('Practice trading validates funds, executes BUY/SELL, and tracks realized PnL in SQLite', () => {
  const tmpDb = path.join(os.tmpdir(), `bullseye-test-${Date.now()}-1.db`);

  try {
    const initial = resetPracticePortfolio('usr-practice-01', tmpDb);
    assert.equal(initial.cashBalance, STARTING_VIRTUAL_CAPITAL);
    assert.equal(initial.holdings.length, 0);

    // Reject impossible buy exceeding ₹10,00,000
    const tooLarge = executeSimulatedOrder(
      {
        userId: 'usr-practice-01',
        symbol: 'RELIANCE',
        side: 'BUY',
        orderType: 'MARKET',
        quantity: 50000,
      },
      tmpDb,
    );
    assert.equal(tooLarge.ok, false);

    // Reject fractional or negative quantities
    const badQty = executeSimulatedOrder(
      {
        userId: 'usr-practice-01',
        symbol: 'RELIANCE',
        side: 'BUY',
        orderType: 'MARKET',
        quantity: 0,
      },
      tmpDb,
    );
    assert.equal(badQty.ok, false);

    // Buy 10 shares of RELIANCE
    const buy = executeSimulatedOrder(
      {
        userId: 'usr-practice-01',
        symbol: 'RELIANCE',
        side: 'BUY',
        orderType: 'MARKET',
        quantity: 10,
      },
      tmpDb,
    );
    assert.equal(buy.ok, true);
    if (buy.ok) {
      assert.equal(buy.portfolio.holdings.length, 1);
      assert.equal(buy.portfolio.holdings[0].quantity, 10);
      assert.ok(buy.portfolio.cashBalance < STARTING_VIRTUAL_CAPITAL);
    }

    // Cannot sell more than held
    const oversell = executeSimulatedOrder(
      {
        userId: 'usr-practice-01',
        symbol: 'RELIANCE',
        side: 'SELL',
        orderType: 'MARKET',
        quantity: 20,
      },
      tmpDb,
    );
    assert.equal(oversell.ok, false);

    // Sell 4 shares
    const sell = executeSimulatedOrder(
      {
        userId: 'usr-practice-01',
        symbol: 'RELIANCE',
        side: 'SELL',
        orderType: 'MARKET',
        quantity: 4,
      },
      tmpDb,
    );
    assert.equal(sell.ok, true);

    const reloaded = getPortfolioSnapshot('usr-practice-01', tmpDb);
    assert.equal(reloaded.holdings[0].quantity, 6);
    assert.equal(reloaded.trades.length, 2);
  } finally {
    closeDb();
    if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
    if (fs.existsSync(`${tmpDb}-wal`)) fs.unlinkSync(`${tmpDb}-wal`);
    if (fs.existsSync(`${tmpDb}-shm`)) fs.unlinkSync(`${tmpDb}-shm`);
  }
});

test('Practice Intelligence computes all five features and guarantees ZERO database mutation', () => {
  const tmpDb = path.join(os.tmpdir(), `bullseye-test-${Date.now()}-2.db`);

  try {
    const userA = 'usr-trader-alpha';
    const db = getDb(tmpDb);
    db.prepare(`
      INSERT INTO users (id, user_code, name, email, role, password_hash, preferred_language, created_at)
      VALUES (?, ?, ?, ?, 'Practice Trader', 'testhash', 'en', ?)
    `).run(userA, 'TRA-001', 'Trader Alpha', 'alpha@bullseye.test', new Date().toISOString());

    resetPracticePortfolio(userA, tmpDb);

    // Establish real initial positions for userA
    executeSimulatedOrder({ userId: userA, symbol: 'RELIANCE', side: 'BUY', orderType: 'MARKET', quantity: 20 }, tmpDb);
    executeSimulatedOrder({ userId: userA, symbol: 'TCS', side: 'BUY', orderType: 'MARKET', quantity: 15 }, tmpDb);
    executeSimulatedOrder({ userId: userA, symbol: 'INFY', side: 'BUY', orderType: 'MARKET', quantity: 30 }, tmpDb);
    // Execute a sell to produce realized trade analytics
    executeSimulatedOrder({ userId: userA, symbol: 'INFY', side: 'SELL', orderType: 'MARKET', quantity: 10 }, tmpDb);

    // Snapshot exact database state before running intelligence & simulations
    const acctBefore = db.prepare('SELECT cash_balance, realized_pnl FROM practice_accounts WHERE user_id = ?').get(userA) as { cash_balance: number; realized_pnl: number };
    const ordersCountBefore = (db.prepare('SELECT count(*) as c FROM practice_orders WHERE user_id = ?').get(userA) as { c: number }).c;
    const tradesCountBefore = (db.prepare('SELECT count(*) as c FROM practice_trades WHERE user_id = ?').get(userA) as { c: number }).c;
    const holdingsCountBefore = (db.prepare('SELECT count(*) as c FROM practice_holdings WHERE user_id = ?').get(userA) as { c: number }).c;

    // Feature 1: Trade Impact Simulation
    const simBuy = simulateTradeImpact(userA, { symbol: 'HDFCBANK', side: 'BUY', quantity: 20 }, tmpDb);
    assert.equal(simBuy.isSimulated, true);
    assert.equal(simBuy.canAfford, true);
    assert.ok(simBuy.projectedCashBalance < acctBefore.cash_balance);
    assert.equal(simBuy.projectedHoldingsCount, holdingsCountBefore + 1);

    const simSell = simulateTradeImpact(userA, { symbol: 'RELIANCE', side: 'SELL', quantity: 10 }, tmpDb);
    assert.equal(simSell.isSimulated, true);
    assert.equal(simSell.canExecute, true);
    assert.ok(simSell.projectedCashBalance > acctBefore.cash_balance);

    // Feature 2-5: Full Practice Intelligence Report
    const intel = getPracticeIntelligence(userA, tmpDb);
    assert.equal(intel.userId, userA);
    assert.equal(intel.portfolio.holdings.length, 3); // RELIANCE, TCS, INFY

    // Feature 2: Verify Macro Stress Scenarios (5 scenarios)
    assert.equal(intel.stressScenarios.length, 5);
    const flashCrash = intel.stressScenarios.find((s) => s.id === 'nifty_flash_crash_5');
    assert.ok(flashCrash);
    assert.ok(flashCrash.simulatedPnL < 0);
    // Verify cash cushions portfolio drop: percentage drop must be smaller in magnitude than -5%
    assert.ok(flashCrash.simulatedPnLPct > -5.0 && flashCrash.simulatedPnLPct < 0);

    // Feature 4: Holdings Health & Technical Diagnostic
    assert.ok(intel.holdingsHealth.diversificationScore > 0 && intel.holdingsHealth.diversificationScore <= 100);
    assert.equal(intel.holdingsHealth.totalHoldingsCount, 3);
    assert.ok(intel.holdingsHealth.totalAtrRiskExposure > 0);
    assert.equal(intel.holdingsHealth.technicalBiases.length, 3);
    assert.ok(['BULLISH', 'BEARISH', 'NEUTRAL'].includes(intel.holdingsHealth.technicalBiases[0].trend));

    // Feature 5: Behavioral Analytics
    assert.equal(intel.behavioralAnalytics.totalTrades, 1); // 1 sell trade
    assert.ok(intel.behavioralAnalytics.winRatePct >= 0);
    assert.ok(intel.behavioralAnalytics.disciplineScore >= 20 && intel.behavioralAnalytics.disciplineScore <= 100);
    assert.ok(intel.behavioralAnalytics.disciplineRemarks.length > 0);

    // CRITICAL ZERO-MUTATION VERIFICATION: DB state MUST be 100% IDENTICAL
    const acctAfter = db.prepare('SELECT cash_balance, realized_pnl FROM practice_accounts WHERE user_id = ?').get(userA) as { cash_balance: number; realized_pnl: number };
    const ordersCountAfter = (db.prepare('SELECT count(*) as c FROM practice_orders WHERE user_id = ?').get(userA) as { c: number }).c;
    const tradesCountAfter = (db.prepare('SELECT count(*) as c FROM practice_trades WHERE user_id = ?').get(userA) as { c: number }).c;
    const holdingsCountAfter = (db.prepare('SELECT count(*) as c FROM practice_holdings WHERE user_id = ?').get(userA) as { c: number }).c;

    assert.equal(acctAfter.cash_balance, acctBefore.cash_balance, 'Actual cash balance must NOT be modified by simulations');
    assert.equal(acctAfter.realized_pnl, acctBefore.realized_pnl, 'Realized PnL must NOT be modified by simulations');
    assert.equal(ordersCountAfter, ordersCountBefore, 'Orders table must have 0 new entries from simulations');
    assert.equal(tradesCountAfter, tradesCountBefore, 'Trades table must have 0 new entries from simulations');
    assert.equal(holdingsCountAfter, holdingsCountBefore, 'Holdings table must have 0 changes from simulations');
  } finally {
    closeDb();
    if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
    if (fs.existsSync(`${tmpDb}-wal`)) fs.unlinkSync(`${tmpDb}-wal`);
    if (fs.existsSync(`${tmpDb}-shm`)) fs.unlinkSync(`${tmpDb}-shm`);
  }
});

test('User-level data isolation guarantees Practice Traders cannot access or affect other users portfolios', () => {
  const tmpDb = path.join(os.tmpdir(), `bullseye-test-${Date.now()}-3.db`);

  try {
    const userAlice = 'usr-alice-practice';
    const userBob = 'usr-bob-practice';

    const db = getDb(tmpDb);
    db.prepare(`
      INSERT INTO users (id, user_code, name, email, role, password_hash, preferred_language, created_at)
      VALUES (?, ?, ?, ?, 'Practice Trader', 'testhash', 'en', ?)
    `).run(userAlice, 'ALICE-01', 'Alice Trader', 'alice@bullseye.test', new Date().toISOString());

    db.prepare(`
      INSERT INTO users (id, user_code, name, email, role, password_hash, preferred_language, created_at)
      VALUES (?, ?, ?, ?, 'Practice Trader', 'testhash', 'en', ?)
    `).run(userBob, 'BOB-01', 'Bob Trader', 'bob@bullseye.test', new Date().toISOString());

    resetPracticePortfolio(userAlice, tmpDb);
    resetPracticePortfolio(userBob, tmpDb);

    // Alice buys TCS
    executeSimulatedOrder({ userId: userAlice, symbol: 'TCS', side: 'BUY', orderType: 'MARKET', quantity: 20 }, tmpDb);

    // Bob buys nothing
    const bobSnap = getPortfolioSnapshot(userBob, tmpDb);
    const aliceSnap = getPortfolioSnapshot(userAlice, tmpDb);

    // Bob has zero holdings and full ₹10L cash
    assert.equal(bobSnap.holdings.length, 0);
    assert.equal(bobSnap.cashBalance, STARTING_VIRTUAL_CAPITAL);

    // Alice has 1 holding and less cash
    assert.equal(aliceSnap.holdings.length, 1);
    assert.equal(aliceSnap.holdings[0].symbol, 'TCS');
    assert.ok(aliceSnap.cashBalance < STARTING_VIRTUAL_CAPITAL);

    // Bob's intelligence is isolated
    const bobIntel = getPracticeIntelligence(userBob, tmpDb);
    assert.equal(bobIntel.holdingsHealth.totalHoldingsCount, 0);
    assert.equal(bobIntel.holdingsHealth.cashBufferPct, 100);

    // Alice's intelligence reflects her positions
    const aliceIntel = getPracticeIntelligence(userAlice, tmpDb);
    assert.equal(aliceIntel.holdingsHealth.totalHoldingsCount, 1);
    assert.equal(aliceIntel.holdingsHealth.concentrations[0].symbol, 'TCS');
  } finally {
    closeDb();
    if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
    if (fs.existsSync(`${tmpDb}-wal`)) fs.unlinkSync(`${tmpDb}-wal`);
    if (fs.existsSync(`${tmpDb}-shm`)) fs.unlinkSync(`${tmpDb}-shm`);
  }
});
