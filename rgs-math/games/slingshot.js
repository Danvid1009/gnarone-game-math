// Slingshot (MS-03) — an EMERGENT model, kept as the contrast case.
//
// Every hit draws a small multiplier from a per-hit table, scaled by SCALE, the ring hit
// and a golden bonus; rank adds +50/30/15/0 %. RTP is therefore a function of how many
// hits the player lands: this is the "sharp-bot" problem the predetermined framework
// removes. The module solves SCALE analytically for a reference player and then lets
// verify-all show how far a sharper player moves the RTP.
//
//   RTP = E[hits] · DRAW_EV · SCALE · E[ring] · E[golden] · (1 + E[rankBonus])

import { fromWeights, rtp as tableRtp, sampler } from '../src/table.js';
import { defineGame } from '../src/contract.js';

export const TARGET_RTP = 0.80;

export const DRAW_TABLE = fromWeights([
  { label: 'x0.02', prize: 0.02, weight: 400 },
  { label: 'x0.05', prize: 0.05, weight: 280 },
  { label: 'x0.10', prize: 0.10, weight: 170 },
  { label: 'x0.20', prize: 0.20, weight: 100 },
  { label: 'x0.50', prize: 0.50, weight: 40 },
  { label: 'x1.50', prize: 1.50, weight: 9 },
  { label: 'x5.00', prize: 5.00, weight: 1 },
]);
export const DRAW_EV = tableRtp(DRAW_TABLE); // 0.0975

export const RING_FACTOR = fromWeights([
  { label: 'bull',  prize: 1.0, weight: 25 },
  { label: 'inner', prize: 0.6, weight: 45 },
  { label: 'outer', prize: 0.3, weight: 30 },
]);
export const GOLDEN_P = 0.05, GOLDEN_MULT = 2.5;
export const RANK_BONUS = fromWeights([
  { label: 'rank1', prize: 0.50, weight: 12 },
  { label: 'rank2', prize: 0.30, weight: 15 },
  { label: 'rank3', prize: 0.15, weight: 18 },
  { label: 'rank4+', prize: 0.00, weight: 55 },
]);
export const PER_HIT_FLOOR = 0.01;

/** Reference player: mean hits per 60 s round. Sharps land more. */
export const REFERENCE_HITS = 14;
export const SHARP_HITS = 22;

/**
 * Exact per-hit expected add at a given SCALE, enumerating draw × ring × golden and
 * applying the 0.01 floor. The floor is part of the math, so SCALE is solved by
 * bisection against this rather than by the closed form (which ignores the floor).
 */
export function perHitEv(scale) {
  let ev = 0;
  for (const d of DRAW_TABLE) for (const r of RING_FACTOR) for (const [g, pg] of [[GOLDEN_MULT, GOLDEN_P], [1, 1 - GOLDEN_P]]) {
    ev += d.p * r.p * pg * Math.max(PER_HIT_FLOOR, d.prize * scale * r.prize * g);
  }
  return ev;
}
export function roundRtp(scale, meanHits) {
  return meanHits * perHitEv(scale) * (1 + tableRtp(RANK_BONUS));
}
export function solveScale(targetRtp, meanHits = REFERENCE_HITS) {
  let lo = 0, hi = 100;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (roundRtp(mid, meanHits) < targetRtp) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
export const SCALE = solveScale(TARGET_RTP);
export const SHARP_RTP = roundRtp(SCALE, SHARP_HITS); // what the same SCALE pays a sharp

const drawMult = sampler(DRAW_TABLE), drawRing = sampler(RING_FACTOR), drawRank = sampler(RANK_BONUS);

function poisson(rng, lambda) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rng.next(); } while (p > L);
  return k - 1;
}

export const LEVELS = [10, 50, 250, 500, 2500];

/** betType selects the player model so the skill-dependence is visible in verify. */
export function play({ bet, betType, rng }) {
  const meanHits = betType === 'SHARP' ? SHARP_HITS : REFERENCE_HITS;
  const hits = poisson(rng, meanHits);
  let acc = 0;
  const log = [];
  for (let i = 0; i < hits; i++) {
    const d = DRAW_TABLE[drawMult(rng)].prize;
    const ring = RING_FACTOR[drawRing(rng)].prize;
    const golden = rng.chance(GOLDEN_P);
    const add = Math.max(PER_HIT_FLOOR, d * SCALE * ring * (golden ? GOLDEN_MULT : 1));
    acc += add;
    log.push({ draw: d, ring, golden, add: Math.round(add * 10000) / 10000 });
  }
  const rank = drawRank(rng);
  const bonus = RANK_BONUS[rank].prize;
  const total = acc * (1 + bonus);
  return {
    totalWinAmount: Math.round(bet * total),
    math: { hits, base: Math.round(acc * 10000) / 10000, rank: rank + 1, rankBonus: bonus, total: Math.round(total * 10000) / 10000, hitsLog: log },
  };
}

export const game = defineGame({
  id: 'slingshot',
  betTypes: ['REFERENCE', 'SHARP'],
  levels: () => LEVELS,
  play,
});

export const meta = { targetRtp: TARGET_RTP, scale: SCALE, drawEv: DRAW_EV, sharpRtp: SHARP_RTP };
