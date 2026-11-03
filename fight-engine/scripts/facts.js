#!/usr/bin/env node
// Data for scripts/plot.py:  node scripts/facts.js > examples/facts.json
import { buildFight } from '../src/engine.js'; import { Rng } from '../src/rng.js'; import { PRESETS } from '../src/rgs.js';
const out = { gaps: [], splits: [], paths: [], presets: {} };
// Elo gap → P(A): the formula, and the calibrated grid's achieved value (they coincide)
for (let gap = -400; gap <= 400; gap += 50) { const F = buildFight({ A: { power: 800 + gap / 2, hp: 800 + gap / 2 }, B: { power: 800, hp: 800 } }); out.gaps.push([gap, F.calibration.target, F.pA0]); }
// same Elo (1600 v 1600), A's power share from 0.3 to 0.7: price fixed at 50%, the fight changes (landing rate solved, KO rate, length)
for (let split = 0.3; split <= 0.7001; split += 0.05) { const F = buildFight({ A: { elo: 1600, split }, B: { power: 800, hp: 800 } }); const s = F.simulate({ rounds: 20000, seed: 'split' }); let len = 0; const r = new Rng('len', 'payout'); for (let i = 0; i < 2000; i++) len += F.play(r).ticks; out.splits.push({ split: +split.toFixed(2), pA0: F.pA0, pLand: F.pLand.A, health: F.hp.A, damage: F.damage.A.mean, ko: s.koRate, meanTicks: len / 2000 }); }
const F = buildFight(PRESETS.favourite);
for (const seed of ['path-1', 'path-2', 'path-3']) { const f = F.play(new Rng(seed, 'payout')); out.paths.push({ seed, winner: f.winner, how: f.how, log: f.log, hp: F.hp, pA0: F.pA0 }); }
for (const [name, cfg] of Object.entries(PRESETS)) { const G = buildFight(cfg); const s = G.simulate({ rounds: 100000, seed: 'plot', liveAt: 5 }); out.presets[name] = { pA0: G.pA0, odds: G.odds, sim: s, fighters: cfg }; }
console.log(JSON.stringify(out));
