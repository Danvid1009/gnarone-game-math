#!/usr/bin/env node
// node bin/build-race.js --elo 1850,...,1300 --rtp 0.95 [--place 0.25 --show 0.2] [--fixed-third 1.4 [--theta 0.5]] [--fractions 0.6,0.3,0.1] [--names a,b,...] [--json] [--js]
import { buildRace, format } from '../src/engine.js';
const argv = process.argv.slice(2), args = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2), v = argv[i + 1]; args[k] = v === undefined || v.startsWith('--') ? true : (i++, v); }
if (!args.elo || !args.rtp) { console.error('usage: build-race --elo e1,...,en --rtp R [--place 0.25 --show 0.2] [--win-only] [--fixed-third M3 [--theta 0.5]] [--fractions f1,f2,f3] [--names ...] [--json] [--js]'); process.exit(1); }
const elos = String(args.elo).split(',').map(Number);
const names = args.names ? String(args.names).split(',') : elos.map((_, i) => `#${i + 1}`);
const structure = args['win-only'] ? { kind: 'win-only' } : args.fractions ? { kind: 'fractions', f: String(args.fractions).split(',').map(Number) }
  : args['fixed-third'] !== undefined ? { kind: 'fixed-third', m3: Number(args['fixed-third'] === true ? 1.4 : args['fixed-third']), theta: Number(args.theta ?? 0.5) }
  : { kind: 'place-terms', place: Number(args.place ?? 0.25), show: Number(args.show ?? 0.2) };
try {
  const race = buildRace({ racers: elos.map((elo, i) => ({ name: names[i], elo })), rtp: Number(args.rtp), structure });
  if (args.json) console.log(JSON.stringify(race.toJSON(), null, 2)); else console.log(format(race));
  if (args.js !== undefined) console.log('\n' + race.standalone());
} catch (e) { console.error(e.message); process.exit(2); }
