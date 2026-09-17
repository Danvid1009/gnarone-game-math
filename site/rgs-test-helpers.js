// Shared checks for each engine's src/rgs.js (browser-safe RGS provider module).
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

/** Walk the ES-module import graph from `entry` and assert nothing imports a node: builtin. */
export function assertBrowserSafe(entryUrl) {
  const seen = new Set(), stack = [fileURLToPath(entryUrl)];
  while (stack.length) {
    const f = stack.pop(); if (seen.has(f)) continue; seen.add(f);
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)) {
      const spec = m[1];
      assert.ok(!spec.startsWith('node:'), `${f} imports ${spec} — not loadable in a browser`);
      if (spec.startsWith('.')) stack.push(resolve(dirname(f), spec));
    }
  }
  return [...seen];
}

/** open → bet → collect with the observed balance semantics; returns the round. */
export function playOnce(g, { betType = g.defaultBetType, betAmount, seed, actions = [] } = {}) {
  const s = g.open(); const bal0 = s.balance;
  betAmount ??= g.levels(betType)[2];
  let r = g.bet({ sessionId: s.sessionId, betAmount, betType, seed });
  assert.equal(r.balance, bal0 - betAmount, 'bet response debits the stake only');
  assert.equal(r.totalBetAmount, betAmount);
  for (const a of actions) { if (r.roundEnded) break; r = g.nextAction({ roundId: r.roundId, actionCode: a }); assert.equal(r.balance, bal0 - betAmount, 'next-action leaves the balance alone'); }
  if (g.isMultiStep) { while (!r.roundEnded) r = g.nextAction({ roundId: r.roundId, actionCode: 'CONTINUE' }); }
  const c = g.collect({ roundId: r.roundId });
  assert.equal(c.balance, bal0 - betAmount + r.totalWinAmount, 'collect credits the win');
  assert.deepEqual(r.nextAction, ['COLLECT']);
  return r;
}
