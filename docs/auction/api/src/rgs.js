// Storage Auction as an RGS provider that rolls locally (browser or Node). Multi-step, stepper shape:
// CONTINUE = bid, CASH_OUT = the hammer (reveals `locker`), CRASH = outbid.
//   const g = createGame({ preset: 'MEDIUM' });   g.bet({ sessionId, betAmount: 1000, betType: 'MEDIUM' })
import { defineGame } from '../../rgs-math/src/contract.js';
import { buildAuction } from './engine.js';

export const RTP = 0.95, LEVELS = [100, 200, 500, 1000, 2500, 5000, 10000];
export const PRESETS = {
  SMALL:  { maxWin: 5,   steps: 10, rtp: RTP },
  MEDIUM: { maxWin: 10,  steps: 10, rtp: RTP },
  LARGE:  { maxWin: 25,  steps: 10, rtp: RTP },
  XL:     { maxWin: 100, steps: 10, rtp: RTP },
};
export const DEFAULT_PRESET = 'SMALL';
export const HOW_TO_SETTLE = 'K = successful bids (from u and cum); v = residual of u in its interval; X = locker multiplier at v. CONTINUE on bid k is SAFE if k ≤ K else CRASH (win 0). CASH_OUT after s ≤ K bids pays round(round(stake × bids[s − 1]) × X)';

const pub = (v, size) => ({ size, currentStep: v.currentStep, currentPayout: v.currentPayout, steps: v.steps, locker: v.locker });

export function createGame({ preset = DEFAULT_PRESET, levels = LEVELS, ...overrides } = {}) {
  if (!PRESETS[preset]) throw new Error(`unknown preset "${preset}"; presets: ${Object.keys(PRESETS).join(', ')}`);
  const params = { ...PRESETS[preset], ...overrides };
  const A = buildAuction({ ...params, name: preset });
  const g = defineGame({
    id: 'auction', betTypes: [preset], levels: () => levels,
    play({ bet, betType, rng }) { const r = A.start(rng.next(), { bet }); const v = r.view(); return { totalWinAmount: 0, roundEnded: false, nextAction: v.nextAction, state: r, ...pub(v, betType) }; },
    step({ round, actionCode }) { const r = round.state; const v = actionCode === 'CASH_OUT' ? r.take() : r.bid(); return { totalWinAmount: v.totalWinAmount, roundEnded: v.roundEnded, nextAction: v.nextAction, state: r, ...pub(v, round.betType) }; },
    sessionExtras: { preset, rtp: A.rtp, maxWin: A.maxWin, steps: A.steps, bids: A.bids, survival: A.survival, cum: A.cum, locker: A.box.bands.map(b => ({ multiple: b.multiple, p: b.p, residual_from: b.from, residual_to: b.to, pays_from: b.range[0], pays_to: b.range[1] })), locker_r: A.box.r },
  });
  g.engine = A; g.preset = preset; g.params = params; g.howToSettle = HOW_TO_SETTLE;
  return g;
}
