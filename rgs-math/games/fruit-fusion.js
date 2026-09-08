// Fruit Fusion (MS-04) — prize-band economy as an outcome table.
//
// From the Fruit Fusion deck: No Win 0x (score 0-499) / Bronze 1x (500-999) /
// Silver 2x (1000-1999) / Gold 5x (2000-2999) / Jackpot 10x (3000+), "entirely
// configurable". Under the RandomSkill framework the band is DRAWN at bet lock and the
// jar round is the reveal that lands the score inside the drawn band.
//
// Input:  relative weights of the winning bands + target RTP.
// Output: the zero-row probability that makes the table sum to the target exactly.
// Speed is the secondary (×5/×4/×3/×2/×1 at 30 s brackets) and skill owns the split:
// a fast round earns a high speed multiplier and a low base, a slow round the reverse.

import { solveZeroRow, sampler, toMinor, rtp } from '../src/table.js';
import { defineGame } from '../src/contract.js';

export const TARGET_RTP = 0.95;

export const BANDS = [
  { label: 'BRONZE',  prize: 1,  weight: 60, meta: { score: [500, 999] } },
  { label: 'SILVER',  prize: 2,  weight: 30, meta: { score: [1000, 1999] } },
  { label: 'GOLD',    prize: 5,  weight: 9,  meta: { score: [2000, 2999] } },
  { label: 'JACKPOT', prize: 10, weight: 1,  meta: { score: [3000, 3999] } },
];

export const OUTCOME_TABLE = solveZeroRow(BANDS, TARGET_RTP, { zeroLabel: 'NO_WIN' });
OUTCOME_TABLE[0].meta = { score: [0, 499] };

export const SPEED_MULT = [5, 4, 3, 2, 1]; // by 30 s bracket, fastest first

const drawRow = sampler(OUTCOME_TABLE);

export const LEVELS = [10, 20, 50, 100, 200, 500, 1000];

export function play({ bet, rng }) {
  const row = OUTCOME_TABLE[drawRow(rng)];
  const [lo, hi] = row.meta.score;
  // Where inside the band the reveal should land. Shaping RNG, not payout RNG.
  const shaping = rng.derive('shaping');
  const scoreTarget = lo + shaping.int(hi - lo + 1);
  return {
    totalWinAmount: toMinor(bet, row.prize),
    math: {
      band: row.label,
      prize: row.prize,
      scoreTarget,
      // Allowed decompositions prize = base × speed. The client picks the speed tier
      // the player actually earned and steers base to prize/speed. Same money every way.
      splits: SPEED_MULT.map(s => ({ speed: s, base: row.prize / s })),
    },
  };
}

export const game = defineGame({
  id: 'fruit-fusion',
  betTypes: ['BASE'],
  levels: () => LEVELS,
  play,
});

export const meta = { targetRtp: TARGET_RTP, designRtp: rtp(OUTCOME_TABLE), table: OUTCOME_TABLE };
