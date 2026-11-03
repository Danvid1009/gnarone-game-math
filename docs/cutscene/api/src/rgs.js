// Cutscene Fight as an RGS provider that rolls locally (browser or Node). Single-call main bet + a side-bet library.
//   const g = createGame({ preset: 'favourite' });
//   const r = g.bet({ sessionId, betAmount: 1000, betType: 'A' });      // winner by biased coin, cutscene script in r.cutscene, nextAction ['COLLECT']
//   g.sideBet({ sessionId, betAmount: 500, params: { kind: 'coin', p: 0.5, pick: 'OPTION_1' } })          // any time, any number of times
//   g.sideBet({ sessionId, betAmount: 500, params: { kind: 'pick', weights: [5, 3, 2], pick: 'OPTION_3' } })
//   g.sideBet({ sessionId, betAmount: 500, params: { kind: 'single-shot', payouts: [0, 0.5, 1, 2, 5, 20] } })
import { defineGame } from '../../rgs-math/src/contract.js';
import { buildCutscene, buildSideBet, SIDE_KINDS } from './engine.js';
import { Rng } from './rng.js';

export const RTP = 0.95, LEVELS = [100, 200, 500, 1000, 2500, 5000, 10000];
export const PRESETS = {
  // a fighter is { power, hp } in attribute points; elo = power + hp sets who wins, the split sets how the cutscene looks
  even:          { A: { power: 800, hp: 800 },  B: { power: 800, hp: 800 },  rtp: RTP },     // 1600 v 1600: 50/50
  favourite:     { A: { power: 850, hp: 850 },  B: { power: 775, hp: 775 },  rtp: RTP },     // 1700 v 1550: 70.3%
  'glass-cannon': { A: { power: 1000, hp: 600 }, B: { power: 600, hp: 1000 }, rtp: RTP },    // 1600 v 1600: 50/50, puncher against tank
};
export const DEFAULT_PRESET = 'even';
export const SIDE_LIBRARY = {
  coin:          { kind: 'coin', p: 0.5, rtp: RTP },
  'biased-coin': { kind: 'coin', p: 0.7, rtp: RTP },
  'pick-3':      { kind: 'pick', n: 3, rtp: RTP },
  'pick-weighted': { kind: 'pick', weights: [5, 3, 2], rtp: RTP },
  'shot-classic': { kind: 'single-shot', payouts: [0, 0.5, 1, 2, 5, 20], rtp: RTP },
};
export const HOW_TO_SETTLE = 'main bet: pA = 1 / (1 + 10^((eloB − eloA) / 400)) with elo = power + hp (attribute points); u < pA → A wins; win = round(stake × odds[betType]) if betType === winner else 0, odds = RTP / P(side). The cutscene is cosmetic. Side bets: coin / pick pay round(stake × RTP / p[pick]) on a hit; single-shot pays round(stake × multiple) from the sloped-band table.';

export function createGame({ preset = DEFAULT_PRESET, levels = LEVELS, ...overrides } = {}) {
  if (!PRESETS[preset]) throw new Error(`unknown preset "${preset}"; presets: ${Object.keys(PRESETS).join(', ')}`);
  const params = { ...PRESETS[preset], ...overrides };
  const C = buildCutscene({ ...params, name: preset }); C._rng = { Rng };
  const g = defineGame({
    id: 'cutscene', betTypes: ['A', 'B'], levels: () => levels,
    play: ({ bet, betType, rng }) => C.play({ bet, betType, rng }),
    side: ({ bet, params: p, rng }) => C.sideBet({ bet, params: typeof p === 'string' ? SIDE_LIBRARY[p] : p, rng }),
    sessionExtras: { preset, rtp: C.rtp, fighters: C.fighters, elo: C.elo, hp: C.hp, calibration: C.fight.calibration, pA: C.pA, odds: C.odds, sideLibrary: Object.fromEntries(Object.entries(SIDE_LIBRARY).map(([k, p]) => { const S = buildSideBet(p); return [k, { ...p, options: S.options, odds: S.odds ?? null, payouts: S.payouts ?? null }]; })), sideKinds: SIDE_KINDS },
  });
  g.engine = C; g.preset = preset; g.params = params; g.howToSettle = HOW_TO_SETTLE; g.sideLibrary = SIDE_LIBRARY;
  return g;
}
