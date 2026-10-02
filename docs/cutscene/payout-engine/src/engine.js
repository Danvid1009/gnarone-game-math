// Sloped-band payout engine.  See ALGORITHM.md for the math.
//
//   const e = buildPayout({ payouts: [0, 0.5, 1, 2, 5, 20], rtp: 0.95 });
//   e.payout(u)          // u ~ Uniform[0,1)  ->  multiple of the stake
//   e.standalone()       // the same function as dependency-free JS text
//
// Inputs:  payouts a_1..a_n (distinct, >= 0, one may be 0), target RTP, a probability
//          method (maxent | geometric | weights), optional weights, fraction (default 0.1).
// Output:  intervals on [0,1) with widths p_i, and inside interval i a straight ramp from
//          a_i − r to a_i + r, r = fraction × min gap between adjacent non-zero payouts.
//          E[payout | interval i] = a_i exactly, so RTP = Σ p_i a_i exactly.

import { Rng } from './rng.js';

const RTP_TOL = 1e-9;

function bisect(f, target, lo, hi, iters = 300) {
  let flo = f(lo), fhi = f(hi);
  if ((flo - target) * (fhi - target) > 0) throw new Error(`solver: target ${target} not reachable`);
  const inc = fhi > flo;
  for (let i = 0; i < iters; i++) {
    const mid = (lo + hi) / 2;
    if ((f(mid) < target) === inc) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Probabilities for sorted payouts A such that Σ p = 1 and Σ p·A = rtp.
 *   maxent     p_i ∝ exp(−λ a_i)          λ solved
 *   geometric  p_i ∝ q^i                  q solved (i = rank in ascending order)
 *   weights    p_i ∝ w_i for a_i > 0, p_0 solved for the zero payout
 */
export function assignProbabilities(A, rtp, method = 'maxent', weights) {
  const n = A.length;
  const amin = A[0], amax = A[n - 1];
  if (!(rtp > amin && rtp < amax)) throw new Error(`rtp ${rtp} must lie strictly between the smallest (${amin}) and largest (${amax}) payout`);

  if (method === 'maxent') {
    const w = lambda => A.map(a => Math.exp(-lambda * (a - amin) / amax));
    const mean = lambda => { const x = w(lambda), Z = x.reduce((s, v) => s + v, 0); return x.reduce((s, v, i) => s + (v / Z) * A[i], 0); };
    const lambda = bisect(mean, rtp, -2000, 2000);
    const x = w(lambda), Z = x.reduce((s, v) => s + v, 0);
    return { p: x.map(v => v / Z), params: { lambda: lambda / amax } };
  }
  if (method === 'geometric') {
    const w = logq => A.map((_, i) => Math.exp(logq * i));
    const mean = logq => { const x = w(logq), Z = x.reduce((s, v) => s + v, 0); return x.reduce((s, v, i) => s + (v / Z) * A[i], 0); };
    const logq = bisect(mean, rtp, -60, 60);
    const x = w(logq), Z = x.reduce((s, v) => s + v, 0);
    return { p: x.map(v => v / Z), params: { q: Math.exp(logq) } };
  }
  if (method === 'weights') {
    const iz = A.indexOf(0);
    if (iz < 0) throw new Error("method 'weights' needs a 0 payout (its probability is the one solved)");
    if (!Array.isArray(weights) || weights.length !== n) throw new Error(`weights must have ${n} entries, one per payout (the zero payout's entry is ignored)`);
    const W = weights.map((w, i) => (i === iz ? 0 : Number(w)));
    if (W.some(w => !Number.isFinite(w) || w < 0)) throw new Error('weights must be finite and ≥ 0');
    const Wt = W.reduce((s, w) => s + w, 0);
    if (!(Wt > 0)) throw new Error('weights must have a positive total');
    const Enz = W.reduce((s, w, i) => s + (w / Wt) * A[i], 0);
    if (!(Enz > rtp)) throw new Error(`E[payout | win] = ${Enz.toFixed(4)} must exceed rtp ${rtp}`);
    const p0 = 1 - rtp / Enz;
    return { p: W.map((w, i) => (i === iz ? p0 : (1 - p0) * w / Wt)), params: { p0, Enz } };
  }
  throw new Error(`unknown method "${method}"`);
}

export function buildPayout({ payouts, rtp, method = 'maxent', weights, fraction = 0.1, probabilities } = {}) {
  if (!Array.isArray(payouts) || payouts.length < 2) throw new Error('need at least two payouts');
  const raw = payouts.map(Number);
  if (raw.some(a => !Number.isFinite(a) || a < 0)) throw new Error('payouts must be finite and ≥ 0');
  if (new Set(raw).size !== raw.length) throw new Error('payouts must be distinct');
  if (!(fraction > 0 && fraction < 0.5)) throw new Error('fraction must be in (0, 0.5) so adjacent bands cannot overlap');

  // sort ascending; carry weights along
  const order = raw.map((_, i) => i).sort((i, j) => raw[i] - raw[j]);
  const A = order.map(i => raw[i]);
  const W = Array.isArray(weights) ? order.map(i => weights[i]) : undefined;

  let p, params;
  if (Array.isArray(probabilities)) {
    // caller-supplied probabilities: validate both constraints
    p = order.map(i => Number(probabilities[i]));
    if (p.some(x => !(x > 0))) throw new Error('every probability must be > 0 (drop a payout instead of giving it probability 0)');
    const sum = p.reduce((s, x) => s + x, 0), ev = p.reduce((s, x, i) => s + x * A[i], 0);
    if (Math.abs(sum - 1) > 1e-9) throw new Error(`probabilities sum to ${sum}, not 1`);
    if (rtp !== undefined && Math.abs(ev - rtp) > 1e-9) throw new Error(`Σ p·a = ${ev}, not the requested rtp ${rtp}`);
    rtp = ev; method = 'given'; params = {};
  } else {
    if (rtp === undefined) throw new Error('rtp is required');
    ({ p, params } = assignProbabilities(A, rtp, method, W));
  }

  const breaks = [0];
  let acc = 0;
  for (const x of p) { acc += x; breaks.push(acc); }
  breaks[breaks.length - 1] = 1;

  const pos = A.filter(a => a > 0);
  if (pos.length < 2) throw new Error('need at least two positive payouts to define a gap');
  const gap = Math.min(...pos.slice(1).map((a, i) => a - pos[i]));
  const r = fraction * gap;
  if (pos[0] - r <= 0) throw new Error(`lowest payout ${pos[0]} minus r=${r} would reach zero`);

  const payout = (u) => {
    if (!(u >= 0 && u < 1)) { if (u === 1) u = 1 - 1e-12; else throw new Error(`u must be in [0,1), got ${u}`); }
    let i = 0;
    while (breaks[i + 1] <= u) i++;
    if (A[i] <= 0) return 0;
    const t = (u - breaks[i]) / (breaks[i + 1] - breaks[i]);
    return A[i] + r * (2 * t - 1);
  };

  const rtpExact = p.reduce((s, x, i) => s + x * A[i], 0);
  const bands = A.map((a, i) => ({
    index: i, payout: a, p: p[i], from: breaks[i], to: breaks[i + 1],
    range: a > 0 ? [a - r, a + r] : [0, 0], rtpContribution: p[i] * a,
  }));
  const secondMoment = bands.reduce((s, b) => s + b.p * (b.payout > 0 ? b.payout ** 2 + r * r / 3 : 0), 0);

  const engine = {
    payouts: A, p, breaks, r, gap, fraction, method, params,
    rtp: rtpExact,
    hitRate: bands.reduce((s, b) => s + (b.payout > 0 ? b.p : 0), 0),
    stdev: Math.sqrt(Math.max(secondMoment - rtpExact ** 2, 0)),
    maxPayout: A[A.length - 1] + r,
    bands,
    byProbability: [...bands].sort((x, y) => y.p - x.p || y.payout - x.payout),
    payout,

    /** Which band a draw falls in. */
    bandOf(u) { let i = 0; while (breaks[i + 1] <= u) i++; return i; },

    /** Integer RNG grid D = floor(N·u), read at cell midpoints. */
    grid(N = 10000) {
      const at = d => payout((d + 0.5) / N);
      let s = 0;
      for (let d = 0; d < N; d++) s += at(d);
      return { N, boundaries: breaks.map(b => b * N), rtp: s / N, residual: s / N - rtpExact, evaluate: at };
    },

    /** Seeded simulation. */
    simulate({ rounds = 100000, seed = 'sim', stake = 1 } = {}) {
      const rng = new Rng(seed, 'payout');
      let tot = 0, sq = 0;
      const perBand = A.map(() => ({ n: 0, sum: 0, min: Infinity, max: -Infinity }));
      for (let k = 0; k < rounds; k++) {
        const u = rng.next(), b = payout(u), i = engine.bandOf(u);
        const w = stake === 1 ? b : Math.round(stake * b) / stake;
        tot += w; sq += w * w;
        const pb = perBand[i]; pb.n++; pb.sum += w; if (w < pb.min) pb.min = w; if (w > pb.max) pb.max = w;
      }
      const mean = tot / rounds, sd = Math.sqrt(Math.max(sq / rounds - mean * mean, 0));
      return {
        rounds, seed, stake, rtp: mean, stdev: sd, se: sd / Math.sqrt(rounds),
        perBand: perBand.map((pb, i) => ({ band: i, payout: A[i], n: pb.n, freq: pb.n / rounds, mean: pb.n ? pb.sum / pb.n : null, min: pb.n ? pb.min : null, max: pb.n ? pb.max : null })),
      };
    },

    /** Hook for an RGS provider: stake in minor units in, integer win out. */
    play({ bet, rng }) {
      const u = rng.next(), b = payout(u);
      return { totalWinAmount: Math.round(bet * b), math: { u, band: engine.bandOf(u), multiple: b, r } };
    },

    /** Dependency-free JS of this exact function. */
    standalone(name = 'payout') {
      return [
        `// Sloped-band payout.  RTP = Σ p_i·a_i = ${rtpExact.toFixed(6)}.  r = ${r} (${fraction} × smallest payout gap ${gap}).`,
        `// Method: ${method}.  u: one uniform in [0,1).  Band i pays a_i − r at its left edge rising to a_i + r at its right edge.`,
        `function ${name}(u) {`,
        `  const breaks = ${JSON.stringify(breaks)};`,
        `  const payouts = ${JSON.stringify(A)};`,
        `  const r = ${r};`,
        `  if (u >= 1) u = 1 - 1e-12;`,
        `  let i = 0; while (breaks[i + 1] <= u) i++;`,
        `  if (payouts[i] <= 0) return 0;`,
        `  const t = (u - breaks[i]) / (breaks[i + 1] - breaks[i]);`,
        `  return payouts[i] + r * (2 * t - 1);`,
        `}`,
      ].join('\n');
    },

    toJSON() {
      return { method, params, payouts: A, probabilities: p, breaks, r, gap, fraction, rtp: rtpExact, hitRate: engine.hitRate, stdev: engine.stdev, bands };
    },
  };
  return engine;
}

export function format(e) {
  const pct = x => `${(100 * x).toFixed(2)}%`;
  const lines = [
    `method ${e.method}   RTP ${e.rtp.toFixed(6)}   hit rate ${pct(e.hitRate)}   stdev ${e.stdev.toFixed(4)}x   r = ${e.r} (${e.fraction} × payout gap ${e.gap})`,
    '',
    'probability (decreasing)   interval [from, to)      payout    pays (left edge → right edge)   rtp contribution',
  ];
  for (const b of e.byProbability) {
    lines.push(`  ${pct(b.p).padStart(8)}                 [${b.from.toFixed(4)}, ${b.to.toFixed(4)})   ${(b.payout > 0 ? b.payout + 'x' : 'no win').padStart(7)}   ${(b.payout > 0 ? `${b.range[0].toFixed(4)} → ${b.range[1].toFixed(4)}` : '—').padEnd(30)} ${b.rtpContribution.toFixed(4)}`);
  }
  return lines.join('\n');
}
