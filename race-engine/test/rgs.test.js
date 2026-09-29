import { test } from 'node:test'; import assert from 'node:assert/strict';
import * as mod from '../src/rgs.js'; import { assertBrowserSafe, assertPresetFixtures, playOnce } from '../../site/rgs-test-helpers.js';
test('rgs module is browser-safe (no node: imports anywhere in its import graph)', () => { assertBrowserSafe(new URL('../src/rgs.js', import.meta.url)); });
test('top3: every preset replays fixture round 007 for every racer', () => { assertPresetFixtures(mod, { mode: 'top3' }, new URL('../examples/api/', import.meta.url)); });
test('top1: every preset replays fixture round 007 for every racer', () => { assertPresetFixtures(mod, { mode: 'top1' }, new URL('../examples/api-top1/', import.meta.url)); });
test('fresh rounds get fresh seeds; unknown racer rejected', () => {
  const g = mod.createGame(); const a = playOnce(g, { betType: 'RACER_6' }), b = playOnce(g, { betType: 'RACER_6' }); assert.notEqual(a.roundId, b.roundId);
  assert.throws(() => g.bet({ sessionId: g.open().sessionId, betAmount: 1000, betType: 'Nobody' }), /invalid betType/);
});
