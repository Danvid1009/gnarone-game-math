// Distributions as an RGS provider (browser or Node): free sealed draws from the library, and a money mode.
//   const g = createGame({ preset: 'lognormal' });
//   g.draw({ sessionId, params: { dist: 'normal', mu: 10, sigma: 2 } })      // no money: { value, u, seedHash, seed }
//   g.draw({ sessionId, params: { dist: 'categorical', weights: [5, 3, 2] } }) // value 0..2, label OPTION_i
//   g.bet({ sessionId, betAmount: 1000, betType: 'BASE' })                    // pays round(stake × multiple), E[multiple] = rtp
import { defineGame } from '../../rgs-math/src/contract.js';
import { buildShot, drawFrom, describeLibrary, DIST_NAMES } from './engine.js';

export const RTP = 0.95, LEVELS = [100, 200, 500, 1000, 2500, 5000, 10000];
export const PRESETS = {
  lognormal:        { dist: 'lognormal',   params: { mu: 0, sigma: 0.8 }, max: 50, rtp: RTP },
  exponential:      { dist: 'exponential', params: { rate: 1 },          max: 20, rtp: RTP },
  uniform:          { dist: 'uniform',     params: { a: 0, b: 1 },                 rtp: RTP },
  'normal-clipped': { dist: 'normal',      params: { mu: 1, sigma: 0.5 }, min: 0, max: 3, rtp: RTP },
  pareto:           { dist: 'pareto',      params: { xm: 0.5, alpha: 2.5 }, max: 100, rtp: RTP },
  poisson:          { dist: 'poisson',     params: { lambda: 1 },                  rtp: RTP },
};
export const DEFAULT_PRESET = 'lognormal';
export const HOW_TO_SETTLE = 'multiple = scale × clamp(quantile(u), min, max); win = round(stake × multiple). scale = rtp / E[clamp(X)], so E[multiple] = rtp exactly. draw(): value = quantile(u) of the requested distribution, no money.';

export function createGame({ preset = DEFAULT_PRESET, levels = LEVELS, ...overrides } = {}) {
  if (!PRESETS[preset]) throw new Error(`unknown preset "${preset}"; presets: ${Object.keys(PRESETS).join(', ')}`);
  const params = { ...PRESETS[preset], ...overrides };
  const S = buildShot({ ...params, name: preset });
  const g = defineGame({
    id: 'distributions', betTypes: ['BASE'], levels: () => levels,
    play: ({ bet, rng }) => S.play({ bet, rng }),
    draw: ({ params: p, rng }) => drawFrom({ ...p, rng }),
    sessionExtras: { preset, rtp: S.rtp, money: S.toJSON(), library: describeLibrary(), dists: DIST_NAMES },
  });
  g.engine = S; g.preset = preset; g.params = params; g.howToSettle = HOW_TO_SETTLE;
  return g;
}
