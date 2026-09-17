import { test } from 'node:test'; import assert from 'node:assert/strict';
import { createGame } from '../src/rgs.js'; import { assertBrowserSafe, playOnce } from '../../site/rgs-test-helpers.js';
test('rgs module is browser-safe', () => { assertBrowserSafe(new URL('../src/rgs.js', import.meta.url)); });
test('all four bet types: balance semantics, pack count, seeded determinism, credit-based levels', () => {
  const g = createGame();
  for (const t of g.betTypes) {
    const r1 = playOnce(g, { betType: t, seed: 'det' }), r2 = playOnce(createGame(), { betType: t, seed: 'det' });
    assert.equal(r1.cardPacks.length, g.engine.betTypes[t].packs); assert.deepEqual(r1.cardPacks, r2.cardPacks); assert.equal(r1.totalWinAmount, r2.totalWinAmount);
    assert.equal(g.levels(t)[0], g.engine.betTypes[t].cost * g.engine.betTypes[t].paidPacks * 100);
  }
  assert.equal(g.boostedBetType, 'BOOSTED');
});
