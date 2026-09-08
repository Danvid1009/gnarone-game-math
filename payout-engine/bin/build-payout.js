#!/usr/bin/env node
// Build a sloped-band payout function.
//
//   node bin/build-payout.js --payouts 0,0.5,1,2,5,20 --rtp 0.95                       maxent (default)
//   node bin/build-payout.js --payouts 0,0.5,1,2,5,20 --rtp 0.95 --method geometric
//   node bin/build-payout.js --payouts 0,0.5,1,2,5,20 --rtp 0.95 --method weights --weights 0,50,30,15,4,1
//   node bin/build-payout.js --payouts 0,0.5,1,2,5,20 --probabilities 0.3,0.26,0.22,0.16,0.056,0.004
//   options: --fraction 0.1   --json   --js [name]   --out file.js

import { writeFileSync } from 'node:fs';
import { buildPayout, format } from '../src/engine.js';

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const k = argv[i].slice(2), v = argv[i + 1];
  args[k] = v === undefined || v.startsWith('--') ? true : (i++, v);
}
const list = s => String(s).split(',').map(Number);
if (!args.payouts || (!args.rtp && !args.probabilities)) {
  console.error('usage: build-payout --payouts a1,...,an --rtp R [--method maxent|geometric|weights --weights w1,...,wn] [--fraction 0.1] [--json] [--js [name]] [--out file]\n       build-payout --payouts a1,...,an --probabilities p1,...,pn');
  process.exit(1);
}
const e = buildPayout({
  payouts: list(args.payouts),
  rtp: args.rtp !== undefined ? Number(args.rtp) : undefined,
  method: typeof args.method === 'string' ? args.method : 'maxent',
  weights: args.weights ? list(args.weights) : undefined,
  probabilities: args.probabilities ? list(args.probabilities) : undefined,
  fraction: args.fraction !== undefined ? Number(args.fraction) : 0.1,
});
if (args.json) console.log(JSON.stringify(e.toJSON(), null, 2));
else console.log(format(e));
if (args.js !== undefined) {
  const code = e.standalone(typeof args.js === 'string' ? args.js : 'payout');
  if (args.out) { writeFileSync(args.out, code + '\n'); console.error(`wrote ${args.out}`); } else console.log('\n' + code);
}
