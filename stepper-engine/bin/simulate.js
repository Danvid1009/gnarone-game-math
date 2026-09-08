#!/usr/bin/env node
// Simulate the three difficulties under several stopping rules; write JSON for scripts/plot.py.
//   node bin/simulate.js --rtp 0.97 --steps 10 --maxes 10,25,100 --rounds 100000 --out examples/sim.json
import { writeFileSync } from 'node:fs';
import { buildLadder } from '../src/engine.js';

const argv = process.argv.slice(2), args = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2), v = argv[i + 1]; args[k] = v === undefined || v.startsWith('--') ? true : (i++, v); }
const rtp = Number(args.rtp ?? 0.97), steps = Number(args.steps ?? 10), rounds = Number(args.rounds ?? 100000);
const maxes = String(args.maxes ?? '10,25,100').split(',').map(Number);
const names = ['easy', 'medium', 'hard', 'd4', 'd5', 'd6'];
const out = { rtp, steps, rounds, ladders: {} };
maxes.forEach((M, idx) => {
  const L = buildLadder({ rtp, maxWin: M, steps, name: names[idx] ?? `max${M}` });
  const rules = {};
  for (const k of [1, 3, 5, 7, steps]) rules[`stop after ${k}`] = L.simulate({ rounds, seed: `s:${M}:${k}`, policy: j => j >= k });
  rules['never stop'] = L.simulate({ rounds, seed: `s:${M}:never`, policy: () => false });
  out.ladders[L.name] = { ...L.toJSON(), rules };
  console.error(`${L.name.padEnd(7)} max ${M}   ` + Object.entries(rules).map(([n, s]) => `${n}: ${(100 * s.rtp).toFixed(2)}%`).join('   '));
});
const file = args.out ?? 'sim.json';
writeFileSync(file, JSON.stringify(out));
console.error(`wrote ${file}`);
