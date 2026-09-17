// Top 3 / Top 1 as an RGS provider that rolls locally (browser or Node).
//   const g = createGame({ mode: 'top3' });    // or 'top1'; racers: [{name, elo}] to change the field
//   g.bet({ sessionId, betAmount: 1000, betType: 'Flint' })
import { defineGame } from '../../rgs-math/src/contract.js';
import { buildRace } from './engine.js';

export const RTP = 0.95;
export const FIELD = [['Ace', 1850], ['Bolt', 1780], ['Cinder', 1720], ['Dash', 1680], ['Ember', 1640], ['Flint', 1600], ['Gale', 1560], ['Hex', 1520], ['Iris', 1480], ['Jolt', 1430], ['Kite', 1380], ['Lux', 1300]].map(([name, elo]) => ({ name, elo }));
export const LEVELS = [100, 200, 500, 1000, 2500, 5000, 10000];

export function createGame({ mode = 'top3', racers = FIELD, rtp = RTP, levels = LEVELS, structure } = {}) {
  if (!['top3', 'top1'].includes(mode)) throw new Error(`mode must be top3 or top1, got "${mode}"`);
  const R = buildRace({ racers, rtp, structure: structure ?? (mode === 'top1' ? { kind: 'win-only' } : undefined) });
  const g = defineGame({ id: mode === 'top1' ? 'top-1' : 'top-3', betTypes: R.racers.map(r => r.name), levels: () => levels, play: ({ bet, betType, rng }) => R.play({ bet, betType, rng }),
    sessionExtras: { mode, rtp, racers: R.racers.map((r, i) => ({ name: r.name, elo: r.elo, q: [R.q1[i], R.q2[i], R.q3[i]], multipliers: R.M[i] })) } });
  g.engine = R; g.mode = mode;
  return g;
}
