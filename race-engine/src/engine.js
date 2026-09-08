// Race engine (Plackett–Luce).  See ALGORITHM.md.
//
//   const R = buildRace({ racers: [{ name: 'A', elo: 1600 }, ...], rtp: 0.95, places: [0.6, 0.3, 0.1] });
//   R.zones            outcome zones on [0,1): every ordered top-K finish, its probability, its RN band
//   R.outcome(u)       u ~ U[0,1) -> { top: [i, j, k], zone }        (the payout-relevant part of the finish)
//   R.finish(u, rng)   full finishing order: top-K from u, the rest sampled cosmetically
//   R.odds[i]          multiplier m_i for backing racer i; pays m_i · f_k if racer i finishes k-th
//   R.settle(i, top, stake)
//
// Strength w_i = 10^(elo_i / 400) (Elo's own scale: P(i beats j) = w_i / (w_i + w_j)).
// Plackett–Luce: P(i first) = w_i / Σw; then the next place is drawn from the remaining racers
// by the same rule. Every ordered top-K tuple therefore has a closed-form probability and the
// tuples partition [0,1) exactly. Odds are set so Σ_k f_k · P(i finishes k) · m_i = RTP for
// every racer i: no racer is a better bet than another, and the return is exact by summation.

import { Rng } from './rng.js';

export const eloToStrength = elo => Math.pow(10, elo / 400);

export function buildRace({ racers, rtp, places = [1], maxEnumerate = 5000, bandFraction = 0 } = {}) {
  if (!Array.isArray(racers) || racers.length < 2) throw new Error('need at least two racers');
  if (!(rtp > 0 && rtp < 1)) throw new Error(`rtp must be in (0,1), got ${rtp}`);
  if (!Array.isArray(places) || places.length < 1) throw new Error('places must be a non-empty array of purse fractions');
  const f = places.map(Number);
  if (f.some(x => !(x >= 0)) || !(f[0] > 0)) throw new Error('place fractions must be ≥ 0 with a positive first place');
  const fsum = f.reduce((s, x) => s + x, 0);
  if (Math.abs(fsum - 1) > 1e-9) throw new Error(`place fractions sum to ${fsum}, not 1`);
  const K = f.length;
  const n = racers.length;
  if (K > n) throw new Error(`cannot pay ${K} places with ${n} racers`);

  const R = racers.map((r, i) => {
    const elo = r.elo !== undefined ? Number(r.elo) : undefined;
    const w = r.strength !== undefined ? Number(r.strength) : eloToStrength(elo);
    if (!(w > 0) || !Number.isFinite(w)) throw new Error(`racer ${i}: strength must be positive (give elo or strength)`);
    return { index: i, name: r.name ?? `#${i + 1}`, elo: elo ?? Math.round(400 * Math.log10(w)), w };
  });
  const W = R.reduce((s, r) => s + r.w, 0);

  // ── enumerate ordered top-K tuples with their Plackett–Luce probabilities ─────────────
  const tuples = [];
  (function rec(prefix, remainingW, prob) {
    if (prefix.length === K) { tuples.push({ top: prefix.slice(), p: prob }); return; }
    for (let i = 0; i < n; i++) {
      if (prefix.includes(i)) continue;
      rec([...prefix, i], remainingW - R[i].w, prob * R[i].w / remainingW);
    }
  })([], W, 1);
  if (tuples.length > maxEnumerate) throw new Error(`${tuples.length} ordered top-${K} outcomes exceeds maxEnumerate=${maxEnumerate}; fewer racers or places`);
  tuples.sort((a, b) => b.p - a.p);                 // decreasing probability, ties keep enumeration order
  let acc = 0;
  const zones = tuples.map((t, z) => { const from = acc; acc += t.p; return { zone: z, top: t.top, names: t.top.map(i => R[i].name), p: t.p, from, to: acc }; });
  zones[zones.length - 1].to = 1;
  const psum = tuples.reduce((s, t) => s + t.p, 0);
  if (Math.abs(psum - 1) > 1e-9) throw new Error(`internal: zone probabilities sum to ${psum}`);

  // ── exact place probabilities P(i finishes k-th), k = 1..K ─────────────────────────
  const placeP = R.map(() => new Array(K).fill(0));
  for (const t of tuples) t.top.forEach((i, k) => { placeP[i][k] += t.p; });
  // ── RTP-exact odds per racer ─────────────────────────────────────────────────────────
  const odds = R.map((_, i) => { const e = f.reduce((s, fk, k) => s + fk * placeP[i][k], 0); return rtp / e; });
  const winP = R.map((_, i) => placeP[i][0]);

  // optional fixed neighbourhood on the paid multiple (same rule as payout-engine): off by default
  const distinct = [...new Set(odds.map(m => +m.toFixed(9)))].sort((a, b) => a - b);
  const gap = distinct.length > 1 ? Math.min(...distinct.slice(1).map((m, i) => m - distinct[i])) : 0;
  const r = bandFraction > 0 && gap > 0 ? bandFraction * gap : 0;

  const zoneOf = u => { if (u >= 1) u = 1 - 1e-12; let lo = 0, hi = zones.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (zones[m].to <= u) lo = m + 1; else hi = m; } return lo; };

  const race = {
    racers: R, n, W, rtp, places: f, K, zones, tuples: zones.length, placeP, winP, odds, r, gap,

    /** The payout-relevant outcome for one uniform draw. */
    outcome(u) { const z = zoneOf(u); const Z = zones[z]; return { zone: z, top: Z.top, names: Z.names, p: Z.p, u, t: (u - Z.from) / (Z.to - Z.from) }; },

    /** Full finishing order: top-K fixed by u, remaining places drawn Plackett–Luce from `rng` (cosmetic). */
    finish(u, rng) {
      const o = race.outcome(u);
      const order = [...o.top];
      let rem = R.map(r => r.index).filter(i => !order.includes(i));
      while (rem.length) {
        const tot = rem.reduce((s, i) => s + R[i].w, 0);
        let x = (rng ? rng.next() : Math.random()) * tot, pick = rem[rem.length - 1];
        for (const i of rem) { x -= R[i].w; if (x < 0) { pick = i; break; } }
        order.push(pick); rem = rem.filter(i => i !== pick);
      }
      return { ...o, order, names: order.map(i => R[i].name) };
    },

    /** Multiple of the stake paid when backing racer i and the top-K is `top`. */
    multiple(i, top, t = 0.5) {
      const k = top.indexOf(i);
      if (k < 0 || k >= K || f[k] === 0) return 0;
      const m = odds[i] * (r > 0 ? 1 + (r / odds[i]) * (2 * t - 1) : 1);   // band on the odds, mean-preserving
      return m * f[k];
    },
    settle(i, outcome, stake) { const mult = race.multiple(i, outcome.top, outcome.t); return { racer: i, place: outcome.top.indexOf(i) + 1 || null, multiple: mult, win: Math.round(stake * mult) }; },

    /** Exact RTP of backing racer i (equals rtp for every i, up to float). */
    rtpOf(i) { return f.reduce((s, fk, k) => s + fk * placeP[i][k], 0) * odds[i]; },
    /** Exact variance / stdev of the paid multiple when backing racer i (band ignored). */
    stdevOf(i) { const m2 = f.reduce((s, fk, k) => s + placeP[i][k] * (odds[i] * fk) ** 2, 0); return Math.sqrt(Math.max(m2 - rtp * rtp, 0)); },

    /** Seeded Monte Carlo backing racer i. */
    simulate({ racer = 0, rounds = 100000, seed = 'race', stake = 1 } = {}) {
      const rng = new Rng(seed, 'payout');
      let tot = 0, sq = 0; const placeCount = new Array(K + 1).fill(0); const zoneCount = new Array(zones.length).fill(0);
      for (let k = 0; k < rounds; k++) {
        const o = race.outcome(rng.next()); zoneCount[o.zone]++;
        const pl = o.top.indexOf(racer); placeCount[pl < 0 ? K : pl]++;
        const w = race.multiple(racer, o.top, o.t); tot += w; sq += w * w;
      }
      const mean = tot / rounds, sd = Math.sqrt(Math.max(sq / rounds - mean * mean, 0));
      return { racer, rounds, seed, rtp: mean, stdev: sd, se: sd / Math.sqrt(rounds), placeFreq: placeCount.map(c => c / rounds), zoneFreq: zoneCount.map(c => c / rounds) };
    },

    /** RGS hook: betType = racer name, stake in minor units. */
    play({ bet, betType, rng }) {
      const i = R.findIndex(x => x.name === betType);
      if (i < 0) throw new Error(`unknown racer "${betType}"`);
      const u = rng.next();
      const fin = race.finish(u, rng.derive ? rng.derive('order') : rng);
      const s = race.settle(i, fin, bet);
      return { totalWinAmount: s.win, math: { u, zone: fin.zone, order: fin.order, names: fin.names, backed: i, place: s.place, multiple: s.multiple, odds: odds[i] } };
    },

    standalone(name = 'raceOutcome') {
      return [
        `// Plackett–Luce race, ${n} racers, top-${K} zones sorted by probability. RTP ${rtp} for every racer.`,
        `// u: one uniform in [0,1). Returns { top: [racer indices], zone }. Odds per racer: ${JSON.stringify(odds.map(x => +x.toFixed(6)))}; place fractions ${JSON.stringify(f)}.`,
        `function ${name}(u) {`,
        `  const to = ${JSON.stringify(zones.map(z => z.to))};`,
        `  const top = ${JSON.stringify(zones.map(z => z.top))};`,
        `  if (u >= 1) u = 1 - 1e-12;`,
        `  let lo = 0, hi = to.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (to[m] <= u) lo = m + 1; else hi = m; }`,
        `  return { top: top[lo], zone: lo };`,
        `}`,
      ].join('\n');
    },
    toJSON() { return { rtp, places: f, racers: R, odds, winP, placeP, zones, r }; },
  };
  return race;
}

export function format(race) {
  const pct = x => `${(100 * x).toFixed(3)}%`;
  const L = [`${race.n} racers   RTP ${race.rtp}   places ${JSON.stringify(race.places)}   ${race.tuples} outcome zones` + (race.r ? `   band r=${race.r.toFixed(4)}` : ''), '', 'racer        elo   strength    P(win)      ' + race.places.map((_, k) => `P(${k + 1})`.padStart(9)).join('') + '     odds m   rtp     stdev'];
  race.racers.forEach((r, i) => L.push(`${r.name.padEnd(10)} ${String(r.elo).padStart(5)}  ${r.w.toFixed(3).padStart(9)}  ${pct(race.winP[i]).padStart(9)}  ` + race.placeP[i].map(p => pct(p).padStart(9)).join('') + `  ${race.odds[i].toFixed(4).padStart(9)}   ${race.rtpOf(i).toFixed(4)}  ${race.stdevOf(i).toFixed(3)}`));
  L.push('', `zones (decreasing probability, first ${Math.min(12, race.zones.length)}):`, 'zone  top-K finish                  P            RN [from, to)');
  for (const z of race.zones.slice(0, 12)) L.push(`${String(z.zone).padStart(4)}  ${z.names.join(' › ').padEnd(28)} ${pct(z.p).padStart(10)}   [${z.from.toFixed(6)}, ${z.to.toFixed(6)})`);
  if (race.zones.length > 12) L.push(`  … ${race.zones.length - 12} more`);
  return L.join('\n');
}
