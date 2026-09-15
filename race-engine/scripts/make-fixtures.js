#!/usr/bin/env node
// Static sample API: 100 pre-drawn rounds from fixed seeds, resolved for every racer.
//   node scripts/make-fixtures.js [top1]     → examples/api/ (or examples/api-top1/){field.json, rounds.json, rounds/NNN.json, sample-request.json, sample-response.json}
// Published by site/build.js at docs/race/api/ so a partner can GET them.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { buildRace } from '../src/engine.js';
import { Rng } from '../src/rng.js';

const ELO = [1850, 1780, 1720, 1680, 1640, 1600, 1560, 1520, 1480, 1430, 1380, 1300];
const NAMES = ['Ace', 'Bolt', 'Cinder', 'Dash', 'Ember', 'Flint', 'Gale', 'Hex', 'Iris', 'Jolt', 'Kite', 'Lux'];
const MODE = process.argv[2] === 'top1' ? 'top1' : 'top3';
const RTP = 0.95, STAKE = 1000, COUNT = 100, DIR = MODE === 'top1' ? 'examples/api-top1' : 'examples/api';
const R = buildRace({ racers: ELO.map((elo, i) => ({ name: NAMES[i], elo })), rtp: RTP, structure: MODE === 'top1' ? { kind: 'win-only' } : undefined });

rmSync(DIR, { recursive: true, force: true }); mkdirSync(`${DIR}/rounds`, { recursive: true });
const field = {
  engine: 'race-engine', version: 1, rtp: RTP, structure: R.structure, stake_units: 'minor units (cents)',
  racers: R.racers.map((r, i) => ({ index: i, name: r.name, elo: r.elo, strength: r.w, q: { first: R.q1[i], second: R.q2[i], third: R.q3[i] }, multipliers: { first: R.M[i][0], second: R.M[i][1], third: R.M[i][2] }, ev: R.ev[i] })),
  feasible_bound_top3: R.feasibleBound,
  mode: MODE,
  how_to_settle: MODE === 'top1' ? 'win = round(stake × multipliers.first) if the backed racer is order[0], else 0' : 'win = round(stake × multipliers[place]) if the backed racer is in the first three of `order`, else 0',
};
writeFileSync(`${DIR}/field.json`, JSON.stringify(field, null, 2));

const rounds = [];
for (let k = 0; k < COUNT; k++) {
  const seed = `fixture-${String(k).padStart(3, '0')}`;
  const u = new Rng(seed, 'payout').next();
  const fin = R.finish(u);
  const round = {
    round: k, seed, u,
    order: fin.order, names: fin.names, podium: fin.names.slice(0, 3), zone: fin.zone,
    // settlement for every possible bet type at a unit stake of STAKE
    settlements: Object.fromEntries(R.racers.map((r, i) => { const s = R.settle(i, fin, STAKE); return [r.name, { place: s.place, multiple: s.multiple, win: s.win, stake: STAKE }]; })),
  };
  rounds.push(round);
  writeFileSync(`${DIR}/rounds/${String(k).padStart(3, '0')}.json`, JSON.stringify(round, null, 2));
}
writeFileSync(`${DIR}/rounds.json`, JSON.stringify({ count: COUNT, stake: STAKE, rounds }, null, 1));

// a worked sample: the RGS-shaped request and response for round 7, backing Flint
const k = 7, backed = 'Flint', rd = rounds[k], i = NAMES.indexOf(backed), s = rd.settlements[backed];
writeFileSync(`${DIR}/sample-request.json`, JSON.stringify({ endpoint: 'POST /api/race/bet', body: { sessionId: 'demo-session', betAmount: STAKE, betType: backed }, note: `deterministic fixture: the server used seed "${rd.seed}" instead of a fresh draw` }, null, 2));
writeFileSync(`${DIR}/sample-response.json`, JSON.stringify({ roundId: `fixture-round-${String(k).padStart(3, '0')}`, balance: 100000 - STAKE, totalBetAmount: STAKE, totalWinAmount: s.win, nextAction: ['COLLECT'], math: { u: rd.u, order: rd.order, names: rd.names, zone: rd.zone, backed: i, place: s.place, multiple: s.multiple, M: R.M[i] } }, null, 2));

const summary = { rounds: COUNT, podiumWins: Object.fromEntries(NAMES.map(n => [n, rounds.filter(r => r.podium[0] === n).length])), totalWinAllRacersStaked: rounds.reduce((s, r) => s + Object.values(r.settlements).reduce((t, x) => t + x.win, 0), 0), totalStakedAllRacers: COUNT * NAMES.length * STAKE };
summary.rtpIfEveryRacerBackedEveryRound = summary.totalWinAllRacersStaked / summary.totalStakedAllRacers;
writeFileSync(`${DIR}/summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
