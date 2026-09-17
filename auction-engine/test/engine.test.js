import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAuction, buildBox } from '../src/engine.js';
import { buildPayout } from '../../payout-engine/src/engine.js';
import { buildLadder } from '../../stepper-engine/src/engine.js';
import { Rng } from '../src/rng.js';

const close = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;
const SIZES = { small: 5, medium: 10, large: 25, xl: 100 };

test('the ladder is the stepper ladder: same rungs, survival, event table (three workbook sheets + all four locker sizes)', () => {
  for (const M of [10, 25, 100, 5]) for (const rtp of [0.97, 0.95]) {
    const A = buildAuction({ rtp, maxWin: M, steps: 10 }), L = buildLadder({ rtp, maxWin: M, steps: 10 });
    assert.deepEqual(A.bids, L.returns); assert.deepEqual(A.survival, L.survival); assert.deepEqual(A.cum, L.cum); assert.deepEqual(A.p, L.p);
    for (let k = 1; k <= 10; k++) assert.ok(close(A.survival[k] * A.bids[k - 1], rtp), `G_k·c_k at ${k}`);
    // the edge is taken on the first bid only; every later bid is fair
    assert.ok(close(A.hazard[0], rtp / A.bids[0]));
    for (let k = 1; k < 10; k++) assert.ok(close(A.hazard[k] * A.bids[k], A.bids[k - 1]), `bid ${k + 1} is EV-neutral`);
  }
});

test('the locker is a Single Shot table with mean exactly 1; matches payout-engine band for band', () => {
  const B = buildBox({ payouts: [0.25, 0.5, 1, 2, 5] });
  const S = buildPayout({ payouts: [0.25, 0.5, 1, 2, 5], rtp: 1, method: 'maxent' });
  assert.ok(close(B.p.reduce((s, x) => s + x, 0), 1)); assert.ok(close(B.mean, 1));
  B.p.forEach((x, i) => assert.ok(close(x, S.p[i]), `band ${i}`)); assert.ok(close(B.r, S.r)); assert.equal(B.r, 0.025);
  const rng = new Rng('box'); for (let i = 0; i < 20000; i++) { const v = rng.next(); assert.ok(close(B.multiplier(v), S.payout(v))); }
  // conditional mean inside each band is the listed multiple (midpoint rule is exact for a straight ramp)
  for (const b of B.bands) { const n = 1000; let s = 0; for (let j = 0; j < n; j++) s += B.multiplier(b.from + (b.to - b.from) * (j + 0.5) / n); assert.ok(close(s / n, b.multiple, 1e-9), `E[X | band ${b.index}]`); }
  // decreasing probability with increasing multiple (maxent)
  for (let i = 1; i < B.p.length; i++) assert.ok(B.p[i] < B.p[i - 1]);
  // geometric and given probabilities also work; a locker that is not mean 1 is rejected by the ladder
  assert.ok(close(buildBox({ payouts: [0.5, 1, 3], method: 'geometric' }).mean, 1));
  assert.ok(close(buildBox({ payouts: [0.5, 1, 2], probabilities: [0.5, 0.25, 0.25] }).mean, 1));
  assert.throws(() => buildAuction({ rtp: 0.95, maxWin: 10, steps: 10, box: { payouts: [0.5, 1, 2], mean: 1.1 } }), /mean 1/);
});

test('every stopping rule has exact RTP = rtp by summation, for all four sizes; a flat locker is the stepper', () => {
  for (const M of Object.values(SIZES)) {
    const A = buildAuction({ rtp: 0.95, maxWin: M, steps: 10 });
    for (let k = 1; k <= 10; k++) {
      assert.ok(close(A.rtpOfStrategy(k), 0.95), `size ${M} take after ${k}`);
      // by hand: Σ_{K ≥ k} P(K) · c_k · Σ_j p_j a_j
      let s = 0; for (let K = k; K <= 10; K++) s += A.p[K] * A.bids[k - 1] * A.box.mean; assert.ok(close(s, 0.95));
      assert.ok(A.varianceOfStrategy(k) > 0);
    }
    const F = buildAuction({ rtp: 0.95, maxWin: M, steps: 10, box: false });
    for (let k = 1; k <= 10; k++) { assert.ok(close(F.rtpOfStrategy(k), 0.95)); assert.equal(F.settle(0.999, k), F.bids[k - 1]); }
  }
});

test('midpoint integration of settle(u, s) over u returns the rtp (the standalone payout function is exact)', () => {
  const A = buildAuction({ rtp: 0.95, maxWin: 25, steps: 10 });
  const N = 400000;
  for (const s of [1, 4, 7, 10]) { let tot = 0; for (let d = 0; d < N; d++) tot += A.settle((d + 0.5) / N, s); assert.ok(Math.abs(tot / N - 0.95) < 2e-4, `s=${s}: ${tot / N}`); }
});

test('the recycled residual is uniform and independent of K', () => {
  const A = buildAuction({ rtp: 0.95, maxWin: 10, steps: 10 });
  const rng = new Rng('resid'); const n = 300000;
  const byK = Array.from({ length: 11 }, () => ({ n: 0, bands: new Array(5).fill(0), sumV: 0 }));
  for (let i = 0; i < n; i++) { const { K, v, band } = A.draw(rng.next()); const b = byK[K]; b.n++; b.bands[band]++; b.sumV += v; }
  for (let K = 0; K <= 10; K++) {
    const b = byK[K]; if (b.n < 2000) continue;
    assert.ok(Math.abs(b.sumV / b.n - 0.5) < 4 * Math.sqrt(1 / 12 / b.n), `mean of v | K=${K}`);
    b.bands.forEach((cnt, j) => { const p = A.box.p[j]; assert.ok(Math.abs(cnt / b.n - p) < 4 * Math.sqrt(p * (1 - p) / b.n), `band ${j} | K=${K}`); });
  }
});

test('simulate: all stopping rules within 4 SE of rtp for all four sizes; exact stdev matches', () => {
  for (const M of Object.values(SIZES)) {
    const A = buildAuction({ rtp: 0.95, maxWin: M, steps: 10 });
    for (const [k, policy] of [[1, j => j >= 1], [4, j => j >= 4], [9, j => j >= 9], [10, () => false]]) {
      const s = A.simulate({ rounds: 150000, seed: `p${M}${k}`, policy });
      assert.ok(Math.abs(s.rtp - 0.95) < 4 * s.se, `max ${M} take after ${k}: ${s.rtp} se ${s.se}`);
      assert.ok(Math.abs(s.stdev - Math.sqrt(A.varianceOfStrategy(k))) / s.stdev < 0.05, `stdev max ${M} k ${k}`);
      assert.ok(Math.abs(s.outbidFreq - (1 - A.survival[k])) < 0.01);
    }
  }
});

test('round state machine follows the RGS stepper shape and reveals the locker on the hammer', () => {
  const A = buildAuction({ rtp: 0.95, maxWin: 10, steps: 10 });
  // u inside "outbid after 2", residual 0.6 → lands in the 1x band
  const u = A.cum[2] + 0.6 * (A.cum[3] - A.cum[2]);
  const r = A.start(u, { bet: 125 });
  assert.equal(r._crashStep, 2); assert.equal(r._locker.band, 2);
  let v = r.view(); assert.equal(v.currentStep, 0); assert.deepEqual(v.nextAction, ['CONTINUE']); assert.equal(v.locker, null);
  v = r.bid(); assert.equal(v.currentStep, 1); assert.equal(v.steps[0].outcome, 'SAFE'); assert.equal(v.currentPayout, Math.round(125 * A.bids[0])); assert.deepEqual(v.nextAction, ['CONTINUE', 'CASH_OUT']);
  v = r.continue_(); assert.equal(v.currentStep, 2); assert.equal(v.currentPayout, Math.round(125 * A.bids[1]));
  v = r.bid(); assert.equal(v.steps[2].outcome, 'CRASH'); assert.equal(v.totalWinAmount, 0); assert.equal(v.roundEnded, true); assert.deepEqual(v.nextAction, ['COLLECT']); assert.equal(v.locker, null);
  assert.throws(() => r.bid(), /ended/);
  // take the locker after one bid: contents = round(currentPayout × X)
  const r2 = A.start(u, { bet: 125 }); r2.bid(); const w = r2.take();
  assert.equal(w.roundEnded, true); assert.deepEqual(w.nextAction, ['COLLECT']); assert.ok(w.locker); assert.equal(w.locker.band, 2);
  assert.equal(w.totalWinAmount, Math.round(Math.round(125 * A.bids[0]) * w.locker.multiplier)); assert.equal(w.totalWinAmount, w.locker.contents);
  assert.ok(Math.abs(w.locker.multiplier - 1) <= A.box.r + 1e-12);
  assert.throws(() => A.start(u).take(), /before the first bid/);
  // the top rung hammers automatically
  const r3 = A.start(0.9999, { bet: 100 }); let g; for (let i = 0; i < 10; i++) g = r3.bid();
  assert.equal(g.roundEnded, true); assert.ok(g.locker); assert.equal(g.totalWinAmount, Math.round(1000 * g.locker.multiplier)); assert.equal(g.locker.band, 4);
});

test('standalone JS matches settle(u, s) for every s', () => {
  for (const M of [5, 100]) {
    const A = buildAuction({ rtp: 0.95, maxWin: M, steps: 10 });
    const fn = new Function(A.standalone('f') + '\nreturn f;')();
    const rng = new Rng('sa'); for (let i = 0; i < 30000; i++) { const u = rng.next(), s = 1 + (i % 10); assert.ok(close(fn(u, s), A.settle(u, s))); }
    const F = buildAuction({ rtp: 0.95, maxWin: M, steps: 10, box: false }), fnF = new Function(F.standalone('f') + '\nreturn f;')();
    for (let i = 0; i < 5000; i++) { const u = rng.next(), s = 1 + (i % 10); assert.equal(fnF(u, s), F.settle(u, s)); }
  }
});

test('validation', () => {
  assert.throws(() => buildAuction({ rtp: 0.95, returns: [0.9, 2] }), /must exceed rtp/);
  assert.throws(() => buildAuction({ rtp: 0.95, returns: [2, 1.5] }), /strictly increase/);
  assert.throws(() => buildAuction({ rtp: 1.2, maxWin: 10, steps: 10 }), /rtp must be/);
  assert.throws(() => buildAuction({ rtp: 0.95, maxWin: 10, steps: 10, box: { payouts: [0.01, 0.2, 5] } }), /reach zero/);
  assert.throws(() => buildBox({ payouts: [2, 3] }), /strictly between/);
  const A = buildAuction({ rtp: 0.96, returns: [1.1, 1.25, 1.5, 2, 3, 5], box: { payouts: [0.5, 1, 2, 4] } });
  assert.equal(A.steps, 6); for (let k = 1; k <= 6; k++) assert.ok(close(A.rtpOfStrategy(k), 0.96));
});
