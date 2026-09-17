// Stepper as an RGS provider that rolls locally (browser or Node). Multi-step:
//   const g = createGame();                                              // EASY 10× · MEDIUM 25× · HARD 100×, RTP 0.97
//   const r = g.bet({ sessionId, betAmount: 1000, betType: 'MEDIUM' });  // nextAction ['CONTINUE']
//   g.nextAction({ roundId: r.roundId, actionCode: 'CONTINUE' });        // → ['CONTINUE','CASH_OUT'] or crash
//   g.nextAction({ roundId: r.roundId, actionCode: 'CASH_OUT' });        // → ['COLLECT']
//   g.collect({ roundId: r.roundId });
import { defineGame } from '../../rgs-math/src/contract.js';
import { buildLadder } from './engine.js';

export const RTP = 0.97, STEPS = 10;
export const DIFFICULTIES = { EASY: 10, MEDIUM: 25, HARD: 100 };
export const LEVELS = [100, 200, 500, 1000, 2500, 5000, 10000];

const pub = (v, difficulty) => ({ difficulty, currentStep: v.currentStep, currentPayout: v.currentPayout, steps: v.steps });

export function createGame({ rtp = RTP, steps = STEPS, difficulties = DIFFICULTIES, levels = LEVELS } = {}) {
  const ladders = Object.fromEntries(Object.entries(difficulties).map(([d, M]) => [d, buildLadder({ rtp, maxWin: M, steps, name: d })]));
  const g = defineGame({
    id: 'stepper', betTypes: Object.keys(ladders), levels: () => levels,
    play({ bet, betType, rng }) { const r = ladders[betType].start(rng.next(), { bet }); const v = r.view(); return { totalWinAmount: 0, roundEnded: false, nextAction: v.nextAction, state: r, ...pub(v, betType) }; },
    step({ round, actionCode }) { const r = round.state; const v = actionCode === 'CASH_OUT' ? r.cashOut() : r.continue_(); return { totalWinAmount: v.totalWinAmount, roundEnded: v.roundEnded, nextAction: v.nextAction, state: r, ...pub(v, round.betType) }; },
    sessionExtras: { rtp, ladders: Object.fromEntries(Object.entries(ladders).map(([d, L]) => [d, { maxWin: L.maxWin, returns: L.returns, survival: L.survival }])) },
  });
  g.engine = ladders;
  return g;
}
