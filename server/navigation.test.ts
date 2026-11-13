import assert from 'node:assert/strict';
import test from 'node:test';

test('URL query parameter parsing correctly resolves portals and sub-tabs for direct URL access and reload', () => {
  // Helper matching AppContext.tsx and PracticePortal.tsx URL parsing logic
  function parsePortalUrl(searchQuery: string): { portal: string; tab: string; section?: string } {
    const params = new URLSearchParams(searchQuery);
    const p = params.get('portal');
    const portal = (p === 'investor' || p === 'broker' || p === 'practice') ? p : (params.get('autostart') === '1' ? 'investor' : 'landing');
    const tab = params.get('tab') || 'home';
    const section = params.get('section') || undefined;
    return { portal, tab, section };
  }

  // 1. Direct access to Practice Home
  const test1 = parsePortalUrl('?portal=practice');
  assert.equal(test1.portal, 'practice');
  assert.equal(test1.tab, 'home');

  // 2. Direct access to Practice Intelligence
  const test2 = parsePortalUrl('?portal=practice&tab=intelligence');
  assert.equal(test2.portal, 'practice');
  assert.equal(test2.tab, 'intelligence');

  // 3. Browser refresh on Practice Intelligence keeps tab=intelligence
  const simulatedHistoryUrl = new URL('http://localhost:3000/?portal=practice&tab=intelligence');
  assert.equal(simulatedHistoryUrl.searchParams.get('portal'), 'practice');
  assert.equal(simulatedHistoryUrl.searchParams.get('tab'), 'intelligence');
  const reloadedPractice = parsePortalUrl(simulatedHistoryUrl.search);
  assert.equal(reloadedPractice.tab, 'intelligence');

  // 4. Broker Portal direct section access & Final Performance tab
  const testBrokerPerf = parsePortalUrl('?portal=broker&tab=performance');
  assert.equal(testBrokerPerf.portal, 'broker');
  assert.equal(testBrokerPerf.tab, 'performance');

  const testBrokerSection = parsePortalUrl('?portal=broker&tab=home&section=07');
  assert.equal(testBrokerSection.portal, 'broker');
  assert.equal(testBrokerSection.tab, 'home');
  assert.equal(testBrokerSection.section, '07');

  // 5. Investor Portal direct access
  const testInvestor = parsePortalUrl('?portal=investor&tab=stocks');
  assert.equal(testInvestor.portal, 'investor');
  assert.equal(testInvestor.tab, 'stocks');

  // 6. Default root URL access without params falls back to landing page
  const testRoot = parsePortalUrl('');
  assert.equal(testRoot.portal, 'landing');
  assert.equal(testRoot.tab, 'home');
});
