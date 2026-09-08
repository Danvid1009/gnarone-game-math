#!/usr/bin/env node
// Build a fair crash ladder.
//
//   node bin/build-ladder.js --rtp 0.97 --max 10 --steps 10                 the "easy" sheet
//   node bin/build-ladder.js --rtp 0.97 --max 25 --steps 10                 "medium"
//   node bin/build-ladder.js --rtp 0.97 --max 100 --steps 10                "hard"
//   node bin/build-ladder.js --rtp 0.96 --returns 1.1,1.25,1.5,2,3,5        explicit rungs
//   options: --decimals 2   --json   --js [name]   --out file.js

import { writeFileSync } from 'node:fs';
import { buildLadder, format } from '../src/engine.js';

const argv = process.argv.slice(2), args = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2), v = argv[i + 1]; args[k] = v === undefined || v.startsWith('--') ? true : (i++, v); }
if (!args.rtp || (!(args.max && args.steps) && !args.returns)) {
  console.error('usage: build-ladder --rtp R (--max M --steps N | --returns c1,...,cN) [--decimals 2] [--json] [--js [name]] [--out file]');
  process.exit(1);
}
const L = buildLadder({
  rtp: Number(args.rtp),
  maxWin: args.max !== undefined ? Number(args.max) : undefined,
  steps: args.steps !== undefined ? Number(args.steps) : undefined,
  returns: args.returns ? String(args.returns).split(',').map(Number) : undefined,
  decimals: args.decimals !== undefined ? Number(args.decimals) : 2,
  name: typeof args.name === 'string' ? args.name : undefined,
});
if (args.json) console.log(JSON.stringify(L.toJSON(), null, 2)); else console.log(format(L));
if (args.js !== undefined) {
  const code = L.standalone(typeof args.js === 'string' ? args.js : 'crashStep');
  if (args.out) { writeFileSync(args.out, code + '\n'); console.error(`wrote ${args.out}`); } else console.log('\n' + code);
}
