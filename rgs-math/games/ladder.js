// Ladder / stepper game (ChickenX-style) — the multi-step provider contract.
//
// The Stepper provider returns a payout ladder at bet time and the client calls
// next-action with CONTINUE or CASH_OUT. This module shows the two directions of the
// same math:
//
//   hazards -> ladder:  given per-step survival p_k and a target RTP, the payout at step k is
//                       payout_k = bet · RTP / Π_{i≤k} p_i
//                       Continuing is then EV-neutral at every rung, so EVERY stopping rule
//                       (cash out at 1, at 7, never) returns exactly RTP. Strategy-proof.
//   ladder -> hazards:  given a desired multiplier ladder m_k (e.g. copied from a live game)
//                       and a target RTP, the survival that makes it RTP-exact is
//                       p_1 = RTP / m_1,  p_k = m_{k-1} / m_k
//
// The crash step is drawn ONCE at bet time (predetermined), then revealed step by step.

import { defineGame } from '../src/contract.js';

export const TARGET_RTP = 0.96;

export function ladderFromHazards(bet, survive, rtp) {
  const out = [];
  let cum = 1;
  for (let k = 0; k < survive.length; k++) {
    cum *= survive[k];
    out.push(Math.round((bet * rtp) / cum));
  }
  return out;
}

/** Per-step survival probabilities that make `multiples` (× bet) pay exactly `rtp`. */
export function solveLadderHazards(multiples, rtp) {
  const p = [];
  for (let k = 0; k < multiples.length; k++) {
    const prev = k === 0 ? rtp : multiples[k - 1];
    const pk = prev / multiples[k];
    if (!(pk > 0 && pk <= 1)) throw new Error(`solveLadderHazards: step ${k + 1} needs survival ${pk}, ladder is not monotone enough`);
    p.push(pk);
  }
  return p;
}

// Multiplier ladder observed live on the Stepper provider (chickenx-v117 mock, MEDIUM, bet 125).
export const CHICKENX_MEDIUM_MULTIPLES = [137, 155, 175, 200, 237, 287, 350, 437, 562, 750, 1000, 1375, 1875, 2500, 3500, 5000, 7500, 12500, 25000, 62500].map(v => v / 125);

export const DIFFICULTY = {
  BEGINNER: { survive: Array(6).fill(0.97) },
  EASY:     { survive: Array(10).fill(0.93) },
  MEDIUM:   { survive: solveLadderHazards(CHICKENX_MEDIUM_MULTIPLES, TARGET_RTP) },
  HARD:     { survive: Array(15).fill(0.80) },
  INSANE:   { survive: Array(12).fill(0.60) },
};

export const BET_TYPES = Object.keys(DIFFICULTY);
export const LEVELS = [5, 25, 125, 250, 1250, 5000];

function stepsView(ladder, crashAt, current) {
  return ladder.map((payout, i) => {
    const step = i + 1;
    let outcome = 'UNDECIDED';
    if (step <= current) outcome = step === crashAt ? 'CRASH' : 'SAFE';
    return { step, payout, outcome };
  });
}

export function play({ bet, betType, rng }) {
  const { survive } = DIFFICULTY[betType];
  const ladder = ladderFromHazards(bet, survive, TARGET_RTP);
  // Predetermined crash step: first k where the survival roll fails (Infinity = never).
  let crashAt = Infinity;
  for (let k = 0; k < survive.length; k++) {
    if (!rng.chance(survive[k])) { crashAt = k + 1; break; }
  }
  return {
    totalWinAmount: 0,
    roundEnded: false,
    nextAction: ['CONTINUE'],
    state: { ladder, crashAt, current: 0 },
    difficulty: betType,
    currentStep: 0,
    currentPayout: 0,
    steps: stepsView(ladder, crashAt, 0),
  };
}

export function step({ round, actionCode }) {
  const st = { ...round.state };
  const { ladder, crashAt } = st;
  const base = { difficulty: round.betType, state: st };

  if (actionCode === 'CASH_OUT') {
    const win = st.current > 0 ? ladder[st.current - 1] : 0;
    return { ...base, totalWinAmount: win, roundEnded: true, nextAction: ['COLLECT'],
      currentStep: st.current, currentPayout: win, steps: stepsView(ladder, crashAt, st.current) };
  }
  // CONTINUE
  st.current += 1;
  if (st.current === crashAt) {
    return { ...base, totalWinAmount: 0, roundEnded: true, nextAction: ['COLLECT'],
      currentStep: st.current, currentPayout: 0, steps: stepsView(ladder, crashAt, st.current) };
  }
  const payout = ladder[st.current - 1];
  const last = st.current >= ladder.length;
  return { ...base,
    totalWinAmount: last ? payout : 0,
    roundEnded: last,
    nextAction: last ? ['COLLECT'] : ['CONTINUE', 'CASH_OUT'],
    currentStep: st.current, currentPayout: payout, steps: stepsView(ladder, crashAt, st.current) };
}

export const game = defineGame({
  id: 'ladder',
  betTypes: BET_TYPES,
  defaultBetType: 'MEDIUM',
  levels: () => LEVELS,
  play,
  step,
});

export const meta = { targetRtp: TARGET_RTP, difficulty: DIFFICULTY };
