// Top 3 / Top 1 as an RGS provider that rolls locally (browser or Node).
//   const g = createGame({ preset: 'field-12', mode: 'top3' });   g.bet({ sessionId, betAmount: 1000, betType: 'RACER_6' })
import { defineGame } from '../../rgs-math/src/contract.js';
import { buildRace } from './engine.js';

export const RTP = 0.95, LEVELS = [100, 200, 500, 1000, 2500, 5000, 10000];
// racers are placeholders RACER_1..n in Elo order; the client reskins them (names, colours, silks)
const field = elos => elos.map((elo, i) => ({ name: `RACER_${i + 1}`, elo }));
const even = (n, top, bottom) => Array.from({ length: n }, (_, i) => Math.round(top - (top - bottom) * i / (n - 1)));
export const PRESETS = {
  'field-12':       { racers: field([1850, 1780, 1720, 1680, 1640, 1600, 1560, 1520, 1480, 1430, 1380, 1300]), rtp: RTP },
  'field-8':        { racers: field(even(8, 1800, 1380)), rtp: RTP },
  'field-6':        { racers: field(even(6, 1750, 1400)), rtp: RTP },
  'field-12-tight': { racers: field(even(12, 1650, 1452)), rtp: RTP },
};
export const DEFAULT_PRESET = 'field-12';
export const HOW_TO_SETTLE = { top3: 'win = round(stake × multipliers[place − 1]) for the backed racer if it finishes 1st, 2nd or 3rd in `order`, else 0', top1: 'win = round(stake × multipliers[0]) if the backed racer is order[0], else 0' };

export function createGame({ preset = DEFAULT_PRESET, mode = 'top3', levels = LEVELS, ...overrides } = {}) {
  if (!PRESETS[preset]) throw new Error(`unknown preset "${preset}"; presets: ${Object.keys(PRESETS).join(', ')}`);
  if (!['top3', 'top1'].includes(mode)) throw new Error(`mode must be top3 or top1, got "${mode}"`);
  const params = { ...PRESETS[preset], ...overrides };
  const R = buildRace({ ...params, structure: params.structure ?? (mode === 'top1' ? { kind: 'win-only' } : undefined) });
  const g = defineGame({ id: mode === 'top1' ? 'top-1' : 'top-3', betTypes: R.racers.map(r => r.name), levels: () => levels, play: ({ bet, betType, rng }) => R.play({ bet, betType, rng }),
    sessionExtras: { preset, mode, rtp: params.rtp, racers: R.racers.map((r, i) => ({ name: r.name, elo: r.elo, q: [R.q1[i], R.q2[i], R.q3[i]], multipliers: R.M[i] })) } });
  g.engine = R; g.preset = preset; g.mode = mode; g.params = { ...params, mode }; g.howToSettle = HOW_TO_SETTLE[mode];
  return g;
}
