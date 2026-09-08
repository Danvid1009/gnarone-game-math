// RTP verification.
//
// Two independent checks on every math module:
//   1. exact:  arithmetic on the outcome table (rtp(), exactRtpAtBet()) - the design number.
//   2. sample: Monte Carlo through game.simulate() - proves the sampling code, the
//              rounding and the step logic agree with the design number.
// If (2) is outside the confidence band of (1), the CODE is wrong, not the table.

import { rtp as tableRtp, exactRtpAtBet } from './table.js';

export function monteCarlo(game, { betType = game.defaultBetType, bet, rounds = 100000, seed = 'mc', policy = null } = {}) {
  if (bet === undefined) bet = game.levels(betType)[0];
  let totalWin = 0, sumSq = 0, hits = 0, maxWin = 0;
  const hist = new Map();
  for (let i = 0; i < rounds; i++) {
    const r = game.simulate({ bet, betType, seed: `${seed}:${i}`, policy });
    const w = r.totalWinAmount;
    const m = w / bet;
    totalWin += w; sumSq += m * m;
    if (w > 0) hits++;
    if (w > maxWin) maxWin = w;
    const key = Math.round(m * 100) / 100;
    hist.set(key, (hist.get(key) ?? 0) + 1);
  }
  const rtp = totalWin / (bet * rounds);
  const variance = sumSq / rounds - rtp * rtp;
  const sd = Math.sqrt(Math.max(variance, 0));
  const se = sd / Math.sqrt(rounds);
  return {
    game: game.id, betType, bet, rounds,
    totalBet: bet * rounds, totalWin,
    rtp, se, ci95: [rtp - 1.96 * se, rtp + 1.96 * se],
    hitRate: hits / rounds,
    maxWinMultiple: maxWin / bet,
    stdevMultiple: sd,
    histogram: [...hist.entries()].sort((a, b) => a[0] - b[0]),
  };
}

/** Throws unless the MC estimate sits within z standard errors of the target. */
export function assertRtp(mc, target, { z = 3.5 } = {}) {
  const diff = Math.abs(mc.rtp - target);
  if (diff > z * mc.se) {
    throw new Error(`${mc.game}/${mc.betType}@${mc.bet}: MC RTP ${mc.rtp.toFixed(5)} is ${(diff / mc.se).toFixed(1)} SE from target ${target} (se=${mc.se.toExponential(2)})`);
  }
  return true;
}

/** Design RTP and per-chip rounded RTP for a table-driven game. */
export function exactReport(table, levels) {
  return {
    designRtp: tableRtp(table),
    perBet: levels.map(bet => ({ bet, rtp: exactRtpAtBet(table, bet), roundingLoss: tableRtp(table) - exactRtpAtBet(table, bet) })),
  };
}

const pct = x => `${(100 * x).toFixed(3)}%`;

export function formatMc(mc, target) {
  const flag = target === undefined ? '' : (Math.abs(mc.rtp - target) <= 3.5 * mc.se ? '  OK' : '  ** OUTSIDE 3.5 SE **');
  return [
    `  ${mc.betType.padEnd(10)} bet=${String(mc.bet).padStart(6)}  rounds=${mc.rounds}`,
    `    RTP ${pct(mc.rtp)}  95% CI [${pct(mc.ci95[0])}, ${pct(mc.ci95[1])}]` + (target !== undefined ? `  target ${pct(target)}${flag}` : ''),
    `    hit rate ${pct(mc.hitRate)}  max win ${mc.maxWinMultiple}x  stdev ${mc.stdevMultiple.toFixed(3)}x`,
  ].join('\n');
}
