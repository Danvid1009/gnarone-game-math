import { test } from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
import { createGame } from '../src/rgs.js'; import { assertBrowserSafe, playOnce } from '../../site/rgs-test-helpers.js';
test('rgs module is browser-safe', () => { assertBrowserSafe(new URL('../src/rgs.js', import.meta.url)); });
test('every size: fixture round 007 reproduced through the live flow (BID ×2 then the hammer), balance semantics', () => {
  const g = createGame(); assert.ok(g.isMultiStep);
  for (const size of g.betTypes) {
    const f = JSON.parse(readFileSync(new URL(`../examples/api/${size.toLowerCase()}/rounds/007.json`, import.meta.url)));
    const s = g.open(); let r = g.bet({ sessionId: s.sessionId, betAmount: 1000, betType: size, seed: 'fixture-007' }); assert.deepEqual(r.nextAction, ['CONTINUE']); assert.equal(r.locker, null);
    for (let k = 1; k <= 2 && !r.roundEnded; k++) { r = g.nextAction({ roundId: r.roundId, actionCode: 'CONTINUE' }); if (!r.roundEnded) assert.equal(r.currentPayout, f.payoutIfTakenAfter[k - 1].lockerValue); }
    if (!r.roundEnded) { r = g.nextAction({ roundId: r.roundId, actionCode: 'CASH_OUT' }); assert.ok(r.locker); assert.equal(r.locker.multiplier, f.lockerMultiplier); assert.equal(r.totalWinAmount, f.payoutIfTakenAfter[1].win, size); }
    else assert.equal(r.totalWinAmount, 0);
    assert.equal(g.collect({ roundId: r.roundId }).balance, s.balance - 1000 + r.totalWinAmount);
  }
  playOnce(g, { betType: 'XL', betAmount: 1000, seed: 'det' });
});
