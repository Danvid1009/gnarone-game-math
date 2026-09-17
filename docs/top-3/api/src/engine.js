// Race engine (Plackett–Luce, one recycled uniform).  See ALGORITHM.md.
//
//   const R = buildRace({ racers: [{ name, elo }, ...], rtp: 0.95 });           // place-terms payouts (default)
//   const R = buildRace({ racers, rtp, structure: { kind: 'place-terms', place: 1/4, show: 1/5 } });
//   const R = buildRace({ racers, rtp, structure: { kind: 'fixed-third', m3: 1.4, theta: 0.5 } });
//   const R = buildRace({ racers, rtp, structure: { kind: 'fractions', f: [0.6, 0.3, 0.1] } });
//   R.finish(u)          // u ~ U[0,1)  ->  { order: [r1..rn], top: [r1,r2,r3], zone, path }   whole ranking from ONE uniform
//   R.M[i]               // [M1, M2, M3] for backing racer i
//   R.settle(i, top, stake)
//
// Pipeline:  Elo array + one U  →  w_i = 10^((E_i − E_max)/400)  →  nested-interval selection, recycling
// U ← (U − a)/p_i after each pick  →  full Plackett–Luce ranking  →  pay 1st/2nd/3rd.
// q_i1, q_i2, q_i3 are closed-form; multipliers solve q_i1 M_i1 + q_i2 M_i2 + q_i3 M_i3 = RTP per racer.
//
// Place-terms structure (default, the each-way convention): every place returns the stake plus a profit,
// and the place profits are fixed fractions of the win profit:  M1 = 1 + P,  M2 = 1 + P·place,  M3 = 1 + P·show,
// P solved per racer. Then M1 > M2 > M3 > 1 automatically and feasibility is simply q_i1 + q_i2 + q_i3 < RTP.
// Alternatives kept: fixed-third (M3 fixed, θ) and fractions (one scale per racer, shared shape).

import { Rng } from './rng.js';

export const eloToStrength = (elo, eMax = 0) => Math.pow(10, (elo - eMax) / 400);

export function buildRace({ racers, rtp, structure = { kind: 'place-terms', place: 1 / 4, show: 1 / 5 }, places } = {}) {
  if (!Array.isArray(racers) || racers.length < 3) throw new Error('need at least three racers (three places pay)');
  if (!(rtp > 0 && rtp < 1)) throw new Error(`rtp must be in (0,1), got ${rtp}`);
  if (Array.isArray(places)) structure = { kind: 'fractions', f: places };
  const n = racers.length;
  const elos = racers.map((r, i) => { const e = Number(r.elo); if (!Number.isFinite(e)) throw new Error(`racer ${i}: elo required`); return e; });
  const eMax = Math.max(...elos);
  const R = racers.map((r, i) => ({ index: i, name: r.name ?? `#${i + 1}`, elo: elos[i], w: eloToStrength(elos[i], eMax) }));
  const w = R.map(r => r.w), W = w.reduce((s, x) => s + x, 0);

  // ── closed-form top-3 probabilities ─────────────────────────────────────────────────
  const q1 = w.map(wi => wi / W);
  const q2 = w.map((wi, i) => { let s = 0; for (let j = 0; j < n; j++) if (j !== i) s += (w[j] / W) * (wi / (W - w[j])); return s; });
  const q3 = w.map((wi, i) => { let s = 0; for (let j = 0; j < n; j++) if (j !== i) for (let k = 0; k < n; k++) if (k !== i && k !== j) s += (w[j] / W) * (w[k] / (W - w[j])) * (wi / (W - w[j] - w[k])); return s; });
  const q = R.map((_, i) => [q1[i], q2[i], q3[i]]);
  const top3 = q.map(x => x[0] + x[1] + x[2]);

  // ── multipliers per racer ───────────────────────────────────────────────────────────
  let M, feasibleBound = null;
  if (structure.kind === 'place-terms') {
    const a = structure.place ?? 1 / 4, b = structure.show ?? 1 / 5;
    if (!(a > 0 && a <= 1) || !(b > 0 && b <= 1) || !(b <= a)) throw new Error('place-terms: need 0 < show ≤ place ≤ 1');
    feasibleBound = rtp;
    const bad = R.filter((_, i) => top3[i] >= rtp);
    if (bad.length) throw new Error(`infeasible field: ${bad.map(r => `${r.name} (top-3 ${(100 * top3[r.index]).toFixed(2)}%)`).join(', ')} at or above RTP ${(100 * rtp).toFixed(2)}%; no positive win profit can return the RTP. Weaken the favourite.`);
    M = q.map(([q1_, q2_, q3_]) => { const P = (rtp - (q1_ + q2_ + q3_)) / (q1_ + a * q2_ + b * q3_); return [1 + P, 1 + a * P, 1 + b * P]; });
  } else if (structure.kind === 'win-only') {
    feasibleBound = 1;
    M = q.map(([q1_]) => [rtp / q1_, 0, 0]);
  } else if (structure.kind === 'fixed-third') {
    const m3 = structure.m3 ?? 1.4, th = structure.theta ?? 0.5;
    if (!(m3 > 0)) throw new Error('fixed-third: m3 must be > 0');
    if (!(th > 0 && th < 1)) throw new Error('fixed-third: theta must be in (0,1)');
    const bound = rtp / m3; feasibleBound = bound;
    const bad = R.filter((_, i) => top3[i] >= bound);
    if (bad.length) throw new Error(`infeasible field: ${bad.map(r => `${r.name} (top-3 ${(100 * top3[r.index]).toFixed(2)}%)`).join(', ')} at or above the bound RTP/M3 = ${(100 * bound).toFixed(2)}%; M1 would not exceed M3=${m3}. Weaken the favourite or lower m3.`);
    M = q.map(([a, b, c]) => { const x = (rtp - m3 * (c + (1 - th) * b)) / (a + th * b); return [x, m3 + th * (x - m3), m3]; });
  } else if (structure.kind === 'fractions') {
    const f = (structure.f ?? [1]).map(Number);
    if (f.length < 1 || f.length > 3 || Math.abs(f.reduce((s, x) => s + x, 0) - 1) > 1e-9 || f.some(x => x < 0) || !(f[0] > 0)) throw new Error('fractions: up to three non-negative fractions summing to 1 with f1 > 0');
    while (f.length < 3) f.push(0);
    M = q.map(([a, b, c]) => { const m = rtp / (f[0] * a + f[1] * b + f[2] * c); return [m * f[0], m * f[1], m * f[2]]; });
  } else throw new Error(`unknown structure kind "${structure.kind}"`);
  const ev = q.map((qi, i) => qi[0] * M[i][0] + qi[1] * M[i][1] + qi[2] * M[i][2]);

  // ── ranking from one uniform (nested intervals, U recycled) ─────────────────────────
  function finish(u) {
    if (!(u >= 0 && u < 1)) { if (u === 1) u = 1 - 1e-15; else throw new Error(`u must be in [0,1), got ${u}`); }
    const rem = R.map(r => r.index), order = [], path = [];
    while (rem.length > 1) {
      const tot = rem.reduce((s, i) => s + w[i], 0);
      let a = 0, pick = -1, pa = 0, pp = 0;
      for (const i of rem) { const p = w[i] / tot; if (u < a + p) { pick = i; pa = a; pp = p; break; } a += p; }
      if (pick < 0) { pick = rem[rem.length - 1]; pp = w[pick] / tot; pa = 1 - pp; }          // float edge at u → 1
      path.push({ pick, from: pa, to: pa + pp, u });
      u = Math.min(Math.max((u - pa) / pp, 0), 1 - 1e-15);
      order.push(pick); rem.splice(rem.indexOf(pick), 1);
    }
    order.push(rem[0]);
    return { order, top: order.slice(0, 3), names: order.map(i => R[i].name), path, zone: zoneIndex(order[0], order[1], order[2]) };
  }
  // zone = index of the ordered top-3 tuple in nested enumeration order (i, j, k by racer index) — the
  // partition of [0,1) the recursion induces; probability of a tuple is the product form.
  function zoneIndex(i, j, k) { let z = 0; for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) { if (b === a) continue; for (let c = 0; c < n; c++) { if (c === a || c === b) continue; if (a === i && b === j && c === k) return z; z++; } } return -1; }
  function zones() {
    const out = []; let acc = 0;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) { if (b === a) continue; for (let c = 0; c < n; c++) { if (c === a || c === b) continue; const p = (w[a] / W) * (w[b] / (W - w[a])) * (w[c] / (W - w[a] - w[b])); out.push({ zone: out.length, top: [a, b, c], names: [R[a].name, R[b].name, R[c].name], p, from: acc, to: acc + p }); acc += p; } }
    if (out.length) out[out.length - 1].to = 1;
    return out;
  }

  const race = {
    racers: R, n, W, rtp, structure, q, q1, q2, q3, top3, M, ev,
    feasibleBound,
    finish,
    zones,                                                     // n(n−1)(n−2) nested zones, in recursion order
    zonesByProbability() { return zones().sort((a, b) => b.p - a.p); },
    multiple(i, top) { const k = top.indexOf(i); return k < 0 || k > 2 ? 0 : M[i][k]; },
    settle(i, fin, stake) { const k = fin.top.indexOf(i); const m = k < 0 ? 0 : M[i][k]; return { racer: i, place: k < 0 ? null : k + 1, multiple: m, win: Math.round(stake * m) }; },
    rtpOf(i) { return ev[i]; },
    stdevOf(i) { const m2 = q[i].reduce((s, qk, k) => s + qk * M[i][k] ** 2, 0); return Math.sqrt(Math.max(m2 - ev[i] ** 2, 0)); },

    /** Seeded Monte Carlo: every racer backed with stake 1 in every race. */
    simulate({ rounds = 100000, seed = 'race' } = {}) {
      const rng = new Rng(seed, 'payout');
      const tot = new Array(n).fill(0), sq = new Array(n).fill(0), place = R.map(() => [0, 0, 0]);
      for (let r = 0; r < rounds; r++) {
        const fin = finish(rng.next());
        fin.top.forEach((i, k) => place[i][k]++);
        for (let i = 0; i < n; i++) { const m = race.multiple(i, fin.top); tot[i] += m; sq[i] += m * m; }
      }
      return R.map((_, i) => { const mean = tot[i] / rounds, sd = Math.sqrt(Math.max(sq[i] / rounds - mean * mean, 0)); return { racer: i, rounds, rtp: mean, stdev: sd, se: sd / Math.sqrt(rounds), placeFreq: place[i].map(c => c / rounds) }; });
    },

    /** RGS hook: betType = racer name. One uniform per race. */
    play({ bet, betType, rng }) {
      const i = R.findIndex(x => x.name === betType);
      if (i < 0) throw new Error(`unknown racer "${betType}"`);
      const u = rng.next(), fin = finish(u), s = race.settle(i, fin, bet);
      return { totalWinAmount: s.win, math: { u, order: fin.order, names: fin.names, zone: fin.zone, backed: i, place: s.place, multiple: s.multiple, M: M[i] } };
    },

    /** Dependency-free JS: whole ranking from one uniform. */
    standalone(name = 'raceOrder') {
      return [
        `// Plackett–Luce race from one uniform. Racers ${JSON.stringify(R.map(r => r.name))}, Elo ${JSON.stringify(elos)}.`,
        `// Returns the full finishing order (racer indices). Pay M[i][k] for racer i finishing k-th (k<3): M = ${JSON.stringify(M.map(m => m.map(x => +x.toFixed(4))))}. RTP ${rtp} for every racer.`,
        `function ${name}(u) {`,
        `  const w = ${JSON.stringify(w)};`,
        `  const rem = w.map((_, i) => i), order = [];`,
        `  if (u >= 1) u = 1 - 1e-15;`,
        `  while (rem.length > 1) {`,
        `    const tot = rem.reduce((s, i) => s + w[i], 0);`,
        `    let a = 0, pick = rem[rem.length - 1], pa = 1 - w[pick] / tot, pp = w[pick] / tot;`,
        `    for (const i of rem) { const p = w[i] / tot; if (u < a + p) { pick = i; pa = a; pp = p; break; } a += p; }`,
        `    u = Math.min(Math.max((u - pa) / pp, 0), 1 - 1e-15);          // recycle the uniform`,
        `    order.push(pick); rem.splice(rem.indexOf(pick), 1);`,
        `  }`,
        `  order.push(rem[0]); return order;`,
        `}`,
      ].join('\n');
    },
    toJSON() { return { rtp, structure, racers: R, q, top3, M, ev, feasibleBound: race.feasibleBound }; },
  };
  return race;
}

export function format(race) {
  const pct = x => `${(100 * x).toFixed(2)}%`;
  const s = race.structure;
  const desc = s.kind === 'win-only' ? `win-only: M1 = RTP / q1, places pay 0` : s.kind === 'place-terms' ? `place-terms: M1 = 1+P, M2 = 1+P·${s.place ?? 0.25}, M3 = 1+P·${s.show ?? 0.2}; feasible iff top-3 < ${pct(race.feasibleBound)}`
    : s.kind === 'fixed-third' ? `fixed-third: M3=${s.m3 ?? 1.4}, θ=${s.theta ?? 0.5}, feasible iff top-3 < ${pct(race.feasibleBound)}` : `fractions ${JSON.stringify(s.f)}`;
  const L = [`${race.n} racers   RTP ${race.rtp}   ${desc}`, '',
    'racer        elo   q1       q2       q3       top3        M1        M2      M3     EV      stdev'];
  race.racers.forEach((r, i) => L.push(`${r.name.padEnd(10)} ${String(r.elo).padStart(5)}  ${pct(race.q1[i]).padStart(7)}  ${pct(race.q2[i]).padStart(7)}  ${pct(race.q3[i]).padStart(7)}  ${pct(race.top3[i]).padStart(7)}  ${race.M[i].map(m => m.toFixed(3).padStart(8)).join('  ')}   ${race.ev[i].toFixed(4)}  ${race.stdevOf(i).toFixed(3)}`));
  const zs = race.zonesByProbability();
  L.push('', `top-3 zones: ${zs.length} nested intervals (one uniform, recycled). Most probable:`, 'top-3 finish                    P          RN [from, to)');
  for (const z of zs.slice(0, 8)) L.push(`${z.names.join(' › ').padEnd(30)} ${pct(z.p).padStart(8)}   [${z.from.toFixed(6)}, ${z.to.toFixed(6)})`);
  return L.join('\n');
}
