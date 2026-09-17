import { test } from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
import { createGame, SETS } from '../src/rgs.js'; import { assertBrowserSafe, playOnce } from '../../site/rgs-test-helpers.js';
test('rgs module is browser-safe', () => { assertBrowserSafe(new URL('../src/rgs.js', import.meta.url)); });
test('every set: balance semantics and fixture round 007 reproduced for every option', () => {
  for (const set of Object.keys(SETS)) {
    const g = createGame({ set }); const f = JSON.parse(readFileSync(new URL(`../examples/api/${set}/rounds/007.json`, import.meta.url)));
    for (const name of g.betTypes) { const r = playOnce(g, { betType: name, betAmount: 1000, seed: 'fixture-007' }); assert.equal(r.math.u, f.u); assert.equal(r.totalWinAmount, f.settlements[name].win, `${set}/${name}`); }
  }
  assert.throws(() => createGame().bet({ sessionId: createGame().open().sessionId, betAmount: 1000, betType: 'NOPE' }), /invalid betType|unknown session/);
});
