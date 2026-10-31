// Locker Wars as an RGS provider that rolls locally (browser or Node). Single-call raises:
//   const g = createGame({ preset: 'storage' });
//   let r = g.bet({ sessionId, betAmount: 1000, betType: 'BID_1' });   // OUTBID → the bid back in totalWinAmount, r.next says the next bid; WON → r.locker
//   g.collect({ roundId: r.roundId });
//   r = g.bet({ sessionId, betAmount: r.next.bid, betType: r.next.betType });   // the raise
import { defineGame } from '../../rgs-math/src/contract.js';
import { buildLockerWars } from './engine.js';

export const RTP = 0.95, LEVELS = [100, 200, 500, 1000, 2500, 5000, 10000];
export const PRESETS = {
  street:  { outbid: [0.5, 0.35, 0.2, 0],                 growth: 1.5, locker: { payouts: [0, 0.5, 1, 2, 5] },        refund: 1, rtp: RTP },
  storage: { outbid: [0.6, 0.5, 0.4, 0.3, 0.2, 0],        growth: 1.5, locker: { payouts: [0, 0.5, 1, 2, 5, 20] },    refund: 1, rtp: RTP },
  vault:   { outbid: [0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0],   growth: 1.6, locker: { payouts: [0, 1, 2, 5, 20, 100] },    refund: 1, rtp: RTP },
};
export const DEFAULT_PRESET = 'storage';
export const HOW_TO_SETTLE = 'raise k (betType BID_k, amount = opening level × growth^(k−1), rounded): u < outbid[k−1] → OUTBID, win = round(bet × refund) (refund 1: the bid comes back); else v = (u − outbid[k−1]) / (1 − outbid[k−1]) and the locker pays the sloped band of v: win = round(bet × (payout + r·(2t − 1))), 0 in the empty band. The last stage has outbid 0: the rivals are gone and the locker always opens.';

export function createGame({ preset = DEFAULT_PRESET, levels = LEVELS, ...overrides } = {}) {
  if (!PRESETS[preset]) throw new Error(`unknown preset "${preset}"; presets: ${Object.keys(PRESETS).join(', ')}`);
  const params = { ...PRESETS[preset], ...overrides };
  const A = buildLockerWars({ ...params, name: preset });
  const lv = t => levels.map(c => Math.round(c * A.bidMultiple(A.stageOf(t))));
  const g = defineGame({ id: 'auction', betTypes: A.betTypes, levels: lv, play: ({ bet, betType, rng }) => A.play({ bet, betType, rng }),
    sessionExtras: { preset, rtp: A.rtp, refund: A.refund, growth: A.growth, stages: A.stages.map(s => ({ stage: s.stage, betType: `BID_${s.stage}`, bidMultiple: s.g, outbid: s.outbid, refund: s.refund, lockerMean: s.lockerMean, locker: s.box.bands.map(b => ({ multiple: b.payout, p: b.p, residual_from: b.from, residual_to: b.to, pays_from: b.range[0], pays_to: b.range[1] })), locker_r: s.box.r })) } });
  g.engine = A; g.preset = preset; g.params = params; g.howToSettle = HOW_TO_SETTLE;
  return g;
}
