// Distributions engine.  See ALGORITHM.md.
//
//   const S = buildShot({ dist: 'lognormal', params: { mu: 0, sigma: 0.8 }, rtp: 0.95, max: 50 });
//   S.multiple(u)        // paid multiple for one uniform: scale × clamp(quantile(u), min, max)
//   S.rtp, S.scale, S.maxMultiple, S.hitRate
//
// Money mode: the chosen distribution gives the SHAPE of the payout; the engine clamps it to [min, max],
// computes the mean of the clamped sample exactly (closed sum for discrete, adaptive Simpson to 1e-12 on
// the quantile for continuous) and scales by rtp / mean, so E[multiple] = rtp exactly. One uniform per bet.
// Draw mode (no money) just returns quantile(u) for any library entry.

import { getDist, DIST_NAMES, describeLibrary } from './dists.js';
import { Rng } from './rng.js';
export { getDist, DIST_NAMES, describeLibrary };

/** Find u with quantile(u) = x for a monotone quantile (bisection). Returns 0 / 1 when x is outside the range. */
function invert(q, x, lo = 0, hi = 1 - 1e-12) {
  if (!(q(lo) < x)) return 0; if (!(q(hi) > x)) return 1;
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (q(m) < x) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
/** Adaptive Simpson on [a, b]: recursive bisection until the local estimate is within tol (handles steep quantile tails). */
function simpson(f, a, b, tol = 1e-12, depth = 60) {
  if (b <= a) return 0;
  const S = (l, r, fl, fm, fr) => (r - l) / 6 * (fl + 4 * fm + fr);
  const rec = (l, r, fl, fm, fr, whole, t, d) => {
    const m = (l + r) / 2, lm = (l + m) / 2, rm = (m + r) / 2, flm = f(lm), frm = f(rm);
    const left = S(l, m, fl, flm, fm), right = S(m, r, fm, frm, fr), delta = left + right - whole;
    if (d <= 0 || Math.abs(delta) <= 15 * t) return left + right + delta / 15;
    return rec(l, m, fl, flm, fm, left, t / 2, d - 1) + rec(m, r, fm, frm, fr, right, t / 2, d - 1);
  };
  const fa = f(a), fb = f(b), fm = f((a + b) / 2);
  return rec(a, b, fa, fm, fb, S(a, b, fa, fm, fb), tol, depth);
}

export function buildShot({ dist, params = {}, rtp = 0.95, min = 0, max = Infinity, name } = {}) {
  if (!(rtp > 0 && rtp < 1)) throw new Error(`rtp must be in (0,1), got ${rtp}`);
  const d = getDist(dist, params);
  if (dist === 'permutation') throw new Error('permutation has no money mode');
  if (!(min >= 0)) throw new Error('min must be ≥ 0'); if (!(max > min)) throw new Error('max must be > min');
  if (!Number.isFinite(max) && !Number.isFinite(d.mean)) throw new Error(`${dist} with these parameters has an infinite mean; set a finite max`);
  const clamp = x => Math.min(max, Math.max(min, x));
  let mean, hit;   // E[clamp(X)] and P(clamp(X) > 0)
  if (d.pmf) { mean = d.pmf.reduce((s, p, i) => s + p * clamp(d.values[i]), 0); hit = d.pmf.reduce((s, p, i) => s + (clamp(d.values[i]) > 0 ? p : 0), 0); }
  else {
    const uLo = invert(d.quantile, min), uHi = Number.isFinite(max) ? invert(d.quantile, max) : 1 - 1e-9;
    mean = min * uLo + simpson(u => d.quantile(u), uLo, uHi) + (Number.isFinite(max) ? max * (1 - uHi) : 0);
    hit = 1 - (min > 0 ? 0 : invert(d.quantile, 0));
  }
  if (!(mean > 0)) throw new Error('the clamped distribution has zero mean; nothing to scale');
  const scale = rtp / mean;
  const multiple = u => scale * clamp(d.quantile(u >= 1 ? 1 - 1e-12 : u));
  const S = {
    name: name ?? `${dist}-${rtp}`, dist, params: d.params, kind: d.kind, rtp, min, max, meanRaw: d.mean, meanClamped: mean, scale, hitRate: hit,
    maxMultiple: scale * (Number.isFinite(max) ? max : d.support[1]), minMultiple: scale * Math.max(min, d.support[0]),
    multiple,
    play({ bet, rng }) { const u = rng.next(), m = multiple(u); return { totalWinAmount: Math.round(bet * m), multiple: m, math: { u, raw: d.quantile(u), scale } }; },
    simulate({ rounds = 200000, seed = 'sim' } = {}) { const rng = new Rng(seed, 'payout'); let t = 0, q = 0; for (let i = 0; i < rounds; i++) { const m = multiple(rng.next()); t += m; q += m * m; } const mu = t / rounds, sd = Math.sqrt(Math.max(q / rounds - mu * mu, 0)); return { rounds, seed, rtp: mu, stdev: sd, se: sd / Math.sqrt(rounds) }; },
    /** Exact-by-summation check: midpoint rule on 1e6 cells (continuous) or the pmf sum (discrete). */
    rtpCheck(N = 1000000) { if (d.pmf) return S.rtp; let s = 0; for (let i = 0; i < N; i++) s += multiple((i + 0.5) / N); return s / N; },
    toJSON() { return { name: S.name, dist, params: d.params, kind: d.kind, rtp, min, max, meanRaw: d.mean, meanClamped: mean, scale, hitRate: hit, maxMultiple: S.maxMultiple }; },
  };
  return S;
}

/** A free sealed draw from any library entry. */
export function drawFrom({ dist, rng, ...params }) {
  const d = getDist(dist, params); const u = rng.next(); const value = d.quantile(u);
  return { dist, params: d.params, u, value, ...(d.label ? { label: d.label(value) } : {}), mean: d.mean, kind: d.kind };
}

export function format(S) {
  return [`${S.name}   ${S.dist} ${JSON.stringify(S.params)}   RTP ${S.rtp}`, `clamp [${S.min}, ${S.max}]   raw mean ${Number.isFinite(S.meanRaw) ? S.meanRaw.toFixed(6) : '∞'}   clamped mean ${S.meanClamped.toFixed(6)}   scale ${S.scale.toFixed(6)}`, `paid multiple: ${S.minMultiple.toFixed(4)}x … ${Number.isFinite(S.maxMultiple) ? S.maxMultiple.toFixed(4) + 'x' : 'unbounded'}   P(win > 0) ${(100 * S.hitRate).toFixed(2)}%   E[multiple] = ${S.rtp}`].join('\n');
}
