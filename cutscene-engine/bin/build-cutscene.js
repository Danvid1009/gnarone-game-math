#!/usr/bin/env node
// node bin/build-cutscene.js --a 850,850 --b 775,775 [--rtp 0.95] [--json]   (fighters are power,hp attribute points, or elo:split)
import { buildCutscene } from '../src/engine.js';
const argv = process.argv.slice(2), a = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2), v = argv[i + 1]; a[k] = v === undefined || v.startsWith('--') ? true : (i++, v); }
const f = s => { s = String(s); if (s.includes(':')) { const [elo, split] = s.split(':').map(Number); return { elo, split }; } const [power, hp] = s.split(',').map(Number); return { power, hp }; };
const C = buildCutscene({ A: f(a.a ?? '800,800'), B: f(a.b ?? '800,800'), rtp: a.rtp ? Number(a.rtp) : undefined });
if (a.json) console.log(JSON.stringify(C.toJSON(), null, 2));
else console.log(`${C.name}   RTP ${C.rtp}\nA: elo ${C.elo.A} (power ${C.fighters.A.power}, hp ${C.fighters.A.hp}, health ${C.hp.A})   B: elo ${C.elo.B} (power ${C.fighters.B.power}, hp ${C.fighters.B.hp}, health ${C.hp.B})\nP(A wins) = ${(100 * C.pA).toFixed(2)}%   odds A ${C.odds.A.toFixed(4)}x  B ${C.odds.B.toFixed(4)}x   (EV = ${C.rtp} either side)\nside bets: coin (RTP / p), pick (RTP / p_i), single-shot (sloped bands)`);
