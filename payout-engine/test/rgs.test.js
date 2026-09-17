import { test } from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
import { createGame, SETS } from '../src/rgs.js'; import { assertBrowserSafe, playOnce } from '../../site/rgs-test-helpers.js';
test('rgs module is browser-safe', () => { assert.ok(assertBrowserSafe(new URL('../src/rgs.js', import.meta.url)).length >= 4); });
test('open/bet/collect follow the RGS balance semantics; a fixture seed reproduces the fixture round in every set', () => {
  for (const set of Object.keys(SETS)) {
    const g = createGame({ set }); const f = JSON.parse(readFileSync(new URL(`../examples/api/${set}/rounds/007.json`, import.meta.url)));
    const r = playOnce(g, { betAmount: 1000, seed: 'fixture-007' });
    assert.equal(r.math.u, f.u); assert.equal(r.totalWinAmount, f.win, set);
  }
});
test('fresh rounds use fresh seeds and stay within the level list', () => {
  const g = createGame(); const a = playOnce(g), b = playOnce(g); assert.notEqual(a.roundId, b.roundId);
  assert.throws(() => g.bet({ sessionId: g.open().sessionId, betAmount: 123 }), /Valid bets/);
});
