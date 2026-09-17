#!/usr/bin/env node
// Build a storage-auction ladder.
//   node bin/build-auction.js --rtp 0.95 --max 25 --steps 10                        LARGE locker
//   node bin/build-auction.js --rtp 0.95 --max 100 --steps 10 --box 0.25,0.5,1,2,5   explicit locker multiples (mean 1 solved by maxent)
//   node bin/build-auction.js --rtp 0.95 --returns 1.2,1.5,2,3,5 --no-box             explicit rungs, flat locker (= stepper)
//   options: --method maxent|geometric  --fraction 0.1  --decimals 2  --json  --js [name]  --out file.js
import { writeFileSync } from 'node:fs';
import { buildAuction, format } from '../src/engine.js';
const argv = process.argv.slice(2), args = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2), v = argv[i + 1]; args[k] = v === undefined || v.startsWith('--') ? true : (i++, v); }
if (!args.rtp || (!(args.max && args.steps) && !args.returns)) { console.error('usage: build-auction --rtp R (--max M --steps N | --returns c1,...,cN) [--box a1,...,an | --no-box] [--method maxent|geometric] [--fraction 0.1] [--decimals 2] [--json] [--js [name]] [--out file]'); process.exit(1); }
const box = args['no-box'] ? false : { payouts: args.box ? String(args.box).split(',').map(Number) : undefined, method: args.method, fraction: args.fraction !== undefined ? Number(args.fraction) : undefined };
for (const k of Object.keys(box || {})) if (box[k] === undefined) delete box[k];
const A = buildAuction({ rtp: Number(args.rtp), maxWin: args.max !== undefined ? Number(args.max) : undefined, steps: args.steps !== undefined ? Number(args.steps) : undefined,
  returns: args.returns ? String(args.returns).split(',').map(Number) : undefined, decimals: args.decimals !== undefined ? Number(args.decimals) : 2, name: typeof args.name === 'string' ? args.name : undefined, box });
if (args.json) console.log(JSON.stringify(A.toJSON(), null, 2)); else console.log(format(A));
if (args.js !== undefined) { const code = A.standalone(typeof args.js === 'string' ? args.js : 'settle'); if (args.out) { writeFileSync(args.out, code + '\n'); console.error(`wrote ${args.out}`); } else console.log('\n' + code); }
