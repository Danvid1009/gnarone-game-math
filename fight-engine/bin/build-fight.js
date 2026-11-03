#!/usr/bin/env node
// node bin/build-fight.js --a 850,850 --b 775,775 [--ticks 16] [--base 16] [--hp 100] [--ref 800] [--scale 400] [--res 1] [--rtp 0.95] [--json]
//   fighters are power,hp in attribute points (elo = power + hp); or elo:split, e.g. --a 1600:0.625
import { buildFight, format } from '../src/engine.js';
const argv = process.argv.slice(2), a = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2), v = argv[i + 1]; a[k] = v === undefined || v.startsWith('--') ? true : (i++, v); }
const f = s => { s = String(s); if (s.includes(':')) { const [elo, split] = s.split(':').map(Number); return { elo, split }; } const [power, hp] = s.split(',').map(Number); return { power, hp }; };
const F = buildFight({ A: f(a.a ?? '800,800'), B: f(a.b ?? '800,800'), ticks: a.ticks ? Number(a.ticks) : undefined, baseDamage: a.base ? Number(a.base) : undefined, baseHp: a.hp ? Number(a.hp) : undefined, ref: a.ref ? Number(a.ref) : undefined, eloScale: a.scale ? Number(a.scale) : undefined, res: a.res ? Number(a.res) : undefined, rtp: a.rtp ? Number(a.rtp) : undefined });
console.log(a.json ? JSON.stringify(F.toJSON(), null, 2) : format(F));
