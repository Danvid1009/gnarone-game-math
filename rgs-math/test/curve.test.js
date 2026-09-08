import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCurve, jitteredDraw, exactRtpAtBetJittered, expectedRounded, halfWidth } from '../src/curve.js';
import { makeTable, rtp, exactRtpAtBet } from '../src/table.js';
import { Rng } from '../src/rng.js';
import { monteCarlo, assertRtp } from '../src/verify.js';
import * as curveBand from '../games/curve-band.js';
import * as jittered from '../games/jittered-table.js';

const N = Number(process.env.TEST_ROUNDS ?? 60000);

test('expectedRounded is the exact mean of round(X), X uniform', () => {
  assert.equal(expectedRounded(7, 7), 7);
  assert.ok(Math.abs(expectedRounded(0, 1) - 0.5) < 1e-12);       // half 0, half 1
  assert.ok(Math.abs(expectedRounded(10.5, 11.5) - 11) < 1e-12);  // all round to 11
  assert.ok(Math.abs(expectedRounded(2, 4) - 3) < 1e-12);         // symmetric
});

test('a symmetric band never moves the mean of a table', () => {
  const t = makeTable([{ prize: 0, p: 0.5 }, { prize: 1.5, p: 0.3 }, { prize: 4, p: 0.2 }]);
  const draw = jitteredDraw(t, { r: 0.1, mode: 'relative' });
  const rng = new Rng('jit');
  let s = 0, sInBand = 0, zeroStaysZero = true;
  for (let i = 0; i < 200000; i++) {
    const d = draw(rng);
    s += d.prize;
    if (d.prize >= d.lo - 1e-12 && d.prize <= d.hi + 1e-12) sInBand++;
    if (d.base === 0 && d.prize !== 0) zeroStaysZero = false;
  }
  assert.ok(zeroStaysZero);
  assert.equal(sInBand, 200000);
  assert.ok(Math.abs(s / 200000 - rtp(t)) < 0.01);
  // exact: at a huge chip the rounding vanishes and jittered == plain
  assert.ok(Math.abs(exactRtpAtBetJittered(t, 1e6, { r: 0.1 }) - rtp(t)) < 1e-6);
});

test('absolute band tapers so prizes stay >= 0 and symmetric', () => {
  assert.equal(halfWidth(0.3, 0.5, 'absolute'), 0.3);
  assert.equal(halfWidth(2, 0.5, 'absolute'), 0.5);
  assert.equal(halfWidth(0, 0.5, 'absolute'), 0);
  assert.throws(() => halfWidth(1, 1.5, 'relative'), /relative r/);
});

test('curve rtp is the trapezoid sum and solveKnot lands the target', () => {
  const c = makeCurve([{ u: 0, a: 0 }, { u: 0.5, a: 0 }, { u: 1, a: 2 }]);
  assert.ok(Math.abs(c.rtp() - 0.5) < 1e-12);        // triangle 0.5 × 2 / 2
  assert.ok(Math.abs(c.hitRate() - 0.5) < 1e-12);
  assert.equal(c.evaluate(0.75), 1);
  const solved = c.solveKnot(2, 0.9);
  assert.ok(Math.abs(solved.rtp() - 0.9) < 1e-12);
  assert.ok(Math.abs(solved.knots[2].a - 3.6) < 1e-12);
  assert.ok(Math.abs(c.scaleTo(0.8).rtp() - 0.8) < 1e-12);
  assert.throws(() => makeCurve([{ u: 0, a: 0 }, { u: 0.9, a: 1 }]), /u=0 to u=1/);
});

test('ramp exact rounded RTP converges to design RTP at large chips', () => {
  const c = curveBand.RAMP;
  assert.ok(Math.abs(c.rtp() - 0.97) < 1e-12);
  assert.ok(Math.abs(c.exactRtpAtBet(1e6) - 0.97) < 1e-6);
  assert.ok(Math.abs(c.exactRtpAtBetBanded(1e6, dispersion.multiplicativeUniform(0.05)) - 0.97) < 1e-4);
  assert.equal(c.evaluate(0.2), 0);
  assert.equal(c.evaluate(0.55), 1);
});

test('step function: RTP is Σ Δu·level, staircase from the ramp keeps 0.97 for any subdivision', () => {
  const st = makeStepCurve({ breaks: [0, 0.5, 1], levels: [0, 2] });
  assert.ok(Math.abs(st.rtp() - 1) < 1e-12);
  assert.equal(st.evaluate(0.49), 0); assert.equal(st.evaluate(0.5), 2);
  assert.ok(Math.abs(st.solveLevel(1, 0.9).levels[1] - 1.8) < 1e-12);
  for (const sub of [1, 2, 5, 20]) {
    const s = stepFromLinear(curveBand.RAMP, sub);
    assert.ok(Math.abs(s.rtp() - 0.97) < 1e-12, `sub=${sub}: ${s.rtp()}`);
    assert.equal(s.levels.length, 5 * sub);
    for (let i = 1; i < s.levels.length; i++) assert.ok(s.levels[i] >= s.levels[i - 1], 'monotone');
  }
  const c = curveBand.CURVE;
  assert.deepEqual(c.breaks, [0, 0.3, 0.425, 0.55, 0.8, 1]);
  assert.deepEqual(c.levels.map(a => +a.toFixed(4)), [0, 0.25, 0.75, 1.5, 2.35]);
  assert.ok(Math.abs(c.exactRtpAtBet(1e6) - 0.97) < 1e-6);
  assert.ok(Math.abs(c.exactRtpAtBetBanded(1e6, curveBand.BAND) - 0.97) < 1e-6);
  // toTable is a valid outcome table with the same RTP
  assert.ok(Math.abs(rtp(c.toTable()) - 0.97) < 1e-12);
});

test('curve-band and jittered-table games hit their targets in MC', () => {
  assertRtp(monteCarlo(curveBand.game, { bet: 2500, rounds: N }), 0.97, { z: 4 });
  assertRtp(monteCarlo(jittered.game, { bet: 2500, rounds: N }), 0.75, { z: 4 });
  const r = curveBand.game.simulate({ bet: 500, seed: 'cb' });
  assert.ok(r.math.prize >= r.math.band[0] - 1e-12 && r.math.prize <= r.math.band[1] + 1e-12);
  assert.ok(curveBand.CURVE.levels.includes(r.math.level));
  assert.equal(r.totalWinAmount, Math.round(500 * r.math.prize));
});

test('plain table exactRtpAtBet equals jittered with the none rule', () => {
  const t = jittered.OUTCOME_TABLE;
  for (const bet of [10, 50, 250]) assert.ok(Math.abs(exactRtpAtBet(t, bet) - exactRtpAtBetJittered(t, bet, dispersion.none())) < 1e-12);
});

test('fixedGap: r = 0.1 × smallest non-zero gap, bands disjoint and clear of zero, zero has no band', () => {
  assert.ok(Math.abs(minPayoutGap([0, 0.2, 0.5, 1.5, 4, 20, 100]) - 0.3) < 1e-12);
  assert.ok(Math.abs(jittered.R - 0.03) < 1e-12);
  assert.ok(Math.abs(curveBand.R - 0.05) < 1e-12);          // levels .25/.75/1.5/2.35 → gap .5
  const rule = jittered.JITTER;
  assert.deepEqual(rule.support(0), [0, 0]);
  assert.deepEqual(rule.support(1.5).map(x => +x.toFixed(6)), [1.47, 1.53]);
  const anchors = [0.2, 0.5, 1.5, 4, 20, 100];
  for (let i = 1; i < anchors.length; i++) assert.ok(rule.support(anchors[i])[0] > rule.support(anchors[i - 1])[1]);
  assert.ok(rule.support(0.2)[0] > 0, 'lowest band clear of zero');
  assert.ok(curveBand.BAND.support(0.25)[0] > 0);
  // a table whose lowest prize would be swallowed by r is rejected
  assert.throws(() => dispersion.fixedGap([0.01, 1, 2]), /touch zero/);
  const draw = jitteredDraw(jittered.OUTCOME_TABLE);
  const rng = new Rng('fg');
  for (let i = 0; i < 50000; i++) {
    const d = draw(rng);
    if (d.base === 0) assert.equal(d.prize, 0);
    else assert.ok(d.prize > 0 && d.prize >= d.base - 0.03 - 1e-12 && d.prize <= d.base + 0.03 + 1e-12);
  }
  assert.ok(verifyConditionalMean(curveBand.CURVE, curveBand.BAND, { samples: 20000 }).ok);
  // and on the step game, no simulated prize ever lands in (0, lowest−r)
  for (let i = 0; i < 20000; i++) {
    const p = curveBand.game.simulate({ bet: 100, seed: 'nz' + i }).math.prize;
    assert.ok(p === 0 || p >= 0.25 - 0.05 - 1e-12);
  }
});

// ── generalised two-layer framework ──────────────────────────────────────────────────
import { dispersion, verifyConditionalMean, discretize, toRule, minPayoutGap, makeStepCurve, stepFromLinear } from '../src/curve.js';

test('every built-in dispersion rule satisfies E[B|U=u] = A(u) on the whiteboard curve', () => {
  const c = curveBand.RAMP;
  for (const rule of [dispersion.none(), dispersion.multiplicativeUniform(0.05), dispersion.multiplicativeUniform(0.5), dispersion.additiveUniform(0.05), dispersion.additiveUniform(0.4)]) {
    const v = verifyConditionalMean(c, rule, { samples: 8000 });
    assert.ok(v.ok, `${rule.name}: worst rel err ${v.worstRelErr} at ${JSON.stringify(v.worstAt)}, negatives ${v.negative}`);
  }
});

test('an un-tapered additive band goes negative near the zero crossing and is caught', () => {
  const v = verifyConditionalMean(curveBand.RAMP, dispersion.additiveUniform(0.3, { taper: false }), { samples: 2000 });
  assert.ok(v.negative > 0 && !v.ok);
});

test('a custom rule with the right conditional mean passes; a biased one fails', () => {
  // two-point rule: pays 0.5A or 1.5A with equal probability — mean A
  const twoPoint = { name: 'two-point', support: a => [0.5 * a, 1.5 * a], sample: (a, u, rng) => (rng.next() < 0.5 ? 0.5 * a : 1.5 * a) };
  // two-point has sd 0.5·A per sample: 40k samples puts 1% tolerance at 4 SE
  assert.ok(verifyConditionalMean(curveBand.RAMP, twoPoint, { samples: 40000 }).ok);
  const biased = { name: 'biased', support: a => [a, 1.2 * a], sample: (a, u, rng) => a * (1 + 0.2 * rng.next()) };
  assert.ok(!verifyConditionalMean(curveBand.RAMP, biased, { samples: 4000 }).ok);
  // and MC through the curve with the custom rule still lands on R*
  const rng = new Rng('custom');
  const draw = curveBand.RAMP.draw(twoPoint);
  let s = 0; const M = 200000;
  for (let i = 0; i < M; i++) s += draw(rng).prize;
  assert.ok(Math.abs(s / M - 0.97) < 0.02);
});

test('discrete N-value grid: midpoint reading reproduces the integral, left reading biases low', () => {
  const c = curveBand.RAMP;
  const mid = discretize(c, 100000);
  assert.ok(Math.abs(mid.rtp - c.rtp()) < 1e-9, `midpoint rtp ${mid.rtp}`);
  assert.deepEqual(mid.knotValues.map(k => k.D), [0, 30000, 42500, 55000, 80000, 100000]);
  const left = discretize(c, 100000, { point: 'left' });
  assert.ok(left.rtp < c.rtp() && c.rtp() - left.rtp < 2e-5);
  const coarse = discretize(c, 1000);
  assert.ok(Math.abs(coarse.rtp - c.rtp()) < 1e-9, 'knots on cell boundaries => exact at N=1000 too');
});

test('legacy {r, mode} shorthand maps onto the rule objects', () => {
  assert.equal(toRule({ r: 0.05 }).name, 'multiplicative-uniform');
  assert.equal(toRule({ r: 0.05, mode: 'absolute' }).name, 'additive-uniform (tapered)');
  assert.equal(toRule(curveBand.CURVE).name, 'fixed-gap');
  assert.equal(toRule(undefined).name, 'none');
});
