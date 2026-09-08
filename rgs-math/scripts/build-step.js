#!/usr/bin/env node
// Build a step-band payout function from intervals + RTP.
//
//   INVERSE — payouts in, probabilities assigned to hit the RTP:
//   node scripts/build-step.js --payouts 0,0.25,0.75,1.5,2.35 --rtp 0.97                 (maxent)
//   node scripts/build-step.js --payouts 0,0.5,1,2,5,20 --rtp 0.95 --method geometric
//   node scripts/build-step.js --payouts 0,0.5,1,2,5,20 --rtp 0.95 --method weights --weights 0,50,30,15,4,1
//   --interp sloped (default): band i ramps from a_i − r to a_i + r across its interval; one uniform.
//   --interp step: flat level per interval.  --interp linear: knots with ramps between them (trapezoid).
//
//   FORWARD — intervals in, levels solved:
//   node scripts/build-step.js --p 0.3,0.125,0.125,0.25,0.2 --rtp 0.97 --shape 0,1,3,6,9.4
//   node scripts/build-step.js --p 0.3,0.125,0.125,0.25,0.2 --rtp 0.97 --growth 2
//   node scripts/build-step.js --p 0.3,0.125,0.125,0.25,0.2 --rtp 0.97 --levels 0,0.25,0.75,1.5,x
//   ... [--fraction 0.1] [--json] [--js]      (--js prints the standalone function)
//
// --shape  relative payout ratios, scaled to hit --rtp (0 = no-win interval)
// --growth geometric ladder c, c·g, c·g², … over paying intervals (first interval = no win
//          unless --zero gives a 0/1 mask), c solved for --rtp
// --levels explicit multiples; one may be x (or ?, _, solve) to be solved for --rtp

import { buildStepBand, buildFromPayouts, buildTrapezoid, buildSloped, formatStepBand, formatTrapezoid, formatSloped } from '../src/step-band.js';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1]?.startsWith('--') || arr[i + 1] === undefined ? true : arr[i + 1]] : []).filter(x => x.length));
const fraction = args.fraction !== undefined ? Number(args.fraction) : 0.1;
const rtp = args.rtp !== undefined ? Number(args.rtp) : undefined;
let sb;
if (args.payouts) {
  if (rtp === undefined) { console.error('--payouts needs --rtp'); process.exit(1); }
  const o = {
    payouts: String(args.payouts).split(',').map(Number), rtp, fraction,
    method: args.method ?? 'maxent',
    weights: args.weights ? String(args.weights).split(',').map(Number) : undefined,
  };
  const interp = args.interp ?? 'sloped';
  sb = interp === 'linear' || interp === 'trapezoid' ? buildTrapezoid(o) : interp === 'step' ? buildFromPayouts(o) : buildSloped(o);
} else if (args.p && (args.shape || args.growth || args.levels)) {
  const UNKNOWN = new Set(['?', 'x', '_', 'solve', '']);
  const opts = { p: String(args.p).split(',').map(Number), rtp, fraction };
  if (args.shape) opts.shape = String(args.shape).split(',').map(Number);
  if (args.growth) opts.growth = Number(args.growth);
  if (args.zero) opts.zero = String(args.zero).split(',').map(x => x.trim() === '1' || x.trim().toLowerCase() === 'true');
  if (args.levels) opts.levels = String(args.levels).split(',').map(s => (UNKNOWN.has(s.trim().toLowerCase()) ? null : Number(s)));
  sb = buildStepBand(opts);
} else {
  console.error('usage:\n  build-step --payouts a1,...,an --rtp R [--method maxent|geometric|weights --weights w1,...,wn] [--fraction 0.1] [--json] [--js]\n  build-step --p p1,...,pn --rtp R (--shape s | --growth g | --levels a with one x) [--fraction 0.1] [--json] [--js]');
  process.exit(1);
}

if (args.json) {
  console.log(JSON.stringify({ kind: sb.kind ?? 'step', p: sb.p, payouts: sb.payouts, levels: sb.levels, knots: sb.knots, breaks: sb.breaks, r: sb.r, gap: sb.gap, rtp: sb.rtp, hitRate: sb.hitRate, byProbability: sb.byProbability }, null, 2));
} else {
  console.log(sb.kind === 'trapezoid' ? formatTrapezoid(sb) : sb.kind === 'sloped' ? formatSloped(sb) : formatStepBand(sb));
}
if (args.js) console.log('\n' + sb.standalone());
