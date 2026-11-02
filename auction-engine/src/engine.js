// Locker Wars engine.  See ALGORITHM.md for the math.
//
//   const A = buildLockerWars({ rtp: 0.95, refund: 1, outbid: [0.6, 0.5, 0.4, 0.3, 0.2, 0], bids: [1, 2, 3, 4, 6, 8], locker: { payouts: [0, 0.5, 1, 2, 5, 20] } });
//   A.stages                 // per raise k: bid multiple g_k, P(outbid) H_k, refund, locker mean
//   A.settle(u, k)           // payout multiple of the bid at stage k for one uniform u
//   A.play({ bet, betType: 'BID_3', rng })   // one raise: OUTBID (bid back less the fee) or WON (the locker opens)
//
// Model. An auction is a sequence of raises. Raise k is its own bet of b_k = b_1 · m_k, with m_1 = 1 < m_2 < … the
// auctioneer's ladder (round multiples of the opening bid, e.g. 1, 2, 3, 4, 6, 8). With probability
// H_k the rivals outbid you and the bid comes back in full (ρ = 1: being outbid costs nothing). Otherwise the rivals
// fold, you win the locker and open it: a Single Shot draw X (sloped bands) times the bid.
// Two ways to place the house edge (`edge`):
//   'per-raise' (default) E[X] = (R − H_k ρ)/(1 − H_k): the locker payouts are solved around the fixed RTP so that every
//               raise returns exactly R, refunds included. Any raise-or-walk policy therefore returns R per unit staked.
//   'hammer'    E[X] = R at every stage: the house takes (1 − R) of the hammer price and nothing else, a buyer's premium.
//               Raise k then returns H_k ρ + (1 − H_k) R, above R whenever H_k > 0, so the RTP per unit staked depends
//               on the outbid schedule and on when the player walks; the loss per auction is (1 − R) × E[winning bid].
// One uniform per raise: u < H_k is the outbid; the residual (u − H_k)/(1 − H_k) is the locker draw.

import { Rng } from './rng.js';
import { buildPayout } from '../../payout-engine/src/engine.js';

export function buildLockerWars({ rtp = 0.95, refund = 1, edge = 'per-raise', outbid = [0.6, 0.5, 0.4, 0.3, 0.2, 0], steps = [[1], [1, 2], [1, 2], [2, 3], [2, 4]], bids = null, growth = 1.5, locker = {}, name } = {}) {
  if (!['hammer', 'per-raise'].includes(edge)) throw new Error(`edge must be 'hammer' or 'per-raise', got ${edge}`);
  if (!(rtp > 0 && rtp < 1)) throw new Error(`rtp must be in (0,1), got ${rtp}`);
  if (!(refund >= 0 && refund <= 1)) throw new Error('refund must be in [0,1]');
  if (!Array.isArray(outbid) || outbid.length < 1 || outbid.some(h => !(h >= 0 && h < 1))) throw new Error('outbid must be a list of probabilities in [0,1), one per raise');
  if (!(growth >= 1)) throw new Error('growth must be ≥ 1');
  const N = outbid.length;
  // The ladder. Bids are multiples of the opening bid. Between stage k and k+1 the auctioneer adds an increment
  // drawn (equally likely) from steps[k−1]; a fixed ladder is the special case of one increment per stage. `bids`
  // (fixed multiples) and `growth` (geometric) are accepted for that case. reach[k] = the multiples stage k can be at.
  let stepSets;
  if (Array.isArray(bids)) { if (bids.length !== N) throw new Error(`bids must list one multiple per raise (${N}), got ${bids.length}`); if (!(bids[0] === 1) || bids.some((m, i) => i > 0 && !(m > bids[i - 1]))) throw new Error('bids must start at 1 and strictly increase'); stepSets = bids.slice(1).map((m, i) => [m - bids[i]]); }
  else if (Array.isArray(steps)) { if (steps.length !== N - 1) throw new Error(`steps must list the increments for ${N - 1} raises, got ${steps.length}`); stepSets = steps.map((o, i) => { const a = [...new Set(o.map(Number))].sort((x, y) => x - y); if (!a.length || a.some(d => !(d > 0))) throw new Error(`steps[${i}] must be positive increments`); return a; }); }
  else stepSets = Array.from({ length: N - 1 }, (_, i) => [Math.pow(growth, i + 1) - Math.pow(growth, i)]);
  const reach = [[1]]; for (let k = 1; k < N; k++) reach.push([...new Set(reach[k - 1].flatMap(m => stepSets[k - 1].map(d => +(m + d).toFixed(6))))].sort((a, b) => a - b));
  // distribution over multiples per stage (the ladder is independent of outcomes)
  const dist = [new Map([[1, 1]])]; for (let k = 1; k < N; k++) { const d = new Map(); for (const [m, p] of dist[k - 1]) for (const inc of stepSets[k - 1]) { const mm = +(m + inc).toFixed(6); d.set(mm, (d.get(mm) ?? 0) + p / stepSets[k - 1].length); } dist.push(d); }
  const expMult = dist.map(d => [...d].reduce((t, [m, p]) => t + m * p, 0));
  const mult = expMult;   // expected multiples, used by the policy figures and simulate
  const payouts = locker.payouts ?? [0, 0.5, 1, 2, 5, 20];
  // a locker per stage: mean solved so the raise returns exactly rtp
  const stages = outbid.map((H, i) => {
    const mean = edge === 'hammer' ? rtp : (rtp - H * refund) / (1 - H);
    if (!(mean > 0)) throw new Error(`stage ${i + 1}: outbid ${H} with refund ${refund} leaves no value for the locker (mean ${mean.toFixed(3)})`);
    const box = buildPayout({ payouts, rtp: mean, method: locker.method ?? 'maxent', weights: locker.weights, fraction: locker.fraction ?? 0.1 });
    return { stage: i + 1, g: expMult[i], multiples: reach[i], increments: i < N - 1 ? stepSets[i] : [], outbid: H, refund, lockerMean: mean, box, rtp: H * refund + (1 - H) * box.rtp };
  });
  const bidMultiple = (k) => expMult[k - 1];
  const fixedLadder = reach.every(r => r.length === 1);

  const A = {
    name: name ?? `locker-wars-${N}`, rtp, refund, edge, steps: stepSets, reach, expectedMultiples: expMult, fixedLadder, N, outbid, payouts, stages,
    betTypes: stages.map(s => `BID_${s.stage}`),
    stageOf(betType) { const m = /^BID_(\d+)$/.exec(betType); const k = m ? Number(m[1]) : NaN; if (!(k >= 1 && k <= N)) throw new Error(`betType must be BID_1 … BID_${N}, got ${betType}`); return k; },
    bidMultiple,

    /** One uniform decides the raise: outbid, or the locker's band and ramp. */
    draw(u, k) { const S = stages[k - 1]; if (u >= 1) u = 1 - 1e-12; if (u < S.outbid) return { outcome: 'OUTBID', multiple: S.refund, v: null, band: null }; const v = S.outbid < 1 ? (u - S.outbid) / (1 - S.outbid) : u; const X = S.box.payout(v); return { outcome: 'WON', multiple: X, v, band: S.box.bandOf(v) }; },
    settle(u, k) { return A.draw(u, k).multiple; },
    /** Exact return of raise k: H ρ + (1 − H) E[X]. */
    rtpOfStage(k) { return stages[k - 1].rtp; },
    /** Exact figures for the policy "raise until won, up to stage m": expected stake, expected winning bid, return per unit staked, loss per auction (× opener). */
    policy(m = N) {
      let alive = 1, eStake = 0, eWin = 0, eRet = 0;
      for (let k = 1; k <= m; k++) { const H = stages[k - 1].outbid, pw = alive * (k === m ? 1 : 1 - H); const staked = mult.slice(0, k).reduce((t, x) => t + x, 0);
        if (k === m) { const pWin = alive * (1 - H), pOut = alive * H; eStake += alive * staked; eWin += pWin * mult[k - 1]; eRet += pWin * (staked - mult[k - 1] + mult[k - 1] * stages[k - 1].lockerMean) + pOut * (staked - mult[k - 1] + mult[k - 1] * refund); }
        else { eStake += pw * staked; eWin += pw * mult[k - 1]; eRet += pw * (staked - mult[k - 1] + mult[k - 1] * stages[k - 1].lockerMean); }
        alive *= H; }
      return { upTo: m, expectedStake: eStake, expectedWinningBid: eWin, rtp: eRet / eStake, lossPerAuction: eStake - eRet };
    },

    /** Which multiple of the opener a stage-k amount is: the (chip, multiple) pair it factors into. Unique for the shipped presets (tested). */
    resolve(bet, k, chips) {
      const hits = reach[k - 1].filter(m => chips ? chips.some(c => Math.round(c * m) === bet) : Number.isInteger(bet / m));
      const m = hits.length ? hits[hits.length - 1] : reach[k - 1][0];
      return { multiple: m, opener: bet / m };
    },
    play({ bet, betType = 'BID_1', rng, chips }) {
      const k = A.stageOf(betType); const S = stages[k - 1]; const u = rng.next(); const d = A.draw(u, k);
      const win = Math.round(bet * d.multiple); const { multiple, opener } = A.resolve(bet, k, chips);
      let next = null;
      if (k < N) { const inc = stepSets[k - 1]; const t = (rng.derive ? rng.derive('ladder') : rng).next(); const step = inc[Math.min(inc.length - 1, Math.floor(t * inc.length))]; const nm = +(multiple + step).toFixed(6); next = { betType: `BID_${k + 1}`, bid: Math.round(opener * nm), increment: Math.round(opener * step), multiple: nm }; }
      return { totalWinAmount: win, outcome: d.outcome, stage: k, stages: N, bid: bet, multiple, pOutbid: S.outbid, refund: d.outcome === 'OUTBID' ? win : 0,
        locker: d.outcome === 'WON' ? { multiplier: d.multiple, band: d.band, multiple: S.box.payouts[d.band], contents: win } : null,
        next, math: { u, v: d.v } };
    },

    /** Seeded Monte Carlo of a raise-until-won policy up to stage `maxStage`: return per unit staked, by stage and overall. */
    simulate({ rounds = 100000, seed = 'sim', maxStage = N } = {}) {
      const rng = new Rng(seed, 'payout'); let staked = 0, returned = 0, wonAt = new Array(N + 1).fill(0); const perStage = stages.map(() => ({ staked: 0, returned: 0 }));
      for (let n = 0; n < rounds; n++) {
        let bid = 1; for (let k = 1; k <= maxStage; k++) { const d = A.draw(rng.next(), k); staked += bid; returned += bid * d.multiple; perStage[k - 1].staked += bid; perStage[k - 1].returned += bid * d.multiple; if (d.outcome === 'WON') { wonAt[k]++; break; } if (k === maxStage) wonAt[0]++; const inc = stepSets[k - 1]; bid = +(bid + inc[Math.floor(rng.next() * inc.length)]).toFixed(6); }
      }
      // and every stage on its own with the full sample, since raise-until-won reaches late stages rarely
      const independent = stages.map((S, i) => { const r2 = new Rng(seed + ':s' + (i + 1), 'payout'); let tot = 0; for (let n = 0; n < rounds; n++) tot += A.draw(r2.next(), i + 1).multiple; return { stage: i + 1, rtp: tot / rounds, exact: S.rtp }; });
      return { rounds, seed, rtp: returned / staked, perStage: perStage.map((s, i) => ({ stage: i + 1, rtp: s.returned / s.staked, exact: stages[i].rtp })), perStageIndependent: independent, wonAtStage: wonAt.map(c => c / rounds) };
    },

    standalone(fn = 'settle') {
      return [`// Locker Wars: raise k is a bet; u < H_k → outbid, pays refund ρ; else the locker: Single Shot bands on the residual. RTP ${rtp} at every stage.`,
        `function ${fn}(u, k) {`, `  const H = ${JSON.stringify(outbid)}, rho = ${refund};`, `  const breaks = ${JSON.stringify(stages.map(s => s.box.breaks))}, pay = ${JSON.stringify(stages.map(s => s.box.payouts))}, r = ${JSON.stringify(stages.map(s => s.box.r))};`,
        `  if (u >= 1) u = 1 - 1e-12; const h = H[k - 1]; if (u < h) return rho;`, `  const v = h < 1 ? (u - h) / (1 - h) : u; const B = breaks[k - 1], P = pay[k - 1]; let i = 0; while (B[i + 1] <= v) i++;`,
        `  if (P[i] <= 0) return 0; const t = (v - B[i]) / (B[i + 1] - B[i]); return P[i] + r[k - 1] * (2 * t - 1);`, `}`].join('\n');
    },
    toJSON() { return { name: A.name, rtp, refund, edge, steps: stepSets, reach, expectedMultiples: expMult, fixedLadder, outbid, payouts, alwaysRaise: A.policy(), stages: stages.map(s => ({ stage: s.stage, bidMultiple: s.g, outbid: s.outbid, refund: s.refund, lockerMean: s.lockerMean, rtp: s.rtp, bands: s.box.bands.map(b => ({ payout: b.payout, p: b.p, from: b.from, to: b.to, range: b.range })) })) }; },
  };
  return A;
}

export function format(A) {
  const pct = x => `${(100 * x).toFixed(2)}%`;
  const P = A.policy(); return [`${A.name}   R ${A.rtp} on ${A.edge === 'hammer' ? 'the hammer price (won lockers only)' : 'every raise'}   refund on outbid ${A.refund}   increments ${A.steps.map(x => '+' + x.join('|')).join(' ')}   locker payouts ${A.payouts.join('/')}`, `always-raise: RTP ${P.rtp.toFixed(4)} per unit staked, expected loss ${P.lossPerAuction.toFixed(4)} × opener (expected hammer price ${P.expectedWinningBid.toFixed(2)}, expected stake ${P.expectedStake.toFixed(2)})`, '',
    'stage  bid× (possible)        P(outbid)   locker mean   P(locker ≥ 1×)   exact return',
    ...A.stages.map(s => `${String(s.stage).padStart(5)}  ${s.multiples.join('/').padEnd(22)} ${pct(s.outbid).padStart(8)}   ${s.lockerMean.toFixed(4).padStart(10)}   ${pct(s.box.bands.filter(b => b.payout >= 1).reduce((t, b) => t + b.p, 0)).padStart(13)}   ${s.rtp.toFixed(6)}`)].join('\n');
}
