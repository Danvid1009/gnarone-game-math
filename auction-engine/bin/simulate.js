#!/usr/bin/env node
// Simulate the locker sizes under several stopping rules; write JSON for scripts/plot.py.
//   node bin/simulate.js --rtp 0.95 --steps 10 --maxes 5,10,25,100 --rounds 100000 --out examples/sim.json
import { writeFileSync } from 'node:fs';
import { buildAuction } from '../src/engine.js';
const argv = process.argv.slice(2), args = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2), v = argv[i + 1]; args[k] = v === undefined || v.startsWith('--') ? true : (i++, v); }
const rtp = Number(args.rtp ?? 0.95), steps = Number(args.steps ?? 10), rounds = Number(args.rounds ?? 100000);
const maxes = String(args.maxes ?? '5,10,25,100').split(',').map(Number);
const names = ['small', 'medium', 'large', 'xl', 'xxl'];
const out = { rtp, steps, rounds, ladders: {} };
maxes.forEach((M, idx) => {
  const A = buildAuction({ rtp, maxWin: M, steps, name: names[idx] ?? `max${M}` });
  const rules = {};
  for (const k of [1, 3, 5, 7, steps]) rules[`take after ${k}`] = { ...A.simulate({ rounds, seed: `s:${M}:${k}`, policy: j => j >= k }), exactStdev: Math.sqrt(A.varianceOfStrategy(k)) };
  rules['never take'] = { ...A.simulate({ rounds, seed: `s:${M}:never`, policy: () => false }), exactStdev: Math.sqrt(A.varianceOfStrategy(steps)) };
  out.ladders[A.name] = { ...A.toJSON(), rules };
  console.error(`${A.name.padEnd(7)} max ${M}   ` + Object.entries(rules).map(([n, s]) => `${n}: ${(100 * s.rtp).toFixed(2)}%`).join('   '));
});
writeFileSync(args.out ?? 'sim.json', JSON.stringify(out)); console.error(`wrote ${args.out ?? 'sim.json'}`);
