// The distribution library. Every entry maps ONE uniform u ∈ [0,1) to a sample through its inverse CDF
// (quantile function), so a draw is reproducible from the seed and auditable from the revealed u.
// Discrete distributions use the cumulative table; `permutation` recycles the uniform (Fisher–Yates).
//
//   const d = getDist('lognormal', { mu: 0, sigma: 0.8 });
//   d.quantile(u)   d.mean   d.variance   d.support   d.params (validated)

const erf = x => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
const Phi = x => 0.5 * (1 + erf(x / Math.SQRT2));
/** Standard normal quantile: Acklam's rational approximation refined with one Halley step on the A&S erf (|err| ≈ 1e-6; the engine integrates the same function it samples, so RTP stays consistent). */
export function normalQuantile(p) {
  if (!(p > 0 && p < 1)) { if (p <= 0) return -Infinity; return Infinity; }
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239], b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783], d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  let x;
  if (p < 0.02425) { const q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  else if (p > 1 - 0.02425) { const q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  else { const q = p - 0.5, r = q * q; x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
  const e = Phi(x) - p, uu = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2); x = x - uu / (1 + x * uu / 2);   // Halley refinement
  return x;
}
const num = (v, name, { min = -Infinity, max = Infinity, int = false, gt, ge } = {}) => {
  if (v === undefined || v === null || !Number.isFinite(Number(v))) throw new Error(`${name} must be a number`); v = Number(v);
  if (int && !Number.isInteger(v)) throw new Error(`${name} must be an integer`); if (gt !== undefined && !(v > gt)) throw new Error(`${name} must be > ${gt}`); if (ge !== undefined && !(v >= ge)) throw new Error(`${name} must be ≥ ${ge}`);
  if (v < min || v > max) throw new Error(`${name} must be in [${min}, ${max}]`); return v;
};
const clampU = u => (u >= 1 ? 1 - 1e-12 : u < 0 ? 0 : u);
const discrete = (pmf, support) => { const cum = [0]; for (const p of pmf) cum.push(cum[cum.length - 1] + p); cum[cum.length - 1] = 1; return { pmf, values: support, cum, quantile: u => { u = clampU(u); let i = 0; while (cum[i + 1] <= u) i++; return support[i]; } }; };

export const LIBRARY = {
  uniform: { kind: 'continuous', params: { a: { default: 0, doc: 'lower bound' }, b: { default: 1, doc: 'upper bound, > a' } },
    build: p => { const a = num(p.a ?? 0, 'a'), b = num(p.b ?? 1, 'b', { gt: a }); return { params: { a, b }, support: [a, b], mean: (a + b) / 2, variance: (b - a) ** 2 / 12, quantile: u => a + (b - a) * clampU(u) }; } },
  triangular: { kind: 'continuous', params: { a: { default: 0 }, b: { default: 1 }, c: { default: 0.5, doc: 'mode, a ≤ c ≤ b' } },
    build: p => { const a = num(p.a ?? 0, 'a'), b = num(p.b ?? 1, 'b', { gt: a }), c = num(p.c ?? (a + b) / 2, 'c', { min: a, max: b }); const F = (c - a) / (b - a); return { params: { a, b, c }, support: [a, b], mean: (a + b + c) / 3, variance: (a * a + b * b + c * c - a * b - a * c - b * c) / 18, quantile: u => { u = clampU(u); return u < F ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c)); } }; } },
  normal: { kind: 'continuous', params: { mu: { default: 0 }, sigma: { default: 1, doc: '> 0' } },
    build: p => { const mu = num(p.mu ?? 0, 'mu'), sigma = num(p.sigma ?? 1, 'sigma', { gt: 0 }); return { params: { mu, sigma }, support: [-Infinity, Infinity], mean: mu, variance: sigma * sigma, quantile: u => mu + sigma * normalQuantile(clampU(Math.max(u, 1e-300))) }; } },
  lognormal: { kind: 'continuous', params: { mu: { default: 0, doc: 'mean of log' }, sigma: { default: 0.5, doc: 'sd of log, > 0' } },
    build: p => { const mu = num(p.mu ?? 0, 'mu'), sigma = num(p.sigma ?? 0.5, 'sigma', { gt: 0 }); const m = Math.exp(mu + sigma * sigma / 2); return { params: { mu, sigma }, support: [0, Infinity], mean: m, variance: (Math.exp(sigma * sigma) - 1) * m * m, quantile: u => Math.exp(mu + sigma * normalQuantile(clampU(Math.max(u, 1e-300)))) }; } },
  halfnormal: { kind: 'continuous', params: { sigma: { default: 1, doc: 'scale, > 0 (mean = sigma·√(2/π))' } },
    build: p => { const sigma = num(p.sigma ?? 1, 'sigma', { gt: 0 }); return { params: { sigma }, support: [0, Infinity], mean: sigma * Math.sqrt(2 / Math.PI), variance: sigma * sigma * (1 - 2 / Math.PI), quantile: u => sigma * normalQuantile(0.5 + clampU(u) / 2) }; } },
  exponential: { kind: 'continuous', params: { rate: { default: 1, doc: 'λ > 0 (mean 1/λ)' } },
    build: p => { const rate = num(p.rate ?? 1, 'rate', { gt: 0 }); return { params: { rate }, support: [0, Infinity], mean: 1 / rate, variance: 1 / (rate * rate), quantile: u => -Math.log(1 - clampU(u)) / rate }; } },
  logistic: { kind: 'continuous', params: { mu: { default: 0 }, s: { default: 1, doc: 'scale > 0' } },
    build: p => { const mu = num(p.mu ?? 0, 'mu'), s = num(p.s ?? 1, 's', { gt: 0 }); return { params: { mu, s }, support: [-Infinity, Infinity], mean: mu, variance: s * s * Math.PI * Math.PI / 3, quantile: u => { u = clampU(Math.max(u, 1e-300)); return mu + s * Math.log(u / (1 - u)); } }; } },
  weibull: { kind: 'continuous', params: { k: { default: 1.5, doc: 'shape > 0' }, lambda: { default: 1, doc: 'scale > 0' } },
    build: p => { const k = num(p.k ?? 1.5, 'k', { gt: 0 }), lambda = num(p.lambda ?? 1, 'lambda', { gt: 0 }); const g = x => gammaFn(x); return { params: { k, lambda }, support: [0, Infinity], mean: lambda * g(1 + 1 / k), variance: lambda * lambda * (g(1 + 2 / k) - g(1 + 1 / k) ** 2), quantile: u => lambda * Math.pow(-Math.log(1 - clampU(u)), 1 / k) }; } },
  pareto: { kind: 'continuous', params: { xm: { default: 1, doc: 'minimum > 0' }, alpha: { default: 2, doc: 'tail index > 0 (mean needs α > 1)' } },
    build: p => { const xm = num(p.xm ?? 1, 'xm', { gt: 0 }), alpha = num(p.alpha ?? 2, 'alpha', { gt: 0 }); return { params: { xm, alpha }, support: [xm, Infinity], mean: alpha > 1 ? alpha * xm / (alpha - 1) : Infinity, variance: alpha > 2 ? xm * xm * alpha / ((alpha - 1) ** 2 * (alpha - 2)) : Infinity, quantile: u => xm * Math.pow(1 - clampU(u), -1 / alpha) }; } },
  bernoulli: { kind: 'discrete', params: { p: { default: 0.5, doc: 'P(1)' } },
    build: q => { const p = num(q.p ?? 0.5, 'p', { min: 0, max: 1 }); const d = discrete([1 - p, p], [0, 1]); return { params: { p }, support: [0, 1], mean: p, variance: p * (1 - p), ...d }; } },
  binomial: { kind: 'discrete', params: { n: { default: 10, doc: 'trials, integer ≥ 1' }, p: { default: 0.5 } },
    build: q => { const n = num(q.n ?? 10, 'n', { int: true, ge: 1, max: 10000 }), p = num(q.p ?? 0.5, 'p', { min: 0, max: 1 }); const pmf = []; let lc = 0; for (let k = 0; k <= n; k++) { pmf.push(Math.exp(lc + k * Math.log(p || 1e-300) + (n - k) * Math.log(1 - p || 1e-300))); lc += Math.log((n - k) / (k + 1)); } const Z = pmf.reduce((s, x) => s + x, 0); const d = discrete(pmf.map(x => x / Z), Array.from({ length: n + 1 }, (_, k) => k)); return { params: { n, p }, support: [0, n], mean: n * p, variance: n * p * (1 - p), ...d }; } },
  poisson: { kind: 'discrete', params: { lambda: { default: 3, doc: 'mean > 0' } },
    build: q => { const lambda = num(q.lambda ?? 3, 'lambda', { gt: 0, max: 1000 }); const pmf = []; let term = Math.exp(-lambda), cum = 0, k = 0; while (cum < 1 - 1e-12 && k < 5000) { pmf.push(term); cum += term; k++; term *= lambda / k; } const Z = pmf.reduce((s, x) => s + x, 0); const d = discrete(pmf.map(x => x / Z), pmf.map((_, i) => i)); return { params: { lambda }, support: [0, pmf.length - 1], mean: lambda, variance: lambda, ...d }; } },
  geometric: { kind: 'discrete', params: { p: { default: 0.3, doc: 'success probability; value = failures before the first success' } },
    build: q => { const p = num(q.p ?? 0.3, 'p', { gt: 0, max: 1 }); const pm = []; let t = p, cum = 0; while (cum < 1 - 1e-12 && pm.length < 100000) { pm.push(t); cum += t; t *= 1 - p; } const Z = pm.reduce((s, x) => s + x, 0); return { params: { p }, support: [0, Infinity], mean: (1 - p) / p, variance: (1 - p) / (p * p), pmf: pm.map(x => x / Z), values: pm.map((_, i) => i), quantile: u => p >= 1 ? 0 : Math.floor(Math.log(1 - clampU(u)) / Math.log(1 - p)) }; } },
  categorical: { kind: 'discrete', params: { weights: { default: [1, 1], doc: 'relative weights; outcome i is OPTION_i+1' } },
    build: q => { const w = (q.weights ?? [1, 1]).map(Number); if (w.length < 2 || w.some(x => !(x >= 0)) || !(w.reduce((s, x) => s + x, 0) > 0)) throw new Error('weights: ≥ 2 non-negative numbers with a positive sum'); const W = w.reduce((s, x) => s + x, 0), pmf = w.map(x => x / W); const d = discrete(pmf, pmf.map((_, i) => i)); return { params: { weights: w }, options: pmf.map((_, i) => `OPTION_${i + 1}`), support: [0, w.length - 1], mean: pmf.reduce((s, x, i) => s + x * i, 0), variance: NaN, ...d, quantile: u => d.quantile(u), label: i => `OPTION_${i + 1}` }; } },
  dice: { kind: 'discrete', params: { sides: { default: 6, doc: 'integer ≥ 2' } },
    build: q => { const n = num(q.sides ?? 6, 'sides', { int: true, ge: 2, max: 1000000 }); const pm = n <= 100000 ? Array.from({ length: n }, () => 1 / n) : undefined; return { params: { sides: n }, support: [1, n], mean: (n + 1) / 2, variance: (n * n - 1) / 12, pmf: pm, values: pm ? pm.map((_, i) => i + 1) : undefined, quantile: u => 1 + Math.floor(clampU(u) * n) }; } },
  permutation: { kind: 'discrete', params: { n: { default: 5, doc: 'items, integer 2..20; returns an ordering of 0..n−1' } },
    build: q => { const n = num(q.n ?? 5, 'n', { int: true, ge: 2, max: 20 }); return { params: { n }, support: [0, n - 1], mean: NaN, variance: NaN, quantile: u => { u = clampU(u); const a = Array.from({ length: n }, (_, i) => i); for (let i = 0; i < n - 1; i++) { const m = n - i, j = i + Math.floor(u * m); u = u * m - Math.floor(u * m); [a[i], a[j]] = [a[j], a[i]]; } return a; } }; } },
};
// Lanczos gamma for the Weibull moments
function gammaFn(z) { const g = 7, C = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]; if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gammaFn(1 - z)); z -= 1; let x = C[0]; for (let i = 1; i < g + 2; i++) x += C[i] / (z + i); const t = z + g + 0.5; return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x; }

export const DIST_NAMES = Object.keys(LIBRARY);
export function getDist(name, params = {}) {
  const entry = LIBRARY[name]; if (!entry) throw new Error(`unknown distribution "${name}"; library: ${DIST_NAMES.join(', ')}`);
  const d = entry.build(params); return { name, kind: entry.kind, paramDoc: entry.params, ...d };
}
/** Library description for open(): names, parameter docs and defaults. */
export const describeLibrary = () => Object.fromEntries(Object.entries(LIBRARY).map(([k, v]) => [k, { kind: v.kind, params: Object.fromEntries(Object.entries(v.params).map(([n, p]) => [n, { default: p.default, doc: p.doc ?? '' }])) }]));
