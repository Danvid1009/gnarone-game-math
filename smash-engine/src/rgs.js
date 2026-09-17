// Game of Three (Rock n Smash) as an RGS provider that rolls locally (browser or Node).
//   const g = createGame();  g.bet({ sessionId, betAmount: 1000, betType: 'BOOSTED' })
import { defineGame } from '../../rgs-math/src/contract.js';
import { buildSmash } from './engine.js';

export const LEVELS = [100, 200, 500, 1000, 2500, 5000, 10000];
export function createGame({ levels = LEVELS, ...cfg } = {}) {
  const S = buildSmash(cfg);
  const modes = Object.keys(S.modes);
  const g = defineGame({ id: 'game-of-three', betTypes: modes, boostedBetType: 'BOOSTED', levels: () => levels, play: ({ bet, betType, rng }) => S.play({ bet, betType, rng }),
    sessionExtras: { modes: Object.fromEntries(modes.map(m => [m, { rtp: S.modes[m].rtp, hitRate: S.modes[m].hitRate }])) } });
  g.engine = S;
  return g;
}
