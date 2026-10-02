// Single Shot as an RGS provider that rolls locally (browser or Node).
//   const g = createGame({ preset: 'classic' });   g.bet({ sessionId, betAmount: 1000, betType: 'BASE' })
import { defineGame } from '../../rgs-math/src/contract.js';
import { buildPayout } from './engine.js';

export const RTP = 0.95, LEVELS = [100, 200, 500, 1000, 2500, 5000, 10000];
export const PRESETS = {
  classic:       { payouts: [0, 0.5, 1, 2, 5, 20],    method: 'geometric', rtp: RTP },
  steady:        { payouts: [0, 0.5, 1, 1.5, 2, 3],   method: 'geometric', rtp: RTP },
  spiky:         { payouts: [0, 1, 2, 5, 20, 100],    method: 'geometric', rtp: RTP },
  'always-pays': { payouts: [0.2, 0.5, 1, 2, 5],      method: 'geometric', rtp: RTP },
};
export const DEFAULT_PRESET = 'classic';
export const HOW_TO_SETTLE = 'find the band with rn_from ≤ u < rn_to; if payout is 0 the win is 0; else t = (u − rn_from)/(rn_to − rn_from), multiple = payout + r·(2t − 1), win = round(stake × multiple)';

export function createGame({ preset = DEFAULT_PRESET, levels = LEVELS, ...overrides } = {}) {
  if (!PRESETS[preset]) throw new Error(`unknown preset "${preset}"; presets: ${Object.keys(PRESETS).join(', ')}`);
  const params = { ...PRESETS[preset], ...overrides };
  const E = buildPayout(params);
  const g = defineGame({ id: 'single-shot', betTypes: ['BASE'], levels: () => levels, play: ({ bet, rng }) => E.play({ bet, rng }),
    sessionExtras: { preset, rtp: E.rtp, r: E.r, bands: E.bands.map(b => ({ payout: b.payout, p: b.p, rn_from: b.from, rn_to: b.to, pays_from: b.range[0], pays_to: b.range[1] })) } });
  g.engine = E; g.preset = preset; g.params = params; g.howToSettle = HOW_TO_SETTLE;
  return g;
}
