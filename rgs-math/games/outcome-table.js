// MS-style predetermined-outcome game (RandomSkill manual, Part I / §3).
//
// Layer A only: draw the composite prize P from a fixed table, then decompose it into a
// base target and a secondary (rank) multiplier as a JOINT draw. The reveal layer
// (Layer B, client/game side) steers the live multiplier to `math.baseTarget` and the
// rank to `math.rank`. Nothing in the round changes the prize.
//
// The 75% table is the illustrative one from the manual §3. Replace OUTCOME_TABLE with a
// refined table; RTP is Σ p·prize and is checked exactly in test/.

import { makeTable, sampler, toMinor, rtp } from '../src/table.js';
import { defineGame } from '../src/contract.js';

export const TARGET_RTP = 0.75;

export const OUTCOME_TABLE = makeTable([
  { label: 'zero',   prize: 0,    p: 0.3215, meta: { rope: 0.60, band: 'low' } },
  { label: 'x0.2',   prize: 0.2,  p: 0.3000, meta: { rope: 0.60, band: 'low' } },
  { label: 'x0.5',   prize: 0.5,  p: 0.2000, meta: { rope: 0.40, band: 'low' } },
  { label: 'x1.5',   prize: 1.5,  p: 0.1200, meta: { rope: 0.25, band: 'mid' } },
  { label: 'x4',     prize: 4,    p: 0.0500, meta: { rope: 0.15, band: 'mid' } },
  { label: 'x20',    prize: 20,   p: 0.0080, meta: { rope: 0.05, band: 'high' } },
  { label: 'x100',   prize: 100,  p: 0.0005, meta: { rope: 0.02, band: 'high' } },
]);

// Secondary multiplier by finishing rank vs 7 bots (×5 / ×2 / ×1.5 / ×1).
export const RANK_MULT = [5, 2, 1.5, 1];
// Conditional rank distribution per prize band. This IS the base/secondary correlation
// (§3.1): richer draws are more often accompanied by a podium finish.
export const RANK_P_BY_BAND = {
  low:  [0.02, 0.08, 0.20, 0.70],
  mid:  [0.10, 0.25, 0.30, 0.35],
  high: [0.55, 0.30, 0.10, 0.05],
};

const drawRow = sampler(OUTCOME_TABLE);
const rankSamplers = Object.fromEntries(
  Object.entries(RANK_P_BY_BAND).map(([band, ps]) => [band, sampler(makeTable(ps.map((p, i) => ({ label: `rank${i + 1}`, prize: RANK_MULT[i], p }))))]),
);

export const LEVELS = [10, 50, 250, 500, 2500];

export function play({ bet, betType, rng }) {
  const rowIdx = drawRow(rng);
  const row = OUTCOME_TABLE[rowIdx];
  const rankIdx = rankSamplers[row.meta.band](rng);
  const secondary = RANK_MULT[rankIdx];
  const prize = row.prize * (betType === 'BOOSTED' ? 1 : 1); // boosted is priced by chip size, not here
  // The payout is rounded from the composite prize ONCE. base × secondary is a
  // presentation split; it can never change the amount paid.
  const totalWinAmount = toMinor(bet, prize);
  return {
    totalWinAmount,
    math: {
      table: 'MS-illustrative-75',
      row: row.label,
      prize,                              // × bet
      rank: rankIdx + 1,
      secondary,                          // rank multiplier
      baseTarget: prize / secondary,      // M* the reveal servo steers to
      rope: row.meta.rope,                // slack above schedule for this row
      band: row.meta.band,
    },
  };
}

export const game = defineGame({
  id: 'outcome-table',
  betTypes: ['BASE'],
  levels: () => LEVELS,
  play,
});

export const meta = { targetRtp: TARGET_RTP, designRtp: rtp(OUTCOME_TABLE), table: OUTCOME_TABLE };
