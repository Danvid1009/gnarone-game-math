// Two-layer payout model.
//
//   U ~ Uniform(0,1)          base draw (or D = floor(N·U) on an N-value RNG grid)
//   A = A(U)                  deterministic design curve — controls RTP and payout shape
//   B ~ F(· | A, U)           conditional dispersion — controls feel/variance only
//
// Constraints:   ∫₀¹ A(u) du = R*        and        E[B | U = u] = A(u)
// Consequence:   E[B] = E[E[B|U]] = E[A(U)] = R*,  and for stake S, E[S·B] = S·R*.
//
// So knots, interpolation and the within-band distribution can all change freely as
// long as those two hold. `makeCurve` owns the first constraint, `dispersion.*` rules
// own the second, and `verifyConditionalMean` checks any custom rule numerically.
//
// A discrete table maps u ~ U[0,1) to one of a few fixed prizes A_i: a step function.
// Two constructions in this file keep the same expected value but make the paid amount
// continuous:
//
//   Jittered table   row i drawn as before, then a second uniform v spreads the prize
//                    over a symmetric neighbourhood:  B_i = A_i + r_i·(2v − 1).
//                    A symmetric band has mean A_i, so Σ p_i·E[B_i] = Σ p_i·A_i: the
//                    RTP of the underlying table, untouched.
//
//   Curve            u is mapped through a piecewise-LINEAR function A(u) drawn through a
//                    few knots (the whiteboard: flat zero to 30k, then rising to A* at
//                    100k). RTP = ∫₀¹ A(u) du, which for straight segments is just the sum
//                    of trapezoid areas — exact, no simulation. An optional band r·(2v−1)
//                    around the curve is again symmetric, so it changes nothing.
//
// Both keep one rounding point (to minor units) and both report what that rounding costs
// at each chip size, exactly, so "well refined" stays refined at 10-cent bets.

import { toMinor } from './table.js';
import { Rng } from './rng.js';

// ───────────────────────── shared: rounding a uniform interval ─────────────────────────

/** E[round(X)] for X ~ U[x0, x1] in minor units; exact. */
export function expectedRounded(x0, x1) {
  if (x1 < x0) [x0, x1] = [x1, x0];
  const len = x1 - x0;
  if (len < 1e-12) return Math.round(x0);
  let acc = 0;
  for (let k = Math.round(x0); k <= Math.round(x1); k++) {
    const lo = Math.max(x0, k - 0.5), hi = Math.min(x1, k + 0.5);
    if (hi > lo) acc += k * (hi - lo);
  }
  return acc / len;
}

/** Symmetric half-width for a prize `a`: relative (r·a) or absolute, tapered so a − r ≥ 0. */
export function halfWidth(a, r, mode) {
  if (a <= 0) return 0;
  if (mode === 'relative') {
    if (r < 0 || r > 1) throw new Error(`relative r must be in [0,1], got ${r}`);
    return r * a;
  }
  if (mode === 'absolute') return Math.min(r, a); // taper keeps the band symmetric and ≥ 0
  throw new Error(`unknown band mode "${mode}"`);
}

// ───────────────────────────────── jittered tables ─────────────────────────────────────

function resolveR(r, row, i) {
  if (typeof r === 'function') return r(row, i);
  if (Array.isArray(r)) return r[i] ?? 0;
  return r;
}

/**
 * draw(rng) -> { index, row, base, prize, lo, hi, u, v }
 * The row draw uses one uniform, the neighbourhood a second. Zero rows never jitter.
 */
export function tableRule(table, rule) {
  if (rule === undefined) return dispersion.fixedGap(table.map(r => r.prize));
  if (rule && typeof rule.sample !== 'function' && rule.mode === undefined && rule.r !== undefined) {
    // legacy per-row shorthand {r, mode} — keep supporting relative/absolute with resolveR
    return legacyRowRule(table, rule);
  }
  return toRule(rule);
}
function legacyRowRule(table, { r = 0, mode = 'relative' }) {
  const bands = table.map((row, i) => { const h = halfWidth(row.prize, resolveR(r, row, i), mode); return [row.prize - h, row.prize + h]; });
  return {
    name: `${mode}-uniform (per-row)`, r, uniform: true,
    support: (a, u, i) => bands[i] ?? [a, a],
    sample: (a, u, rng, i) => { const [lo, hi] = bands[i]; return lo + (hi - lo) * rng.next(); },
  };
}

export function jitteredDraw(table, rule) {
  rule = tableRule(table, rule);
  const cum = [];
  let acc = 0;
  for (const row of table) { acc += row.p; cum.push(acc); }
  cum[cum.length - 1] = 1;
  return function draw(rng) {
    const u = rng.next();
    let index = cum.length - 1;
    for (let i = 0; i < cum.length; i++) if (u < cum[i]) { index = i; break; }
    const row = table[index];
    const [lo, hi] = rule.support(row.prize, u, index);
    const prize = rule.sample(row.prize, u, rng.derive ? rng.derive('dispersion:' + index + ':' + u) : rng, index);
    return { index, row, base: row.prize, prize, lo, hi, u, rule: rule.name };
  };
}

/** Realised RTP at a chip size for a jittered table, exact for uniform rules. */
export function exactRtpAtBetJittered(table, bet, rule) {
  rule = tableRule(table, rule);
  let s = 0;
  table.forEach((row, i) => {
    if (rule.uniform) { const [lo, hi] = rule.support(row.prize, null, i); s += row.p * expectedRounded(bet * lo, bet * hi); }
    else if (rule.expectedRounded) s += row.p * rule.expectedRounded(bet, row.prize, null, i);
    else throw new Error(`exactRtpAtBetJittered: rule "${rule.name}" is not uniform and has no expectedRounded()`);
  });
  return s / bet;
}

// ───────────────────────────── dispersion rules F(·|A,U) ───────────────────────────────
//
// A rule is { name, support(a, u) -> [lo, hi], sample(a, u, rng) -> b } with the invariant
// E[sample(a,u,·)] = a. `uniform: true` marks rules whose conditional law is uniform on the
// support, which lets the rounding report stay closed-form; other rules may supply
// expectedRounded(bet, a, u) themselves or fall back to sampling.

export const dispersion = {
  /** B = A. The degenerate rule; the plain curve. */
  none: () => ({ name: 'none', uniform: true, support: a => [a, a], sample: a => a }),

  /** B = A·(1+ε), ε ~ U(−r, r).  Band A ± r·A. */
  multiplicativeUniform: (r) => {
    if (!(r >= 0 && r <= 1)) throw new Error(`multiplicativeUniform: r must be in [0,1], got ${r}`);
    return {
      name: 'multiplicative-uniform', r, uniform: true,
      support: a => [a * (1 - r), a * (1 + r)],
      sample: (a, u, rng) => (a <= 0 ? 0 : a * (1 + r * (2 * rng.next() - 1))),
    };
  },

  /**
   * B = A + ε, ε ~ U(−h, h).  Band A ± r in ×bet units.
   * With taper (default) h = min(r, A) so the band stays symmetric and never dips below 0
   * where the curve approaches zero; clamping instead would break E[B|U] = A. Pass
   * {taper: false} only if every positive A(u) ≥ r (checked by verifyConditionalMean).
   */
  additiveUniform: (r, { taper = true } = {}) => {
    if (!(r >= 0)) throw new Error(`additiveUniform: r must be ≥ 0, got ${r}`);
    const h = a => (a <= 0 ? 0 : (taper ? Math.min(r, a) : r));
    return {
      name: taper ? 'additive-uniform (tapered)' : 'additive-uniform', r, uniform: true,
      support: a => [a - h(a), a + h(a)],
      sample: (a, u, rng) => { const w = h(a); return w === 0 ? a : a + w * (2 * rng.next() - 1); },
    };
  },
};

/** Smallest gap between adjacent distinct POSITIVE anchors (zero is not an anchor). */
export function minPayoutGap(anchors) {
  const v = [...new Set(anchors.map(Number).filter(a => a > 0))].sort((a, b) => a - b);
  if (v.length < 2) throw new Error('minPayoutGap: need at least two distinct positive anchors');
  let gap = Infinity;
  for (let i = 1; i < v.length; i++) gap = Math.min(gap, v[i] - v[i - 1]);
  return gap;
}

/**
 * THE default rule. One fixed absolute half-width
 *     r = fraction · (smallest gap between adjacent distinct non-zero payout levels),   fraction = 0.1
 * B = A + ε, ε ~ U(−r, r) for every non-zero level; the zero level pays exactly 0 and gets
 * no band. Bands of adjacent levels are therefore separated by at least 0.8 of a gap, and
 * the rule throws if the lowest band would reach zero (lowest level ≤ r).
 */
dispersion.fixedGap = (anchors, { fraction = 0.1 } = {}) => {
  const gap = minPayoutGap(anchors);
  const r = fraction * gap;
  const lowest = Math.min(...anchors.map(Number).filter(a => a > 0));
  if (lowest - r <= 0) throw new Error(`fixedGap: lowest payout ${lowest} minus r=${r} would touch zero; lower the fraction`);
  return {
    name: 'fixed-gap', r, gap, fraction, uniform: true, anchors: [...anchors],
    support: a => (a <= 0 ? [0, 0] : [a - r, a + r]),
    sample: (a, u, rng) => (a <= 0 ? 0 : a + r * (2 * rng.next() - 1)),
  };
};

/** Accept a rule object or the legacy {r, mode} shorthand. */
export function toRule(x) {
  if (!x) return dispersion.none();
  if (Array.isArray(x)) return dispersion.fixedGap(x);
  if (x.kind === 'step') return dispersion.fixedGap(x.anchors());
  if (typeof x.sample === 'function') return x;
  if (x.mode === 'absolute') return dispersion.additiveUniform(x.r ?? 0);
  return dispersion.multiplicativeUniform(x.r ?? 0);
}

/**
 * Numerically checks E[B|U=u] = A(u) for a rule on a grid of u, and that no sample is
 * negative. Returns { ok, worstRelErr, worstAt, negative } — use it on any custom F.
 * `tol` is relative; size `samples` so that tol is several standard errors of the rule's
 * conditional sd (sd/(A·√samples)), or a correct high-variance rule will fail by noise.
 */
export function verifyConditionalMean(curve, rule, { grid = 41, samples = 20000, tol = 0.01, seed = 'cm' } = {}) {
  rule = toRule(rule);
  let worst = 0, worstAt = null, negative = 0;
  for (let i = 0; i < grid; i++) {
    const u = (i + 0.5) / grid, a = curve.evaluate(u);
    const rng = new Rng(`${seed}:${i}`, 'dispersion');
    let sum = 0;
    for (let k = 0; k < samples; k++) { const b = rule.sample(a, u, rng); if (b < 0) negative++; sum += b; }
    const mean = sum / samples;
    const err = Math.abs(mean - a) / Math.max(a, 1e-9);
    if (a > 0 && err > worst) { worst = err; worstAt = { u, a, mean }; }
  }
  return { ok: worst <= tol && negative === 0, worstRelErr: worst, worstAt, negative };
}

// ────────────────────────── discrete RNG grid: D = floor(N·U) ──────────────────────────

/**
 * The curve evaluated on an N-value RNG. `point` picks where inside cell D the curve is
 * read: 'midpoint' ((D+0.5)/N) matches the continuous RTP exactly whenever the knots sit
 * on cell boundaries; 'left' (D/N) is the literal floor(N·U) and biases slightly low.
 * knot u_i ↔ RNG value N·u_i.
 */
export function discretize(curve, N, { point = 'midpoint' } = {}) {
  if (!Number.isInteger(N) || N < 2) throw new Error('discretize: N must be an integer ≥ 2');
  const off = point === 'left' ? 0 : 0.5;
  const at = d => curve.evaluate((d + off) / N);
  let s = 0;
  for (let d = 0; d < N; d++) s += at(d);
  return {
    N, point,
    evaluate: at,
    rtp: s / N,
    knotValues: curve.knots.map(k => ({ u: k.u, D: Math.round(k.u * N), a: k.a })),
    draw: (rng) => { const D = Math.floor(rng.next() * N); return { D, u: (D + off) / N, base: at(D) }; },
  };
}

// ───────────────────────────────── step functions ──────────────────────────────────────
//
// A(u) = level_i for u in [break_i, break_{i+1}). This IS the discrete outcome table with the
// rows laid out along the draw axis (row i has probability break_{i+1} − break_i), so RTP is
// Σ Δu_i · level_i, exactly, and everything in table.js applies via toTable().

export function makeStepCurve({ breaks, levels }) {
  if (!Array.isArray(breaks) || !Array.isArray(levels) || breaks.length !== levels.length + 1) {
    throw new Error('makeStepCurve: need breaks (K+1 values from 0 to 1) and levels (K values)');
  }
  const b = breaks.map(Number), L = levels.map(Number);
  if (Math.abs(b[0]) > 1e-12 || Math.abs(b[b.length - 1] - 1) > 1e-12) throw new Error('makeStepCurve: breaks must run from 0 to 1');
  for (let i = 1; i < b.length; i++) if (!(b[i] > b[i - 1])) throw new Error(`makeStepCurve: breaks must strictly increase (index ${i})`);
  for (let i = 0; i < L.length; i++) if (!Number.isFinite(L[i]) || L[i] < 0) throw new Error(`makeStepCurve: bad level ${L[i]} at ${i}`);
  const widths = L.map((_, i) => b[i + 1] - b[i]);
  const evaluate = (u) => {
    if (u < 0) return L[0];
    if (u >= 1) return L[L.length - 1];
    let i = 0;
    while (b[i + 1] <= u) i++;
    return L[i];
  };
  const step = {
    kind: 'step', breaks: b, levels: L, widths,
    knots: L.map((a, i) => ({ u: b[i], a })), // for callers that read knots
    evaluate,
    rtp: () => L.reduce((s, a, i) => s + widths[i] * a, 0),
    hitRate: () => L.reduce((s, a, i) => s + (a > 0 ? widths[i] : 0), 0),
    maxWin: () => Math.max(...L),
    secondMoment: () => L.reduce((s, a, i) => s + widths[i] * a * a, 0),
    stdev() { const m = this.rtp(); return Math.sqrt(Math.max(this.secondMoment() - m * m, 0)); },
    scaleTo(target) { const k = target / step.rtp(); return makeStepCurve({ breaks: b, levels: L.map(a => a * k) }); },
    /** Solve level i so RTP hits target (RTP is linear in every level). */
    solveLevel(i, target) {
      const rest = L.reduce((s, a, j) => s + (j === i ? 0 : widths[j] * a), 0);
      const a = (target - rest) / widths[i];
      if (!(a >= 0)) throw new Error(`solveLevel: level ${i} would need ${a}`);
      return makeStepCurve({ breaks: b, levels: L.map((x, j) => (j === i ? a : x)) });
    },
    /** The same object as an outcome table (rows in draw order, p = width). */
    toTable() { return L.map((a, i) => ({ label: `step${i}`, prize: a, p: widths[i], meta: { from: b[i], to: b[i + 1] } })); },
    /** Distinct non-zero payout levels — the anchors the band rule is derived from. */
    anchors: () => [...new Set(L.filter(a => a > 0))].sort((x, y) => x - y),
    exactRtpAtBet(bet) { return L.reduce((s, a, i) => s + widths[i] * Math.round(bet * a), 0) / bet; },
    /** Exact (no quadrature needed: each level is a single band). */
    exactRtpAtBetBanded(bet, rule = {}) {
      rule = toRule(rule);
      return L.reduce((s, a, i) => {
        if (rule.uniform) { const [lo, hi] = rule.support(a, b[i]); return s + widths[i] * expectedRounded(bet * lo, bet * hi); }
        if (rule.expectedRounded) return s + widths[i] * rule.expectedRounded(bet, a, b[i]);
        throw new Error(`exactRtpAtBetBanded: rule "${rule.name}" is not uniform and has no expectedRounded()`);
      }, 0) / bet;
    },
    draw(rule = {}) {
      rule = toRule(rule);
      return function draw(rng) {
        const u = rng.next();
        const base = evaluate(u);
        const [lo, hi] = rule.support(base, u);
        const prize = rule.sample(base, u, rng.derive ? rng.derive('dispersion:' + u) : rng);
        return { u, base, prize, lo, hi, rule: rule.name };
      };
    },
  };
  return step;
}

/**
 * Staircase from a piecewise-linear curve: each linear segment is cut into `sub` equal
 * cells and each cell pays the ramp's value at its midpoint. The midpoint rule is exact for
 * straight segments, so the staircase has the SAME RTP as the ramp for any `sub`.
 */
export function stepFromLinear(curve, sub = 1) {
  const breaks = [], levels = [];
  for (let i = 1; i < curve.knots.length; i++) {
    const k0 = curve.knots[i - 1], k1 = curve.knots[i];
    for (let j = 0; j < sub; j++) {
      const u0 = k0.u + (k1.u - k0.u) * (j / sub), um = k0.u + (k1.u - k0.u) * ((j + 0.5) / sub);
      breaks.push(u0);
      levels.push(k0.a + (k1.a - k0.a) * ((um - k0.u) / (k1.u - k0.u)));
    }
  }
  breaks.push(1);
  return makeStepCurve({ breaks, levels });
}

// ──────────────────────────────────── curves ───────────────────────────────────────────

/**
 * knots: [{u, a}] with u strictly increasing from 0 to 1 and a ≥ 0.
 * Between knots A(u) is linear; RTP = Σ (u₁−u₀)(a₀+a₁)/2.
 */
export function makeCurve(knots) {
  if (!Array.isArray(knots) || knots.length < 2) throw new Error('curve: need at least 2 knots');
  const ks = knots.map(k => ({ u: Number(k.u), a: Number(k.a) }));
  if (Math.abs(ks[0].u) > 1e-12 || Math.abs(ks[ks.length - 1].u - 1) > 1e-12) throw new Error('curve: knots must run from u=0 to u=1');
  for (let i = 0; i < ks.length; i++) {
    if (!Number.isFinite(ks[i].a) || ks[i].a < 0) throw new Error(`curve: knot ${i} has bad a=${ks[i].a}`);
    if (i > 0 && !(ks[i].u > ks[i - 1].u)) throw new Error(`curve: knot u values must strictly increase (knot ${i})`);
  }

  const evaluate = (u) => {
    if (u <= 0) return ks[0].a;
    if (u >= 1) return ks[ks.length - 1].a;
    let i = 1;
    while (ks[i].u < u) i++;
    const k0 = ks[i - 1], k1 = ks[i];
    const t = (u - k0.u) / (k1.u - k0.u);
    return k0.a + (k1.a - k0.a) * t;
  };
  const segments = () => ks.slice(1).map((k1, i) => ({ u0: ks[i].u, u1: k1.u, a0: ks[i].a, a1: k1.a }));

  const curve = {
    knots: ks,
    evaluate,
    rtp: () => segments().reduce((s, g) => s + (g.u1 - g.u0) * (g.a0 + g.a1) / 2, 0),
    hitRate: () => segments().reduce((s, g) => s + (Math.max(g.a0, g.a1) > 0 ? g.u1 - g.u0 : 0), 0),
    maxWin: () => Math.max(...ks.map(k => k.a)),
    secondMoment: () => segments().reduce((s, g) => s + (g.u1 - g.u0) * (g.a0 * g.a0 + g.a0 * g.a1 + g.a1 * g.a1) / 3, 0),
    stdev() { const m = this.rtp(); return Math.sqrt(Math.max(this.secondMoment() - m * m, 0)); },

    /** Multiply every knot so the curve hits `target`. */
    scaleTo(target) { const k = target / curve.rtp(); return makeCurve(ks.map(x => ({ u: x.u, a: x.a * k }))); },

    /** Solve knot i's height so the curve hits `target` (RTP is linear in a_i). */
    solveKnot(i, target) {
      const zero = makeCurve(ks.map((x, j) => ({ u: x.u, a: j === i ? 0 : x.a })));
      const left = i > 0 ? (ks[i].u - ks[i - 1].u) / 2 : 0;
      const right = i < ks.length - 1 ? (ks[i + 1].u - ks[i].u) / 2 : 0;
      const a = (target - zero.rtp()) / (left + right);
      if (!(a >= 0)) throw new Error(`solveKnot: knot ${i} would need a=${a}; lower the other knots or raise the target`);
      return makeCurve(ks.map((x, j) => ({ u: x.u, a: j === i ? a : x.a })));
    },

    /** Exact realised RTP at a chip size after rounding (no band). */
    exactRtpAtBet(bet) {
      return segments().reduce((s, g) => s + (g.u1 - g.u0) * expectedRounded(bet * g.a0, bet * g.a1), 0) / bet;
    },

    /**
     * Realised RTP at a chip size WITH a band: exact in v, quadrature over u.
     * `steps` u-samples per unit interval (midpoint rule).
     */
    exactRtpAtBetBanded(bet, rule = {}, { steps = 20000 } = {}) {
      rule = toRule(rule);
      let s = 0;
      for (let i = 0; i < steps; i++) {
        const u = (i + 0.5) / steps, a = evaluate(u);
        if (rule.uniform) { const [lo, hi] = rule.support(a, u); s += expectedRounded(bet * lo, bet * hi); }
        else if (rule.expectedRounded) s += rule.expectedRounded(bet, a, u);
        else throw new Error(`exactRtpAtBetBanded: rule "${rule.name}" is not uniform and has no expectedRounded()`);
      }
      return s / steps / bet;
    },

    /**
     * draw(rng) -> { u, base, prize, lo, hi }. Layer 1 (u) uses the payout stream passed
     * in; layer 2 (the dispersion) uses an independent stream derived from the same seed,
     * so U and V are independent and both replay from one seed.
     */
    draw(rule = {}) {
      rule = toRule(rule);
      return function draw(rng) {
        const u = rng.next();
        const base = evaluate(u);
        const [lo, hi] = rule.support(base, u);
        const prize = rule.sample(base, u, rng.derive ? rng.derive('dispersion:' + u) : rng);
        return { u, base, prize, lo, hi, rule: rule.name };
      };
    },
  };
  return curve;
}

export { toMinor };
