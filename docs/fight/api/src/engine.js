// Live Fight engine.  See ALGORITHM.md for the math.
//
//   const F = buildFight({ A: { power: 1650, hp: 100 }, B: { power: 1550, hp: 100 }, ticks: 50, rtp: 0.95 });
//   F.pA0                      // exact P(A wins) at the opening bell — the "overall" that folds power and HP together
//   F.odds                     // opening prices: { A: rtp / pA0, B: rtp / (1 − pA0) }
//   F.prob(t, hpA, hpB)        // exact P(A wins | t ticks done, healths) — a martingale, so live prices 1/p are fair
//   F.play(u-source)           // the whole fight from one seed: tick-by-tick hits, winner, how it ended
//   F.start(rng, { bet, betType })   // round state machine: CONTINUE reveals one tick
//
// Model. Each tick one fighter lands a hit: A with probability pA = wA / (wA + wB), w = 10^(power/400).
// Damage is a half-normal draw, mean scaled by the hitter's relative power, discretised to the health grid
// (resolution `res`), so decimals are fine and the win probability is exact by summation. Health only
// goes down; a fighter at 0 is knocked out. If both stand after `ticks` ticks, a biased coin decides with
// probability V_N(a, b) = a / (a + b) (health share). Backward induction from that end rule gives
// V_t(a, b) = P(A wins | state) for every state, exact, and by construction E[V_{t+1}] = V_t.

import { Rng } from './rng.js';

const erf = x => { // Abramowitz–Stegun 7.1.26, |err| < 1.5e-7
  const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
};
const Phi = x => 0.5 * (1 + erf(x / Math.SQRT2));
export const eloToStrength = (elo, ref = 0) => Math.pow(10, (elo - ref) / 400);

/** Half-normal damage with the given mean, discretised to multiples of `res` (no zero-damage hits). */
export function damageTable(mean, res, maxSigmas = 4) {
  const sigma = mean * Math.sqrt(Math.PI / 2);
  const K = Math.max(1, Math.ceil(maxSigmas * sigma / res));
  const cdf = x => 2 * Phi(x / sigma) - 1;                    // |Z|·sigma
  const p = [];
  for (let k = 1; k <= K; k++) { const lo = k === 1 ? 0 : (k - 0.5) * res, hi = k === K ? Infinity : (k + 0.5) * res; p.push(cdf(hi) - cdf(lo)); }
  const Z = p.reduce((s, x) => s + x, 0);
  const probs = p.map(x => x / Z); const cum = [0]; for (const x of probs) cum.push(cum[cum.length - 1] + x); cum[K] = 1;
  return { res, k: Array.from({ length: K }, (_, i) => i + 1), damage: Array.from({ length: K }, (_, i) => (i + 1) * res), p: probs, cum, mean: probs.reduce((s, x, i) => s + x * (i + 1) * res, 0), sample(v) { if (v >= 1) v = 1 - 1e-12; let i = 0; while (cum[i + 1] <= v) i++; return i + 1; } };
}

export function buildFight({ A, B, ticks = 16, res = 0.5, baseDamage = 16, damageExponent = 0.25, eloScale = 1200, rtp = 0.95, endRule = 'health-share', name } = {}) {
  for (const [k, f] of [['A', A], ['B', B]]) if (!f || !(f.hp > 0) || !Number.isFinite(f.power)) throw new Error(`fighter ${k} needs { power, hp > 0 }`);
  if (!(rtp > 0 && rtp < 1)) throw new Error(`rtp must be in (0,1), got ${rtp}`);
  if (!Number.isInteger(ticks) || ticks < 1) throw new Error('ticks must be a positive integer');
  if (!(res > 0)) throw new Error('res must be > 0');
  const wA = Math.pow(10, (A.power - B.power) / eloScale), wB = 1;    // relative strengths (eloScale 1200: a 100-point gap is a 54.8% hit rate)
  const pA = wA / (wA + wB);                                            // P(A lands the tick's hit)
  const ratio = wA / wB;
  const dmgA = damageTable(baseDamage * Math.pow(ratio, damageExponent), res);
  const dmgB = damageTable(baseDamage * Math.pow(ratio, -damageExponent), res);
  const IA = Math.round(A.hp / res), IB = Math.round(B.hp / res);     // health cells; 0 = KO
  if (IA < 1 || IB < 1) throw new Error('hp must be at least one resolution step');
  const W = IB + 1;                                                     // row stride
  const idx = (i, j) => i * W + j;
  const endValue = endRule === 'coin-half' ? () => 0.5 : (i, j) => i / (i + j);

  // V[t] = Float64Array over (i, j), i = A cells left, j = B cells left; alive cells only matter (i, j ≥ 1)
  const V = new Array(ticks + 1);
  V[ticks] = new Float64Array((IA + 1) * W);
  for (let i = 1; i <= IA; i++) for (let j = 1; j <= IB; j++) V[ticks][idx(i, j)] = endValue(i, j);
  for (let t = ticks - 1; t >= 0; t--) {
    const cur = new Float64Array((IA + 1) * W), nxt = V[t + 1];
    for (let i = 1; i <= IA; i++) for (let j = 1; j <= IB; j++) {
      let a = 0;                                                        // A lands: B loses d cells
      for (let k = 0; k < dmgA.p.length; k++) { const jj = j - dmgA.k[k]; a += dmgA.p[k] * (jj <= 0 ? 1 : nxt[idx(i, jj)]); }
      let b = 0;                                                        // B lands: A loses d cells
      for (let k = 0; k < dmgB.p.length; k++) { const ii = i - dmgB.k[k]; b += dmgB.p[k] * (ii <= 0 ? 0 : nxt[idx(ii, j)]); }
      cur[idx(i, j)] = pA * a + (1 - pA) * b;
    }
    V[t] = cur;
  }
  const pA0 = V[0][idx(IA, IB)];
  const odds = { A: rtp / pA0, B: rtp / (1 - pA0) };
  const toHp = c => Math.round(c * res * 100) / 100;

  const F = {
    name: name ?? `fight-${A.power}v${B.power}`, rtp, ticks, res, eloScale, baseDamage, damageExponent, pLand: { A: pA, B: 1 - pA }, damage: { A: dmgA, B: dmgB }, hp: { A: A.hp, B: B.hp }, cells: { A: IA, B: IB }, fighters: { A, B }, endRule,
    pA0, odds,

    /** Exact P(A wins | t ticks done, hpA, hpB) for alive fighters. */
    prob(t, hpA, hpB) {
      const i = Math.round(hpA / res), j = Math.round(hpB / res);
      if (j <= 0) return 1; if (i <= 0) return 0;
      if (t > ticks) t = ticks;
      return V[t][idx(Math.min(i, IA), Math.min(j, IB))];
    },
    /** Fair live prices at a state. */
    liveOdds(t, hpA, hpB) { const p = F.prob(t, hpA, hpB); return { pA: p, A: p > 0 ? 1 / p : Infinity, B: p < 1 ? 1 / (1 - p) : Infinity }; },

    /** One tick from one uniform: who lands (interval pA) and how hard (recycled residual). */
    tick(u) { if (u >= 1) u = 1 - 1e-12; if (u < pA) return { hitter: 'A', cells: dmgA.sample(u / pA) }; return { hitter: 'B', cells: dmgB.sample((u - pA) / (1 - pA)) }; },

    /** The whole fight from a uniform source (rng.next or a function). */
    play(next) {
      const nx = typeof next === 'function' ? next : () => next.next();
      let i = IA, j = IB; const log = [];
      for (let t = 1; t <= ticks; t++) {
        const h = F.tick(nx());
        if (h.hitter === 'A') j = Math.max(0, j - h.cells); else i = Math.max(0, i - h.cells);
        log.push({ tick: t, hitter: h.hitter, damage: toHp(h.cells), hpA: toHp(i), hpB: toHp(j), pA: j === 0 ? 1 : i === 0 ? 0 : V[t][idx(i, j)] });
        if (i === 0 || j === 0) return { winner: j === 0 ? 'A' : 'B', how: 'KO', ticks: t, log, final: { hpA: toHp(i), hpB: toHp(j) } };
      }
      const pEnd = endValue(i, j), u = nx();
      return { winner: u < pEnd ? 'A' : 'B', how: 'DECISION', ticks, log, final: { hpA: toHp(i), hpB: toHp(j) }, decision: { pA: pEnd, u } };
    },

    /** Round state machine: bet on A or B at the opening odds; CONTINUE reveals one tick; linked bets price off view().pA. */
    start(rng, { bet = 1, betType = 'A' } = {}) {
      if (!['A', 'B'].includes(betType)) throw new Error(`betType must be A or B, got ${betType}`);
      const fight = F.play(rng); let shown = 0;
      const st = { bet, betType, tick: 0, hpA: A.hp, hpB: B.hp, pA: pA0, last: null, winner: null, how: null, roundEnded: false, totalWinAmount: 0, nextAction: ['CONTINUE'] };
      const view = () => ({ tick: st.tick, hp: { A: st.hpA, B: st.hpB }, pA: st.pA, odds: { opening: odds, live: st.roundEnded ? null : { A: 1 / st.pA, B: 1 / (1 - st.pA) } }, last: st.last, winner: st.winner, how: st.how, totalWinAmount: st.totalWinAmount, roundEnded: st.roundEnded, nextAction: [...st.nextAction], ticksMax: ticks, decision: st.roundEnded && fight.how === 'DECISION' ? fight.decision : null });
      return {
        view,
        continue_() {
          if (st.roundEnded) throw new Error('fight has ended');
          const e = fight.log[shown++]; st.tick = e.tick; st.hpA = e.hpA; st.hpB = e.hpB; st.pA = e.pA; st.last = { hitter: e.hitter, damage: e.damage };
          if (shown === fight.log.length) { st.winner = fight.winner; st.how = fight.how; st.roundEnded = true; st.nextAction = ['COLLECT']; st.totalWinAmount = fight.winner === betType ? Math.round(bet * odds[betType]) : 0; st.pA = fight.winner === 'A' ? 1 : 0; }
          return view();
        },
        _fight: fight,
      };
    },

    /** Seeded Monte Carlo: frequency of A winning vs the exact pA0, opening-bet return on A and B, and fair-ness of live bets placed at a fixed tick. */
    simulate({ rounds = 100000, seed = 'sim', liveAt = 10 } = {}) {
      const rng = new Rng(seed, 'payout');
      let winsA = 0, retA = 0, retB = 0, liveStake = 0, liveRet = 0, kos = 0;
      for (let n = 0; n < rounds; n++) {
        const f = F.play(rng);
        if (f.winner === 'A') { winsA++; retA += odds.A; } else retB += odds.B;
        if (f.how === 'KO') kos++;
        const e = f.log[liveAt - 1];
        if (e && e.pA > 0 && e.pA < 1) { liveStake += 1; if (f.winner === 'A') liveRet += 1 / e.pA; }   // always back A live at tick liveAt
      }
      return { rounds, seed, pA0, freqA: winsA / rounds, se: Math.sqrt(pA0 * (1 - pA0) / rounds), rtpA: retA / rounds, rtpB: retB / rounds, koRate: kos / rounds, live: { at: liveAt, stake: liveStake, rtp: liveStake ? liveRet / liveStake : null } };
    },

    toJSON() { return { name: F.name, rtp, ticks, res, eloScale, baseDamage, damageExponent, fighters: { A, B }, pLand: F.pLand, damageMean: { A: dmgA.mean, B: dmgB.mean }, pA0, odds, endRule }; },
  };
  return F;
}

export function format(F) {
  const pct = x => `${(100 * x).toFixed(2)}%`;
  return [
    `${F.name}   RTP ${F.rtp}   ticks ${F.ticks}   grid ${F.res}`,
    `A: power ${F.fighters.A.power}, hp ${F.hp.A}   lands ${pct(F.pLand.A)} of hits, mean damage ${F.damage.A.mean.toFixed(2)}`,
    `B: power ${F.fighters.B.power}, hp ${F.hp.B}   lands ${pct(F.pLand.B)} of hits, mean damage ${F.damage.B.mean.toFixed(2)}`,
    `P(A wins) at the bell = ${pct(F.pA0)}   opening odds A ${F.odds.A.toFixed(4)}x  B ${F.odds.B.toFixed(4)}x   (EV = ${F.rtp} either side)`,
    `live price examples:  after 10 ticks at full health ${F.liveOdds(10, F.hp.A, F.hp.B).A.toFixed(3)}x / ${F.liveOdds(10, F.hp.A, F.hp.B).B.toFixed(3)}x;  A at half health, B full, tick 25: ${F.liveOdds(25, F.hp.A / 2, F.hp.B).A.toFixed(3)}x / ${F.liveOdds(25, F.hp.A / 2, F.hp.B).B.toFixed(3)}x`,
  ].join('\n');
}
