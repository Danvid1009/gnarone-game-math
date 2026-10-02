// Cutscene Fight engine.  See ALGORITHM.md for the math.
//
//   const C = buildCutscene({ A: { power: 1700, hp: 100 }, B: { power: 1550, hp: 100 }, rtp: 0.95 });
//   C.pA                    // P(A wins): the Live Fight rating of this pairing (power + HP folded into one number)
//   C.odds                  // { A: rtp / pA, B: rtp / (1 − pA) }
//   C.play({ bet, betType, rng })   // winner by one biased coin, cutscene script, win
//   C.sideBet({ bet, params, rng }) // a draw from the side-bet library, independent of the fight
//
// The fight outcome is a single biased coin: u < pA → A. The cutscene is cosmetic: a Live Fight trajectory
// drawn from a derived stream and re-drawn until its winner matches the coin (the first matching one is
// used, so the script never changes the payout). Side bets are independent single draws from their own
// stream: a biased coin, an n-way pick (RTP / p), or a Single Shot payout table.

import { buildFight } from '../../fight-engine/src/engine.js';
import { buildPayout } from '../../payout-engine/src/engine.js';

export const SIDE_KINDS = ['coin', 'pick', 'single-shot'];

/** Build one side bet from its params. Options are placeholders OPTION_1..n; the client reskins them. */
export function buildSideBet(params = {}) {
  const { kind, rtp = 0.95 } = params;
  if (!(rtp > 0 && rtp <= 1)) throw new Error(`side rtp must be in (0,1], got ${rtp}`);
  if (kind === 'coin') {
    const p = params.p ?? 0.5; if (!(p > 0 && p < 1)) throw new Error('coin needs 0 < p < 1 (probability of OPTION_1)');
    const probs = [p, 1 - p], odds = probs.map(x => rtp / x);
    return { kind, rtp, options: ['OPTION_1', 'OPTION_2'], probs, odds, outcome: u => (u < p ? 0 : 1) };
  }
  if (kind === 'pick') {
    let probs; if (Array.isArray(params.probabilities)) probs = params.probabilities.map(Number); else if (Array.isArray(params.weights)) { const W = params.weights.reduce((s, w) => s + Number(w), 0); probs = params.weights.map(w => Number(w) / W); } else if (Number.isInteger(params.n) && params.n >= 2) probs = Array.from({ length: params.n }, () => 1 / params.n); else throw new Error('pick needs n, weights or probabilities');
    if (probs.some(x => !(x > 0)) || Math.abs(probs.reduce((s, x) => s + x, 0) - 1) > 1e-9) throw new Error('pick probabilities must be positive and sum to 1');
    const cum = [0]; for (const x of probs) cum.push(cum[cum.length - 1] + x); cum[probs.length] = 1;
    return { kind, rtp, options: probs.map((_, i) => `OPTION_${i + 1}`), probs, odds: probs.map(x => rtp / x), outcome: u => { if (u >= 1) u = 1 - 1e-12; let i = 0; while (cum[i + 1] <= u) i++; return i; } };
  }
  if (kind === 'single-shot') {
    if (!Array.isArray(params.payouts)) throw new Error('single-shot needs a payouts array');
    const E = buildPayout({ payouts: params.payouts, rtp, method: params.method ?? 'geometric', weights: params.weights });
    return { kind, rtp, options: ['BASE'], payouts: E.payouts, probs: E.p, r: E.r, engine: E, multiple: u => E.payout(u) };
  }
  throw new Error(`unknown side bet kind "${kind}"; kinds: ${SIDE_KINDS.join(', ')}`);
}

export function buildCutscene({ A, B, rtp = 0.95, fight = {}, maxRedraws = 64, name } = {}) {
  const F = buildFight({ A, B, rtp, ...fight });
  const pA = F.pA0, odds = { A: rtp / pA, B: rtp / (1 - pA) };
  const C = {
    name: name ?? `cutscene-${A.power}v${B.power}`, rtp, fighters: { A, B }, pA, odds, fight: F,

    /** Winner by one biased coin; then a cosmetic script with that winner. */
    play({ bet, betType, rng }) {
      if (!['A', 'B'].includes(betType)) throw new Error(`betType must be A or B, got ${betType}`);
      const u = rng.next(), winner = u < pA ? 'A' : 'B';
      const cos = rng.derive ? rng.derive('cutscene') : rng; let script = null, tries = 0;
      while (tries++ < maxRedraws) { const f = F.play(cos); if (f.winner === winner) { script = f; break; } }
      if (!script) { const f = F.play(cos); script = { ...f, winner, log: f.log.map(e => ({ ...e, hitter: e.hitter === 'A' ? 'B' : 'A', hpA: e.hpB, hpB: e.hpA, pA: 1 - e.pA })), final: { hpA: f.final.hpB, hpB: f.final.hpA }, relabelled: true }; }
      const win = winner === betType ? Math.round(bet * odds[betType]) : 0;
      return { totalWinAmount: win, winner, odds: odds[betType], cutscene: { how: script.how, ticks: script.ticks, hits: script.log.map(e => ({ tick: e.tick, hitter: e.hitter, damage: e.damage, hpA: e.hpA, hpB: e.hpB })), final: script.final, redraws: tries - 1 }, math: { u, pA } };
    },

    /** An independent side bet. params: { kind: 'coin', p, pick: 'OPTION_1' } | { kind: 'pick', n|weights|probabilities, pick } | { kind: 'single-shot', payouts, method?, weights? } plus optional rtp. */
    sideBet({ bet, params, rng }) {
      const S = buildSideBet(params); const u = rng.next();
      if (S.kind === 'single-shot') { const m = S.multiple(u); return { totalWinAmount: Math.round(bet * m), kind: S.kind, multiple: m, band: S.engine.bandOf(u), math: { u } }; }
      const pick = params.pick ?? S.options[0]; const j = S.options.indexOf(pick); if (j < 0) throw new Error(`pick must be one of ${S.options.join(', ')}`);
      const w = S.outcome(u), hit = w === j;
      return { totalWinAmount: hit ? Math.round(bet * S.odds[j]) : 0, kind: S.kind, outcome: S.options[w], pick, hit, odds: S.odds[j], math: { u, probs: S.probs } };
    },

    /** Seeded Monte Carlo of the main bet and a few side bets. */
    simulate({ rounds = 100000, seed = 'sim' } = {}) {
      const { Rng } = C._rng; const rng = new Rng(seed, 'payout'); let a = 0, retA = 0, retB = 0;
      for (let i = 0; i < rounds; i++) { const u = rng.next(); if (u < pA) { a++; retA += odds.A; } else retB += odds.B; }
      const side = {}; for (const [k, params] of Object.entries({ coin: { kind: 'coin', p: 0.5 }, pick3: { kind: 'pick', n: 3 }, shot: { kind: 'single-shot', payouts: [0, 0.5, 1, 2, 5, 20] } })) { const r2 = new Rng(seed + k, 'side'); let tot = 0; for (let i = 0; i < rounds; i++) tot += C.sideBet({ bet: 1000, params, rng: r2 }).totalWinAmount; side[k] = tot / rounds / 1000; }
      return { rounds, seed, pA, freqA: a / rounds, se: Math.sqrt(pA * (1 - pA) / rounds), rtpA: retA / rounds, rtpB: retB / rounds, sideRtp: side };
    },
    toJSON() { return { name: C.name, rtp, fighters: { A, B }, pA, odds, fight: F.toJSON(), sideKinds: SIDE_KINDS }; },
  };
  return C;
}
