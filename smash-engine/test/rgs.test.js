import { test } from 'node:test'; import assert from 'node:assert/strict';
import { createGame } from '../src/rgs.js'; import { assertBrowserSafe, playOnce } from '../../site/rgs-test-helpers.js';
test('rgs module is browser-safe', () => { assertBrowserSafe(new URL('../src/rgs.js', import.meta.url)); });
test('BASE and BOOSTED: balance semantics, GO3 result fields, seeded determinism', () => {
  const g = createGame();
  for (const t of g.betTypes) {
    const r1 = playOnce(g, { betType: t, betAmount: 1000, seed: 'det' }), r2 = playOnce(createGame(), { betType: t, betAmount: 1000, seed: 'det' });
    assert.ok([0, 1, 2, 3].includes(r1.count)); assert.equal(typeof r1.hasBonus, 'boolean'); assert.equal(r1.totalWinAmount, Math.round(1000 * r1.multiplier)); assert.equal(r1.totalWinAmount, r2.totalWinAmount);
  }
});
