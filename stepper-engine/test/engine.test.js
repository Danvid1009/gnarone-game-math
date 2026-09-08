import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLadder } from '../src/engine.js';
import { Rng } from '../src/rng.js';

const close = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

// Values copied from "stepper crash game ver 2.xlsx"
const SHEETS = {
  easy:   { max: 10,  returns: [1.26, 1.58, 2, 2.51, 3.16, 3.98, 5.01, 6.31, 7.94, 10],          p0: 0.23015873015873023, p1: 0.15591721920835844, pTop: 0.097,  rn9max: 0.90299999999999991 },
  medium: { max: 25,  returns: [1.38, 1.9, 2.63, 3.62, 5, 6.9, 9.52, 13.13, 18.12, 25],           p0: 0.29710144927536231, p1: 0.19237223493516398, pTop: 0.0388, rn9max: 0.96120000000000005 },
  hard:   { max: 100, returns: [1.58, 2.51, 3.98, 6.31, 10, 15.85, 25.12, 39.81, 63.1, 100],      p0: 0.38607594936708867, p1: 0.22746986736597902, pTop: 0.0097, rn9max: 0.99029999999999996 },
};

test('reproduces the three workbook sheets exactly', () => {
  for (const [name, S] of Object.entries(SHEETS)) {
    const L = buildLadder({ rtp: 0.97, maxWin: S.max, steps: 10 });
    assert.deepEqual(L.returns, S.returns, `${name} returns`);
    assert.ok(close(L.p[0], S.p0), `${name} instant crash`);
    assert.ok(close(L.p[1], S.p1), `${name} crash after 1`);
    assert.ok(close(L.p[10], S.pTop), `${name} golden egg`);
    assert.ok(close(L.cum[10], S.rn9max), `${name} RN max at step 9`);
    assert.ok(close(L.p.reduce((s, x) => s + x, 0), 1));
    for (let k = 1; k <= 10; k++) assert.ok(close(L.survival[k] * L.returns[k - 1], 0.97), `${name} G_k·c_k at ${k}`);
    assert.ok(close(L.stepMultiple, Math.pow(S.max, 0.1)));
  }
});

test('every fixed stopping rule has exact RTP = rtp; probabilities and hazards are consistent', () => {
  const L = buildLadder({ rtp: 0.97, maxWin: 25, steps: 10 });
  for (let k = 1; k <= 10; k++) assert.ok(close(L.rtpOfStrategy(k), 0.97));
  // hazards multiply back to survival
  let g = 1;
  L.hazard.forEach((h, i) => { g *= h; assert.ok(close(g, L.survival[i + 1])); });
  // event probs are differences of survival
  for (let k = 0; k < 10; k++) assert.ok(close(L.p[k], L.survival[k] - L.survival[k + 1]));
});

test('crashStep(u) follows the RN intervals; frequencies match', () => {
  const L = buildLadder({ rtp: 0.97, maxWin: 10, steps: 10 });
  for (const row of L.table) {
    assert.equal(L.crashStep(row.rnMin), row.step);
    assert.equal(L.crashStep(row.rnMax - 1e-12), row.step);
  }
  const rng = new Rng('freq'); const N = 200000, counts = new Array(11).fill(0);
  for (let i = 0; i < N; i++) counts[L.crashStep(rng.next())]++;
  counts.forEach((n, k) => assert.ok(Math.abs(n / N - L.p[k]) < 4 * Math.sqrt(L.p[k] * (1 - L.p[k]) / N), `event ${k}`));
});

test('simulate: all stopping rules within 4 SE of rtp, for all three sheets', () => {
  for (const S of Object.values(SHEETS)) {
    const L = buildLadder({ rtp: 0.97, maxWin: S.max, steps: 10 });
    for (const policy of [j => j >= 1, j => j >= 4, j => j >= 9, () => false]) {
      const s = L.simulate({ rounds: 150000, seed: `p${S.max}`, policy });
      assert.ok(Math.abs(s.rtp - 0.97) < 4 * s.se, `max ${S.max}: ${s.rtp} se ${s.se}`);
    }
  }
});

test('round state machine follows the RGS stepper shape', () => {
  const L = buildLadder({ rtp: 0.97, maxWin: 10, steps: 10 });
  // u inside "crash after 2" → survive 2 rungs, crash on the 3rd
  const u = (L.cum[2] + L.cum[3]) / 2;
  const r = L.start(u, { bet: 125 });
  assert.equal(r._crashStep, 2);
  let v = r.view(); assert.equal(v.currentStep, 0); assert.deepEqual(v.nextAction, ['CONTINUE']); assert.ok(v.steps.every(s => s.outcome === 'UNDECIDED'));
  v = r.continue_(); assert.equal(v.currentStep, 1); assert.equal(v.steps[0].outcome, 'SAFE'); assert.equal(v.currentPayout, Math.round(125 * 1.26)); assert.deepEqual(v.nextAction, ['CONTINUE', 'CASH_OUT']);
  v = r.continue_(); assert.equal(v.currentStep, 2); assert.equal(v.currentPayout, Math.round(125 * 1.58));
  v = r.continue_(); assert.equal(v.steps[2].outcome, 'CRASH'); assert.equal(v.currentPayout, 0); assert.equal(v.totalWinAmount, 0); assert.equal(v.roundEnded, true); assert.deepEqual(v.nextAction, ['COLLECT']);
  assert.throws(() => r.continue_(), /ended/);
  // cash out path
  const r2 = L.start(u, { bet: 125 }); r2.continue_(); const w = r2.cashOut();
  assert.equal(w.totalWinAmount, Math.round(125 * 1.26)); assert.equal(w.roundEnded, true);
  // golden egg
  const r3 = L.start(0.999, { bet: 100 }); let g; for (let i = 0; i < 10; i++) g = r3.continue_();
  assert.equal(g.totalWinAmount, 1000); assert.equal(g.roundEnded, true);
});

test('standalone JS matches crashStep', () => {
  const L = buildLadder({ rtp: 0.97, maxWin: 100, steps: 10 });
  const fn = new Function(L.standalone('f') + '\nreturn f;')();
  const rng = new Rng('sa');
  for (let i = 0; i < 50000; i++) { const u = rng.next(); assert.equal(fn(u), L.crashStep(u)); }
});

test('explicit returns and validation', () => {
  const L = buildLadder({ rtp: 0.96, returns: [1.1, 1.25, 1.5, 2, 3, 5] });
  assert.equal(L.steps, 6); assert.ok(close(L.p.reduce((s, x) => s + x, 0), 1));
  for (let k = 1; k <= 6; k++) assert.ok(close(L.rtpOfStrategy(k), 0.96));
  assert.throws(() => buildLadder({ rtp: 0.97, returns: [0.9, 2] }), /must exceed rtp/);
  assert.throws(() => buildLadder({ rtp: 0.97, returns: [2, 1.5] }), /strictly increase/);
  assert.throws(() => buildLadder({ rtp: 1.2, maxWin: 10, steps: 10 }), /rtp must be/);
  assert.throws(() => buildLadder({ rtp: 0.97, maxWin: 10 }), /integer steps/);
});
