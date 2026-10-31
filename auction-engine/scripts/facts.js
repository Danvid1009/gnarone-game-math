#!/usr/bin/env node
import { buildLockerWars } from '../src/engine.js'; import { PRESETS } from '../src/rgs.js';
const out = {};
for (const [name, cfg] of Object.entries(PRESETS)) { const A = buildLockerWars(cfg); const s = A.simulate({ rounds: 100000, seed: 'plot' }); out[name] = { ...A.toJSON(), sim: s }; }
console.log(JSON.stringify(out));
