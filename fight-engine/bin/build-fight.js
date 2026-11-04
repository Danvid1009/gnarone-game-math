#!/usr/bin/env node
// node bin/build-fight.js --a 850,850 --b 775,775   |   --a cannon --b tank (roster names)   |   --roster (table + matchup matrix) [--ticks 16] [--base 16] [--hp 100] [--ref 800] [--scale 400] [--res 1] [--rtp 0.95] [--json]
//   fighters are power,hp in attribute points (elo = power + hp); or elo:split, e.g. --a 1600:0.625
import { buildFight, format } from '../src/engine.js';
import { ROSTER, resolveFighter, rosterTable, matchupMatrix } from '../src/roster.js';
const argv = process.argv.slice(2), a = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2), v = argv[i + 1]; a[k] = v === undefined || v.startsWith('--') ? true : (i++, v); }
const f = s => { s = String(s); if (ROSTER[s]) return resolveFighter(s); if (s.includes(':')) { const [elo, split] = s.split(':').map(Number); return { elo, split }; } const [power, hp] = s.split(',').map(Number); return { power, hp }; };
if (a.roster) {
  const T = rosterTable(), M = matchupMatrix();
  if (a.json) { console.log(JSON.stringify({ roster: T, matrix: M }, null, 2)); process.exit(0); }
  console.log('fighter     power    hp   elo  split  health  dmg'); for (const r of T) console.log(`${r.name.padEnd(10)} ${String(r.power).padStart(6)} ${String(r.hp).padStart(5)} ${String(r.elo).padStart(5)}  ${r.split.toFixed(3)} ${r.health.toFixed(1).padStart(7)} ${r.damage.toFixed(1).padStart(5)}`);
  console.log('\nP(row beats column)\n' + ''.padEnd(10) + M.names.map(n => n.slice(0, 6).padStart(7)).join('')); M.names.forEach((n, i) => console.log(n.padEnd(10) + M.pA[i].map(p => (100 * p).toFixed(1).padStart(6) + '%').join('')));
  process.exit(0);
}
const F = buildFight({ A: f(a.a ?? '800,800'), B: f(a.b ?? '800,800'), ticks: a.ticks ? Number(a.ticks) : undefined, baseDamage: a.base ? Number(a.base) : undefined, baseHp: a.hp ? Number(a.hp) : undefined, ref: a.ref ? Number(a.ref) : undefined, eloScale: a.scale ? Number(a.scale) : undefined, res: a.res ? Number(a.res) : undefined, rtp: a.rtp ? Number(a.rtp) : undefined });
console.log(a.json ? JSON.stringify(F.toJSON(), null, 2) : format(F));
