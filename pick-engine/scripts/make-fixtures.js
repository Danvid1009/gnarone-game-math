#!/usr/bin/env node
// Static sample API: 100 seeded rounds for three reference option sets, each resolved for every option.
//   node scripts/make-fixtures.js  →  examples/api/{index.json, <set>/field.json, <set>/rounds.json, <set>/rounds/NNN.json, <set>/sample-*.json}
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { buildPick } from '../src/engine.js';
import { Rng } from '../src/rng.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
process.chdir(join(dirname(fileURLToPath(import.meta.url)), '..'));   // paths below are relative to the engine folder
const RTP = 0.95, STAKE = 1000, COUNT = 100;
const SETS = {
  coin:     { n: 2 },
  five:     { n: 5 },
  weighted: { weights: [5, 3, 2], labels: ['RED', 'GREEN', 'BLUE'] },
};
rmSync('examples/api', { recursive: true, force: true }); mkdirSync('examples/api', { recursive: true });
const index = { engine: 'pick-engine', rtp: RTP, stake: STAKE, rounds: COUNT, seeds: 'fixture-000 … fixture-099 (shared across sets: the same u drives every set)', sets: {} };
for (const [name, cfg] of Object.entries(SETS)) {
  const P = buildPick({ ...cfg, rtp: RTP }); const dir = `examples/api/${name}`; mkdirSync(`${dir}/rounds`, { recursive: true });
  const field = { set: name, rtp: RTP, stake_units: 'minor units (cents)', options: P.options.map(o => ({ index: o.index, name: o.name, p: o.p, odds: o.odds, rn_from: o.from, rn_to: o.to })), how_to_settle: 'win = round(stake × odds[backed]) if backed === winner, else 0' };
  writeFileSync(`${dir}/field.json`, JSON.stringify(field, null, 2));
  const rounds = [];
  for (let k = 0; k < COUNT; k++) {
    const seed = `fixture-${String(k).padStart(3, '0')}`, u = new Rng(seed, 'payout').next(), w = P.outcome(u);
    const round = { round: k, seed, u, winner: w, winnerName: P.names[w], settlements: Object.fromEntries(P.names.map((nm, i) => [nm, { hit: i === w, odds: P.odds[i], win: i === w ? Math.round(STAKE * P.odds[i]) : 0, stake: STAKE }])) };
    rounds.push(round); writeFileSync(`${dir}/rounds/${String(k).padStart(3, '0')}.json`, JSON.stringify(round, null, 2));
  }
  writeFileSync(`${dir}/rounds.json`, JSON.stringify({ set: name, count: COUNT, stake: STAKE, rounds }, null, 1));
  const k = 7, backed = P.names[0], rd = rounds[k], s = rd.settlements[backed];
  writeFileSync(`${dir}/sample-request.json`, JSON.stringify({ endpoint: 'POST /api/pick/bet', body: { sessionId: 'demo-session', betAmount: STAKE, betType: backed }, note: `deterministic fixture: seed "${rd.seed}"` }, null, 2));
  writeFileSync(`${dir}/sample-response.json`, JSON.stringify({ roundId: `fixture-round-${String(k).padStart(3, '0')}`, balance: 100000 - STAKE, totalBetAmount: STAKE, totalWinAmount: s.win, nextAction: ['COLLECT'], math: { u: rd.u, winner: rd.winner, winnerName: rd.winnerName, backed: 0, hit: s.hit, odds: s.odds } }, null, 2));
  const winCounts = Object.fromEntries(P.names.map(nm => [nm, rounds.filter(r => r.winnerName === nm).length]));
  index.sets[name] = { options: P.names, odds: P.odds, files: [`${name}/field.json`, `${name}/rounds.json`, `${name}/rounds/NNN.json`, `${name}/sample-request.json`, `${name}/sample-response.json`], winCounts, rtpIfEveryOptionBackedEveryRound: rounds.reduce((s, r) => s + Object.values(r.settlements).reduce((t, x) => t + x.win, 0), 0) / (COUNT * P.names.length * STAKE) };
}
writeFileSync('examples/api/index.json', JSON.stringify(index, null, 2)); console.log(JSON.stringify(index.sets, null, 0));
