// Roster: a set of named fighters, each { power, hp } in attribute points. Any two pair into a priced fight.
//
//   import { ROSTER, matchupMatrix, rosterTable } from './roster.js';
//   createGame({ A: 'cannon', B: 'tank' })      // any pairing by name (fight-engine and cutscene-engine)
//   matchupMatrix()                             // P(row beats column) for every pair, straight from the Elo formula
//   rosterTable()                               // elo, split, health and mean damage per fighter
//
// Names are placeholders describing the shape (the client reskins them). The price between any two is the
// Elo formula on power + hp, exact; the split only shapes the fight. Keep hp at or above ~400 points so a
// fight lasts more than one landed hit (see ALGORITHM.md §11).

import { eloProbability, fighter } from './engine.js';

export const ROSTER = {
  rookie:    { power: 700,  hp: 700 },    // 1400
  brawler:   { power: 800,  hp: 800 },    // 1600, the reference fighter: 100 health, hits for 16
  cannon:    { power: 1000, hp: 600 },    // 1600, puncher
  tank:      { power: 600,  hp: 1000 },   // 1600, absorber
  contender: { power: 850,  hp: 850 },    // 1700
  slugger:   { power: 1100, hp: 600 },    // 1700, puncher
  wall:      { power: 600,  hp: 1100 },   // 1700, absorber
  champion:  { power: 950,  hp: 950 },    // 1900
};

/** A roster name → { name, power, hp }; anything else passes through (a { power, hp } or { elo, split } spec). */
export function resolveFighter(spec, k = 'X', roster = ROSTER) {
  if (typeof spec !== 'string') return spec;
  const f = roster[spec]; if (!f) throw new Error(`unknown fighter "${spec}" for ${k}; roster: ${Object.keys(roster).join(', ')}`);
  return { name: spec, ...f };
}

/** One row per fighter: attribute points, Elo, split, and the health / mean damage the defaults give. */
export function rosterTable({ roster = ROSTER, baseHp = 100, baseDamage = 16, ref = 800 } = {}) {
  return Object.entries(roster).map(([name, f]) => { const n = fighter(f, name); return { name, power: n.power, hp: n.hp, elo: n.elo, split: n.split, health: baseHp * n.hp / ref, damage: baseDamage * n.power / ref }; });
}

/** P(row beats column) for every pair, from the Elo formula alone (exact, no grid needed). */
export function matchupMatrix({ roster = ROSTER, scale = 400 } = {}) {
  const names = Object.keys(roster), elo = names.map(n => fighter(roster[n], n).elo);
  return { names, elo, pA: elo.map(a => elo.map(b => eloProbability(a, b, scale))) };
}

export const matchupName = (A, B) => `${A}-v-${B}`;
