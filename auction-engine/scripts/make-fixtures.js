#!/usr/bin/env node
// Static sample API: 100 seeded rounds for the four locker sizes, each resolved for every possible hammer point.
//   node scripts/make-fixtures.js  →  examples/api/{index.json, <size>/field.json, <size>/rounds.json, <size>/rounds/NNN.json, <size>/sample-*.json}
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { buildAuction } from '../src/engine.js';
import { Rng } from '../src/rng.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
process.chdir(join(dirname(fileURLToPath(import.meta.url)), '..'));   // paths below are relative to the engine folder
const RTP = 0.95, STAKE = 1000, COUNT = 100, STEPS = 10;
const SIZES = { small: 5, medium: 10, large: 25, xl: 100 };
rmSync('examples/api', { recursive: true, force: true }); mkdirSync('examples/api', { recursive: true });
const index = { engine: 'auction-engine', rtp: RTP, stake: STAKE, rounds: COUNT, steps: STEPS, seeds: 'fixture-000 … fixture-099 (shared across sizes: the same u drives every size)', sets: {} };
for (const [name, M] of Object.entries(SIZES)) {
  const A = buildAuction({ rtp: RTP, maxWin: M, steps: STEPS, name }); const dir = `examples/api/${name}`; mkdirSync(`${dir}/rounds`, { recursive: true });
  const field = {
    set: name, rtp: RTP, maxWin: M, steps: STEPS, stake_units: 'minor units (cents)',
    bids: A.bids.map((c, i) => ({ step: i + 1, value: c, lockerValueAtStake: Math.round(STAKE * c), survivalToHere: A.survival[i + 1], pRivalFoldsGivenHere: A.hazard[i] })),
    events: A.table.map(t => ({ step: t.step, event: t.event, p: t.p, rn_from: t.rnMin, rn_to: t.rnMax })),
    locker: A.box.bands.map(b => ({ multiple: b.multiple, p: b.p, residual_from: b.from, residual_to: b.to, pays_from: b.range[0], pays_to: b.range[1] })),
    locker_r: A.box.r,
    how_to_play: 'BID = CONTINUE. Rung k is SAFE if k <= bidsSurvived, CRASH (outbid, win 0) if k == bidsSurvived + 1. CASH_OUT = the hammer: the player takes the locker at the current rung.',
    how_to_settle: 'win = payoutIfTakenAfter[s-1].win when the hammer falls after s successful bids (s <= bidsSurvived); 0 if outbid first. That value is round(round(stake × bids[s-1].value) × lockerMultiplier). Reaching step 10 hammers automatically.',
  };
  writeFileSync(`${dir}/field.json`, JSON.stringify(field, null, 2));
  const rounds = [];
  for (let k = 0; k < COUNT; k++) {
    const seed = `fixture-${String(k).padStart(3, '0')}`, u = new Rng(seed, 'payout').next(), d = A.draw(u);
    const round = {
      round: k, seed, u, bidsSurvived: d.K, outcome: d.K === STEPS ? 'TOP' : `OUTBID_ON_BID_${d.K + 1}`, residual: d.v, lockerBand: d.band, lockerMultiple: A.box.payouts[d.band], lockerMultiplier: d.X,
      payoutIfTakenAfter: A.bids.map((c, i) => { const s = i + 1, lockerValue = Math.round(STAKE * c); return { step: s, lockerValue, reachable: s <= d.K, win: s <= d.K ? Math.round(lockerValue * d.X) : 0, stake: STAKE }; }),
    };
    rounds.push(round); writeFileSync(`${dir}/rounds/${String(k).padStart(3, '0')}.json`, JSON.stringify(round, null, 2));
  }
  writeFileSync(`${dir}/rounds.json`, JSON.stringify({ set: name, count: COUNT, stake: STAKE, rounds }, null, 1));
  // worked sample: round 7 played as bet → BID → BID → CASH_OUT (or the crash if it comes first)
  const k = 7, rd = rounds[k], r = A.start(rd.u, { bet: STAKE }); const seq = [{ action: 'bet', response: r.view() }];
  for (let i = 0; i < 2 && !r.view().roundEnded; i++) seq.push({ action: 'CONTINUE', response: r.bid() });
  if (!r.view().roundEnded) seq.push({ action: 'CASH_OUT', response: r.take() });
  writeFileSync(`${dir}/sample-request.json`, JSON.stringify({ endpoint: 'POST /api/auction/bet then POST /api/auction/next-action', body: { sessionId: 'demo-session', betAmount: STAKE, betType: name.toUpperCase() }, nextActions: seq.slice(1).map(s => ({ action: s.action })), note: `deterministic fixture: seed "${rd.seed}"` }, null, 2));
  writeFileSync(`${dir}/sample-response.json`, JSON.stringify({ roundId: `fixture-round-${String(k).padStart(3, '0')}`, balance: 100000 - STAKE, totalBetAmount: STAKE, sequence: seq, math: { u: rd.u, bidsSurvived: rd.bidsSurvived, residual: rd.residual, lockerMultiplier: rd.lockerMultiplier } }, null, 2));
  const rtpByRule = A.bids.map((_, i) => rounds.reduce((s, r) => s + r.payoutIfTakenAfter[i].win, 0) / (COUNT * STAKE));
  index.sets[name] = { maxWin: M, bids: A.bids, files: [`${name}/field.json`, `${name}/rounds.json`, `${name}/rounds/NNN.json`, `${name}/sample-request.json`, `${name}/sample-response.json`], outcomes: Object.fromEntries(rounds.map(r => r.outcome).sort().filter((x, i, a) => a.indexOf(x) === i).map(o => [o, rounds.filter(r => r.outcome === o).length])), realisedRtpByTakeAfter: rtpByRule };
}
writeFileSync('examples/api/index.json', JSON.stringify(index, null, 2)); console.log(JSON.stringify(Object.fromEntries(Object.entries(index.sets).map(([k, v]) => [k, v.realisedRtpByTakeAfter.map(x => x.toFixed(3))]))));
