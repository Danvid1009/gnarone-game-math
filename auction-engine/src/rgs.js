// Storage Auction as an RGS provider that rolls locally (browser or Node). Multi-step, stepper shape:
//   const g = createGame();                                              // SMALL 5× · MEDIUM 10× · LARGE 25× · XL 100×, RTP 0.95
//   const r = g.bet({ sessionId, betAmount: 1000, betType: 'MEDIUM' });  // nextAction ['CONTINUE'] (= BID)
//   g.nextAction({ roundId: r.roundId, actionCode: 'CONTINUE' });        // → ['CONTINUE','CASH_OUT'] or outbid
//   g.nextAction({ roundId: r.roundId, actionCode: 'CASH_OUT' });        // the hammer: reveals `locker`, → ['COLLECT']
import { defineGame } from '../../rgs-math/src/contract.js';
import { buildAuction } from './engine.js';

export const RTP = 0.95, STEPS = 10;
export const SIZES = { SMALL: 5, MEDIUM: 10, LARGE: 25, XL: 100 };
export const LEVELS = [100, 200, 500, 1000, 2500, 5000, 10000];

const pub = (v, size) => ({ size, currentStep: v.currentStep, currentPayout: v.currentPayout, steps: v.steps, locker: v.locker });

export function createGame({ rtp = RTP, steps = STEPS, sizes = SIZES, levels = LEVELS, box } = {}) {
  const lots = Object.fromEntries(Object.entries(sizes).map(([s, M]) => [s, buildAuction({ rtp, maxWin: M, steps, name: s, box })]));
  const g = defineGame({
    id: 'auction', betTypes: Object.keys(lots), levels: () => levels,
    play({ bet, betType, rng }) { const r = lots[betType].start(rng.next(), { bet }); const v = r.view(); return { totalWinAmount: 0, roundEnded: false, nextAction: v.nextAction, state: r, ...pub(v, betType) }; },
    step({ round, actionCode }) { const r = round.state; const v = actionCode === 'CASH_OUT' ? r.take() : r.bid(); return { totalWinAmount: v.totalWinAmount, roundEnded: v.roundEnded, nextAction: v.nextAction, state: r, ...pub(v, round.betType) }; },
    sessionExtras: { rtp, lots: Object.fromEntries(Object.entries(lots).map(([s, A]) => [s, { maxWin: A.maxWin, bids: A.bids, survival: A.survival, locker: A.box.bands.map(b => ({ multiple: b.multiple, p: b.p })) }])) },
  });
  g.engine = lots;
  return g;
}
