#!/usr/bin/env node
// Static sample API: 100 seeded rounds of the reference sloped-band payout, one set per probability method.
//   node scripts/make-fixtures.js  →  examples/api/{index.json, <method>/field.json, <method>/rounds.json, <method>/rounds/NNN.json, <method>/sample-*.json}
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { buildPayout } from '../src/engine.js';
import { Rng } from '../src/rng.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
process.chdir(join(dirname(fileURLToPath(import.meta.url)), '..'));   // paths below are relative to the engine folder
const RTP = 0.95, STAKE = 1000, COUNT = 100, PAYOUTS = [0, 0.5, 1, 2, 5, 20];
const METHODS = { maxent: {}, geometric: {}, weights: { weights: [0, 50, 30, 15, 4, 1] } };
rmSync('examples/api', { recursive: true, force: true }); mkdirSync('examples/api', { recursive: true });
const index = { engine: 'payout-engine', rtp: RTP, payouts: PAYOUTS, stake: STAKE, rounds: COUNT, seeds: 'fixture-000 … fixture-099 (shared across methods: the same u drives every method)', sets: {} };
for (const [method, extra] of Object.entries(METHODS)) {
  const E = buildPayout({ payouts: PAYOUTS, rtp: RTP, method, ...extra }); const dir = `examples/api/${method}`; mkdirSync(`${dir}/rounds`, { recursive: true });
  const field = { method, rtp: RTP, r: E.r, gap: E.gap, fraction: E.fraction, stake_units: 'minor units (cents)',
    bands: E.bands.map(b => ({ index: b.index, payout: b.payout, p: b.p, rn_from: b.from, rn_to: b.to, pays_from: b.range[0], pays_to: b.range[1] })),
    how_to_settle: 'find the band with rn_from ≤ u < rn_to; if payout is 0 the win is 0; else t = (u − rn_from)/(rn_to − rn_from), multiple = payout + r·(2t − 1), win = round(stake × multiple)' };
  writeFileSync(`${dir}/field.json`, JSON.stringify(field, null, 2));
  const rounds = [];
  for (let k = 0; k < COUNT; k++) {
    const seed = `fixture-${String(k).padStart(3, '0')}`, u = new Rng(seed, 'payout').next(), b = E.bandOf(u), m = E.payout(u);
    const round = { round: k, seed, u, band: b, bandPayout: E.payouts[b], t: E.payouts[b] > 0 ? (u - E.breaks[b]) / (E.breaks[b + 1] - E.breaks[b]) : null, multiple: m, win: Math.round(STAKE * m), stake: STAKE };
    rounds.push(round); writeFileSync(`${dir}/rounds/${String(k).padStart(3, '0')}.json`, JSON.stringify(round, null, 2));
  }
  writeFileSync(`${dir}/rounds.json`, JSON.stringify({ method, count: COUNT, stake: STAKE, rounds }, null, 1));
  const k = 7, rd = rounds[k];
  writeFileSync(`${dir}/sample-request.json`, JSON.stringify({ endpoint: 'POST /api/single-shot/bet', body: { sessionId: 'demo-session', betAmount: STAKE, betType: 'BASE' }, note: `deterministic fixture: seed "${rd.seed}"; method ${method}` }, null, 2));
  writeFileSync(`${dir}/sample-response.json`, JSON.stringify({ roundId: `fixture-round-${String(k).padStart(3, '0')}`, balance: 100000 - STAKE, totalBetAmount: STAKE, totalWinAmount: rd.win, nextAction: ['COLLECT'], math: { u: rd.u, band: rd.band, level: rd.bandPayout, multiple: rd.multiple, r: E.r } }, null, 2));
  index.sets[method] = { r: E.r, probabilities: E.p, files: [`${method}/field.json`, `${method}/rounds.json`, `${method}/rounds/NNN.json`, `${method}/sample-request.json`, `${method}/sample-response.json`], bandHits: E.payouts.map((p, i) => rounds.filter(r => r.band === i).length), rtpOver100Rounds: rounds.reduce((s, r) => s + r.win, 0) / (COUNT * STAKE) };
}
writeFileSync('examples/api/index.json', JSON.stringify(index, null, 2)); console.log(JSON.stringify(index.sets, null, 0));
