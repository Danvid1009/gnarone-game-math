#!/usr/bin/env node
// Simulate a built payout and write JSON for scripts/plot.py.
//
//   node bin/simulate.js --payouts 0,0.5,1,2,5,20 --rtp 0.95 --methods maxent,geometric,weights --weights 0,50,30,15,4,1 --rounds 100000 --out examples/sim.json

import { writeFileSync } from 'node:fs';
import { buildPayout } from '../src/engine.js';
import { Rng } from '../src/rng.js';

const argv = process.argv.slice(2), args = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2), v = argv[i + 1]; args[k] = v === undefined || v.startsWith('--') ? true : (i++, v); }
const list = s => String(s).split(',').map(Number);
const payouts = list(args.payouts), rtp = Number(args.rtp), rounds = Number(args.rounds ?? 100000);
const methods = String(args.methods ?? 'maxent').split(',');
const keepPts = Number(args.points ?? 10000);
const out = { payouts, rtp, rounds, methods: {} };
for (const method of methods) {
  const e = buildPayout({ payouts, rtp, method, weights: args.weights ? list(args.weights) : undefined, fraction: args.fraction !== undefined ? Number(args.fraction) : 0.1 });
  const rng = new Rng(`sim:${method}`, 'payout');
  const pts = [], perBand = e.payouts.map(() => []);
  let tot = 0, sq = 0;
  for (let k = 0; k < rounds; k++) {
    const u = rng.next(), b = e.payout(u), i = e.bandOf(u);
    tot += b; sq += b * b; perBand[i].push(+b.toFixed(5));
    if (k < keepPts) pts.push([+(10000 * u).toFixed(2), +b.toFixed(5)]);
  }
  const mean = tot / rounds;
  out.methods[method] = { ...e.toJSON(), grid: e.grid(10000), simRtp: mean, simSd: Math.sqrt(sq / rounds - mean * mean), pts, perBand };
  console.error(`${method.padEnd(10)} design ${e.rtp.toFixed(4)}  sim ${mean.toFixed(4)}  grid ${e.grid(10000).rtp.toFixed(4)}  p ${e.p.map(x => (100 * x).toFixed(2) + '%').join(' ')}`);
}
const file = args.out ?? 'sim.json';
writeFileSync(file, JSON.stringify(out));
console.error(`wrote ${file}`);
