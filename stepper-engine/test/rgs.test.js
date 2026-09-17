import { test } from 'node:test'; import assert from 'node:assert/strict';
import { createGame } from '../src/rgs.js'; import { assertBrowserSafe, playOnce } from '../../site/rgs-test-helpers.js';
test('rgs module is browser-safe', () => { assertBrowserSafe(new URL('../src/rgs.js', import.meta.url)); });
test('multi-step flow in the live stepper shape: CONTINUE → CONTINUE/CASH_OUT → COLLECT; cash-out pays the rung; balance semantics', () => {
  const g = createGame(); assert.ok(g.isMultiStep);
  for (const d of g.betTypes) {
    // find a seed that survives the first rung, checking the crash path on the way
    let found = null;
    for (let i = 0; i < 200 && !found; i++) { const s = g.open(); const r = g.bet({ sessionId: s.sessionId, betAmount: 1000, betType: d, seed: `s${i}` }); assert.deepEqual(r.nextAction, ['CONTINUE']); assert.equal(r.currentStep, 0);
      const r1 = g.nextAction({ roundId: r.roundId, actionCode: 'CONTINUE' }); if (r1.roundEnded) { assert.equal(r1.totalWinAmount, 0); g.collect({ roundId: r.roundId }); continue; }
      assert.deepEqual(r1.nextAction, ['CONTINUE', 'CASH_OUT']); assert.equal(r1.currentPayout, Math.round(1000 * g.engine[d].returns[0]));
      const r2 = g.nextAction({ roundId: r.roundId, actionCode: 'CASH_OUT' }); assert.equal(r2.roundEnded, true); assert.equal(r2.totalWinAmount, r1.currentPayout); assert.deepEqual(r2.nextAction, ['COLLECT']);
      assert.equal(g.collect({ roundId: r.roundId }).balance, s.balance - 1000 + r2.totalWinAmount); found = r2; }
    assert.ok(found, `${d}: a surviving seed exists`);
    const r = playOnce(g, { betType: d, betAmount: 1000, seed: 'det' }); assert.ok(r.roundEnded);
  }
});
