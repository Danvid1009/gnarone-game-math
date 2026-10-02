#!/usr/bin/env node
// node bin/build-cutscene.js --a 1700,100 --b 1550,100 [--rtp 0.95] [--json]
import { buildCutscene } from '../src/engine.js';
const argv = process.argv.slice(2), a = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2), v = argv[i + 1]; a[k] = v === undefined || v.startsWith('--') ? true : (i++, v); }
const f = s => { const [power, hp] = String(s).split(',').map(Number); return { power, hp }; };
const C = buildCutscene({ A: f(a.a ?? '1600,100'), B: f(a.b ?? '1600,100'), rtp: a.rtp ? Number(a.rtp) : undefined });
if (a.json) console.log(JSON.stringify(C.toJSON(), null, 2));
else console.log(`${C.name}   RTP ${C.rtp}\nA: power ${C.fighters.A.power}, hp ${C.fighters.A.hp}   B: power ${C.fighters.B.power}, hp ${C.fighters.B.hp}\nP(A wins) = ${(100 * C.pA).toFixed(2)}%   odds A ${C.odds.A.toFixed(4)}x  B ${C.odds.B.toFixed(4)}x   (EV = ${C.rtp} either side)\nside bets: coin (RTP / p), pick (RTP / p_i), single-shot (sloped bands)`);
