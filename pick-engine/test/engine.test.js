import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPick } from '../src/engine.js';
import { Rng } from '../src/rng.js';
const close = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

test('coin flip: 2 options pay 2·RTP; every option returns RTP; zones tile [0,1)', () => {
  const P = buildPick({ n: 2, rtp: 0.95 });
  assert.deepEqual(P.names, ['HEADS', 'TAILS']); P.odds.forEach(o => assert.ok(close(o, 1.9)));
  for (const n of [3, 5, 8]) { const Q = buildPick({ n, rtp: 0.96 }); Q.options.forEach(o => { assert.ok(close(o.p * o.odds, 0.96)); assert.ok(close(o.odds, 0.96 * n)); }); assert.ok(close(Q.cum[n], 1)); }
});

test('weighted options: odds = rtp / p', () => {
  const P = buildPick({ weights: [1, 1, 2], rtp: 0.9, labels: ['A', 'B', 'C'] });
  assert.ok(close(P.p[2], 0.5) && close(P.odds[2], 1.8) && close(P.odds[0], 3.6));
  assert.throws(() => buildPick({ probabilities: [0.5, 0.4] }), /sum to/);
  assert.throws(() => buildPick({ n: 1 }), /≥ 2/);
});

test('play + monte carlo: each backed option within 4 SE of rtp; win frequencies match p; standalone agrees', () => {
  const P = buildPick({ weights: [5, 3, 2], rtp: 0.95 });
  for (const t of P.names) { const s = P.simulate({ betType: t, rounds: 200000, seed: 'mc' + t }); assert.ok(Math.abs(s.rtp - 0.95) < 4 * s.se, `${t} ${s.rtp} se ${s.se}`); s.winFreq.forEach((f, i) => assert.ok(Math.abs(f - P.p[i]) < 4 * Math.sqrt(P.p[i] * (1 - P.p[i]) / s.rounds))); }
  const fn = new Function(P.standalone('f') + '\nreturn f;')(); const rng = new Rng('sa');
  for (let i = 0; i < 20000; i++) { const u = rng.next(); assert.equal(fn(u), P.outcome(u)); }
  const a = P.play({ bet: 100, betType: 'OPTION_2', rng: new Rng('x') }); assert.deepEqual(P.play({ bet: 100, betType: 'OPTION_2', rng: new Rng('x') }), a);
});
