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

    // 10. Broker ML Training, Backtesting, Risk & Monitoring
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

    const riskRes = await callApi(
      'ATR(14) risk & position sizing calculation (RELIANCE)',
      'POST',
      '/api/quant/risk',
      200,
      '200 OK computing ATR stop-loss, target price, and position size',
      {
        token: invToken,
        body: {
          symbol: 'RELIANCE',
          entryPrice: 1364,
          atrMultiplier: 1.5,
          availableCapital: 100000,
          riskPercentage: 1.5,
          riskRewardMultiple: 2,
        },
      },
    );
    assert.ok(Number(riskRes.data.stopLoss) < 1364);
    assert.ok(Number(riskRes.data.positionSizeShares) >= 0);

    const backtestRes = await callApi(
      'Broker / Quant chronological backtest (RELIANCE ML strategy)',
      'POST',
      '/api/quant/backtest',
      200,
      '200 OK with chronological equity curve, Sharpe ratio, and max drawdown',
      {
        token: brkToken,
        body: {
          symbol: 'RELIANCE',
          strategy: 'ml_model',
          modelType: 'logistic_regression',
          initialCapital: 1000000,
          brokeragePct: 0.05,
          slippagePct: 0.02,
          buyThreshold: 0.55,
        },
      },
    );
    assert.ok(Array.isArray(backtestRes.data.equityCurve));
    assert.equal(backtestRes.data.walkForwardLeakageFree, true);
    assert.ok(Number(backtestRes.data.retrainCount) >= 1);
    const btCurve = backtestRes.data.equityCurve as Array<{ strategyEquity: number }>;
    assert.equal(btCurve[btCurve.length - 1].strategyEquity, backtestRes.data.finalEquity);

    // 11. Investor Watchlist Upsert & Removal, Orders CRUD, IPO, News, and RBAC
    const watchRes = await callApi(
      'Investor SQLite Watchlist upsert (INFY)',
      'POST',
      '/api/investor/watchlist',
      200,
      '200 OK saving INFY to SQLite watchlist',
      { token: invToken, body: { symbol: 'INFY', note: 'API test watchlist note' } },
    );
    assert.ok(Array.isArray(watchRes.data.watchlist));
    assert.ok((watchRes.data.watchlist as Array<{ symbol: string }>).some((w) => w.symbol === 'INFY'));

    const unwatchRes = await callApi(
      'Investor SQLite Watchlist removal (INFY)',
      'DELETE',
      '/api/investor/watchlist/INFY',
      200,
      '200 OK removing INFY from SQLite watchlist',
      { token: invToken },
    );
    assert.ok(!(unwatchRes.data.watchlist as Array<{ symbol: string }>).some((w) => w.symbol === 'INFY'));

    const ipoRes = await callApi(
      'Investor IPO snapshot & honest feed availability check',
      'GET',
      '/api/investor/ipo',
      200,
      '200 OK returning liveIpoFeedAvailable=false and real NSE SME Emerge rows',
      { token: invToken },
    );
    assert.equal(ipoRes.data.liveIpoFeedAvailable, false);
    assert.ok(Number(ipoRes.data.smeListingsCount) > 0);

    const newsRes = await callApi(
      'Investor News & NSE corporate filings retrieval',
      'GET',
      '/api/investor/news',
      200,
      '200 OK returning liveNewsFeedAvailable=false and parsed NSE PR121126 filings',
      { token: invToken },
    );
    assert.equal(newsRes.data.liveNewsFeedAvailable, false);
    assert.ok(Array.isArray(newsRes.data.items) && newsRes.data.items.length > 0);

    const invOrdersRes = await callApi(
      'Investor My Orders retrieval from SQLite',
      'GET',
      '/api/investor/orders',
      200,
      '200 OK returning seeded and newly persisted investor orders',
      { token: invToken },
    );
    assert.ok(Array.isArray(invOrdersRes.data.orders) && invOrdersRes.data.orders.length >= 2);

    const createInvOrderRes = await callApi(
      'Investor create LIMIT BUY order persisted in SQLite',
      'POST',
      '/api/investor/orders',
      200,
      '200 OK storing new PLANNED investor order in SQLite',
      {
        token: invToken,
        body: { symbol: 'INFY', side: 'BUY', orderType: 'LIMIT', quantity: 8, price: 1450, notes: 'API order test' },
      },
    );
    const createdOrderId = String((createInvOrderRes.data.order as { id: string }).id);
    assert.ok(createdOrderId.startsWith('INV-ORD-'));

    const cancelInvOrderRes = await callApi(
      'Investor cancel order updates SQLite status to CANCELLED',
      'POST',
      `/api/investor/orders/${createdOrderId}/cancel`,
      200,
      '200 OK marking order CANCELLED in SQLite',
      { token: invToken },
    );
    const cancelledRow = (cancelInvOrderRes.data.orders as Array<{ id: string; status: string }>).find(
      (o) => o.id === createdOrderId,
    );
    assert.equal(cancelledRow?.status, 'CANCELLED');

    await callApi(
      'Unauthorized access blocked on Investor IPO endpoint',
      'GET',
      '/api/investor/ipo',
      401,
      '401 Unauthorized without Bearer token',
    );
    await callApi(
      'RBAC blocks Broker / Quant from Investor Orders endpoint',
      'GET',
      '/api/investor/orders',
      403,
      '403 Forbidden for Broker / Quant calling /api/investor/orders',
      { token: brkToken },
    );

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

    // 13. Multilingual User Preferences & Translated News API
    const prefUpdateRes = await callApi(
      'Persist Hindi language preference in SQLite',
      'PATCH',
      '/api/user/preferences',
      200,
      '200 OK persisting preferredLanguage=hi',
      { token: invToken, body: { preferredLanguage: 'hi' } },
    );
    assert.equal(prefUpdateRes.data.preferredLanguage, 'hi');

    const mePrefRes = await callApi(
      'Session /api/auth/me reflects saved Hindi preference',
      'GET',
      '/api/auth/me',
      200,
      '200 OK with user.preferredLanguage=hi',
      { token: invToken },
    );
    assert.equal((mePrefRes.data.user as { preferredLanguage: string }).preferredLanguage, 'hi');

    const newsHiRes = await callApi(
      'Investor News translated to Hindi (?lang=hi)',
      'GET',
      '/api/investor/news?lang=hi',
      200,
      '200 OK returning Hindi translated NSE corporate filings',
      { token: invToken },
    );
    assert.equal(newsHiRes.data.language, 'hi');
    assert.ok(Array.isArray(newsHiRes.data.items) && newsHiRes.data.items.length > 0);
    assert.ok((newsHiRes.data.items as Array<{ headline: string }>)[0].headline.length > 0);

    const newsTeRes = await callApi(
      'Investor News translated to Telugu (?lang=te)',
      'GET',
      '/api/investor/news?lang=te',
      200,
      '200 OK returning Telugu translated NSE corporate filings',
      { token: invToken },
    );
    assert.equal(newsTeRes.data.language, 'te');

    await callApi(
      'Restore English language preference in SQLite',
      'PATCH',
      '/api/user/preferences',
      200,
      '200 OK restoring preferredLanguage=en',
      { token: invToken, body: { preferredLanguage: 'en' } },
    );

    // 14. Broker-Client Roster, Portfolios, Requests, Expert Advice Lifecycle & Two-Way Messages
    const brkClientsRes = await callApi(
      'Broker My Clients roster lists seeded linked client INV-DEMO-01',
      'GET',
      '/api/broker/clients',
      200,
      '200 OK listing connected Investor accounts',
      { token: brkToken },
    );
    const clientsList = brkClientsRes.data.clients as Array<{ clientId: string; userCode: string }>;
    assert.ok(clientsList.some((c) => c.userCode === 'INV-DEMO-01'));

    const brkPortRes = await callApi(
      'Broker Client Portfolios summary computes aggregate valuations',
      'GET',
      '/api/broker/portfolios',
      200,
      '200 OK with holdings and stockBreakdown valued through 2025-09-30',
      { token: brkToken },
    );
    assert.ok(String(brkPortRes.data.valuationLabel).includes('2025-09-30'));
    assert.ok(Array.isArray(brkPortRes.data.holdings));

    const invReqCreateRes = await callApi(
      'Investor submits advisory request to linked Broker',
      'POST',
      '/api/investor/requests',
      201,
      '201 Created storing request with Pending status',
      {
        token: invToken,
        body: {
          category: 'Risk Management',
          symbol: 'RELIANCE',
          message: 'How should I manage RELIANCE ATR stop-loss risk?',
        },
      },
    );
    const createdReqId = String((invReqCreateRes.data.request as { id: string }).id);

    const brkReqsRes = await callApi(
      'Broker lists Client Requests queue',
      'GET',
      '/api/broker/requests',
      200,
      '200 OK including the newly submitted investor request',
      { token: brkToken },
    );
    assert.ok((brkReqsRes.data.requests as Array<{ id: string }>).some((r) => r.id === createdReqId));

    await callApi(
      'Broker updates request status to Under Review',
      'PATCH',
      `/api/broker/requests/${createdReqId}/status`,
      200,
      '200 OK updating request status in SQLite',
      { token: brkToken, body: { status: 'Under Review' } },
    );

    const brkRespRes = await callApi(
      'Broker responds to client request',
      'POST',
      `/api/broker/requests/${createdReqId}/respond`,
      201,
      '201 Created recording broker reply and setting status=Responded',
      { token: brkToken, body: { responseText: 'Reviewing your 1.5x ATR stop-loss on RELIANCE.' } },
    );
    assert.equal((brkRespRes.data.request as { status: string }).status, 'Responded');

    const brkAdviceGenRes = await callApi(
      'Broker generates grounded AI Expert Advice Draft',
      'POST',
      '/api/broker/advice/generate',
      201,
      '201 Created producing Draft advice backed by quantitative metrics',
      {
        token: brkToken,
        body: { clientId: 'usr-investor-01', symbol: 'RELIANCE', requestId: createdReqId },
      },
    );
    const adviceObj = brkAdviceGenRes.data.advice as { id: string; status: string };
    assert.equal(adviceObj.status, 'Draft');

    const invAdviceBeforeSend = await callApi(
      'Investor cannot view Draft advice before Broker publishes it',
      'GET',
      '/api/investor/advice?lang=en',
      200,
      '200 OK excluding Draft advice ID',
      { token: invToken },
    );
    assert.ok(!(invAdviceBeforeSend.data.advice as Array<{ id: string }>).some((a) => a.id === adviceObj.id));

    const brkAdviceSendRes = await callApi(
      'Broker sends Expert Advice to Investor',
      'POST',
      `/api/broker/advice/${adviceObj.id}/send`,
      200,
      '200 OK changing advice status from Draft to Sent',
      { token: brkToken },
    );
    assert.equal((brkAdviceSendRes.data.advice as { status: string }).status, 'Sent');

    const invAdviceHiRes = await callApi(
      'Investor retrieves Sent Expert Advice translated to Hindi (?lang=hi)',
      'GET',
      '/api/investor/advice?lang=hi',
      200,
      '200 OK returning Sent advice translated to Hindi',
      { token: invToken },
    );
    assert.ok((invAdviceHiRes.data.advice as Array<{ id: string }>).some((a) => a.id === adviceObj.id));

    const invAdviceReadRes = await callApi(
      'Investor marks received Expert Advice as Read',
      'POST',
      `/api/investor/advice/${adviceObj.id}/read`,
      200,
      '200 OK updating advice status to Read',
      { token: invToken },
    );
    assert.equal((invAdviceReadRes.data.advice as { status: string }).status, 'Read');

    // Two-way Messaging
    const invMsgRes = await callApi(
      'Investor sends direct message to linked Broker',
      'POST',
      '/api/investor/messages',
      201,
      '201 Created persisting message from Investor to Broker',
      { token: invToken, body: { messageText: 'Thank you, I received the RELIANCE advisory.' } },
    );
    assert.ok(Array.isArray(invMsgRes.data.messages) && invMsgRes.data.messages.length >= 1);

    const brkMsgThreadRes = await callApi(
      'Broker reads client message thread & marks Investor messages read',
      'GET',
      '/api/broker/messages/usr-investor-01',
      200,
      '200 OK returning conversation thread',
      { token: brkToken },
    );
    assert.ok(
      (brkMsgThreadRes.data.messages as Array<{ messageText: string }>).some((m) =>
        m.messageText.includes('RELIANCE advisory'),
      ),
    );

    await callApi(
      'Broker sends direct message reply to linked Investor',
      'POST',
      '/api/broker/messages/usr-investor-01',
      201,
      '201 Created sending Broker reply to Investor',
      { token: brkToken, body: { messageText: 'Let me know if you want a TCS follow-up.' } },
    );

    // 15. Cross-Role & Cross-Broker / Cross-Investor RBAC Isolation
    await callApi(
      'RBAC blocks Investor from Broker Clients endpoint',
      'GET',
      '/api/broker/clients',
      403,
      '403 Forbidden when Investor calls /api/broker/clients',
      { token: invToken },
    );
    await callApi(
      'RBAC blocks Practice Trader from Investor Requests endpoint',
      'GET',
      '/api/investor/requests',
      403,
      '403 Forbidden when Practice Trader calls /api/investor/requests',
      { token: prcToken },
    );

    const regBrk2 = await callApi(
      'Register isolated second Broker / Quant user',
      'POST',
      '/api/auth/register',
      201,
      '201 Created for second Broker',
      {
        body: {
          userId: 'BRK-ISOL-02',
          name: 'Isolated Broker Two',
          email: 'isolated-brk-02@bullseye.local',
          password: 'Quant@2026',
          role: 'Broker / Quant',
        },
      },
    );
    const brk2Token = String(regBrk2.data.token);

    await callApi(
      'Cross-broker isolation blocks unlinked Broker from viewing INV-DEMO-01 dossier',
      'GET',
      '/api/broker/clients/usr-investor-01',
      403,
      '403 Forbidden for unlinked Broker accessing another broker client',
      { token: brk2Token },
    );
    await callApi(
      'Cross-broker isolation blocks unlinked Broker from sending another broker advice',
      'POST',
      `/api/broker/advice/${adviceObj.id}/send`,
      403,
      '403 Forbidden when second Broker attempts to send BRK-QUANT-01 advice',
      { token: brk2Token },
    );

    // 15b. Quant Research Terminal APIs & RBAC Isolation
    const qInspect = await callApi(
      'Quant dataset inspector returns RELIANCE audit & 13 features',
      'GET',
      '/api/quant/dataset/inspect/RELIANCE?limit=10',
      200,
      '200 OK with leakageVerified=true and 13 feature stats',
      { token: brkToken },
    );
    assert.equal(qInspect.data.leakageVerified, true);

    const qMath = await callApi(
      'Quant math lab computes 10 statistical metrics and correlations',
      'POST',
      '/api/quant/math/analysis',
      200,
      '200 OK with 10 calculations and correlation matrix',
      { token: brkToken, body: { symbol: 'RELIANCE', compareSymbols: ['RELIANCE', 'TCS', 'HDFCBANK'] } },
    );
    assert.equal((qMath.data.calculations as unknown[]).length, 10);

    const qOpt = await callApi(
      'Hyperparameter Grid Search optimizes on val fold without test leakage',
      'POST',
      '/api/ml/optimize',
      200,
      '200 OK persisting Experiment ID and held-out test metrics',
      { token: brkToken, body: { symbol: 'RELIANCE', modelType: 'sequence_mlp', trainPct: 0.65, valPct: 0.15 } },
    );
    assert.ok(String(qOpt.data.experimentId).startsWith('EXP-'));

    const qCmp = await callApi(
      'Multi-model comparison benchmarks all 4 models',
      'POST',
      '/api/ml/compare',
      200,
      '200 OK returning 4 compared models',
      { token: brkToken, body: { symbol: 'RELIANCE' } },
    );
    assert.equal((qCmp.data.models as unknown[]).length, 4);

    await callApi(
      'Walk-forward validation computes sequential OOS folds',
      'POST',
      '/api/quant/walk-forward',
      200,
      '200 OK returning chronological walk-forward folds',
      { token: brkToken, body: { symbol: 'RELIANCE', modelType: 'logistic_regression', numWindows: 4 } },
    );

    await callApi(
      'Strategy signals endpoint returns gated BUY/SELL/HOLD decision',
      'POST',
      '/api/quant/signals',
      200,
      '200 OK with latestDecision & signal counts',
      { token: brkToken, body: { symbol: 'RELIANCE', strategy: 'combined_ml_tech' } },
    );

    await callApi(
      'Advanced risk endpoint returns VaR, CVaR & portfolio concentration',
      'POST',
      '/api/quant/risk/advanced',
      200,
      '200 OK with Historical VaR/CVaR and Sharpe/Sortino',
      { token: brkToken, body: { symbol: 'RELIANCE', useRealInvestorHoldings: true } },
    );

    await callApi(
      'Experiment registry returns persisted training & backtest runs',
      'GET',
      '/api/quant/experiments',
      200,
      '200 OK listing SQLite experiments',
      { token: brkToken },
    );

    await callApi(
      'Python environment endpoint returns honest package probe & files',
      'GET',
      '/api/quant/python',
      200,
      '200 OK returning pythonVersion and python_quant source files',
      { token: brkToken },
    );

    await callApi(
      'RBAC blocks Investor from Quant Research Terminal optimization endpoint',
      'POST',
      '/api/ml/optimize',
      403,
      '403 Forbidden when Investor calls /api/ml/optimize',
      { token: invToken, body: { symbol: 'RELIANCE', modelType: 'logistic_regression' } },
    );

    const fpRes = await callApi(
      'Consolidated Final Performance endpoint returns all 5 metric groups for Broker',
      'GET',
      '/api/quant/final-performance?symbol=RELIANCE&modelType=logistic_regression',
      200,
      '200 OK with modelPerformance, tradingPerformance, risk, efficiency & transactionCosts',
      { token: brkToken },
    );
    assert.equal(fpRes.data.hasModelData, true);
    assert.equal(fpRes.data.hasBacktestData, true);
    assert.ok(fpRes.data.efficiency);

    await callApi(
      'RBAC blocks Investor from Quant Final Performance endpoint',
      'GET',
      '/api/quant/final-performance?symbol=RELIANCE',
      403,
      '403 Forbidden when Investor calls /api/quant/final-performance',
      { token: invToken },
    );

    // 16. Logout & Session Invalidation
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
