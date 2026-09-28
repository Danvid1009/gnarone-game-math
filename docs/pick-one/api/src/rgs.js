// Pick One as an RGS provider that rolls locally (browser or Node).
//   const g = createGame({ preset: 'five' });   g.bet({ sessionId, betAmount: 1000, betType: 'OPTION_3' })
import { defineGame } from '../../rgs-math/src/contract.js';
import { buildPick } from './engine.js';

export const RTP = 0.95, LEVELS = [100, 200, 500, 1000, 2500, 5000, 10000];
export const PRESETS = {
  coin:     { n: 2, rtp: RTP },
  three:    { n: 3, rtp: RTP },
  five:     { n: 5, rtp: RTP },
  weighted: { weights: [5, 3, 2], labels: ['RED', 'GREEN', 'BLUE'], rtp: RTP },
};
export const DEFAULT_PRESET = 'coin';
export const HOW_TO_SETTLE = 'the winner is the option whose [rn_from, rn_to) contains u; win = round(stake × odds[backed]) if backed === winner, else 0';

export function createGame({ preset = DEFAULT_PRESET, levels = LEVELS, ...overrides } = {}) {
  if (!PRESETS[preset]) throw new Error(`unknown preset "${preset}"; presets: ${Object.keys(PRESETS).join(', ')}`);
  const params = { ...PRESETS[preset], ...overrides };
  const P = buildPick(params);
  const g = defineGame({ id: 'pick-one', betTypes: P.names, levels: () => levels, play: ({ bet, betType, rng }) => P.play({ bet, betType, rng }),
    sessionExtras: { preset, rtp: P.rtp, options: P.options.map(o => ({ name: o.name, p: o.p, odds: o.odds, rn_from: o.from, rn_to: o.to })) } });
  g.engine = P; g.preset = preset; g.params = params; g.howToSettle = HOW_TO_SETTLE;
  return g;
}
