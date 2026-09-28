// Rip & Rumble as an RGS provider that rolls locally (browser or Node).
//   const g = createGame({ preset: 'sheet-v4' });   g.bet({ sessionId, betAmount: 500, betType: 'BASE' })   // 1 credit = 100 minor units
import { defineGame } from '../../rgs-math/src/contract.js';
import { buildRumble } from './engine.js';

export const CREDIT = 100;
export const PRESETS = {
  'sheet-v4':      { rtp: 0.95 },
  'sheet-v4-0.93': { rtp: 0.93 },
  'sheet-v4-0.97': { rtp: 0.97 },
};
export const DEFAULT_PRESET = 'sheet-v4';
export const HOW_TO_SETTLE = 'per pack: for each rarity win += count × valuePerCard × multiplier(count); totalWinAmount = sum over packs. valuePerCard = round(pay[rarity] × bet / (cost × paidPacks))';

export function createGame({ preset = DEFAULT_PRESET, credit = CREDIT, multiples = [1, 2, 5, 10], ...overrides } = {}) {
  if (!PRESETS[preset]) throw new Error(`unknown preset "${preset}"; presets: ${Object.keys(PRESETS).join(', ')}`);
  const params = { ...PRESETS[preset], ...overrides };
  const R = buildRumble(params);
  const types = Object.keys(R.betTypes);
  const levels = t => multiples.map(k => k * R.betTypes[t].cost * R.betTypes[t].paidPacks * credit);
  const g = defineGame({ id: 'rip-rumble', betTypes: types, boostedBetType: 'BOOSTED', levels, play: ({ bet, betType, rng }) => R.play({ bet, betType, rng }),
    sessionExtras: { preset, rtp: R.config.rtp, credit, betTypes: Object.fromEntries(types.map(t => [t, { cost: R.betTypes[t].cost, packs: R.betTypes[t].packs, paidPacks: R.betTypes[t].paidPacks, pLow: R.betTypes[t].pLow }])) } });
  g.engine = R; g.preset = preset; g.params = { ...params, credit }; g.howToSettle = HOW_TO_SETTLE;
  return g;
}
