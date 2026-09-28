// Stepper as an RGS provider that rolls locally (browser or Node). Multi-step: CONTINUE → CONTINUE/CASH_OUT → COLLECT.
//   const g = createGame({ preset: 'MEDIUM' });   g.bet({ sessionId, betAmount: 1000, betType: 'MEDIUM' })
// One preset = one ladder; the bet type must equal the preset name (the live Stepper sends difficulty as the bet type).
import { defineGame } from '../../rgs-math/src/contract.js';
import { buildLadder } from './engine.js';

export const RTP = 0.97, LEVELS = [100, 200, 500, 1000, 2500, 5000, 10000];
export const PRESETS = {
  EASY:   { maxWin: 10,  steps: 10, rtp: RTP },
  MEDIUM: { maxWin: 25,  steps: 10, rtp: RTP },
  HARD:   { maxWin: 100, steps: 10, rtp: RTP },
};
export const DEFAULT_PRESET = 'EASY';
export const HOW_TO_SETTLE = 'K = rungs survived (from u and the cum table). CONTINUE on rung k is SAFE if k ≤ K else CRASH (win 0). CASH_OUT after s ≤ K rungs pays round(stake × returns[s − 1]); reaching the top pays returns[N − 1]';

const pub = (v, difficulty) => ({ difficulty, currentStep: v.currentStep, currentPayout: v.currentPayout, steps: v.steps });

export function createGame({ preset = DEFAULT_PRESET, levels = LEVELS, ...overrides } = {}) {
  if (!PRESETS[preset]) throw new Error(`unknown preset "${preset}"; presets: ${Object.keys(PRESETS).join(', ')}`);
  const params = { ...PRESETS[preset], ...overrides };
  const L = buildLadder({ ...params, name: preset });
  const g = defineGame({
    id: 'stepper', betTypes: [preset], levels: () => levels,
    play({ bet, betType, rng }) { const r = L.start(rng.next(), { bet }); const v = r.view(); return { totalWinAmount: 0, roundEnded: false, nextAction: v.nextAction, state: r, ...pub(v, betType) }; },
    step({ round, actionCode }) { const r = round.state; const v = actionCode === 'CASH_OUT' ? r.cashOut() : r.continue_(); return { totalWinAmount: v.totalWinAmount, roundEnded: v.roundEnded, nextAction: v.nextAction, state: r, ...pub(v, round.betType) }; },
    sessionExtras: { preset, rtp: L.rtp, maxWin: L.maxWin, steps: L.steps, returns: L.returns, survival: L.survival, cum: L.cum },
  });
  g.engine = L; g.preset = preset; g.params = params; g.howToSettle = HOW_TO_SETTLE;
  return g;
}
