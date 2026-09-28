import { test } from 'node:test'; import assert from 'node:assert/strict';
import * as mod from '../src/rgs.js'; import { assertBrowserSafe, assertPresetFixtures, playOnce } from '../../site/rgs-test-helpers.js';
test('rgs module is browser-safe (no node: imports anywhere in its import graph)', () => { assertBrowserSafe(new URL('../src/rgs.js', import.meta.url)); });
test('every preset builds, replays fixture round 007 through the live calls, and follows the RGS balance semantics', () => { assertPresetFixtures(mod, {}, new URL('../examples/api/', import.meta.url)); });
test('fresh rounds get fresh seeds; bets outside the level list are rejected', () => {
  const g = mod.createGame(); const a = playOnce(g), b = playOnce(g); assert.notEqual(a.roundId, b.roundId);
  assert.throws(() => g.bet({ sessionId: g.open().sessionId, betAmount: 123, betType: g.defaultBetType }), /Valid bets/);
});
