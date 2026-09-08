// Whiteboard model as a STEP function with a fixed neighbourhood r.
//
// The draw axis is cut at the whiteboard breakpoints (30k, 42.5k, 55k, 80k) and each
// region pays one constant level. Levels are taken from the sketched ramp at each region's
// midpoint, so the staircase has exactly the ramp's RTP (0.97) and is monotone; A* is the
// ramp's top knot, solved for the 0.97 target. Set SUBSTEPS > 1 to cut each region into
// finer steps (RTP is unchanged for any value).
//
// Layer 2: r = 0.1 × the smallest gap between adjacent non-zero levels. The zero region
// pays exactly 0 and the lowest band is checked to sit strictly above zero, so there is
// no intersection with zero anywhere.

import { makeCurve, stepFromLinear, dispersion, toMinor } from '../src/curve.js';
import { defineGame } from '../src/contract.js';

export const TARGET_RTP = 0.97;
export const SUBSTEPS = 1;

// The sketched ramp (only used to place the levels).
export const SHAPE = [
  { u: 0.000, a: 0 },
  { u: 0.300, a: 0 },
  { u: 0.425, a: 0.5 },
  { u: 0.550, a: 1.0 },
  { u: 0.800, a: 2.0 },
  { u: 1.000, a: 5.0 },   // A*, solved below
];
export const RAMP = makeCurve(SHAPE).solveKnot(SHAPE.length - 1, TARGET_RTP);
export const A_STAR = RAMP.knots[RAMP.knots.length - 1].a;

export const CURVE = stepFromLinear(RAMP, SUBSTEPS);   // breaks 0/.3/.425/.55/.8/1, levels 0/.25/.75/1.5/2.35
export const LEVELS_X = CURVE.levels;
export const TOP_LEVEL = Math.max(...CURVE.levels);

export const BAND = dispersion.fixedGap(CURVE.anchors());   // r = 0.1 × 0.5 = 0.05
export const R = BAND.r;

const draw = CURVE.draw(BAND);

export const LEVELS = [10, 50, 250, 500, 2500];

export function play({ bet, rng }) {
  const d = draw(rng);
  return {
    totalWinAmount: toMinor(bet, d.prize),
    math: {
      u: d.u,
      level: d.base,                 // A(u), the step's payout level
      prize: d.prize,                // level + ε, × bet
      band: [d.lo, d.hi],
      r: R,
      dispersion: d.rule,
    },
  };
}

export const game = defineGame({ id: 'curve-band', betTypes: ['BASE'], levels: () => LEVELS, play });

export const meta = { targetRtp: TARGET_RTP, designRtp: CURVE.rtp(), curve: CURVE, band: BAND, table: CURVE.toTable() };
