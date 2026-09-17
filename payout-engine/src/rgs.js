// Single Shot as an RGS provider that rolls locally (browser or Node). No server needed.
//
//   import { createGame } from '.../single-shot/api/rgs.js';
//   const g = createGame({ set: 'maxent' });                 // or { payouts, rtp, method, weights }
//   const s = g.open();                                      // session + chip levels
//   const r = g.bet({ sessionId: s.sessionId, betAmount: 1000 });   // fresh crypto seed; pass seed: 'fixture-007' to replay a fixture
//   g.collect({ roundId: r.roundId });
import { defineGame } from '../../rgs-math/src/contract.js';
import { buildPayout } from './engine.js';

export const PAYOUTS = [0, 0.5, 1, 2, 5, 20], RTP = 0.95;
export const SETS = { maxent: { method: 'maxent' }, geometric: { method: 'geometric' }, weights: { method: 'weights', weights: [0, 50, 30, 15, 4, 1] } };
export const LEVELS = [100, 200, 500, 1000, 2500, 5000, 10000];

export function createGame({ set = 'maxent', payouts = PAYOUTS, rtp = RTP, levels = LEVELS, ...cfg } = {}) {
  if (!SETS[set] && !cfg.method) throw new Error(`unknown set "${set}"; sets: ${Object.keys(SETS).join(', ')}`);
  const E = buildPayout({ payouts, rtp, ...(SETS[set] ?? {}), ...cfg });
  const g = defineGame({ id: 'single-shot', betTypes: ['BASE'], levels: () => levels, play: ({ bet, rng }) => E.play({ bet, rng }), sessionExtras: { set, rtp: E.rtp } });
  g.engine = E; g.set = set;
  return g;
}
