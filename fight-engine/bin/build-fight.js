#!/usr/bin/env node
// node bin/build-fight.js --a 1700,100 --b 1550,100 [--ticks 16] [--base 16] [--exp 0.25] [--scale 1200] [--res 0.5] [--rtp 0.95] [--json]
import { buildFight, format } from '../src/engine.js';
const argv = process.argv.slice(2), a = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2), v = argv[i + 1]; a[k] = v === undefined || v.startsWith('--') ? true : (i++, v); }
const f = s => { const [power, hp] = String(s).split(',').map(Number); return { power, hp }; };
const F = buildFight({ A: f(a.a ?? '1600,100'), B: f(a.b ?? '1600,100'), ticks: a.ticks ? Number(a.ticks) : undefined, baseDamage: a.base ? Number(a.base) : undefined, damageExponent: a.exp ? Number(a.exp) : undefined, eloScale: a.scale ? Number(a.scale) : undefined, res: a.res ? Number(a.res) : undefined, rtp: a.rtp ? Number(a.rtp) : undefined });
console.log(a.json ? JSON.stringify(F.toJSON(), null, 2) : format(F));
