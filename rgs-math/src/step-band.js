// Generic builder: intervals + RTP in, step-band payout function out.
//
//   buildStepBand({ p: [p1..pn], rtp, shape | growth | levels, fraction? })
//
// Degrees of freedom. n intervals give n payout levels a_i. The constraint Σ p_i a_i = rtp
// removes one; a zero (no-win) interval pins another at 0. The remaining n−2 (or n−1 with
// no zero interval) must be spent somehow, and there are three ways:
//
//   shape    relative levels s_i (any non-negative numbers, 0 marks a no-win interval).
//            The whole vector is scaled: a_i = k·s_i with k = rtp / Σ p_i s_i.
//            → RTP is exact and you control the payout ratios.
//   growth   geometric ladder over the paying intervals: a = [c, c·g, c·g², …] with c solved
//            for rtp. Intervals whose entry in `zero` is true (default: the first) pay 0.
//            → one number describes the whole ladder.
//   levels   explicit multiples with exactly one null, solved for rtp (or none, checked).
//
//   p        probabilities, Σ p_i = 1 (validated). Region i occupies [c_{i-1}, c_i) of the
//            draw axis where c_i = p_1 + … + p_i, so P(region i) = p_i exactly.
//   rtp      target return. Required (except with fully explicit levels, where it is checked).
//   fraction band half-width as a fraction of the minimum distance between adjacent distinct
//            non-zero payout levels (default 0.1). r is derived, never a free parameter.
//            The lowest band must stay clear of zero; the zero level gets no band.
//
// The result carries the pure function  payout(u, v) = A(u) + r·(2v − 1)  with u, v ~ U[0,1)
// independent, plus a `standalone()` string: the same function as dependency-free JS.

import { makeStepCurve, dispersion } from './curve.js';
import { defineGame } from './contract.js';

const EPS = 1e-9;

export function buildStepBand({ p, rtp, shape, growth, zero, levels, fraction = 0.1, labels } = {}) {
  if (!Array.isArray(p) || p.length === 0) throw new Error('buildStepBand: p must be a non-empty array');
  const probs = p.map(Number);
  const modes = [shape !== undefined, growth !== undefined, levels !== undefined].filter(Boolean).length;
  if (modes !== 1) throw new Error('buildStepBand: give exactly one of shape, growth or levels');

  if (shape !== undefined) {
    if (!Array.isArray(shape) || shape.length !== probs.length) throw new Error(`buildStepBand: shape must have ${probs.length} entries`);
    if (rtp === undefined) throw new Error('buildStepBand: rtp is required with shape');
    const S = shape.map(Number);
    if (S.some(x => !Number.isFinite(x) || x < 0)) throw new Error('buildStepBand: shape entries must be ≥ 0');
    const es = S.reduce((acc, x, i) => acc + probs[i] * x, 0);
    if (!(es > 0)) throw new Error('buildStepBand: shape must have a positive entry on a positive-probability interval');
    const k = rtp / es;
    levels = S.map(x => x * k);
  } else if (growth !== undefined) {
    if (rtp === undefined) throw new Error('buildStepBand: rtp is required with growth');
    const g = Number(growth);
    if (!(g > 0)) throw new Error('buildStepBand: growth must be > 0');
    const isZero = zero ?? probs.map((_, i) => i === 0);
    if (isZero.length !== probs.length) throw new Error(`buildStepBand: zero must have ${probs.length} entries`);
    let j = 0;
    const S = probs.map((_, i) => (isZero[i] ? 0 : g ** (j++)));
    if (j === 0) throw new Error('buildStepBand: growth needs at least one paying interval');
    const es = S.reduce((acc, x, i) => acc + probs[i] * x, 0);
    levels = S.map(x => x * (rtp / es));
  }
  if (!Array.isArray(levels) || levels.length !== probs.length) throw new Error(`buildStepBand: levels must have ${probs.length} entries (one per probability)`);
  if (probs.some(x => !Number.isFinite(x) || x <= 0)) throw new Error('buildStepBand: every probability must be > 0');
  const sum = probs.reduce((s, x) => s + x, 0);
  if (Math.abs(sum - 1) > 1e-6) throw new Error(`buildStepBand: probabilities sum to ${sum}, not 1`);

  // breaks from cumulative probabilities (normalised so the last is exactly 1)
  const breaks = [0];
  let acc = 0;
  for (const x of probs) { acc += x; breaks.push(acc / sum); }
  breaks[breaks.length - 1] = 1;

  // solve the one unknown level, if any
  const unknown = levels.map((a, i) => (a === null || a === undefined ? i : -1)).filter(i => i >= 0);
  if (unknown.length > 1) throw new Error('buildStepBand: at most one level may be unknown');
  let L = levels.map(a => (a === null || a === undefined ? 0 : Number(a)));
  if (L.some(a => !Number.isFinite(a) || a < 0)) throw new Error('buildStepBand: levels must be ≥ 0');
  if (unknown.length === 1) {
    if (rtp === undefined) throw new Error('buildStepBand: rtp is required to solve an unknown level');
    const i = unknown[0];
    const rest = L.reduce((s, a, j) => s + (j === i ? 0 : probs[j] * a), 0);
    const a = (rtp - rest) / probs[i];
    if (!(a >= 0)) throw new Error(`buildStepBand: level ${i} would need ${a.toFixed(4)} to reach rtp ${rtp}; the other levels already pay ${rest.toFixed(4)}`);
    L[i] = a;
  }

  const curve = makeStepCurve({ breaks, levels: L });
  const design = curve.rtp();
  if (rtp !== undefined && Math.abs(design - rtp) > 1e-6) throw new Error(`buildStepBand: Σ p·a = ${design.toFixed(6)} but rtp ${rtp} was requested; leave one level null to solve it`);

  const band = dispersion.fixedGap(curve.anchors(), { fraction });
  const r = band.r;
  const A = curve.evaluate;

  const rows = L.map((a, i) => ({
    index: i, label: labels?.[i] ?? (a > 0 ? `${a}x` : 'zero'),
    p: probs[i], from: breaks[i], to: breaks[i + 1],
    level: a, band: a > 0 ? [a - r, a + r] : null, rtpContribution: probs[i] * a,
  }));

  const result = {
    p: probs, levels: L, breaks, r, gap: band.gap, fraction, rtp: design,
    hitRate: curve.hitRate(), stdev: curve.stdev(), maxWin: curve.maxWin() + r,
    curve, band, rows,
    byProbability: [...rows].sort((x, y) => y.p - x.p || y.level - x.level),

    /** Pure: u picks the region, v places the prize inside its band. */
    payout(u, v) { const a = A(u); return a <= 0 ? 0 : a + r * (2 * v - 1); },
    level: A,
    draw(rng) { const u = rng.next(), v = rng.next(); const a = A(u); return { u, v, level: a, prize: result.payout(u, v) }; },

    /** Dependency-free JS of this exact function, for pasting into any codebase. */
    standalone(name = 'payout') {
      const b = JSON.stringify(breaks);   // full precision: the standalone must reproduce payout() bit for bit
      const l = JSON.stringify(L);
      return [
        `// Step-band payout. RTP = ${design.toFixed(6)}, r = ${r.toFixed(6)} (${fraction} × smallest level gap ${band.gap.toFixed(6)}).`,
        `// u, v: independent uniforms in [0,1). Returns the multiple of the bet to pay.`,
        `function ${name}(u, v) {`,
        `  const breaks = ${b};`,
        `  const levels = ${l};`,
        `  const r = ${r};`,
        `  let i = 0; while (i + 1 < levels.length && breaks[i + 1] <= u) i++;`,
        `  const a = levels[i];`,
        `  return a <= 0 ? 0 : a + r * (2 * v - 1);`,
        `}`,
      ].join('\n');
    },

    /** Wrap as an RGS provider (see src/contract.js). Wins are rounded to minor units once. */
    toGame({ id, chips = [10, 50, 250, 500, 2500], betTypes = ['BASE'] } = {}) {
      return defineGame({
        id, betTypes, levels: () => chips,
        play: ({ bet, rng }) => {
          const d = result.draw(rng);
          return { totalWinAmount: Math.round(bet * d.prize), math: { u: d.u, level: d.level, prize: d.prize, r } };
        },
      });
    },
  };
  return result;
}

export function formatStepBand(sb) {
  const pct = x => `${(100 * x).toFixed(2)}%`;
  const lines = [
    `RTP ${sb.rtp.toFixed(6)}   hit rate ${pct(sb.hitRate)}   stdev ${sb.stdev.toFixed(4)}x   r = ${sb.r.toFixed(6)} (${sb.fraction} × gap ${sb.gap.toFixed(6)})`,
    '',
    'probability (decreasing)   region [from, to)        level      band                 rtp contribution',
  ];
  for (const w of sb.byProbability) {
    lines.push(
      `  ${pct(w.p).padStart(8)}                 [${w.from.toFixed(4)}, ${w.to.toFixed(4)})   ${(w.level > 0 ? w.level.toFixed(4) + 'x' : 'no win').padStart(9)}   ${(w.band ? `${w.band[0].toFixed(4)} – ${w.band[1].toFixed(4)}` : '—').padEnd(20)} ${w.rtpContribution.toFixed(4)}`,
    );
  }
  return lines.join('\n');
}

// ───────────────────────── inverse: payouts + RTP in, probabilities out ─────────────────────
//
//   buildFromPayouts({ payouts: [a1..an], rtp, method = 'maxent', weights?, fraction? })
//
// n payouts → n probabilities under two constraints, Σ p_i = 1 and Σ p_i a_i = rtp. The
// remaining n−2 degrees of freedom are spent by `method`:
//
//   maxent     p_i ∝ exp(−λ a_i), λ solved for the mean. The maximum-entropy distribution:
//              the least-assumption assignment consistent with the RTP. Probability falls
//              (or rises) monotonically with payout; no other structure is imposed. Default.
//   geometric  p_i ∝ q^i over the payouts sorted ascending, q solved for the mean.
//   weights    you give relative weights for the non-zero payouts; the zero payout's
//              probability is solved (requires a 0 in payouts). This is solveZeroRow.
//
// r = fraction × minimum distance between adjacent distinct non-zero payouts, as before.

function solveMonotone(f, target, lo, hi, iters = 300) {
  // f is monotone on [lo, hi]; find x with f(x) = target by bisection
  let flo = f(lo), fhi = f(hi);
  if ((flo - target) * (fhi - target) > 0) throw new Error(`buildFromPayouts: target ${target} not reachable in the solver's range`);
  const inc = fhi > flo;
  for (let i = 0; i < iters; i++) {
    const mid = (lo + hi) / 2, fm = f(mid);
    if ((fm < target) === inc) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export function assignProbabilities({ payouts, rtp, method = 'maxent', weights } = {}) {
  if (!Array.isArray(payouts) || payouts.length < 2) throw new Error('buildFromPayouts: need at least two payouts');
  const A = payouts.map(Number);
  if (A.some(a => !Number.isFinite(a) || a < 0)) throw new Error('buildFromPayouts: payouts must be ≥ 0');
  if (new Set(A).size !== A.length) throw new Error('buildFromPayouts: payouts must be distinct');
  if (!(rtp > 0)) throw new Error('buildFromPayouts: rtp must be > 0');
  const amin = Math.min(...A), amax = Math.max(...A);
  if (!(rtp > amin && rtp < amax)) throw new Error(`buildFromPayouts: rtp ${rtp} must lie strictly between the smallest (${amin}) and largest (${amax}) payout`);

  let p;
  if (method === 'maxent') {
    // p_i ∝ exp(−λ a_i); mean(λ) is decreasing in λ. Scale λ by amax for a stable bracket.
    const mean = lambda => {
      const w = A.map(a => Math.exp(-lambda * (a - amin) / amax)); // shift for stability
      const Z = w.reduce((s, x) => s + x, 0);
      return w.reduce((s, x, i) => s + (x / Z) * A[i], 0);
    };
    const lambda = solveMonotone(mean, rtp, -2000, 2000);
    const w = A.map(a => Math.exp(-lambda * (a - amin) / amax));
    const Z = w.reduce((s, x) => s + x, 0);
    p = w.map(x => x / Z);
  } else if (method === 'geometric') {
    const order = A.map((a, i) => i).sort((i, j) => A[i] - A[j]);
    const mean = logq => {
      const w = order.map((_, k) => Math.exp(logq * k));
      const Z = w.reduce((s, x) => s + x, 0);
      return w.reduce((s, x, k) => s + (x / Z) * A[order[k]], 0);
    };
    const logq = solveMonotone(mean, rtp, -60, 60);
    const w = order.map((_, k) => Math.exp(logq * k));
    const Z = w.reduce((s, x) => s + x, 0);
    p = new Array(A.length);
    order.forEach((i, k) => { p[i] = w[k] / Z; });
  } else if (method === 'weights') {
    const iz = A.indexOf(0);
    if (iz < 0) throw new Error("buildFromPayouts: method 'weights' needs a 0 payout to solve; use maxent or geometric otherwise");
    if (!Array.isArray(weights) || weights.length !== A.length) throw new Error(`buildFromPayouts: weights must have ${A.length} entries (the zero payout's entry is ignored)`);
    const W = weights.map((w, i) => (i === iz ? 0 : Number(w)));
    if (W.some(w => !Number.isFinite(w) || w < 0) || !(W.reduce((s, w) => s + w, 0) > 0)) throw new Error('buildFromPayouts: weights must be ≥ 0 with a positive total');
    const Wt = W.reduce((s, w) => s + w, 0);
    const Enz = W.reduce((s, w, i) => s + (w / Wt) * A[i], 0);
    if (!(Enz > rtp)) throw new Error(`buildFromPayouts: E[payout | win] = ${Enz.toFixed(4)} must exceed rtp ${rtp}`);
    const p0 = 1 - rtp / Enz;
    p = W.map((w, i) => (i === iz ? p0 : (1 - p0) * w / Wt));
  } else {
    throw new Error(`buildFromPayouts: unknown method "${method}"`);
  }
  return p;
}

export function buildFromPayouts({ payouts, rtp, method = 'maxent', weights, fraction = 0.1 } = {}) {
  const p = assignProbabilities({ payouts, rtp, method, weights });
  const sb = buildStepBand({ p, levels: payouts.map(Number), rtp, fraction });
  sb.method = method;
  return sb;
}

// ─────────────────────────── trapezoid (linear-interpolation) variant ───────────────────────
//
// Same inputs as buildFromPayouts, different interpolation. The positive payouts are KNOTS
// a_0 < a_1 < … < a_K at interval boundaries; interval i (i = 0..K−1) pays a linear ramp
// from a_i to a_{i+1}, so its mean payout is m_i = (a_i + a_{i+1})/2 and
//
//     R = Σ_i Δu_i · (a_i + a_{i+1}) / 2          (the trapezoid formula)
//
// An optional zero interval sits first, flat at 0, with a JUMP to a_0 at its right edge, so
// the ramp never approaches zero. Probabilities for the intervals are assigned by the same
// three methods, applied to the interval means m_i. The band is A(u) ± r with
// r = fraction × min(a_{i+1} − a_i); the lowest possible payout is a_0 − r > 0.

export function buildTrapezoid({ payouts, rtp, method = 'maxent', weights, fraction = 0.1 } = {}) {
  const A = [...new Set(payouts.map(Number))].sort((x, y) => x - y);
  if (A.some(a => !Number.isFinite(a) || a < 0)) throw new Error('buildTrapezoid: payouts must be ≥ 0');
  const hasZero = A[0] === 0;
  const knots = hasZero ? A.slice(1) : A;
  if (knots.length < 2) throw new Error('buildTrapezoid: need at least two positive payouts to form a ramp');
  const means = knots.slice(1).map((a, i) => (knots[i] + a) / 2);
  const intervalPayouts = hasZero ? [0, ...means] : means;
  let w = weights;
  if (method === 'weights' && Array.isArray(weights)) {
    // weights are given per positive payout (knot); map to intervals by averaging adjacent knots
    const kw = hasZero ? weights.slice(1).map(Number) : weights.map(Number);
    if (kw.length !== knots.length) throw new Error(`buildTrapezoid: weights must have one entry per payout (${A.length})`);
    w = [...(hasZero ? [0] : []), ...knots.slice(1).map((_, i) => (kw[i] + kw[i + 1]) / 2)];
  }
  const p = assignProbabilities({ payouts: intervalPayouts, rtp, method, weights: w });

  const breaks = [0];
  let acc = 0;
  for (const x of p) { acc += x; breaks.push(acc); }
  breaks[breaks.length - 1] = 1;
  const nZero = hasZero ? 1 : 0;

  const gap = Math.min(...knots.slice(1).map((a, i) => a - knots[i]));
  const r = fraction * gap;
  if (knots[0] - r <= 0) throw new Error(`buildTrapezoid: lowest payout ${knots[0]} minus r=${r} would touch zero`);

  const level = (u) => {
    if (u >= 1) return knots[knots.length - 1];
    let i = 0;
    while (breaks[i + 1] <= u) i++;
    if (i < nZero) return 0;
    const k = i - nZero;
    const t = (u - breaks[i]) / (breaks[i + 1] - breaks[i]);
    return knots[k] + (knots[k + 1] - knots[k]) * t;
  };
  const rows = p.map((pi, i) => {
    const k = i - nZero;
    const from = breaks[i], to = breaks[i + 1];
    const ramp = i < nZero ? null : [knots[k], knots[k + 1]];
    return { index: i, p: pi, from, to, ramp, mean: intervalPayouts[i], band: ramp ? [ramp[0] - r, ramp[1] + r] : null, rtpContribution: pi * intervalPayouts[i] };
  });
  const design = rows.reduce((s, w) => s + w.rtpContribution, 0);

  const result = {
    kind: 'trapezoid', method, payouts: A, knots, hasZero, p, breaks, r, gap, fraction, rtp: design,
    hitRate: 1 - (hasZero ? p[0] : 0),
    rows, byProbability: [...rows].sort((x, y) => y.p - x.p || y.mean - x.mean),
    level,
    payout(u, v) { const a = level(u); return a <= 0 ? 0 : a + r * (2 * v - 1); },
    draw(rng) { const u = rng.next(), v = rng.next(); const a = level(u); return { u, v, level: a, prize: result.payout(u, v) }; },
    standalone(name = 'payout') {
      return [
        `// Trapezoid payout. RTP = Σ Δu·(a_i+a_{i+1})/2 = ${design.toFixed(6)}, r = ${r.toFixed(6)} (${fraction} × smallest knot gap ${gap.toFixed(6)}).`,
        `// u, v: independent uniforms in [0,1). Returns the multiple of the bet to pay.`,
        `function ${name}(u, v) {`,
        `  const breaks = ${JSON.stringify(breaks)};`,
        `  const knots = ${JSON.stringify(knots)};   // payout at each paying-interval boundary`,
        `  const nZero = ${nZero};                  // leading no-win intervals`,
        `  const r = ${r};`,
        `  if (u >= 1) u = 1 - 1e-12;`,
        `  let i = 0; while (breaks[i + 1] <= u) i++;`,
        `  if (i < nZero) return 0;`,
        `  const k = i - nZero, t = (u - breaks[i]) / (breaks[i + 1] - breaks[i]);`,
        `  const a = knots[k] + (knots[k + 1] - knots[k]) * t;`,
        `  return a + r * (2 * v - 1);`,
        `}`,
      ].join('\n');
    },
    /**
     * The draw axis projected linearly onto [0, N): x = N·u. Knot positions in x, and the
     * RTP of the integer grid D = floor(N·u) read at cell midpoints (exact whenever every
     * band boundary lands on a cell edge; otherwise it reports the tiny residual).
     */
    grid(N = 10000) {
      const at = d => level((d + 0.5) / N);
      let s = 0;
      for (let d = 0; d < N; d++) s += at(d);
      return {
        N, x: u => N * u, toU: x => x / N,
        boundaries: breaks.map(b => b * N),
        knotsX: knots.map((a, k) => ({ x: breaks[k + nZero] * N, a })).concat([{ x: N, a: knots[knots.length - 1] }]),
        discreteRtp: s / N, residual: s / N - design, evaluateD: at,
      };
    },
    /** Analytic payout density inside band i: U[a_i, a_{i+1}] ⊛ U[−r, r] (trapezoidal). */
    bandDensity(i) {
      const row = rows[i];
      if (!row.ramp) return null;
      const [lo, hi] = row.ramp;
      const w = hi - lo;
      return (b) => { // density of X + E, X ~ U[lo,hi], E ~ U[-r,r]
        const a1 = Math.max(lo, b - r), a2 = Math.min(hi, b + r);
        return a2 > a1 ? (a2 - a1) / (w * 2 * r) : 0;
      };
    },
    toGame({ id, chips = [10, 50, 250, 500, 2500], betTypes = ['BASE'] } = {}) {
      return defineGame({
        id, betTypes, levels: () => chips,
        play: ({ bet, rng }) => { const d = result.draw(rng); return { totalWinAmount: Math.round(bet * d.prize), math: { u: d.u, level: d.level, prize: d.prize, r } }; },
      });
    },
  };
  return result;
}

export function formatTrapezoid(tz) {
  const pct = x => `${(100 * x).toFixed(2)}%`;
  const lines = [
    `TRAPEZOID  RTP ${tz.rtp.toFixed(6)}   hit rate ${pct(tz.hitRate)}   r = ${tz.r.toFixed(6)} (${tz.fraction} × knot gap ${tz.gap.toFixed(6)})   method ${tz.method}`,
    '',
    'probability (decreasing)   region [from, to)        ramp a_i → a_{i+1}     mean       band                 rtp contribution',
  ];
  for (const w of tz.byProbability) {
    lines.push(`  ${pct(w.p).padStart(8)}                 [${w.from.toFixed(4)}, ${w.to.toFixed(4)})   ${(w.ramp ? `${w.ramp[0]} → ${w.ramp[1]}` : 'no win').padEnd(20)}   ${w.mean.toFixed(4).padStart(7)}x   ${(w.band ? `${w.band[0].toFixed(4)} – ${w.band[1].toFixed(4)}` : '—').padEnd(20)} ${w.rtpContribution.toFixed(4)}`);
  }
  return lines.join('\n');
}

// ──────────────────────── sloped bands: r defines the slope inside each interval ──────────────
//
//   buildSloped({ payouts, rtp, method = 'maxent', weights, fraction = 0.1 })
//
// Interval i (probability p_i) pays a straight ramp centred on its payout a_i:
//
//     A(u) = a_i + r · (2t − 1),     t = (u − c_{i−1}) / (c_i − c_{i−1}) ∈ [0, 1)
//
// so the payout runs from a_i − r at the left edge of the interval to a_i + r at the right
// edge. One uniform draw does everything: the interval it lands in picks the payout, the
// position inside the interval places it within the band. E[A | interval i] = a_i exactly,
// hence R = Σ p_i a_i. r = fraction × (smallest gap between adjacent distinct non-zero payouts),
// and since a_i + r < a_{i+1} − r the curve is monotone and bands never overlap. The zero
// interval is flat at 0. Inside band i the payout is exactly Uniform[a_i − r, a_i + r].

export function buildSloped({ payouts, rtp, method = 'maxent', weights, fraction = 0.1 } = {}) {
  const A = payouts.map(Number);
  const p = assignProbabilities({ payouts: A, rtp, method, weights });
  // lay out in ascending payout order so the curve is monotone regardless of input order
  const order = A.map((_, i) => i).sort((i, j) => A[i] - A[j]);
  const a = order.map(i => A[i]), pr = order.map(i => p[i]);
  const breaks = [0];
  let acc = 0;
  for (const x of pr) { acc += x; breaks.push(acc); }
  breaks[breaks.length - 1] = 1;
  const pos = a.filter(x => x > 0);
  if (pos.length < 2) throw new Error('buildSloped: need at least two positive payouts');
  const gap = Math.min(...pos.slice(1).map((x, i) => x - pos[i]));
  const r = fraction * gap;
  if (pos[0] - r <= 0) throw new Error(`buildSloped: lowest payout ${pos[0]} minus r=${r} would touch zero`);

  const level = (u) => {
    if (u >= 1) u = 1 - 1e-12;
    let i = 0;
    while (breaks[i + 1] <= u) i++;
    if (a[i] <= 0) return 0;
    const t = (u - breaks[i]) / (breaks[i + 1] - breaks[i]);
    return a[i] + r * (2 * t - 1);
  };
  const rows = a.map((ai, i) => ({
    index: i, p: pr[i], from: breaks[i], to: breaks[i + 1], payout: ai,
    band: ai > 0 ? [ai - r, ai + r] : null, rtpContribution: pr[i] * ai,
  }));
  const design = rows.reduce((s, w) => s + w.rtpContribution, 0);

  const result = {
    kind: 'sloped', method, payouts: a, p: pr, breaks, r, gap, fraction, rtp: design,
    hitRate: rows.reduce((s, w) => s + (w.payout > 0 ? w.p : 0), 0),
    stdev: Math.sqrt(rows.reduce((s, w) => s + w.p * (w.payout > 0 ? w.payout * w.payout + r * r / 3 : 0), 0) - design * design),
    rows, byProbability: [...rows].sort((x, y) => y.p - x.p || y.payout - x.payout),
    level,
    payout: level,                       // single uniform: payout(u)
    draw(rng) { const u = rng.next(); return { u, prize: level(u) }; },
    grid(N = 10000) {
      const at = d => level((d + 0.5) / N);
      let s = 0;
      for (let d = 0; d < N; d++) s += at(d);
      return { N, boundaries: breaks.map(b => b * N), discreteRtp: s / N, residual: s / N - design, evaluateD: at };
    },
    standalone(name = 'payout') {
      return [
        `// Sloped-band payout. RTP = Σ p_i·a_i = ${design.toFixed(6)}. r = ${r.toFixed(6)} (${fraction} × smallest payout gap ${gap.toFixed(6)}).`,
        `// u: one uniform in [0,1). Band i pays a_i − r at its left edge rising to a_i + r at its right edge.`,
        `function ${name}(u) {`,
        `  const breaks = ${JSON.stringify(breaks)};`,
        `  const payouts = ${JSON.stringify(a)};`,
        `  const r = ${r};`,
        `  if (u >= 1) u = 1 - 1e-12;`,
        `  let i = 0; while (breaks[i + 1] <= u) i++;`,
        `  if (payouts[i] <= 0) return 0;`,
        `  const t = (u - breaks[i]) / (breaks[i + 1] - breaks[i]);`,
        `  return payouts[i] + r * (2 * t - 1);`,
        `}`,
      ].join('\n');
    },
    toGame({ id, chips = [10, 50, 250, 500, 2500], betTypes = ['BASE'] } = {}) {
      return defineGame({
        id, betTypes, levels: () => chips,
        play: ({ bet, rng }) => { const d = result.draw(rng); return { totalWinAmount: Math.round(bet * d.prize), math: { u: d.u, prize: d.prize, r } }; },
      });
    },
  };
  return result;
}

export function formatSloped(sl) {
  const pct = x => `${(100 * x).toFixed(2)}%`;
  const lines = [
    `SLOPED  RTP ${sl.rtp.toFixed(6)}   hit rate ${pct(sl.hitRate)}   stdev ${sl.stdev.toFixed(4)}x   r = ${sl.r.toFixed(6)} (${sl.fraction} × payout gap ${sl.gap.toFixed(6)})   method ${sl.method}`,
    '',
    'probability (decreasing)   region [from, to)        payout     pays from → to (left → right edge)   rtp contribution',
  ];
  for (const w of sl.byProbability) {
    lines.push(`  ${pct(w.p).padStart(8)}                 [${w.from.toFixed(4)}, ${w.to.toFixed(4)})   ${(w.payout > 0 ? w.payout + 'x' : 'no win').padStart(8)}   ${(w.band ? `${w.band[0].toFixed(4)} → ${w.band[1].toFixed(4)}` : '—').padEnd(34)} ${w.rtpContribution.toFixed(4)}`);
  }
  return lines.join('\n');
}
