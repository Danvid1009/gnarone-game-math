// Game of Three (GO3) engine. See ALGORITHM.md. Reproduces `Rock n Smash.xlsx`.
//
// One draw picks how many of three rocks are crushed (0..3) and, on 2 or 3, whether a gem bonus fires and
// which gem multiplier it carries. Payout = win(count) × gem multiplier. RTP is the exact sum over the
// zones. Mode BASE / BOOSTED are separate tables; boosted stakes are 2× base chips and the sheet's wins are
// in base-chip units, so the boosted multiple of stake is win / 2.
import { Rng } from './rng.js';

export const DEFAULT = {
  gems: [{ mult: 10, weight: 1 }, { mult: 8, weight: 1 }, { mult: 5, weight: 2 }, { mult: 4, weight: 3 }, { mult: 3, weight: 4 }, { mult: 2, weight: 7 }],
  altAnimationProb: 0.3,                                   // cosmetic, on count >= 2
  modes: {
    BASE:    { stakeDivisor: 1, rows: [{ count: 3, p: 0.08, gemP: 0.05,  win: 5 }, { count: 2, p: 0.28, gemP: 0.05,  win: 1 }, { count: 1, p: 0.40, gemP: 0, win: 0.5 }, { count: 0, p: null, gemP: 0, win: 0 }] },
    BOOSTED: { stakeDivisor: 2, rows: [{ count: 3, p: 0.23, gemP: 0.075, win: 5 }, { count: 2, p: 0.34, gemP: 0.075, win: 1 }, { count: 1, p: 0.31, gemP: 0, win: 0.5 }, { count: 0, p: null, gemP: 0, win: 0 }] },
  },
};

export function buildSmash(cfg = {}) {
  const C = { ...DEFAULT, ...cfg, modes: { ...DEFAULT.modes, ...(cfg.modes ?? {}) } };
  const W = C.gems.reduce((s, g) => s + g.weight, 0);
  const gemTable = C.gems.map(g => ({ ...g, p: g.weight / W }));
  const gemMean = gemTable.reduce((s, g) => s + g.p * g.mult, 0);
  const modes = {};
  for (const [name, m] of Object.entries(C.modes)) {
    const rows = m.rows.map(r => ({ ...r }));
    const fixed = rows.filter(r => r.p !== null).reduce((s, r) => s + r.p, 0);
    for (const r of rows) if (r.p === null) r.p = 1 - fixed;                 // the sheet's "=1-SUM" row
    if (rows.some(r => r.p < -1e-12) || Math.abs(rows.reduce((s, r) => s + r.p, 0) - 1) > 1e-9) throw new Error(`${name}: rock probabilities must sum to 1`);
    // optional: scale the win column so the mode hits cfg.rtp exactly
    let scale = 1;
    const evRaw = rows.reduce((s, r) => s + r.p * r.win * (r.gemP * gemMean + (1 - r.gemP)), 0) / m.stakeDivisor;
    if (cfg.rtp) scale = cfg.rtp / evRaw;
    const zones = [];
    for (const r of rows) {
      const base = r.win * scale / m.stakeDivisor;
      if (r.gemP > 0) for (const g of gemTable) zones.push({ count: r.count, gem: g.mult, p: r.p * r.gemP * g.p, multiple: base * g.mult });
      zones.push({ count: r.count, gem: null, p: r.p * (1 - r.gemP), multiple: base });
    }
    zones.sort((a, b) => b.multiple - a.multiple);
    let acc = 0; for (const z of zones) { z.from = acc; acc += z.p; z.to = acc; } zones[zones.length - 1].to = 1;
    const ev = zones.reduce((s, z) => s + z.p * z.multiple, 0), m2 = zones.reduce((s, z) => s + z.p * z.multiple ** 2, 0);
    modes[name] = { name, stakeDivisor: m.stakeDivisor, rows, scale, zones, rtp: ev, stdev: Math.sqrt(m2 - ev * ev), hitRate: zones.filter(z => z.multiple > 0).reduce((s, z) => s + z.p, 0),
      returnByCount: Object.fromEntries(rows.map(r => [r.count, r.p * r.win * scale * (r.gemP * gemMean + (1 - r.gemP)) / m.stakeDivisor])), maxMultiple: zones[0].multiple };
  }
  function outcome(u, mode = 'BASE') {
    const Z = modes[mode].zones; if (u >= 1) u = 1 - 1e-15; let z = 0; while (z < Z.length - 1 && Z[z].to <= u) z++;
    return { zone: z, ...Z[z], u };
  }
  function play({ bet, betType = 'BASE', rng }) {
    const m = modes[betType]; if (!m) throw new Error(`unknown betType ${betType}`);
    const u = rng.next(), o = outcome(u, betType);
    const alt = o.count >= 2 && (rng.derive ? rng.derive('anim') : rng).next() < C.altAnimationProb;
    return { totalWinAmount: Math.round(bet * o.multiple), count: o.count, hasBonus: o.gem !== null, multiplier: o.multiple, math: { u, zone: o.zone, gem: o.gem, altAnimation: alt, baseWin: m.rows.find(r => r.count === o.count).win * m.scale } };
  }
  function simulate({ betType = 'BASE', rounds = 200000, seed = 'smash', bet = 100 } = {}) {
    const rng = new Rng(seed, 'payout'); let tot = 0, sq = 0; const counts = [0, 0, 0, 0]; let bonus = 0;
    for (let i = 0; i < rounds; i++) { const r = play({ bet, betType, rng }); const x = r.totalWinAmount / bet; tot += x; sq += x * x; counts[r.count]++; if (r.hasBonus) bonus++; }
    const mean = tot / rounds, sd = Math.sqrt(Math.max(sq / rounds - mean * mean, 0));
    return { betType, rounds, rtp: mean, stdev: sd, se: sd / Math.sqrt(rounds), countFreq: counts.map(c => c / rounds), bonusRate: bonus / rounds };
  }
  return { config: C, gemTable, gemMean, modes, outcome, play, simulate, toJSON() { return { gemTable, gemMean, modes }; } };
}

export function format(S) {
  const pct = x => `${(100 * x).toFixed(3)}%`, L = [`gem multipliers: ${S.gemTable.map(g => `${g.mult}× (${pct(g.p)})`).join('  ')}  mean ${S.gemMean.toFixed(4)}`];
  for (const m of Object.values(S.modes)) {
    L.push('', `${m.name}  stake divisor ${m.stakeDivisor}${m.scale !== 1 ? `  win scale ${m.scale.toFixed(6)}` : ''}  RTP ${m.rtp.toFixed(6)}  hit rate ${pct(m.hitRate)}  stdev ${m.stdev.toFixed(3)}×  max ${m.maxMultiple.toFixed(2)}×`);
    L.push('  rocks  P(rocks)   P(gem|rocks)   win(base chips)   return');
    for (const r of m.rows) L.push(`  ${r.count}      ${pct(r.p).padStart(8)}   ${pct(r.gemP).padStart(8)}       ${(r.win * m.scale).toFixed(3).padStart(6)}          ${m.returnByCount[r.count].toFixed(5)}`);
    L.push(`  zones (${m.zones.length}): ` + m.zones.slice(0, 6).map(z => `${z.count}${z.gem ? '+gem' + z.gem : ''}→${z.multiple.toFixed(2)}× ${pct(z.p)}`).join(' | '));
  }
  return L.join('\n');
}
