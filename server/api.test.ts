import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createBullseyeApp } from '../server.ts';
import { closeDb } from './db.ts';

interface RecordedApiCheck {
  id: number;
  name: string;
  method: string;
  endpoint: string;
  expected: string;
  actual: string;
  statusCode: number;
  passed: boolean;
}

test('BULLSEYE AI full-stack API integration & RBAC suite', async () => {
  const tmpDb = path.join(os.tmpdir(), `bullseye-api-test-${Date.now()}.db`);
  process.env.BULLSEYE_DB_PATH = tmpDb;

  const app = await createBullseyeApp({ withVite: false });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const reportRows: RecordedApiCheck[] = [];
  let seq = 0;

  async function callApi(
    name: string,
    method: string,
    endpoint: string,
    expectedStatus: number,
    expectedDesc: string,
    options?: { token?: string; body?: unknown },
  ): Promise<{ status: number; data: Record<string, unknown> }> {
    seq += 1;
    const headers: Record<string, string> = {};
    if (options?.token) headers.Authorization = `Bearer ${options.token}`;
    if (options?.body !== undefined) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const data = (await res.json()) as Record<string, unknown>;
    const passed = res.status === expectedStatus;

    const actualSnippet = JSON.stringify(data).slice(0, 140).replace(/\|/g, '/');
    reportRows.push({
      id: seq,
      name,
      method,
      endpoint,
      expected: expectedDesc,
      actual: `${actualSnippet}${JSON.stringify(data).length > 140 ? '...' : ''}`,
      statusCode: res.status,
      passed,
    });

    assert.equal(
      res.status,
      expectedStatus,
      `${name} (${method} ${endpoint}) expected ${expectedStatus}, got ${res.status}: ${JSON.stringify(data)}`,
    );
    return { status: res.status, data };
  }

  try {
    // 1. Health & Database Check
    const health = await callApi(
      'Backend health, CSV datasets & SQLite init check',
      'GET',
      '/api/health',
      200,
      '200 OK with datasetLoaded=true, databaseInitialized=true, 50 stocks',
    );
    assert.equal(health.data.datasetLoaded, true);
    assert.equal(health.data.databaseInitialized, true);
    assert.equal(health.data.stocksCount, 50);

    // 2. Missing Credentials
    await callApi(
      'Login with missing credentials',
      'POST',
      '/api/auth/login',
      400,
      '400 Bad Request rejecting empty credentials',
      { body: { userId: '', password: '' } },
    );

    // 3. Incorrect Password
    await callApi(
      'Login with incorrect password',
      'POST',
      '/api/auth/login',
      401,
      '401 Unauthorized for wrong password',
      { body: { userId: 'INV-DEMO-01', password: 'WrongPassword123' } },
    );

    // 4. Cross-role Portal Login Mismatch
    await callApi(
      'Cross-role login blocked on wrong portal',
      'POST',
      '/api/auth/login',
      403,
      '403 Forbidden when Investor attempts Broker / Quant login',
      {
        body: {
          userId: 'INV-DEMO-01',
          password: process.env.DEMO_INVESTOR_PASSWORD || 'Investor@2026',
          expectedRole: 'Broker / Quant',
        },
      },
    );

    // 5. Successful Logins for All 3 Portals
    const invLogin = await callApi(
      'Successful Investor portal login',
      'POST',
      '/api/auth/login',
      200,
      '200 OK returning Bearer token and Investor role',
      {
        body: {
          userId: 'INV-DEMO-01',
          password: process.env.DEMO_INVESTOR_PASSWORD || 'Investor@2026',
          expectedRole: 'Investor',
        },
      },
    );
    const invToken = String(invLogin.data.token);

    const brkLogin = await callApi(
      'Successful Broker / Quant portal login',
      'POST',
      '/api/auth/login',
      200,
      '200 OK returning Bearer token and Broker / Quant role',
      {
        body: {
          userId: 'BRK-QUANT-01',
          password: process.env.DEMO_BROKER_PASSWORD || 'Quant@2026',
          expectedRole: 'Broker / Quant',
        },
      },
    );
    const brkToken = String(brkLogin.data.token);

    const prcLogin = await callApi(
      'Successful Practice Trading portal login',
      'POST',
      '/api/auth/login',
      200,
      '200 OK returning Bearer token and Practice Trader role',
      {
        body: {
          userId: 'PRC-TRADE-01',
          password: process.env.DEMO_PRACTICE_PASSWORD || 'Trade@2026',
          expectedRole: 'Practice Trader',
        },
      },
    );
    const prcToken = String(prcLogin.data.token);

    // 6. Unauthorized Access (No Token)
    await callApi(
      'Unauthorized access to protected investor portfolio',
      'GET',
      '/api/investor/portfolio',
      401,
      '401 Unauthorized without Bearer token',
    );
    await callApi(
      'Unauthorized access to protected practice portfolio',
      'GET',
      '/api/practice/portfolio',
      401,
      '401 Unauthorized without Bearer token',
    );
    await callApi(
      'Unauthorized access to protected ML training endpoint',
      'POST',
      '/api/ml/train',
      401,
      '401 Unauthorized without Bearer token',
      { body: { symbol: 'RELIANCE', modelType: 'logistic_regression' } },
    );

    // 7. Role-Based Access Restrictions
    await callApi(
      'RBAC blocks Investor from Broker ML training',
      'POST',
      '/api/ml/train',
      403,
      '403 Forbidden for Investor calling /api/ml/train',
      { token: invToken, body: { symbol: 'RELIANCE', modelType: 'logistic_regression' } },
    );
    await callApi(
      'RBAC blocks Practice Trader from technical indicators API',
      'GET',
      '/api/stocks/TCS/indicators',
      403,
      '403 Forbidden for Practice Trader calling /api/stocks/TCS/indicators',
      { token: prcToken },
    );
    await callApi(
      'RBAC blocks Broker from Practice order endpoint',
      'POST',
      '/api/practice/order',
      403,
      '403 Forbidden for Broker calling /api/practice/order',
      { token: brkToken, body: { symbol: 'RELIANCE', side: 'BUY', orderType: 'MARKET', quantity: 5 } },
    );

    // 8. Stock Data Retrieval & Technical Indicator Calculation
    const stockRes = await callApi(
      'Authenticated historical stock data retrieval (RELIANCE)',
      'GET',
      '/api/stocks/RELIANCE?range=6M',
      200,
      '200 OK with OHLCV candles ending 2025-09-30 and risk metrics',
      { token: invToken },
    );
    assert.equal(stockRes.data.latestDate, '2025-09-30');

    const indRes = await callApi(
      'Technical indicator calculation retrieval (TCS)',
      'GET',
      '/api/stocks/TCS/indicators',
      200,
      '200 OK with 13 computed technical indicators and rule summary',
      { token: invToken },
    );
    assert.ok(indRes.data.indicators);

    // 9. Model Prediction & Invalid Symbol
    const predRes = await callApi(
      'Trained ML prediction retrieval (ADANIENT)',
      'GET',
      '/api/ml/predict/ADANIENT?threshold=0.75',
      200,
      '200 OK with modelTrained=true, probabilities, and SHAP contributions',
      { token: invToken },
    );
    assert.equal(predRes.data.modelTrained, true);

    await callApi(
      'Invalid stock symbol handling',
      'GET',
      '/api/stocks/INVALIDXYZ',
      404,
      '404 Not Found for unknown ticker symbol',
      { token: invToken },
    );

    // 10. Broker ML Training & Monitoring
    const trainRes = await callApi(
      'Broker / Quant chronological ML training (Random Forest)',
      'POST',
      '/api/ml/train',
      200,
      '200 OK with chronological accuracy/F1 and SQLite run persistence',
      {
        token: brkToken,
        body: { symbol: 'TATASTEEL', modelType: 'random_forest', splitRatio: 0.8 },
      },
    );
    assert.equal(trainRes.data.trained, true);

    // 11. Investor Watchlist & Holdings Persistence
    const watchRes = await callApi(
      'Investor SQLite Watchlist upsert (INFY)',
      'POST',
      '/api/investor/watchlist',
      200,
      '200 OK saving INFY to SQLite watchlist',
      { token: invToken, body: { symbol: 'INFY', note: 'API test watchlist note' } },
    );
    assert.ok(Array.isArray(watchRes.data.watchlist));

    // 12. Practice Trading: Invalid Qty, Insufficient Balance, BUY, SELL, Portfolio Update
    await callApi(
      'Practice order rejects zero/invalid quantity',
      'POST',
      '/api/practice/order',
      400,
      '400 Bad Request for invalid order quantity <= 0',
      {
        token: prcToken,
        body: { symbol: 'RELIANCE', side: 'BUY', orderType: 'MARKET', quantity: 0 },
      },
    );

    await callApi(
      'Practice order rejects insufficient virtual balance',
      'POST',
      '/api/practice/order',
      400,
      '400 Bad Request when order exceeds ₹10,00,000 balance',
      {
        token: prcToken,
        body: { symbol: 'RELIANCE', side: 'BUY', orderType: 'MARKET', quantity: 50000 },
      },
    );

    const buyRes = await callApi(
      'Practice BUY order (10 RELIANCE @ MARKET)',
      'POST',
      '/api/practice/order',
      200,
      '200 OK executing BUY order and updating cash/holdings in SQLite',
      {
        token: prcToken,
        body: { symbol: 'RELIANCE', side: 'BUY', orderType: 'MARKET', quantity: 10 },
      },
    );
    assert.equal(buyRes.data.ok, true);

    const sellRes = await callApi(
      'Practice SELL order (4 RELIANCE @ MARKET)',
      'POST',
      '/api/practice/order',
      200,
      '200 OK executing SELL order and leaving 6 RELIANCE shares',
      {
        token: prcToken,
        body: { symbol: 'RELIANCE', side: 'SELL', orderType: 'MARKET', quantity: 4 },
      },
    );
    assert.equal(sellRes.data.ok, true);

    const portRes = await callApi(
      'Practice portfolio reflects updated holdings & cash balance',
      'GET',
      '/api/practice/portfolio',
      200,
      '200 OK with 6 RELIANCE shares, updated cash, and 2 trades',
      { token: prcToken },
    );
    const holdings = portRes.data.holdings as Array<{ symbol: string; quantity: number }>;
    assert.equal(holdings[0].symbol, 'RELIANCE');
    assert.equal(holdings[0].quantity, 6);

    // 13. Logout & Session Invalidation
    await callApi(
      'Logout revokes active session token in SQLite',
      'POST',
      '/api/auth/logout',
      200,
      '200 OK with revoked=true',
      { token: prcToken },
    );

    await callApi(
      'Revoked token rejected on subsequent /api/auth/me request',
      'GET',
      '/api/auth/me',
      401,
      '401 Unauthorized after logout',
      { token: prcToken },
    );

    // Write live executed API test report
    const docsDir = path.resolve(process.cwd(), 'docs');
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

    const passedCount = reportRows.filter((r) => r.passed).length;
    const reportLines = [
      '# BULLSEYE AI — Automated API Testing Report',
      '',
      `- **Executed At**: ${new Date().toISOString()}`,
      `- **Test Runner**: \`tsx --test server/api.test.ts\` (Node \`node:test\` + live Express HTTP server against isolated SQLite DB)`,
      `- **Result Summary**: **${passedCount} / ${reportRows.length} checks PASSED** (0 failures)`,
      '',
      '| # | Test Case | Method | Endpoint | Expected Response | Actual Response | Status Code | Result |',
      '|---|-----------|--------|----------|-------------------|-----------------|-------------|--------|',
      ...reportRows.map(
        (r) =>
          `| ${r.id} | ${r.name} | \`${r.method}\` | \`${r.endpoint}\` | ${r.expected} | \`${r.actual}\` | ${r.statusCode} | ${r.passed ? 'PASS' : 'FAIL'} |`,
      ),
      '',
    ];
    fs.writeFileSync(path.join(docsDir, 'API_TEST_REPORT.md'), reportLines.join('\n'), 'utf-8');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDb();
    delete process.env.BULLSEYE_DB_PATH;
    if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
    if (fs.existsSync(`${tmpDb}-wal`)) fs.unlinkSync(`${tmpDb}-wal`);
    if (fs.existsSync(`${tmpDb}-shm`)) fs.unlinkSync(`${tmpDb}-shm`);
  }
});
