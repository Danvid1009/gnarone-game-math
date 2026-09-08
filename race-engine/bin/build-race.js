#!/usr/bin/env node
// node bin/build-race.js --elo 1800,1650,1600,1500,1450,1300 --rtp 0.95 [--places 0.6,0.3,0.1] [--names A,B,C,...] [--json] [--js]
import { buildRace, format } from '../src/engine.js';
const argv = process.argv.slice(2), args = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2), v = argv[i + 1]; args[k] = v === undefined || v.startsWith('--') ? true : (i++, v); }
if (!args.elo || !args.rtp) { console.error('usage: build-race --elo e1,...,en --rtp R [--places f1,f2,f3] [--names n1,...] [--json] [--js]'); process.exit(1); }
const elos = String(args.elo).split(',').map(Number);
const names = args.names ? String(args.names).split(',') : elos.map((_, i) => `#${i + 1}`);
const race = buildRace({ racers: elos.map((elo, i) => ({ name: names[i], elo })), rtp: Number(args.rtp), places: args.places ? String(args.places).split(',').map(Number) : [1] });
if (args.json) console.log(JSON.stringify(race.toJSON(), null, 2)); else console.log(format(race));
if (args.js !== undefined) console.log('\n' + race.standalone());
