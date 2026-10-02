#!/usr/bin/env node
// Data for scripts/plot.py:  node scripts/facts.js > examples/facts.json
import { buildFight } from '../src/engine.js'; import { Rng } from '../src/rng.js'; import { PRESETS } from '../src/rgs.js';
const out = { gaps: [], hpGaps: [], paths: [], presets: {} };
for (let gap = -400; gap <= 400; gap += 25) out.gaps.push([gap, buildFight({ A: { power: 1600 + gap, hp: 100 }, B: { power: 1600, hp: 100 } }).pA0]);
for (let hp = 50; hp <= 160; hp += 5) out.hpGaps.push([hp, buildFight({ A: { power: 1600, hp }, B: { power: 1600, hp: 100 } }).pA0]);
const F = buildFight(PRESETS.favourite);
for (const seed of ['path-1', 'path-2', 'path-3']) { const f = F.play(new Rng(seed, 'payout')); out.paths.push({ seed, winner: f.winner, how: f.how, log: f.log, hp: F.hp, pA0: F.pA0 }); }
for (const [name, cfg] of Object.entries(PRESETS)) { const G = buildFight(cfg); const s = G.simulate({ rounds: 100000, seed: 'plot', liveAt: 5 }); out.presets[name] = { pA0: G.pA0, odds: G.odds, sim: s, fighters: cfg }; }
console.log(JSON.stringify(out));
