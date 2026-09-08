import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStepBand, buildFromPayouts, buildTrapezoid, buildSloped, assignProbabilities } from '../src/step-band.js';
import { Rng } from '../src/rng.js';
import { monteCarlo, assertRtp } from '../src/verify.js';

const P = [0.3, 0.125, 0.125, 0.25, 0.2];

test('probabilities become region widths exactly; RTP is Σ p·a', () => {
  const sb = buildStepBand({ p: P, levels: [0, 0.25, 0.75, 1.5, 2.35] });
  assert.deepEqual(sb.breaks.map(x => +x.toFixed(6)), [0, 0.3, 0.425, 0.55, 0.8, 1]);
  assert.ok(Math.abs(sb.rtp - 0.97) < 1e-12);
  assert.ok(Math.abs(sb.r - 0.05) < 1e-12);
  assert.deepEqual(sb.byProbability.map(w => w.p), [0.3, 0.25, 0.2, 0.125, 0.125]);
  assert.deepEqual(sb.byProbability.map(w => w.level), [0, 1.5, 2.35, 0.75, 0.25]);
});

test('one unknown level is solved for the target RTP', () => {
  const sb = buildStepBand({ p: P, levels: [0, 0.25, 0.75, 1.5, null], rtp: 0.97 });
  assert.ok(Math.abs(sb.levels[4] - 2.35) < 1e-12);
  const sb2 = buildStepBand({ p: [0.5, 0.3, 0.2], levels: [0, null, 3], rtp: 0.9 });
  assert.ok(Math.abs(sb2.rtp - 0.9) < 1e-12);
  assert.throws(() => buildStepBand({ p: [0.5, 0.5], levels: [0, null], rtp: 0.9, }), undefined, 'solvable');
});

test('validation: sum to 1, at most one unknown, rtp consistency, band clear of zero', () => {
  assert.throws(() => buildStepBand({ p: [0.5, 0.4], levels: [0, 1] }), /sum to/);
  assert.throws(() => buildStepBand({ p: [0.5, 0.5], levels: [null, null], rtp: 1 }), /at most one/);
  assert.throws(() => buildStepBand({ p: [0.5, 0.5], levels: [0, 1], rtp: 0.9 }), /was requested/);
  assert.throws(() => buildStepBand({ p: [0.5, 0.5], levels: [0, null] }), /rtp is required/);
  assert.throws(() => buildStepBand({ p: [0.5, 0.25, 0.25], levels: [0, 0.01, 1] }), /touch zero/);
  assert.throws(() => buildStepBand({ p: [0.9, 0.1], levels: [0, null], rtp: 0.05 }), undefined);
});

test('payout(u,v) is a step in u, a symmetric band in v, zero region pays 0', () => {
  const sb = buildStepBand({ p: P, levels: [0, 0.25, 0.75, 1.5, 2.35] });
  assert.equal(sb.payout(0.1, 0.99), 0);
  assert.equal(sb.payout(0.29999, 0.5), 0);
  assert.ok(Math.abs(sb.payout(0.3, 0.5) - 0.25) < 1e-12);
  assert.ok(Math.abs(sb.payout(0.3, 0) - 0.20) < 1e-12);
  assert.ok(Math.abs(sb.payout(0.999, 1) - 2.40) < 1e-12);
  assert.ok(Math.abs(sb.payout(0.6, 0.25) - 1.475) < 1e-12);
});

test('standalone JS reproduces payout() exactly', () => {
  const sb = buildStepBand({ p: P, levels: [0, 0.25, 0.75, 1.5, null], rtp: 0.97 });
  const fn = new Function(sb.standalone('f') + '\nreturn f;')();
  const rng = new Rng('standalone');
  for (let i = 0; i < 20000; i++) { const u = rng.next(), v = rng.next(); assert.equal(fn(u, v), sb.payout(u, v)); }
});

test('toGame wraps it as an RGS provider that hits the RTP in MC', () => {
  const sb = buildStepBand({ p: P, levels: [0, 0.25, 0.75, 1.5, 2.35] });
  const g = sb.toGame({ id: 'built' });
  assertRtp(monteCarlo(g, { bet: 2500, rounds: 60000 }), 0.97, { z: 4 });
  // the sampled region frequencies match p
  const counts = new Array(P.length).fill(0), N = 100000, rng = new Rng('freq');
  for (let i = 0; i < N; i++) { const u = rng.next(); let k = 0; while (sb.breaks[k + 1] <= u) k++; counts[k]++; }
  counts.forEach((c, i) => assert.ok(Math.abs(c / N - P[i]) < 4 * Math.sqrt(P[i] * (1 - P[i]) / N)));
});

test('shape mode: ratios preserved, scaled to rtp; r follows from the scaled levels', () => {
  const sb = buildStepBand({ p: P, rtp: 0.97, shape: [0, 1, 3, 6, 9.4] });
  assert.ok(Math.abs(sb.rtp - 0.97) < 1e-12);
  assert.ok(Math.abs(sb.levels[2] / sb.levels[1] - 3) < 1e-12);
  assert.ok(Math.abs(sb.levels[4] / sb.levels[1] - 9.4) < 1e-12);
  assert.ok(Math.abs(sb.levels[1] - 0.25) < 1e-12);          // same as the whiteboard set
  assert.ok(Math.abs(sb.r - 0.1 * 0.5) < 1e-12);
  // change rtp only: every level scales, r scales with them
  const sb2 = buildStepBand({ p: P, rtp: 0.90, shape: [0, 1, 3, 6, 9.4] });
  assert.ok(Math.abs(sb2.levels[4] / sb.levels[4] - 0.90 / 0.97) < 1e-12);
  assert.ok(Math.abs(sb2.r / sb.r - 0.90 / 0.97) < 1e-12);
});

test('growth mode: geometric ladder over paying intervals, first interval no-win by default', () => {
  const sb = buildStepBand({ p: P, rtp: 0.97, growth: 2 });
  assert.equal(sb.levels[0], 0);
  for (let i = 2; i < 5; i++) assert.ok(Math.abs(sb.levels[i] / sb.levels[i - 1] - 2) < 1e-12);
  assert.ok(Math.abs(sb.rtp - 0.97) < 1e-12);
  assert.ok(Math.abs(sb.r - 0.1 * sb.levels[1]) < 1e-12);    // smallest gap is c·(2−1) = c
  const noZero = buildStepBand({ p: [0.5, 0.3, 0.2], rtp: 0.95, growth: 3, zero: [false, false, false] });
  assert.ok(noZero.levels.every(a => a > 0) && Math.abs(noZero.rtp - 0.95) < 1e-12);
});

test('exactly one of shape/growth/levels, and rtp required for the solved modes', () => {
  assert.throws(() => buildStepBand({ p: P, rtp: 0.97 }), /exactly one/);
  assert.throws(() => buildStepBand({ p: P, rtp: 0.97, shape: [0, 1, 3, 6, 9.4], growth: 2 }), /exactly one/);
  assert.throws(() => buildStepBand({ p: P, shape: [0, 1, 3, 6, 9.4] }), /rtp is required/);
  assert.throws(() => buildStepBand({ p: P, growth: 2 }), /rtp is required/);
});

test('inverse/maxent: probabilities sum to 1, hit the rtp, and fall monotonically in payout', () => {
  const A = [0, 0.5, 1, 2, 5, 20];
  const p = assignProbabilities({ payouts: A, rtp: 0.95 });
  assert.ok(Math.abs(p.reduce((s, x) => s + x, 0) - 1) < 1e-12);
  assert.ok(Math.abs(p.reduce((s, x, i) => s + x * A[i], 0) - 0.95) < 1e-9);
  for (let i = 1; i < p.length; i++) assert.ok(p[i] < p[i - 1], 'decreasing in payout when rtp < mean');
  const sb = buildFromPayouts({ payouts: A, rtp: 0.95 });
  assert.ok(Math.abs(sb.rtp - 0.95) < 1e-9);
  assert.ok(Math.abs(sb.r - 0.05) < 1e-12);                      // min gap 0.5 → 0.05
  // whiteboard payouts have mean exactly 0.97 → maxent is uniform
  const u = assignProbabilities({ payouts: [0, 0.25, 0.75, 1.5, 2.35], rtp: 0.97 });
  u.forEach(x => assert.ok(Math.abs(x - 0.2) < 1e-9));
});

test('inverse/geometric and weights hit the rtp; order of payouts does not matter', () => {
  const A = [0, 0.5, 1, 2, 5, 20];
  const g = assignProbabilities({ payouts: A, rtp: 0.95, method: 'geometric' });
  assert.ok(Math.abs(g.reduce((s, x, i) => s + x * A[i], 0) - 0.95) < 1e-9);
  for (let i = 2; i < g.length; i++) assert.ok(Math.abs(g[i] / g[i - 1] - g[1] / g[0]) < 1e-9, 'constant ratio');
  const w = assignProbabilities({ payouts: A, rtp: 0.95, method: 'weights', weights: [0, 50, 30, 15, 4, 1] });
  assert.ok(Math.abs(w.reduce((s, x, i) => s + x * A[i], 0) - 0.95) < 1e-12);
  assert.ok(Math.abs(w[1] / w[2] - 50 / 30) < 1e-12);
  const shuffled = assignProbabilities({ payouts: [20, 0, 2, 0.5, 5, 1], rtp: 0.95, method: 'geometric' });
  assert.ok(Math.abs(shuffled[0] - g[5]) < 1e-12 && Math.abs(shuffled[1] - g[0]) < 1e-12);
});

test('inverse validation: rtp must sit strictly inside the payout range; weights need a zero', () => {
  assert.throws(() => assignProbabilities({ payouts: [1, 2, 3], rtp: 0.95 }), /strictly between/);
  assert.throws(() => assignProbabilities({ payouts: [0, 1, 2], rtp: 2 }), /strictly between/);
  assert.throws(() => assignProbabilities({ payouts: [1, 2, 3], rtp: 2, method: 'weights', weights: [1, 1, 1] }), /needs a 0/);
  assert.throws(() => assignProbabilities({ payouts: [0, 1, 1], rtp: 0.5 }), /distinct/);
  // no zero payout is fine for maxent: a game that always pays something
  const p = assignProbabilities({ payouts: [0.5, 1, 2], rtp: 0.9 });
  assert.ok(Math.abs(p.reduce((s, x, i) => s + x * [0.5, 1, 2][i], 0) - 0.9) < 1e-9);
});

test('trapezoid: RTP = Σ Δu·(a_i+a_{i+1})/2 exactly, ramps are continuous, jump at the zero edge', () => {
  const tz = buildTrapezoid({ payouts: [0, 0.5, 1, 2, 5, 20], rtp: 0.95 });
  const trap = tz.p.reduce((s, pi, i) => s + pi * (tz.rows[i].ramp ? (tz.rows[i].ramp[0] + tz.rows[i].ramp[1]) / 2 : 0), 0);
  assert.ok(Math.abs(trap - 0.95) < 1e-9 && Math.abs(tz.rtp - 0.95) < 1e-9);
  assert.equal(tz.level(tz.breaks[1] - 1e-9), 0);                       // zero region flat
  assert.ok(Math.abs(tz.level(tz.breaks[1]) - 0.5) < 1e-9);              // jump to a_0
  assert.ok(Math.abs(tz.level(tz.breaks[2] - 1e-9) - 1) < 1e-6);         // ramp reaches a_1 at the boundary
  assert.ok(Math.abs(tz.level(tz.breaks[2]) - 1) < 1e-9);                // continuous into the next ramp
  assert.ok(Math.abs(tz.level(1 - 1e-12) - 20) < 1e-6);
  assert.ok(Math.abs(tz.r - 0.05) < 1e-12 && tz.knots[0] - tz.r > 0);
  // MC through the real function agrees
  const rng = new Rng('tz'); let s = 0; const N = 300000;
  for (let i = 0; i < N; i++) s += tz.draw(rng).prize;
  assert.ok(Math.abs(s / N - 0.95) < 0.02, `mc ${s / N}`);
  const fn = new Function(tz.standalone('f') + '\nreturn f;')();
  for (let i = 0; i < 20000; i++) { const u = rng.next(), v = rng.next(); assert.ok(Math.abs(fn(u, v) - tz.payout(u, v)) < 1e-12); }
});

test('trapezoid: every prize lies within its ramp ± r and never in (0, a_0 − r)', () => {
  const tz = buildTrapezoid({ payouts: [0, 0.5, 1, 2, 5, 20], rtp: 0.95, method: 'geometric' });
  const rng = new Rng('tz2');
  for (let i = 0; i < 50000; i++) {
    const d = tz.draw(rng);
    if (d.level === 0) assert.equal(d.prize, 0);
    else assert.ok(d.prize >= 0.5 - 0.05 - 1e-12 && Math.abs(d.prize - d.level) <= 0.05 + 1e-12);
  }
  assert.throws(() => buildTrapezoid({ payouts: [0, 0.01, 1, 2], rtp: 0.5 }), /touch zero/);
  assert.throws(() => buildTrapezoid({ payouts: [0, 1], rtp: 0.5 }), /at least two positive/);
});

test('sloped: each band ramps a_i − r → a_i + r, mean a_i, curve monotone, RTP exact', () => {
  const sl = buildSloped({ payouts: [0, 0.5, 1, 2, 5, 20], rtp: 0.95 });
  assert.ok(Math.abs(sl.rtp - 0.95) < 1e-9 && Math.abs(sl.r - 0.05) < 1e-12);
  for (const w of sl.rows) {
    if (!w.band) { assert.equal(sl.level(w.from), 0); continue; }
    assert.ok(Math.abs(sl.level(w.from) - (w.payout - sl.r)) < 1e-9, 'left edge');
    assert.ok(Math.abs(sl.level(w.to - 1e-12) - (w.payout + sl.r)) < 1e-6, 'right edge');
    assert.ok(Math.abs(sl.level((w.from + w.to) / 2) - w.payout) < 1e-9, 'midpoint = payout');
  }
  // monotone on a fine grid
  let prev = -1;
  for (let k = 0; k <= 100000; k++) { const v = sl.level(k / 100000); assert.ok(v >= prev - 1e-12); prev = v; }
  // MC: overall rtp and exact-uniform distribution inside band 2 (payout 1)
  const rng = new Rng('sl'); let s = 0; const N = 300000; const inBand = [];
  for (let i = 0; i < N; i++) { const d = sl.draw(rng); s += d.prize; if (d.prize > 0.9 && d.prize < 1.1) inBand.push(d.prize); }
  assert.ok(Math.abs(s / N - 0.95) < 0.02);
  const m = inBand.reduce((x, y) => x + y, 0) / inBand.length;
  assert.ok(Math.abs(m - 1) < 0.002 && Math.min(...inBand) >= 0.95 - 1e-9 && Math.max(...inBand) <= 1.05 + 1e-9);
  const fn = new Function(sl.standalone('f') + '\nreturn f;')();
  for (let i = 0; i < 20000; i++) { const u = rng.next(); assert.equal(fn(u), sl.level(u)); }
  assert.ok(Math.abs(sl.grid(10000).residual) < 5e-3); // 20x band is ~3 cells wide, so cell rounding can move RTP a few tenths of a point
});
