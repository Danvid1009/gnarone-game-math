import { test } from 'node:test'; import assert from 'node:assert/strict';
import { buildCutscene, buildSideBet } from '../src/engine.js'; import { Rng } from '../src/rng.js';
const close = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

test('main bet: pA is the Live Fight rating, both sides return the RTP exactly, simulation agrees, cutscene winner always matches the coin', () => {
  const C = buildCutscene({ A: { power: 1700, hp: 70 }, B: { power: 1550, hp: 120 } }); C._rng = { Rng };
  assert.ok(close(C.pA, C.fight.pA0)); assert.ok(close(C.pA * C.odds.A, 0.95)); assert.ok(close((1 - C.pA) * C.odds.B, 0.95));
  const s = C.simulate({ rounds: 100000 }); assert.ok(Math.abs(s.freqA - C.pA) < 4 * s.se); assert.ok(Math.abs(s.rtpA - 0.95) < 4 * s.se * C.odds.A); assert.ok(Math.abs(s.rtpB - 0.95) < 4 * s.se * C.odds.B);
  for (const [k, v] of Object.entries(s.sideRtp)) assert.ok(Math.abs(v - 0.95) < 0.03, `${k} ${v}`);
  const rng = new Rng('cut'); let relabelled = 0;
  for (let i = 0; i < 300; i++) { const r = C.play({ bet: 1000, betType: 'A', rng }); assert.equal(r.winner, r.math.u < C.pA ? 'A' : 'B'); const last = r.cutscene.hits[r.cutscene.hits.length - 1]; if (r.cutscene.how === 'KO') assert.equal(r.winner, last.hpB === 0 ? 'A' : 'B'); assert.equal(r.totalWinAmount, r.winner === 'A' ? Math.round(1000 * C.odds.A) : 0); if (r.cutscene.relabelled) relabelled++; }
  assert.equal(relabelled, 0);
});

test('side-bet library: coin, pick and single-shot are exact at their RTP; placeholders; validation', () => {
  const coin = buildSideBet({ kind: 'coin', p: 0.7 }); assert.deepEqual(coin.options, ['OPTION_1', 'OPTION_2']); assert.ok(close(coin.odds[0] * 0.7, 0.95)); assert.ok(close(coin.odds[1] * 0.3, 0.95));
  const pick = buildSideBet({ kind: 'pick', weights: [5, 3, 2] }); assert.ok(close(pick.probs.reduce((s, x, i) => s + x * pick.odds[i], 0), 3 * 0.95)); assert.equal(pick.outcome(0.49), 0); assert.equal(pick.outcome(0.51), 1);
  const shot = buildSideBet({ kind: 'single-shot', payouts: [0, 0.5, 1, 2, 5, 20] }); assert.ok(close(shot.engine.rtp, 0.95));
  assert.throws(() => buildSideBet({ kind: 'dice' }), /unknown side bet kind/); assert.throws(() => buildSideBet({ kind: 'coin', p: 1.2 }), /0 < p < 1/); assert.throws(() => buildSideBet({ kind: 'pick' }), /needs n/);
  const C = buildCutscene({ A: { power: 1600, hp: 100 }, B: { power: 1600, hp: 100 } });
  const r = C.sideBet({ bet: 1000, params: { kind: 'pick', n: 4, pick: 'OPTION_3' }, rng: new Rng('s') }); assert.ok(['OPTION_1', 'OPTION_2', 'OPTION_3', 'OPTION_4'].includes(r.outcome)); assert.equal(r.totalWinAmount, r.hit ? Math.round(1000 * 0.95 * 4) : 0);
  assert.throws(() => C.sideBet({ bet: 1000, params: { kind: 'coin', pick: 'HEADS' }, rng: new Rng('s') }), /pick must be one of/);
});
