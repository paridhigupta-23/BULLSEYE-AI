import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { registerAccount } from './auth.ts';
import {
  buildAdviceQuantitativeContext,
  createInvestorRequest,
  generateExpertAdviceForClient,
  getBrokerClientDetail,
  getConversationMessages,
  isClientLinkedToBroker,
  linkInvestorToBrokerByCode,
  listBrokerClients,
  listInvestorAdvice,
  markAdviceAsRead,
  respondToClientRequest,
  sendBrokerClientMessage,
  sendExpertAdvice,
  updateBrokerRequestStatus,
} from './brokerStore.ts';
import { closeDb, getDb } from './db.ts';
import {
  deterministicFinancialTranslate,
  getCachedTranslation,
  translateFinancialTexts,
} from './translationService.ts';

test('brokerStore & translationService unit suite', async () => {
  const tmpDb = path.join(os.tmpdir(), `bullseye-broker-unit-${Date.now()}.db`);
  process.env.BULLSEYE_DB_PATH = tmpDb;
  const origGemini = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  try {
    getDb();

    // 1. Deterministic offline Hindi & Telugu translation preserves tickers, rupees & dates
    const sampleHeadline =
      'RELIANCE Board Meeting on 2025-09-30 to consider and approve Unaudited Financial Results and Interim Dividend of ₹1,364';
    const hiTranslated = deterministicFinancialTranslate(sampleHeadline, 'hi');
    const teTranslated = deterministicFinancialTranslate(sampleHeadline, 'te');

    assert.ok(hiTranslated.includes('RELIANCE'));
    assert.ok(hiTranslated.includes('2025-09-30'));
    assert.ok(hiTranslated.includes('₹1,364'));
    assert.ok(hiTranslated.includes('बोर्ड बैठक'));
    assert.ok(hiTranslated.includes('लाभांश'));

    assert.ok(teTranslated.includes('RELIANCE'));
    assert.ok(teTranslated.includes('2025-09-30'));
    assert.ok(teTranslated.includes('₹1,364'));
    assert.ok(teTranslated.includes('బోర్డు సమావేశం'));
    assert.ok(teTranslated.includes('డివిడెండ్'));

    // 2. SQLite translation_cache stores & hits on second call
    const firstBatch = await translateFinancialTexts([sampleHeadline], 'hi');
    assert.equal(firstBatch.length, 1);
    assert.equal(firstBatch[0].provider, 'dictionary-fallback');

    const cached = getCachedTranslation('hi', sampleHeadline);
    assert.ok(cached !== null);
    assert.equal(cached.translatedText, firstBatch[0].text);

    const secondBatch = await translateFinancialTexts([sampleHeadline], 'hi');
    assert.equal(secondBatch[0].provider, 'dictionary-fallback (cached)');
    assert.equal(secondBatch[0].text, firstBatch[0].text);

    // 3. Broker-client linkage isolation
    const regInv2 = registerAccount({
      userCode: 'INV-UNIT-02',
      name: 'Unit Investor Two',
      email: 'unit-inv-02@bullseye.local',
      password: 'Password@123',
      role: 'Investor',
    });
    assert.equal(regInv2.ok, true);
    if (!regInv2.ok) throw new Error('Registration failed');

    const regBrk2 = registerAccount({
      userCode: 'BRK-UNIT-02',
      name: 'Unit Broker Two',
      email: 'unit-brk-02@bullseye.local',
      password: 'Password@123',
      role: 'Broker / Quant',
    });
    assert.equal(regBrk2.ok, true);
    if (!regBrk2.ok) throw new Error('Broker 2 registration failed');

    assert.equal(isClientLinkedToBroker('usr-broker-01', 'usr-investor-01'), true);
    assert.equal(isClientLinkedToBroker('usr-broker-01', regInv2.user.id), false);
    assert.equal(getBrokerClientDetail('usr-broker-01', regInv2.user.id), null);
    assert.equal(listBrokerClients(regBrk2.user.id).length, 0);

    // Link Unit Investor Two to Unit Broker Two
    const linkRes = linkInvestorToBrokerByCode(regInv2.user.id, 'BRK-UNIT-02');
    assert.equal(linkRes.ok, true);
    assert.equal(isClientLinkedToBroker(regBrk2.user.id, regInv2.user.id), true);
    assert.equal(isClientLinkedToBroker('usr-broker-01', regInv2.user.id), false);

    // 4. Grounded Advice Quantitative Context truthfully reports mlModelTrained=false when untrained
    const untrainedCtx = buildAdviceQuantitativeContext({
      clientId: regInv2.user.id,
      symbol: 'INFY',
    });
    assert.equal(untrainedCtx.chosenSymbol, 'INFY');
    assert.equal(untrainedCtx.metrics.mlModelTrained, false);
    assert.equal(untrainedCtx.metrics.valuationDate, '2025-09-30');
    assert.ok(untrainedCtx.deterministicAnalysis.includes('No ML classifier has been trained'));

    // 5. Client request -> Advice Draft -> Sent -> Read lifecycle
    const reqCreate = createInvestorRequest({
      clientId: regInv2.user.id,
      category: 'Stock Analysis',
      symbol: 'INFY',
      message: 'Should I hold INFY given current ATR volatility?',
    });
    assert.equal(reqCreate.ok, true);
    if (!reqCreate.ok) throw new Error('Create request failed');

    const statusUpd = updateBrokerRequestStatus({
      brokerId: regBrk2.user.id,
      requestId: reqCreate.request.id,
      status: 'Under Review',
    });
    assert.equal(statusUpd.ok, true);

    const respRes = respondToClientRequest({
      brokerId: regBrk2.user.id,
      requestId: reqCreate.request.id,
      responseText: 'Reviewed INFY ATR and RSI indicators.',
    });
    assert.equal(respRes.ok, true);
    if (!respRes.ok) throw new Error('Respond failed');
    assert.equal(respRes.request.status, 'Responded');

    const genRes = await generateExpertAdviceForClient({
      brokerId: regBrk2.user.id,
      clientId: regInv2.user.id,
      symbol: 'INFY',
      requestId: reqCreate.request.id,
    });
    assert.equal(genRes.ok, true);
    if (!genRes.ok) throw new Error('Advice generation failed');
    assert.equal(genRes.advice.status, 'Draft');

    // Investor must NOT see Draft advice before Broker sends it
    const beforeSend = await listInvestorAdvice(regInv2.user.id, 'en');
    assert.equal(beforeSend.length, 0);

    const markDraftErr = markAdviceAsRead(regInv2.user.id, genRes.advice.id);
    assert.equal(markDraftErr.ok, false);
    if (!markDraftErr.ok) {
      assert.equal(markDraftErr.status, 403);
    }

    const sendRes = sendExpertAdvice(regBrk2.user.id, genRes.advice.id);
    assert.equal(sendRes.ok, true);
    if (!sendRes.ok) throw new Error('Send advice failed');
    assert.equal(sendRes.advice.status, 'Sent');

    const afterSendTe = await listInvestorAdvice(regInv2.user.id, 'te');
    assert.equal(afterSendTe.length, 1);
    assert.equal(afterSendTe[0].language, 'te');
    assert.ok(afterSendTe[0].analysis.includes('INFY'));

    const markReadOk = markAdviceAsRead(regInv2.user.id, genRes.advice.id);
    assert.equal(markReadOk.ok, true);
    if (!markReadOk.ok) throw new Error('Mark read failed');
    assert.equal(markReadOk.advice.status, 'Read');

    // 6. Two-way messaging respects active link & read receipts
    const msgErr = sendBrokerClientMessage({
      brokerId: 'usr-broker-01',
      clientId: regInv2.user.id,
      senderId: 'usr-broker-01',
      senderRole: 'Broker / Quant',
      messageText: 'Cross-broker message should fail',
    });
    assert.equal(msgErr.ok, false);

    const msgOk = sendBrokerClientMessage({
      brokerId: regBrk2.user.id,
      clientId: regInv2.user.id,
      senderId: regBrk2.user.id,
      senderRole: 'Broker / Quant',
      messageText: 'Hello Unit Investor Two, your INFY review is ready.',
    });
    assert.equal(msgOk.ok, true);
    const msgs = getConversationMessages({
      brokerId: regBrk2.user.id,
      clientId: regInv2.user.id,
      readerUserId: regInv2.user.id,
    });
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].messageText, 'Hello Unit Investor Two, your INFY review is ready.');
  } finally {
    if (origGemini !== undefined) process.env.GEMINI_API_KEY = origGemini;
    closeDb();
    delete process.env.BULLSEYE_DB_PATH;
    if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
    if (fs.existsSync(`${tmpDb}-wal`)) fs.unlinkSync(`${tmpDb}-wal`);
    if (fs.existsSync(`${tmpDb}-shm`)) fs.unlinkSync(`${tmpDb}-shm`);
  }
});
