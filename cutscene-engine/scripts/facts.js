#!/usr/bin/env node
import { buildCutscene, buildSideBet } from '../src/engine.js'; import { Rng } from '../src/rng.js'; import { PRESETS, SIDE_LIBRARY } from '../src/rgs.js';
const out = { presets: {}, side: {} };
for (const [name, cfg] of Object.entries(PRESETS)) { const C = buildCutscene(cfg); C._rng = { Rng }; const s = C.simulate({ rounds: 100000, seed: 'plot' }); out.presets[name] = { pA: C.pA, odds: C.odds, sim: s }; }
const C = buildCutscene(PRESETS.even);
for (const [name, params] of Object.entries(SIDE_LIBRARY)) { const S = buildSideBet(params); const rng = new Rng('side-' + name, 'side'); let tot = 0; const N = 100000; for (let i = 0; i < N; i++) tot += C.sideBet({ bet: 1000, params, rng }).totalWinAmount; out.side[name] = { options: S.options, odds: S.odds ?? null, payouts: S.payouts ?? null, probs: S.probs, rtp: tot / N / 1000 }; }
console.log(JSON.stringify(out));
