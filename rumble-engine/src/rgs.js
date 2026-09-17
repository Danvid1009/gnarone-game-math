// Rip & Rumble as an RGS provider that rolls locally (browser or Node).
//   const g = createGame();  g.bet({ sessionId, betAmount: 500, betType: 'BASE' })   // 1 credit = 100 minor units
import { defineGame } from '../../rgs-math/src/contract.js';
import { buildRumble } from './engine.js';

export const CREDIT = 100;   // minor units per credit; a BASE pack costs 5 credits
export function createGame({ credit = CREDIT, multiples = [1, 2, 5, 10], ...cfg } = {}) {
  const R = buildRumble(cfg);
  const types = Object.keys(R.betTypes);
  const levels = t => multiples.map(k => k * R.betTypes[t].cost * R.betTypes[t].paidPacks * credit);
  const g = defineGame({ id: 'rip-rumble', betTypes: types, boostedBetType: 'BOOSTED', levels, play: ({ bet, betType, rng }) => R.play({ bet, betType, rng }),
    sessionExtras: { rtp: R.config.rtp, credit, betTypes: Object.fromEntries(types.map(t => [t, { cost: R.betTypes[t].cost, packs: R.betTypes[t].packs, paidPacks: R.betTypes[t].paidPacks, pLow: R.betTypes[t].pLow }])) } });
  g.engine = R;
  return g;
}
