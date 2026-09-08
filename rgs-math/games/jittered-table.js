// The 75% outcome table with a neighbourhood R around every non-zero prize.
//
// Same rows and probabilities as games/outcome-table.js. r is fixed at 0.1 × the smallest
// gap between adjacent non-zero prizes (0.2, 0.5, 1.5, 4, 20, 100 → gap 0.3 → r = 0.03), so
// the 1.5x row pays anywhere in [1.47, 1.53] and the 0.2x row in [0.17, 0.23]. The zero
// row pays exactly 0 and has no band. Σ p_i·E[B_i] = Σ p_i·A_i, so the table's 75% is
// untouched; the per-chip report shows what rounding to cents does to it.

import { jitteredDraw, dispersion, toMinor } from '../src/curve.js';
import { OUTCOME_TABLE, TARGET_RTP } from './outcome-table.js';
import { defineGame } from '../src/contract.js';
import { rtp } from '../src/table.js';

export { OUTCOME_TABLE, TARGET_RTP };
export const JITTER = dispersion.fixedGap(OUTCOME_TABLE.map(r => r.prize));
export const R = JITTER.r;

const draw = jitteredDraw(OUTCOME_TABLE, JITTER);

export const LEVELS = [10, 50, 250, 500, 2500];

export function play({ bet, rng }) {
  const d = draw(rng);
  return {
    totalWinAmount: toMinor(bet, d.prize),
    math: { row: d.row.label, anchor: d.base, prize: d.prize, band: [d.lo, d.hi] },
  };
}

export const game = defineGame({ id: 'jittered-table', betTypes: ['BASE'], levels: () => LEVELS, play });

export const meta = { targetRtp: TARGET_RTP, designRtp: rtp(OUTCOME_TABLE), table: OUTCOME_TABLE, jitter: JITTER };
