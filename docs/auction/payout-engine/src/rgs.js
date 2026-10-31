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
  // Sasha's Ragency / Bin Boost claw table (Oct 2026): explicit probabilities, 3 shots per round, zero only if all miss.
  // Σ p·a = 0.989972 (his sim: 0.988–0.991); r = 0.1 × min gap 0.2 = 0.02, so the top band reaches exactly 50.00×.
  ragency: { payouts: [0, 0.25, 0.5, 0.8, 1, 1.2, 1.5, 2, 5, 10, 25, 49.98], probabilities: [0.0622, 0.05, 0.12, 0.2356, 0.25, 0.17, 0.07, 0.03, 0.008, 0.003, 0.0008, 0.0004],
             prizes: ['No grab', 'Old bones', 'Scaly imp', 'Scaly imp', 'Ember beast', 'Credit ingots', 'Dragon hatchling', 'Dragon hatchling', 'Blood gems', 'Blood gems', 'Relic hoard', 'Golden dragon'] },
};
export const DEFAULT_PRESET = 'classic';
export const HOW_TO_SETTLE = 'find the band with rn_from ≤ u < rn_to; if payout is 0 the win is 0; else t = (u − rn_from)/(rn_to − rn_from), multiple = payout + r·(2t − 1), win = round(stake × multiple)';

export function createGame({ preset = DEFAULT_PRESET, levels = LEVELS, ...overrides } = {}) {
  if (!PRESETS[preset]) throw new Error(`unknown preset "${preset}"; presets: ${Object.keys(PRESETS).join(', ')}`);
  const params = { ...PRESETS[preset], ...overrides };
  const { prizes, ...engineParams } = params;
  const E = buildPayout(engineParams);
  const g = defineGame({ id: 'single-shot', betTypes: ['BASE'], levels: () => levels, play: ({ bet, rng }) => E.play({ bet, rng }),
    sessionExtras: { preset, rtp: E.rtp, method: E.method, r: E.r, bands: E.bands.map((b, i) => ({ payout: b.payout, p: b.p, rn_from: b.from, rn_to: b.to, pays_from: b.range[0], pays_to: b.range[1], ...(prizes ? { prize: prizes[E.payouts.indexOf(b.payout)] } : {}) })) } });
  g.engine = E; g.preset = preset; g.params = params; g.howToSettle = HOW_TO_SETTLE;
  return g;
}
