// Live Fight as an RGS provider that rolls locally (browser or Node). Multi-step with linked (live) bets.
//   const g = createGame({ preset: 'favourite' });                        // or any roster pairing: createGame({ A: 'cannon', B: 'tank' })
//   let r = g.bet({ sessionId, betAmount: 1000, betType: 'A' });            // opening bet at RTP ÷ P(A wins); nextAction ['CONTINUE']
//   r = g.nextAction({ roundId: r.roundId, actionCode: 'CONTINUE' });        // reveals one tick: who landed, damage, healths, pA
//   g.quote({ roundId: r.roundId });                                          // fair live prices { odds: { A, B }, pA, tick, hp, cap: { maxBet, placed, remaining } }
//   const live = g.linkedBet({ sessionId, roundId: r.roundId, betAmount: 500, betType: 'B' });   // new money, settles when the fight ends; per tick at most 3× the opening stake
//   ... CONTINUE until roundEnded ...; g.collect({ roundId: r.roundId }); g.collect({ roundId: live.roundId });
import { defineGame } from '../../rgs-math/src/contract.js';
import { buildFight, fighter } from './engine.js';
import { ROSTER, resolveFighter, matchupMatrix, rosterTable, matchupName } from './roster.js';
export { ROSTER, matchupMatrix, rosterTable, matchupName };

export const RTP = 0.95, LEVELS = [100, 200, 500, 1000, 2500, 5000, 10000];
export const PRESETS = {
  // a fighter is { power, hp } in attribute points; elo = power + hp sets who wins, the split sets how
  even:          { A: { power: 800, hp: 800 },  B: { power: 800, hp: 800 },  rtp: RTP },                              // 1600 v 1600: 50/50
  favourite:     { A: { power: 850, hp: 850 },  B: { power: 775, hp: 775 },  rtp: RTP },                              // 1700 v 1550: 70.3% by the Elo formula
  'glass-cannon': { A: { power: 1000, hp: 600 }, B: { power: 600, hp: 1000 }, rtp: RTP },                             // 1600 v 1600: still 50/50, but 20-damage punches against a 125-health tank
  slugfest:      { A: { power: 800, hp: 800 },  B: { power: 800, hp: 800 },  ticks: 10, baseDamage: 24, rtp: RTP },   // even, short and heavy
};
export const DEFAULT_PRESET = 'even';
export const HOW_TO_SETTLE = 'a fighter is { power, hp } in attribute points and its Elo is the sum; P(A wins at the bell) = 1 / (1 + 10^((eloB − eloA) / 400)) exactly. Health = 100 × hp / 800, mean damage = 16 × power / 800, and the chance that a tick\'s hit is A\'s (pLand) is solved on the exact grid so the fight\'s V_0 equals that Elo probability (session.calibration). Opening bet: win = round(stake × odds[betType]) if betType === winner else 0, odds = RTP / P(side wins at the bell). Live (linked) bet placed after t ticks: win = round(stake × 1 / P(side wins | state after t ticks)) if the side wins, else 0; the live stakes placed at any one tick may total at most liveCap × the opening stake (default 3×), enforced by linkedBet and reported by quote().cap. Each tick: u < pLand.A → A lands and u / pLand.A picks the damage cell from damage.A.cum; else B lands and (u − pLand.A) / (1 − pLand.A) picks from damage.B.cum. Health only falls; 0 is a KO. If both stand after the last tick one more uniform decides against P = hpA / (hpA + hpB).';

const pub = v => ({ tick: v.tick, ticksMax: v.ticksMax, hp: v.hp, pA: v.pA, odds: v.odds, last: v.last, winner: v.winner, how: v.how, decision: v.decision });

export const LIVE_CAP = 3;   // live bets at any one tick may total at most 3× the opening stake

/** The matchup label: the preset name, or A-v-B from roster names (a custom spec shows as power/hp). */
const sideLabel = x => x.name ?? (f => `${f.power}/${f.hp}`)(fighter(x));   // a roster name, else power/hp

export function createGame({ preset, A, B, levels = LEVELS, liveCap = LIVE_CAP, ...overrides } = {}) {
  if (preset !== undefined && !PRESETS[preset]) throw new Error(`unknown preset "${preset}"; presets: ${Object.keys(PRESETS).join(', ')}`);
  const base = PRESETS[preset ?? DEFAULT_PRESET];
  const params = { ...base, ...overrides, ...(A !== undefined ? { A: resolveFighter(A, 'A') } : {}), ...(B !== undefined ? { B: resolveFighter(B, 'B') } : {}) };
  const label = A === undefined && B === undefined ? (preset ?? DEFAULT_PRESET) : matchupName(sideLabel(params.A), sideLabel(params.B));
  const F = buildFight({ ...params, name: label });
  const g = defineGame({
    id: 'fight', betTypes: ['A', 'B'], levels: () => levels,
    play({ bet, betType, rng }) { const r = F.start(rng, { bet, betType }); const v = r.view(); return { totalWinAmount: 0, roundEnded: false, nextAction: v.nextAction, state: r, ...pub(v) }; },
    step({ round }) { const r = round.state; const v = r.continue_(); return { totalWinAmount: v.totalWinAmount, roundEnded: v.roundEnded, nextAction: v.nextAction, state: r, ...pub(v) }; },
    linked: {
      price({ round }) { const v = round.state.view(); return { odds: { A: 1 / v.pA, B: 1 / (1 - v.pA) }, pA: v.pA, tick: v.tick, hp: v.hp }; },
      settle({ round, child }) { const v = round.state.view(); return v.winner === child.betType ? Math.round(child.totalBetAmount * child.odds) : 0; },
      maxMultiple: liveCap,   // live money per tick is capped at liveCap × the opening stake (quote() reports the room left)
    },
    sessionExtras: { preset: label, roster: Object.keys(ROSTER), rtp: F.rtp, liveCap, fighters: F.fighters, elo: F.elo, hp: F.hp, calibration: F.calibration, ticks: F.ticks, res: F.res, pLand: F.pLand, damage: { A: { damage: F.damage.A.damage, p: F.damage.A.p, cum: F.damage.A.cum, mean: F.damage.A.mean }, B: { damage: F.damage.B.damage, p: F.damage.B.p, cum: F.damage.B.cum, mean: F.damage.B.mean } }, pA0: F.pA0, openingOdds: F.odds, endRule: F.endRule },
  });
  g.engine = F; g.preset = label; g.params = params; g.howToSettle = HOW_TO_SETTLE; g.hasCashOut = false;
  return g;
}
