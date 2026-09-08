import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPayout, assignProbabilities } from '../src/engine.js';
import { Rng } from '../src/rng.js';

const P = [0, 0.5, 1, 2, 5, 20], RTP = 0.95;
const close = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

test('all three methods satisfy Σp = 1 and Σp·a = rtp exactly', () => {
  for (const [method, weights] of [['maxent'], ['geometric'], ['weights', [0, 50, 30, 15, 4, 1]]]) {
    const { p } = assignProbabilities(P, RTP, method, weights);
    assert.ok(close(p.reduce((s, x) => s + x, 0), 1));
    assert.ok(close(p.reduce((s, x, i) => s + x * P[i], 0), RTP), method);
    assert.ok(p.every(x => x > 0));
  }
});

test('method shapes: maxent decreasing, geometric constant ratio, weights keep the ratios', () => {
  const m = assignProbabilities(P, RTP, 'maxent').p;
  for (let i = 1; i < m.length; i++) assert.ok(m[i] < m[i - 1]);
  const g = assignProbabilities(P, RTP, 'geometric').p;
  for (let i = 2; i < g.length; i++) assert.ok(close(g[i] / g[i - 1], g[1] / g[0]));
  const w = assignProbabilities(P, RTP, 'weights', [0, 50, 30, 15, 4, 1]).p;
  assert.ok(close(w[1] / w[2], 50 / 30) && close(w[4] / w[5], 4));
});

test('r = fraction × smallest non-zero gap; bands disjoint and clear of zero', () => {
  const e = buildPayout({ payouts: P, rtp: RTP });
  assert.ok(close(e.gap, 0.5) && close(e.r, 0.05));
  for (let i = 2; i < e.bands.length; i++) assert.ok(e.bands[i].range[0] > e.bands[i - 1].range[1]);
  assert.ok(e.bands[1].range[0] > 0);
  assert.throws(() => buildPayout({ payouts: [0, 0.01, 1, 2], rtp: 0.5 }), /reach zero/);
  assert.throws(() => buildPayout({ payouts: P, rtp: RTP, fraction: 0.6 }), /fraction/);
});

test('payout(u): ramp a_i − r → a_i + r per band, midpoint = a_i, monotone, zero band flat', () => {
  const e = buildPayout({ payouts: P, rtp: RTP });
  for (const b of e.bands) {
    if (b.payout === 0) { assert.equal(e.payout(b.from), 0); assert.equal(e.payout((b.from + b.to) / 2), 0); continue; }
    assert.ok(close(e.payout(b.from), b.payout - e.r));
    assert.ok(close(e.payout(b.to - 1e-12), b.payout + e.r, 1e-6));
    assert.ok(close(e.payout((b.from + b.to) / 2), b.payout));
  }
  let prev = -1;
  for (let k = 0; k < 200000; k++) { const v = e.payout(k / 200000); assert.ok(v >= prev - 1e-12); prev = v; }
  assert.throws(() => e.payout(1.5), /u must be/);
});

test('simulate: rtp within 4 SE, per-band means within 0.002 of a_i, in-band range respected', () => {
  for (const method of ['maxent', 'geometric', 'weights']) {
    const e = buildPayout({ payouts: P, rtp: RTP, method, weights: [0, 50, 30, 15, 4, 1] });
    const s = e.simulate({ rounds: 200000, seed: 't:' + method });
    assert.ok(Math.abs(s.rtp - RTP) < 4 * s.se, `${method}: ${s.rtp} vs ${RTP} (se ${s.se})`);
    for (const b of s.perBand) {
      if (b.n < 200) continue;
      assert.ok(Math.abs(b.mean - b.payout) < 0.002, `${method} band ${b.band}: mean ${b.mean}`);
      if (b.payout > 0) assert.ok(b.min >= b.payout - e.r - 1e-9 && b.max <= b.payout + e.r + 1e-9);
      assert.ok(Math.abs(b.freq - e.p[b.band]) < 4 * Math.sqrt(e.p[b.band] * (1 - e.p[b.band]) / s.rounds));
    }
  }
});

test('standalone JS reproduces payout() bit for bit', () => {
  const e = buildPayout({ payouts: P, rtp: RTP, method: 'geometric' });
  const fn = new Function(e.standalone('f') + '\nreturn f;')();
  const rng = new Rng('sa');
  for (let i = 0; i < 50000; i++) { const u = rng.next(); assert.equal(fn(u), e.payout(u)); }
});

test('input order does not matter; given probabilities are validated', () => {
  const a = buildPayout({ payouts: P, rtp: RTP }), b = buildPayout({ payouts: [20, 0, 2, 0.5, 5, 1], rtp: RTP });
  assert.deepEqual(a.payouts, b.payouts); assert.deepEqual(a.p, b.p);
  const g = buildPayout({ payouts: P, probabilities: a.p });
  assert.ok(close(g.rtp, RTP));
  assert.throws(() => buildPayout({ payouts: P, probabilities: [0.5, 0.5, 0, 0, 0, 0] }), /must be > 0/);
  assert.throws(() => buildPayout({ payouts: P, probabilities: [0.5, 0.4, 0.1, 0.1, 0.1, 0.1] }), /sum to/);
  assert.throws(() => buildPayout({ payouts: P, rtp: RTP, probabilities: [0.3, 0.3, 0.2, 0.1, 0.05, 0.05] }), /not the requested/);
});

test('grid: integer N-value RNG reproduces the RTP up to cell rounding', () => {
  const e = buildPayout({ payouts: P, rtp: RTP });
  const g = e.grid(10000);
  assert.deepEqual(g.boundaries.map(x => +x.toFixed(2)), e.breaks.map(x => +(x * 10000).toFixed(2)));
  assert.ok(Math.abs(g.residual) < 5e-3);
  assert.ok(Math.abs(e.grid(1000000).residual) < 5e-5);
});

test('validation of inputs', () => {
  assert.throws(() => buildPayout({ payouts: [1, 2, 3], rtp: 0.95 }), /strictly between/);
  assert.throws(() => buildPayout({ payouts: [0, 1, 1], rtp: 0.5 }), /distinct/);
  assert.throws(() => buildPayout({ payouts: [0, 1], rtp: 0.5 }), /two positive/);
  assert.throws(() => buildPayout({ payouts: P, rtp: RTP, method: 'weights' }), /weights must have/);
  assert.throws(() => buildPayout({ payouts: [1, 2, 3], rtp: 2, method: 'weights', weights: [1, 1, 1] }), /needs a 0/);
  assert.throws(() => buildPayout({ payouts: P, rtp: RTP, method: 'nope' }), /unknown method/);
});
