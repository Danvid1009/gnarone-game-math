import { test } from 'node:test'; import assert from 'node:assert/strict';
import * as mod from '../src/rgs.js'; import { assertBrowserSafe, assertPresetFixtures, playOnce } from '../../site/rgs-test-helpers.js';
test('rgs module is browser-safe', () => { assertBrowserSafe(new URL('../src/rgs.js', import.meta.url)); });
test('every preset builds, replays fixture round 007 through the live calls, and follows the balance semantics', () => { assertPresetFixtures(mod, {}, new URL('../examples/api/', import.meta.url)); });
test('draws: free, sealed, committed and revealed at once; library listed in open(); money untouched', () => {
  const g = mod.createGame(); assert.ok(g.hasDraws); const s = g.open(); assert.ok(s.library.lognormal && s.dists.length >= 16);
  const a = g.draw({ sessionId: s.sessionId, params: { dist: 'normal', mu: 10, sigma: 2 }, seed: 'fixture-007' }), b = g.draw({ sessionId: s.sessionId, params: { dist: 'normal', mu: 10, sigma: 2 }, seed: 'fixture-007' });
  assert.equal(a.value, b.value); assert.equal(a.seedHash.length, 64); assert.equal(a.seed, 'fixture-007'); assert.equal(g.getSession(s.sessionId).balance, s.balance);
  const c = g.draw({ sessionId: s.sessionId, params: { dist: 'categorical', weights: [1, 1, 1, 1] } }); assert.ok(/^OPTION_[1-4]$/.test(c.label));
  assert.throws(() => g.draw({ sessionId: s.sessionId, params: { dist: 'nope' } }), /unknown distribution/);
  playOnce(g, { betAmount: 1000 });
});
