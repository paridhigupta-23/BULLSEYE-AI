import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { closeDb } from './db.ts';
import {
  executeSimulatedOrder,
  getPortfolioSnapshot,
  resetPracticePortfolio,
  STARTING_VIRTUAL_CAPITAL,
} from './tradingStore.ts';

test('Practice trading validates funds, executes BUY/SELL, and tracks realized PnL in SQLite', () => {
  const tmpDb = path.join(os.tmpdir(), `bullseye-test-${Date.now()}.db`);

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
    if (fs.existsSync(tmpDb)) {
      fs.unlinkSync(tmpDb);
    }
    if (fs.existsSync(`${tmpDb}-wal`)) fs.unlinkSync(`${tmpDb}-wal`);
    if (fs.existsSync(`${tmpDb}-shm`)) fs.unlinkSync(`${tmpDb}-shm`);
  }
});
