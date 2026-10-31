// Locker Wars engine.  See ALGORITHM.md for the math.
//
//   const A = buildLockerWars({ rtp: 0.95, refund: 1, outbid: [0.6, 0.5, 0.4, 0.3, 0.2, 0], growth: 1.5, locker: { payouts: [0, 0.5, 1, 2, 5, 20] } });
//   A.stages                 // per raise k: bid multiple g_k, P(outbid) H_k, refund, locker mean
//   A.settle(u, k)           // payout multiple of the bid at stage k for one uniform u
//   A.play({ bet, betType: 'BID_3', rng })   // one raise: OUTBID (bid back less the fee) or WON (the locker opens)
//
// Model. An auction is a sequence of raises. Raise k is its own bet of b_k = b_1 · g^(k−1). With probability
// H_k the rivals outbid you and the bid comes back in full (ρ = 1: being outbid costs nothing). Otherwise the rivals
// fold, you win the locker and open it: a Single Shot draw X (sloped bands) times the bid, with mean
// E[X] = (R − H_k ρ)/(1 − H_k) so that the raise returns H_k ρ + (1 − H_k) E[X] = R exactly. The house edge therefore
// lives only in won lockers, and any sequence of raise / walk decisions returns exactly R per unit staked.
// One uniform per raise: u < H_k is the outbid; the residual (u − H_k)/(1 − H_k) is the locker draw.

import { Rng } from './rng.js';
import { buildPayout } from '../../payout-engine/src/engine.js';

export function buildLockerWars({ rtp = 0.95, refund = 1, outbid = [0.6, 0.5, 0.4, 0.3, 0.2, 0], growth = 1.5, locker = {}, name } = {}) {
  if (!(rtp > 0 && rtp < 1)) throw new Error(`rtp must be in (0,1), got ${rtp}`);
  if (!(refund >= 0 && refund <= 1)) throw new Error('refund must be in [0,1]');
  if (!Array.isArray(outbid) || outbid.length < 1 || outbid.some(h => !(h >= 0 && h < 1))) throw new Error('outbid must be a list of probabilities in [0,1), one per raise');
  if (!(growth >= 1)) throw new Error('growth must be ≥ 1');
  const N = outbid.length;
  const payouts = locker.payouts ?? [0, 0.5, 1, 2, 5, 20];
  // a locker per stage: mean solved so the raise returns exactly rtp
  const stages = outbid.map((H, i) => {
    const mean = (rtp - H * refund) / (1 - H);
    if (!(mean > 0)) throw new Error(`stage ${i + 1}: outbid ${H} with refund ${refund} leaves no value for the locker (mean ${mean.toFixed(3)})`);
    const box = buildPayout({ payouts, rtp: mean, method: locker.method ?? 'maxent', weights: locker.weights, fraction: locker.fraction ?? 0.1 });
    return { stage: i + 1, g: Math.pow(growth, i), outbid: H, refund, lockerMean: mean, box, rtp: H * refund + (1 - H) * box.rtp };
  });
  const bidMultiple = (k) => stages[k - 1].g;

  const A = {
    name: name ?? `locker-wars-${N}`, rtp, refund, growth, N, outbid, payouts, stages,
    betTypes: stages.map(s => `BID_${s.stage}`),
    stageOf(betType) { const m = /^BID_(\d+)$/.exec(betType); const k = m ? Number(m[1]) : NaN; if (!(k >= 1 && k <= N)) throw new Error(`betType must be BID_1 … BID_${N}, got ${betType}`); return k; },
    bidMultiple,

    /** One uniform decides the raise: outbid, or the locker's band and ramp. */
    draw(u, k) { const S = stages[k - 1]; if (u >= 1) u = 1 - 1e-12; if (u < S.outbid) return { outcome: 'OUTBID', multiple: S.refund, v: null, band: null }; const v = S.outbid < 1 ? (u - S.outbid) / (1 - S.outbid) : u; const X = S.box.payout(v); return { outcome: 'WON', multiple: X, v, band: S.box.bandOf(v) }; },
    settle(u, k) { return A.draw(u, k).multiple; },
    /** Exact return of raise k: H ρ + (1 − H) E[X]. */
    rtpOfStage(k) { return stages[k - 1].rtp; },

    play({ bet, betType = 'BID_1', rng }) {
      const k = A.stageOf(betType); const S = stages[k - 1]; const u = rng.next(); const d = A.draw(u, k);
      const win = Math.round(bet * d.multiple);
      return { totalWinAmount: win, outcome: d.outcome, stage: k, stages: N, bid: bet, pOutbid: S.outbid, refund: d.outcome === 'OUTBID' ? win : 0,
        locker: d.outcome === 'WON' ? { multiplier: d.multiple, band: d.band, multiple: S.box.payouts[d.band], contents: win } : null,
        next: k < N ? { betType: `BID_${k + 1}`, bid: Math.round(bet * growth) } : null, math: { u, v: d.v } };
    },

    /** Seeded Monte Carlo of a raise-until-won policy up to stage `maxStage`: return per unit staked, by stage and overall. */
    simulate({ rounds = 100000, seed = 'sim', maxStage = N } = {}) {
      const rng = new Rng(seed, 'payout'); let staked = 0, returned = 0, wonAt = new Array(N + 1).fill(0); const perStage = stages.map(() => ({ staked: 0, returned: 0 }));
      for (let n = 0; n < rounds; n++) {
        let bid = 1; for (let k = 1; k <= maxStage; k++) { const d = A.draw(rng.next(), k); staked += bid; returned += bid * d.multiple; perStage[k - 1].staked += bid; perStage[k - 1].returned += bid * d.multiple; if (d.outcome === 'WON') { wonAt[k]++; break; } if (k === maxStage) wonAt[0]++; bid *= growth; }
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
    toJSON() { return { name: A.name, rtp, refund, growth, outbid, payouts, stages: stages.map(s => ({ stage: s.stage, bidMultiple: s.g, outbid: s.outbid, refund: s.refund, lockerMean: s.lockerMean, rtp: s.rtp, bands: s.box.bands.map(b => ({ payout: b.payout, p: b.p, from: b.from, to: b.to, range: b.range })) })) }; },
  };
  return A;
}

export function format(A) {
  const pct = x => `${(100 * x).toFixed(2)}%`;
  return [`${A.name}   RTP ${A.rtp}   refund on outbid ${A.refund}   bid growth ×${A.growth}   locker payouts ${A.payouts.join('/')}`, '',
    'stage  bid×    P(outbid)   locker mean   P(locker ≥ 1×)   exact return',
    ...A.stages.map(s => `${String(s.stage).padStart(5)}  ${s.g.toFixed(3).padStart(6)}   ${pct(s.outbid).padStart(8)}   ${s.lockerMean.toFixed(4).padStart(10)}   ${pct(s.box.bands.filter(b => b.payout >= 1).reduce((t, b) => t + b.p, 0)).padStart(13)}   ${s.rtp.toFixed(6)}`)].join('\n');
}
