import { test } from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
import { createGame } from '../src/rgs.js'; import { assertBrowserSafe, playOnce } from '../../site/rgs-test-helpers.js';
test('rgs module is browser-safe', () => { assertBrowserSafe(new URL('../src/rgs.js', import.meta.url)); });
test('top3 and top1: balance semantics and fixture round 007 reproduced for every racer', () => {
  for (const [mode, dir] of [['top3', 'api'], ['top1', 'api-top1']]) {
    const g = createGame({ mode }); const f = JSON.parse(readFileSync(new URL(`../examples/${dir}/rounds/007.json`, import.meta.url)));
    for (const name of g.betTypes) { const r = playOnce(g, { betType: name, betAmount: 1000, seed: 'fixture-007' }); assert.equal(r.math.u, f.u); assert.deepEqual(r.math.order, f.order); assert.equal(r.totalWinAmount, f.settlements[name].win, `${mode}/${name}`); }
  }
});
