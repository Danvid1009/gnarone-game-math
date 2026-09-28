// Game of Three (Rock n Smash) as an RGS provider that rolls locally (browser or Node).
//   const g = createGame({ preset: 'sheet' });   g.bet({ sessionId, betAmount: 1000, betType: 'BOOSTED' })
import { defineGame } from '../../rgs-math/src/contract.js';
import { buildSmash } from './engine.js';

export const LEVELS = [100, 200, 500, 1000, 2500, 5000, 10000];
export const PRESETS = {
  sheet:      {},                 // exact workbook: BASE 97.07%, BOOSTED 97.15%
  'rtp-0.95': { rtp: 0.95 },      // wins scaled so both modes return 95%
};
export const DEFAULT_PRESET = 'sheet';
export const HOW_TO_SETTLE = 'the zone whose [rn_from, rn_to) contains u gives count, gem and multiple; win = round(stake × multiple)';

export function createGame({ preset = DEFAULT_PRESET, levels = LEVELS, ...overrides } = {}) {
  if (!PRESETS[preset]) throw new Error(`unknown preset "${preset}"; presets: ${Object.keys(PRESETS).join(', ')}`);
  const params = { ...PRESETS[preset], ...overrides };
  const S = buildSmash(params);
  const modes = Object.keys(S.modes);
  const g = defineGame({ id: 'game-of-three', betTypes: modes, boostedBetType: 'BOOSTED', levels: () => levels, play: ({ bet, betType, rng }) => S.play({ bet, betType, rng }),
    sessionExtras: { preset, modes: Object.fromEntries(modes.map(m => [m, { rtp: S.modes[m].rtp, hitRate: S.modes[m].hitRate, zones: S.modes[m].zones.map(z => ({ count: z.count, gem: z.gem, multiple: z.multiple, p: z.p, rn_from: z.from, rn_to: z.to })) }])) } });
  g.engine = S; g.preset = preset; g.params = params; g.howToSettle = HOW_TO_SETTLE;
  return g;
}
