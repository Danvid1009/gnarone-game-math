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

/**
 * For every preset of an rgs module: create the game, replay fixture round 007 with the same seed through the
 * real open/bet/(next-action)/collect calls, and check the wins match the generated fixtures bit for bit.
 * Multi-step games are checked for "take after 1" and "take after 2".
 */
export function assertPresetFixtures(mod, opts, apiDirUrl) {
  assert.ok(Object.keys(mod.PRESETS).length >= 2, 'a module ships at least two presets');
  assert.ok(mod.PRESETS[mod.DEFAULT_PRESET], 'default preset exists');
  for (const preset of Object.keys(mod.PRESETS)) {
    const g = mod.createGame({ preset, ...opts });
    const f = JSON.parse(readFileSync(new URL(`${preset}/rounds/007.json`, apiDirUrl)));
    assert.equal(f.seed, 'fixture-007');
    for (const t of g.betTypes) {
      const exp = f.results[t]; assert.ok(exp, `${preset}: fixture has bet type ${t}`);
      if (!g.isMultiStep) {
        const r = playOnce(g, { betType: t, betAmount: exp.stake, seed: 'fixture-007' });
        assert.equal(r.totalWinAmount, exp.win, `${preset}/${t}`);
      } else {
        for (const s of [1, 2]) {
          const sess = g.open(); let r = g.bet({ sessionId: sess.sessionId, betAmount: exp.stake, betType: t, seed: 'fixture-007' });
          assert.deepEqual(r.nextAction, ['CONTINUE']);
          for (let k = 0; k < s && !r.roundEnded; k++) r = g.nextAction({ roundId: r.roundId, actionCode: 'CONTINUE' });
          if (!r.roundEnded) r = g.nextAction({ roundId: r.roundId, actionCode: 'CASH_OUT' });
          assert.equal(r.totalWinAmount, exp.payoutIfTakenAfter[s - 1].win, `${preset}/${t} take after ${s}`);
          assert.equal(g.collect({ roundId: r.roundId }).balance, sess.balance - exp.stake + r.totalWinAmount);
        }
        assert.equal(exp.survived >= 1 ? 'reachable' : 'crash', exp.payoutIfTakenAfter[0].reachable ? 'reachable' : 'crash');
      }
    }
    assert.throws(() => mod.createGame({ preset: 'no-such-preset' }), /unknown preset/);
  }
}
