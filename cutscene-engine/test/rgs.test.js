import { test } from 'node:test'; import assert from 'node:assert/strict';
import * as mod from '../src/rgs.js'; import { assertBrowserSafe, assertPresetFixtures, playOnce } from '../../site/rgs-test-helpers.js';
test('rgs module is browser-safe', () => { assertBrowserSafe(new URL('../src/rgs.js', import.meta.url)); });
test('every preset builds, replays fixture round 007 through the live calls, and follows the balance semantics', () => { assertPresetFixtures(mod, {}, new URL('../examples/api/', import.meta.url)); });
test('side bets: library names and raw params, own round and collect, balance semantics, seeded replay', () => {
  const g = mod.createGame({ preset: 'even' }); assert.ok(g.hasSideBets);
  const s = g.open(); assert.ok(s.sideLibrary['pick-weighted'].odds.length === 3);
  const r = g.bet({ sessionId: s.sessionId, betAmount: 1000, betType: 'A', seed: 'fixture-007' }); assert.ok(r.cutscene.hits.length > 0); assert.deepEqual(r.nextAction, ['COLLECT']);
  let bal = r.balance;
  for (const params of ['coin', 'biased-coin', 'pick-3', 'shot-classic', { kind: 'pick', weights: [1, 1, 2], pick: 'OPTION_3' }, { kind: 'coin', p: 0.25, pick: 'OPTION_2', rtp: 0.9 }]) {
    const a = g.sideBet({ sessionId: s.sessionId, betAmount: 500, params, seed: 'side-1' }), b = g.sideBet({ sessionId: s.sessionId, betAmount: 500, params, seed: 'side-1' });
    assert.equal(a.totalWinAmount, b.totalWinAmount); assert.equal(a.balance, bal - 500); bal = b.balance; assert.deepEqual(a.nextAction, ['COLLECT']);
    const c = g.collect({ roundId: a.roundId }).balance; assert.equal(c, bal + a.totalWinAmount); bal = c;
    g.collect({ roundId: b.roundId }); bal += b.totalWinAmount;
  }
  assert.throws(() => g.sideBet({ sessionId: s.sessionId, betAmount: 333, params: 'coin' }), /Valid bets/);
  assert.throws(() => g.sideBet({ sessionId: s.sessionId, betAmount: 500, params: { kind: 'nope' } }), /unknown side bet kind/);
  playOnce(g, { betType: 'B' });
});
test('roster pairings price by the Elo formula and share the fight roster', () => {
  const g = mod.createGame({ A: 'slugger', B: 'wall' }); assert.equal(g.preset, 'slugger-v-wall'); assert.ok(Math.abs(g.engine.pA - 0.5) < 1e-8);
  const h = mod.createGame({ A: 'champion', B: 'rookie' }); assert.ok(Math.abs(h.engine.pA - 1 / (1 + 10 ** ((1400 - 1900) / 400))) < 1e-8);
  assert.deepEqual(Object.keys(mod.ROSTER), mod.matchupMatrix().names); assert.ok(g.open().roster.includes('tank'));
  const s = h.open(); const r = h.bet({ sessionId: s.sessionId, betAmount: 1000, betType: 'A', seed: 'roster' }); assert.ok(['A', 'B'].includes(r.winner)); h.collect({ roundId: r.roundId });
});
