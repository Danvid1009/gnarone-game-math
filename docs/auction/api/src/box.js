// The locker: a one-shot multiplier X with E[X] = 1 exactly, built the Single Shot way.
//
//   const B = buildBox({ payouts: [0.25, 0.5, 1, 2, 5] });   // mean 1, maxent weights
//   B.multiplier(v)       // v ~ Uniform[0,1)  ->  X, a sloped-band draw around the listed multiples
//
// Bands: interval i on [0,1) has width p_i; inside it X ramps from a_i − r to a_i + r with
// r = fraction × (smallest gap between adjacent positive multiples), so E[X | band i] = a_i
// and E[X] = Σ p_i a_i = mean exactly. A 0 multiple (empty locker) pays 0 flat.

function bisect(f, target, lo, hi, iters = 300) {
  const flo = f(lo), fhi = f(hi);
  if ((flo - target) * (fhi - target) > 0) throw new Error(`solver: target ${target} not reachable`);
  const inc = fhi > flo;
  for (let i = 0; i < iters; i++) { const mid = (lo + hi) / 2; if ((f(mid) < target) === inc) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

/** Probabilities for ascending multiples A with Σ p = 1, Σ p·A = mean.  maxent: p ∝ e^{−λa};  geometric: p ∝ q^i. */
export function assignProbabilities(A, mean, method = 'maxent') {
  const n = A.length, amin = A[0], amax = A[n - 1];
  if (!(mean > amin && mean < amax)) throw new Error(`mean ${mean} must lie strictly between the smallest (${amin}) and largest (${amax}) multiple`);
  const solve = (w, lo, hi) => {
    const m = t => { const x = w(t), Z = x.reduce((s, v) => s + v, 0); return x.reduce((s, v, i) => s + (v / Z) * A[i], 0); };
    const t = bisect(m, mean, lo, hi); const x = w(t), Z = x.reduce((s, v) => s + v, 0);
    return { p: x.map(v => v / Z), t };
  };
  if (method === 'maxent') { const { p, t } = solve(l => A.map(a => Math.exp(-l * (a - amin) / amax)), -2000, 2000); return { p, params: { lambda: t / amax } }; }
  if (method === 'geometric') { const { p, t } = solve(lq => A.map((_, i) => Math.exp(lq * i)), -60, 60); return { p, params: { q: Math.exp(t) } }; }
  throw new Error(`unknown method "${method}"`);
}

export function buildBox({ payouts = [0.25, 0.5, 1, 2, 5], mean = 1, method = 'maxent', probabilities, fraction = 0.1 } = {}) {
  if (!Array.isArray(payouts) || payouts.length < 2) throw new Error('box needs at least two multiples');
  const raw = payouts.map(Number);
  if (raw.some(a => !Number.isFinite(a) || a < 0)) throw new Error('box multiples must be finite and ≥ 0');
  if (new Set(raw).size !== raw.length) throw new Error('box multiples must be distinct');
  if (!(fraction > 0 && fraction < 0.5)) throw new Error('fraction must be in (0, 0.5)');
  const order = raw.map((_, i) => i).sort((i, j) => raw[i] - raw[j]);
  const A = order.map(i => raw[i]);
  let p, params;
  if (Array.isArray(probabilities)) {
    p = order.map(i => Number(probabilities[i]));
    if (p.some(x => !(x > 0))) throw new Error('every box probability must be > 0');
    const sum = p.reduce((s, x) => s + x, 0), ev = p.reduce((s, x, i) => s + x * A[i], 0);
    if (Math.abs(sum - 1) > 1e-9) throw new Error(`box probabilities sum to ${sum}, not 1`);
    if (Math.abs(ev - mean) > 1e-9) throw new Error(`Σ p·a = ${ev}, not the requested mean ${mean}`);
    method = 'given'; params = {};
  } else ({ p, params } = assignProbabilities(A, mean, method));
  const breaks = [0]; let acc = 0; for (const x of p) { acc += x; breaks.push(acc); } breaks[breaks.length - 1] = 1;
  const pos = A.filter(a => a > 0);
  if (pos.length < 2) throw new Error('need at least two positive multiples to define a gap');
  const gap = Math.min(...pos.slice(1).map((a, i) => a - pos[i]));
  const r = fraction * gap;
  if (pos[0] - r <= 0) throw new Error(`lowest multiple ${pos[0]} minus r=${r} would reach zero`);
  const bandOf = v => { if (v >= 1) v = 1 - 1e-12; let i = 0; while (breaks[i + 1] <= v) i++; return i; };
  const multiplier = v => {
    if (!(v >= 0 && v <= 1)) throw new Error(`v must be in [0,1], got ${v}`);
    if (v >= 1) v = 1 - 1e-12;
    const i = bandOf(v); if (A[i] <= 0) return 0;
    const t = (v - breaks[i]) / (breaks[i + 1] - breaks[i]);
    return A[i] + r * (2 * t - 1);
  };
  const meanExact = p.reduce((s, x, i) => s + x * A[i], 0);
  const second = p.reduce((s, x, i) => s + x * (A[i] > 0 ? A[i] ** 2 + r * r / 3 : 0), 0);
  return {
    payouts: A, p, breaks, r, gap, fraction, method, params, mean: meanExact, secondMoment: second,
    stdev: Math.sqrt(Math.max(second - meanExact ** 2, 0)), maxMultiplier: A[A.length - 1] + r, minMultiplier: A[0] > 0 ? A[0] - r : 0,
    bands: A.map((a, i) => ({ index: i, multiple: a, p: p[i], from: breaks[i], to: breaks[i + 1], range: a > 0 ? [a - r, a + r] : [0, 0] })),
    bandOf, multiplier,
    toJSON() { return { method, params, payouts: A, probabilities: p, breaks, r, gap, fraction, mean: meanExact, stdev: this.stdev, bands: this.bands }; },
  };
}
