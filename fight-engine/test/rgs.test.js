import { test } from 'node:test'; import assert from 'node:assert/strict';
import * as mod from '../src/rgs.js'; import { assertBrowserSafe, assertPresetFixtures, playOnce } from '../../site/rgs-test-helpers.js';
test('rgs module is browser-safe', () => { assertBrowserSafe(new URL('../src/rgs.js', import.meta.url)); });
test('every preset builds, replays fixture round 007 through the live calls, and follows the balance semantics', () => { assertPresetFixtures(mod, {}, new URL('../examples/api/', import.meta.url)); });
test('linked live bets: quoted fair from the current state, settle with the fight, own collect', () => {
  const g = mod.createGame({ preset: 'favourite' }); assert.ok(g.hasLinkedBets && g.isMultiStep);
  let found = 0;
  for (let n = 0; n < 40 && found < 3; n++) {
    const s = g.open(); let r = g.bet({ sessionId: s.sessionId, betAmount: 1000, betType: 'A', seed: `live${n}` });
    for (let k = 0; k < 3 && !r.roundEnded; k++) r = g.nextAction({ roundId: r.roundId, actionCode: 'CONTINUE' });
    if (r.roundEnded) continue; found++;
    const q = g.quote({ roundId: r.roundId }); assert.equal(q.step, 3); assert.ok(Math.abs(q.odds.A * q.pA - 1) < 1e-12); assert.ok(Math.abs(q.odds.B * (1 - q.pA) - 1) < 1e-12);
    assert.ok(Math.abs(q.pA - g.engine.prob(3, r.hp.A, r.hp.B)) < 1e-12, 'quote is the grid value of the public state');
    const live = g.linkedBet({ sessionId: s.sessionId, roundId: r.roundId, betAmount: 500, betType: 'B' }); assert.equal(live.balance, s.balance - 1000 - 500); assert.equal(live.odds, q.odds.B);
    while (!r.roundEnded) r = g.nextAction({ roundId: r.roundId, actionCode: 'CONTINUE' });
    const child = g.getRound(live.roundId); assert.equal(child.ended, true); assert.equal(child.totalWinAmount, r.winner === 'B' ? Math.round(500 * live.odds) : 0);
    g.collect({ roundId: r.roundId }); const b = g.collect({ roundId: live.roundId }).balance;
    assert.equal(b, s.balance - 1500 + r.totalWinAmount + child.totalWinAmount);
    assert.equal(r.totalWinAmount, r.winner === 'A' ? Math.round(1000 * g.engine.odds.A) : 0);
  }
  assert.ok(found >= 1);
  playOnce(g, { betType: 'B' });
});
