import { test } from 'node:test'; import assert from 'node:assert/strict';
import { buildShot, drawFrom, getDist, DIST_NAMES } from '../src/engine.js'; import { normalQuantile as nq } from '../src/dists.js'; import { Rng } from '../src/rng.js';
const close = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

test('library: every quantile is monotone in u, means match closed forms, discrete tables sum to 1, validation errors', () => {
  for (const name of DIST_NAMES) {
    const d = getDist(name); if (name === 'permutation') { const a = d.quantile(0.37); assert.equal(a.length, 5); assert.deepEqual([...a].sort(), [0, 1, 2, 3, 4]); continue; }
    let prev = -Infinity; for (let i = 1; i < 2000; i++) { const x = d.quantile(i / 2000); assert.ok(x >= prev - 1e-12, `${name} monotone at ${i}`); prev = x; }
    if (d.pmf) { assert.ok(close(d.pmf.reduce((s, x) => s + x, 0), 1), `${name} pmf sums to 1`); if (Number.isFinite(d.mean)) assert.ok(close(d.pmf.reduce((s, p, i) => s + p * d.values[i], 0), d.mean, 1e-6), `${name} pmf mean`); }
    else if (Number.isFinite(d.mean)) { const N = 400000; let s = 0; for (let i = 0; i < N; i++) s += d.quantile((i + 0.5) / N); assert.ok(Math.abs(s / N - d.mean) < 2e-3 * Math.max(1, Math.abs(d.mean)), `${name} numeric mean ${s / N} vs ${d.mean}`); }
  }
  assert.ok(Math.abs(nq(0.975) - 1.959963985) < 1e-5); assert.ok(Math.abs(nq(0.5)) < 1e-12);
  assert.throws(() => getDist('normal', { sigma: -1 }), /sigma/); assert.throws(() => getDist('uniform', { a: 2, b: 1 }), /b must be/); assert.throws(() => getDist('categorical', { weights: [1] }), /weights/); assert.throws(() => getDist('nope'), /unknown distribution/);
});

test('money mode: E[multiple] = rtp exactly by summation, simulation agrees, clamp and scale are honoured', () => {
  for (const cfg of [{ dist: 'lognormal', params: { mu: 0, sigma: 0.8 }, max: 50 }, { dist: 'exponential', params: { rate: 1 }, max: 20 }, { dist: 'uniform', params: { a: 0, b: 1 } }, { dist: 'normal', params: { mu: 1, sigma: 0.5 }, min: 0, max: 3 }, { dist: 'pareto', params: { xm: 0.5, alpha: 2.5 }, max: 100 }, { dist: 'poisson', params: { lambda: 1 } }, { dist: 'dice', params: { sides: 6 } }, { dist: 'geometric', params: { p: 0.4 } }, { dist: 'binomial', params: { n: 5, p: 0.3 } }]) {
    const S = buildShot({ ...cfg, rtp: 0.95 });
    assert.ok(Math.abs(S.rtpCheck(2000000) - 0.95) < 3e-4, `${cfg.dist} summation ${S.rtpCheck(2000000)}`);
    const s = S.simulate({ rounds: 200000, seed: 'mc' }); assert.ok(Math.abs(s.rtp - 0.95) < 4 * s.se + 1e-4, `${cfg.dist} sim ${s.rtp} se ${s.se}`);
    const rng = new Rng('clamp'); for (let i = 0; i < 20000; i++) { const m = S.multiple(rng.next()); assert.ok(m >= S.minMultiple - 1e-9 && m <= S.maxMultiple + 1e-9, `${cfg.dist} range`); }
    assert.ok(close(S.scale * S.meanClamped, 0.95));
  }
  assert.throws(() => buildShot({ dist: 'pareto', params: { xm: 1, alpha: 0.8 } }), /infinite mean/); assert.throws(() => buildShot({ dist: 'permutation' }), /no money mode/);
});

test('draws: deterministic from the uniform source, categorical labels, permutation', () => {
  const a = drawFrom({ dist: 'normal', mu: 10, sigma: 2, rng: new Rng('d') }), b = drawFrom({ dist: 'normal', mu: 10, sigma: 2, rng: new Rng('d') }); assert.deepEqual(a, b); assert.equal(a.kind, 'continuous');
  const c = drawFrom({ dist: 'categorical', weights: [5, 3, 2], rng: new Rng('c') }); assert.ok(/^OPTION_[123]$/.test(c.label)); assert.equal(c.label, `OPTION_${c.value + 1}`);
  const p = drawFrom({ dist: 'permutation', n: 6, rng: new Rng('p') }); assert.equal(p.value.length, 6);
});
