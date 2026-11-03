// Live Fight as an RGS provider that rolls locally (browser or Node). Multi-step with linked (live) bets.
//   const g = createGame({ preset: 'favourite' });
//   let r = g.bet({ sessionId, betAmount: 1000, betType: 'A' });            // opening bet at RTP ÷ P(A wins); nextAction ['CONTINUE']
//   r = g.nextAction({ roundId: r.roundId, actionCode: 'CONTINUE' });        // reveals one tick: who landed, damage, healths, pA
//   g.quote({ roundId: r.roundId });                                          // fair live prices { odds: { A, B }, pA, tick, hp }
//   const live = g.linkedBet({ sessionId, roundId: r.roundId, betAmount: 500, betType: 'B' });   // new money, settles when the fight ends
//   ... CONTINUE until roundEnded ...; g.collect({ roundId: r.roundId }); g.collect({ roundId: live.roundId });
import { defineGame } from '../../rgs-math/src/contract.js';
import { buildFight } from './engine.js';

export const RTP = 0.95, LEVELS = [100, 200, 500, 1000, 2500, 5000, 10000];
export const PRESETS = {
  // a fighter is { power, hp } in attribute points; elo = power + hp sets who wins, the split sets how
  even:          { A: { power: 800, hp: 800 },  B: { power: 800, hp: 800 },  rtp: RTP },                              // 1600 v 1600: 50/50
  favourite:     { A: { power: 850, hp: 850 },  B: { power: 775, hp: 775 },  rtp: RTP },                              // 1700 v 1550: 70.3% by the Elo formula
  'glass-cannon': { A: { power: 1000, hp: 600 }, B: { power: 600, hp: 1000 }, rtp: RTP },                             // 1600 v 1600: still 50/50, but 20-damage punches against a 125-health tank
  slugfest:      { A: { power: 800, hp: 800 },  B: { power: 800, hp: 800 },  ticks: 10, baseDamage: 24, rtp: RTP },   // even, short and heavy
};
export const DEFAULT_PRESET = 'even';
export const HOW_TO_SETTLE = 'a fighter is { power, hp } in attribute points and its Elo is the sum; P(A wins at the bell) = 1 / (1 + 10^((eloB − eloA) / 400)) exactly. Health = 100 × hp / 800, mean damage = 16 × power / 800, and the chance that a tick\'s hit is A\'s (pLand) is solved on the exact grid so the fight\'s V_0 equals that Elo probability (session.calibration). Opening bet: win = round(stake × odds[betType]) if betType === winner else 0, odds = RTP / P(side wins at the bell). Live (linked) bet placed after t ticks: win = round(stake × 1 / P(side wins | state after t ticks)) if the side wins, else 0. Each tick: u < pLand.A → A lands and u / pLand.A picks the damage cell from damage.A.cum; else B lands and (u − pLand.A) / (1 − pLand.A) picks from damage.B.cum. Health only falls; 0 is a KO. If both stand after the last tick one more uniform decides against P = hpA / (hpA + hpB).';

const pub = v => ({ tick: v.tick, ticksMax: v.ticksMax, hp: v.hp, pA: v.pA, odds: v.odds, last: v.last, winner: v.winner, how: v.how, decision: v.decision });

export function createGame({ preset = DEFAULT_PRESET, levels = LEVELS, ...overrides } = {}) {
  if (!PRESETS[preset]) throw new Error(`unknown preset "${preset}"; presets: ${Object.keys(PRESETS).join(', ')}`);
  const params = { ...PRESETS[preset], ...overrides };
  const F = buildFight({ ...params, name: preset });
  const g = defineGame({
    id: 'fight', betTypes: ['A', 'B'], levels: () => levels,
    play({ bet, betType, rng }) { const r = F.start(rng, { bet, betType }); const v = r.view(); return { totalWinAmount: 0, roundEnded: false, nextAction: v.nextAction, state: r, ...pub(v) }; },
    step({ round }) { const r = round.state; const v = r.continue_(); return { totalWinAmount: v.totalWinAmount, roundEnded: v.roundEnded, nextAction: v.nextAction, state: r, ...pub(v) }; },
    linked: {
      price({ round }) { const v = round.state.view(); return { odds: { A: 1 / v.pA, B: 1 / (1 - v.pA) }, pA: v.pA, tick: v.tick, hp: v.hp }; },
      settle({ round, child }) { const v = round.state.view(); return v.winner === child.betType ? Math.round(child.totalBetAmount * child.odds) : 0; },
    },
    sessionExtras: { preset, rtp: F.rtp, fighters: F.fighters, elo: F.elo, hp: F.hp, calibration: F.calibration, ticks: F.ticks, res: F.res, pLand: F.pLand, damage: { A: { damage: F.damage.A.damage, p: F.damage.A.p, cum: F.damage.A.cum, mean: F.damage.A.mean }, B: { damage: F.damage.B.damage, p: F.damage.B.p, cum: F.damage.B.cum, mean: F.damage.B.mean } }, pA0: F.pA0, openingOdds: F.odds, endRule: F.endRule },
  });
  g.engine = F; g.preset = preset; g.params = params; g.howToSettle = HOW_TO_SETTLE; g.hasCashOut = false;
  return g;
}
