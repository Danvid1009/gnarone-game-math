#!/usr/bin/env node
import { buildShot, getDist, DIST_NAMES } from '../src/engine.js'; import { PRESETS } from '../src/rgs.js';
const out = { presets: {}, library: {} };
for (const [name, cfg] of Object.entries(PRESETS)) { const S = buildShot(cfg); const N = 4000; const samples = Array.from({ length: N }, (_, i) => S.multiple((i + 0.5) / N)); out.presets[name] = { ...S.toJSON(), samples, sim: S.simulate({ rounds: 1000000, seed: 'plot' }) }; }
for (const n of DIST_NAMES) { if (n === 'permutation') continue; const d = getDist(n); out.library[n] = { kind: d.kind, params: d.params, mean: d.mean, q: Array.from({ length: 199 }, (_, i) => [ (i + 1) / 200, d.quantile((i + 1) / 200) ]) }; }
console.log(JSON.stringify(out));
