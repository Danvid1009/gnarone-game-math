// Pick One as an RGS provider that rolls locally (browser or Node).
//   const g = createGame({ set: 'five' });     // coin | five | weighted, or { n } / { weights, labels }
//   g.bet({ sessionId, betAmount: 1000, betType: 'OPTION_3' })
import { defineGame } from '../../rgs-math/src/contract.js';
import { buildPick } from './engine.js';

export const RTP = 0.95;
export const SETS = { coin: { n: 2 }, five: { n: 5 }, weighted: { weights: [5, 3, 2], labels: ['RED', 'GREEN', 'BLUE'] } };
export const LEVELS = [100, 200, 500, 1000, 2500, 5000, 10000];

export function createGame({ set = 'coin', rtp = RTP, levels = LEVELS, ...cfg } = {}) {
  const c = Object.keys(cfg).length ? cfg : SETS[set];
  if (!c) throw new Error(`unknown set "${set}"; sets: ${Object.keys(SETS).join(', ')}`);
  const P = buildPick({ ...c, rtp });
  const g = defineGame({ id: 'pick-one', betTypes: P.names, levels: () => levels, play: ({ bet, betType, rng }) => P.play({ bet, betType, rng }), sessionExtras: { set, rtp, options: P.options.map(o => ({ name: o.name, p: o.p, odds: o.odds })) } });
  g.engine = P; g.set = set;
  return g;
}
