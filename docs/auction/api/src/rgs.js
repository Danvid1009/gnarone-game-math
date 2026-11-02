// Locker Wars as an RGS provider that rolls locally (browser or Node). Single-call raises:
//   const g = createGame({ preset: 'storage' });
//   let r = g.bet({ sessionId, betAmount: 1000, betType: 'BID_1' });   // OUTBID → the bid back in totalWinAmount, r.next says the next bid (the auctioneer's increment is drawn per raise); WON → r.locker, r.next null
//   g.collect({ roundId: r.roundId });
//   r = g.bet({ sessionId, betAmount: r.next.bid, betType: r.next.betType });   // the raise
import { defineGame } from '../../rgs-math/src/contract.js';
import { buildLockerWars } from './engine.js';

export const RTP = 0.95, LEVELS = [100, 200, 500, 1000, 2500, 5000, 10000];
export const PRESETS = {
  street:  { outbid: [0.5, 0.35, 0.2, 0],                 steps: [[1], [1, 2], [1, 2]],                           locker: { payouts: [0, 0.5, 0.8, 1.2, 1.5, 2, 3, 5], method: 'weights', weights: [0, 30, 24, 16, 11, 8, 4, 1.8] },  refund: 1, rtp: RTP },
  storage: { outbid: [0.6, 0.5, 0.4, 0.3, 0.2, 0],        steps: [[1], [1, 2], [1, 2], [2, 3], [2, 4]],           locker: { payouts: [0, 0.5, 0.8, 1.2, 1.5, 2, 3, 5, 7], method: 'weights', weights: [0, 30, 24, 16, 11, 8, 4, 1.5, 0.6] },  refund: 1, rtp: RTP },
  vault:   { outbid: [0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0],   steps: [[1], [1, 2], [2, 3], [2, 3, 5], [3, 5], [4, 6, 8]], locker: { payouts: [0, 0.5, 0.8, 1.2, 1.5, 2, 3, 5, 7, 10], method: 'weights', weights: [0, 30, 24, 16, 11, 8, 4, 1.5, 0.6, 0.3] }, refund: 1, rtp: RTP },
};
export const DEFAULT_PRESET = 'storage';
export const HOW_TO_SETTLE = 'each raise is its own single-call bet. Raise k (betType BID_k, amount = opening chip × a multiple the stage can reach; every amount factors into exactly one chip × multiple, which recovers the opener): u < outbid[k−1] → OUTBID, win = round(bet × refund) (refund 1: the bid comes back in full) and next names the following raise, whose increment is drawn from the derived stream SHA-256(seed|ladder|0) uniformly over steps[k−1] (in opener units): next.bid = round(opener × (multiple + step)); else v = (u − outbid[k−1]) / (1 − outbid[k−1]) and the locker pays the sloped band of v: win = round(bet × (payout + r·(2t − 1))), 0 in the empty band, with next = null since the auction is over. With edge "hammer" (default) every won locker has mean R × the hammer price and walks or outbids return exactly the stake, so the house takes 1 − R of what is bought and nothing else; raise k returns outbid + (1 − outbid) × R per unit staked. Edge "per-raise" instead solves the locker mean as (R − outbid) ÷ (1 − outbid) so every raise returns exactly R. The last stage has outbid 0: the rivals are gone and the locker always opens.';

export function createGame({ preset = DEFAULT_PRESET, levels = LEVELS, ...overrides } = {}) {
  if (!PRESETS[preset]) throw new Error(`unknown preset "${preset}"; presets: ${Object.keys(PRESETS).join(', ')}`);
  const params = { ...PRESETS[preset], ...overrides };
  const A = buildLockerWars({ ...params, name: preset });
  const lv = t => [...new Set(A.reach[A.stageOf(t) - 1].flatMap(m => levels.map(c => Math.round(c * m))))].sort((a, b) => a - b);
  const g = defineGame({ id: 'auction', betTypes: A.betTypes, levels: lv, play: ({ bet, betType, rng }) => A.play({ bet, betType, rng, chips: levels }),
    sessionExtras: { preset, rtp: A.rtp, edge: A.edge, refund: A.refund, steps: A.steps, reach: A.reach, alwaysRaise: A.policy(), stages: A.stages.map(s => ({ stage: s.stage, betType: `BID_${s.stage}`, multiples: s.multiples, increments: s.increments, expectedMultiple: s.g, outbid: s.outbid, refund: s.refund, lockerMean: s.lockerMean, locker: s.box.bands.map(b => ({ multiple: b.payout, p: b.p, residual_from: b.from, residual_to: b.to, pays_from: b.range[0], pays_to: b.range[1] })), locker_r: s.box.r })) } });
  g.engine = A; g.preset = preset; g.params = params; g.howToSettle = HOW_TO_SETTLE;
  return g;
}
