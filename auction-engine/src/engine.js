// Storage-auction ladder.  See ALGORITHM.md for the math.
//
//   const A = buildAuction({ rtp: 0.95, maxWin: 25, steps: 10 });
//   A.bids                 // c_1..c_N: what the locker is worth (× stake) after k successful bids
//   A.draw(u)              // u ~ U[0,1) -> { K, v, X }: bids survived, recycled residual, locker multiplier
//   A.settle(u, s)         // payout multiple if the player takes the locker after s bids
//   A.start(u)             // round state machine: BID / TAKE (RGS stepper shape: CONTINUE / CASH_OUT / COLLECT)
//
// Same math as the stepper: survival to at least rung k is G_k = R / c_k (the edge is taken on
// the first bid, every later bid is a fair bet). The one change: when the hammer falls at rung s
// the player does not receive c_s flat — they open the locker, whose contents are a one-shot
// draw X with E[X] = 1 exactly, and receive c_s · X. Because E[c_s X] = c_s, every stopping rule
// still returns R. The locker draw v is the residual of the single uniform u inside its crash
// interval, so one uniform still decides the whole round.

import { Rng } from './rng.js';
import { buildBox } from './box.js';

export { buildBox };

/**
 * { rtp, maxWin, steps, decimals = 2 }  or  { rtp, returns: [c_1..c_N] }, plus
 * box: buildBox() options ({ payouts, mean = 1, method, probabilities, fraction }) or false for a flat locker (X ≡ 1).
 */
export function buildAuction({ rtp, maxWin, steps, returns, decimals = 2, name, box = {} } = {}) {
  if (!(rtp > 0 && rtp < 1)) throw new Error(`rtp must be in (0,1), got ${rtp}`);
  let c, m = null;
  if (Array.isArray(returns)) c = returns.map(Number);
  else {
    if (!(maxWin > 1) || !Number.isInteger(steps) || steps < 1) throw new Error('need maxWin > 1 and integer steps ≥ 1 (or explicit returns)');
    m = Math.pow(maxWin, 1 / steps);
    const f = 10 ** decimals;
    c = Array.from({ length: steps }, (_, i) => Math.round(Math.pow(m, i + 1) * f) / f);
  }
  const N = c.length;
  if (N < 1 || c.some(x => !Number.isFinite(x) || x <= 0)) throw new Error('returns must be positive numbers');
  for (let k = 1; k < N; k++) if (!(c[k] > c[k - 1])) throw new Error(`returns must strictly increase (rung ${k + 1})`);
  if (!(c[0] > rtp)) throw new Error(`first return ${c[0]} must exceed rtp ${rtp}, otherwise P(instant outbid) < 0`);

  const B = box === false ? null : buildBox({ ...box, mean: box?.mean ?? 1 });
  if (B && Math.abs(B.mean - 1) > 1e-9) throw new Error(`the locker must have mean 1 to keep the ladder fair (got ${B.mean}); scale the rungs instead`);

  const G = [1, ...c.map(ck => rtp / ck)];                                   // survival to at least rung k
  const p = Array.from({ length: N + 1 }, (_, k) => (k < N ? G[k] - G[k + 1] : G[N]));   // P(K = k)
  const cum = [0]; for (const x of p) cum.push(cum[cum.length - 1] + x); cum[cum.length - 1] = 1;
  const hazard = c.map((ck, i) => G[i + 1] / G[i]);                         // P(rival folds | reached rung k)

  const table = p.map((pk, k) => ({
    step: k,
    event: k === 0 ? 'Outbid on the first bid' : k < N ? `Outbid after ${c[k - 1]}` : `Hammer at the top ${c[N - 1]}`,
    return: k === 0 ? 0 : c[k - 1], p: pk, rnMin: cum[k], rnMax: cum[k + 1],
    survivalToHere: k === 0 ? null : G[k], survivalTimesReturn: k === 0 ? null : G[k] * c[k - 1],
  }));

  const X = v => (B ? B.multiplier(v) : 1);

  const A = {
    name: name ?? (m ? `rtp${rtp}-max${maxWin}-n${N}` : `rtp${rtp}-custom${N}`),
    rtp, maxWin: c[N - 1], steps: N, stepMultiple: m, bids: c, returns: c, survival: G, hazard, p, cum, table, box: B,

    /** K = successful bids before being outbid (0..N; N = the auction runs to the top). One uniform. */
    crashStep(u) { if (u >= 1) u = 1 - 1e-12; let k = 0; while (cum[k + 1] <= u) k++; return k; },

    /** The residual of u inside its interval: v = (u − e_K)/(e_{K+1} − e_K), uniform and independent of K. */
    residual(u, K = A.crashStep(u)) { if (u >= 1) u = 1 - 1e-12; const v = (u - cum[K]) / (cum[K + 1] - cum[K]); return v < 0 ? 0 : v >= 1 ? 1 - 1e-12 : v; },

    /** Everything the round needs from one uniform. */
    draw(u) { const K = A.crashStep(u), v = A.residual(u, K); return { K, v, X: X(v), band: B ? B.bandOf(v) : 0 }; },

    /** Payout multiple if the player takes the locker after `stopAt` bids, given (K, v). */
    payoutFor(K, v, stopAt) { if (stopAt <= 0) return 0; if (stopAt > N) stopAt = N; return K >= stopAt ? c[stopAt - 1] * X(v) : 0; },
    settle(u, stopAt) { const { K, v } = A.draw(u); return A.payoutFor(K, v, stopAt); },

    /** Exact RTP of "take after k bids" — G_k · c_k · E[X] = rtp for every k. */
    rtpOfStrategy(k) { return k <= 0 ? 0 : G[k] * c[k - 1] * (B ? B.mean : 1); },

    /** Exact variance of the payout under "take after k bids". */
    varianceOfStrategy(k) { if (k <= 0) return 0; const m2 = B ? B.secondMoment : 1; const e2 = G[k] * c[k - 1] ** 2 * m2; return e2 - A.rtpOfStrategy(k) ** 2; },

    /**
     * Round state machine in the RGS stepper shape. start(u) predetermines (K, X); bid() / take()
     * reveal it. Aliases: continue_ = bid, cashOut = take.
     */
    start(u, { bet = 1 } = {}) {
      const { K, v, X: mult, band } = A.draw(u);
      const st = { bet, currentStep: 0, currentPayout: 0, totalWinAmount: 0, roundEnded: false, locker: null,
        steps: c.map((ck, i) => ({ step: i + 1, payout: Math.round(bet * ck), outcome: 'UNDECIDED' })), nextAction: ['CONTINUE'] };
      const view = () => ({ currentStep: st.currentStep, currentPayout: st.currentPayout, totalWinAmount: st.totalWinAmount, roundEnded: st.roundEnded,
        steps: st.steps.map(s => ({ ...s })), nextAction: [...st.nextAction], locker: st.locker ? { ...st.locker } : null });
      const hammer = () => { st.locker = { multiplier: mult, band, contents: Math.round(st.currentPayout * mult) }; st.totalWinAmount = st.locker.contents; st.roundEnded = true; st.nextAction = ['COLLECT']; };
      const round = {
        view,
        bid() {
          if (st.roundEnded) throw new Error('round has ended');
          const k = st.currentStep + 1;
          if (k > K) { st.steps[k - 1].outcome = 'CRASH'; st.currentStep = k; st.currentPayout = 0; st.totalWinAmount = 0; st.roundEnded = true; st.nextAction = ['COLLECT']; }
          else { st.steps[k - 1].outcome = 'SAFE'; st.currentStep = k; st.currentPayout = st.steps[k - 1].payout; if (k === N) hammer(); else st.nextAction = ['CONTINUE', 'CASH_OUT']; }
          return view();
        },
        take() {
          if (st.roundEnded) throw new Error('round has ended');
          if (st.currentStep === 0) throw new Error('nothing to take before the first bid');
          hammer(); return view();
        },
        _crashStep: K, _locker: { v, multiplier: mult, band },
      };
      round.continue_ = round.bid; round.cashOut = round.take;
      return round;
    },

    /** Seeded Monte Carlo under a stopping rule: policy(k) -> true to take the locker after k bids. */
    simulate({ rounds = 100000, seed = 'sim', policy = () => false } = {}) {
      const rng = new Rng(seed, 'payout');
      let tot = 0, sq = 0;
      const crashHist = new Array(N + 1).fill(0), bandHist = new Array(B ? B.payouts.length : 1).fill(0);
      let outbid = 0;
      for (let i = 0; i < rounds; i++) {
        const { K, X: mult, band } = A.draw(rng.next());
        crashHist[K]++;
        let k = 0, win = 0, took = false;
        while (true) {
          if (k >= N) { win = c[N - 1] * mult; took = true; break; }
          if (policy(k) && k > 0) { win = c[k - 1] * mult; took = true; break; }
          k++;
          if (k > K) { win = 0; break; }
        }
        if (took) bandHist[band]++; else outbid++;
        tot += win; sq += win * win;
      }
      const mean = tot / rounds, sd = Math.sqrt(Math.max(sq / rounds - mean * mean, 0));
      return { rounds, seed, rtp: mean, stdev: sd, se: sd / Math.sqrt(rounds), crashFreq: crashHist.map(n => n / rounds), outbidFreq: outbid / rounds, bandFreq: bandHist.map(n => n / rounds) };
    },

    /** Dependency-free JS: settle(u, s) -> payout multiple for taking the locker after s bids. */
    standalone(fn = 'settle') {
      return [
        `// Storage-auction ladder: bids ${JSON.stringify(c)}, RTP ${rtp}. Survival to rung k = RTP / c_k; the locker multiplier has mean 1,`,
        `// so taking the locker after any number of bids returns ${rtp}. u: one uniform in [0,1). s: bids made before the hammer (1..${N}).`,
        `function ${fn}(u, s) {`,
        `  const cum = ${JSON.stringify(cum)}, bids = ${JSON.stringify(c)};`,
        `  if (u >= 1) u = 1 - 1e-12;`,
        `  let K = 0; while (cum[K + 1] <= u) K++;                 // successful bids before the rival wins`,
        `  if (s < 1 || s > K) return 0;                             // outbid before the hammer`,
        `  if (s > ${N}) s = ${N};`,
        B ? `  const v = (u - cum[K]) / (cum[K + 1] - cum[K]);         // recycled residual: the locker draw` : `  return bids[s - 1];`,
        ...(B ? [
          `  const breaks = ${JSON.stringify(B.breaks)}, mult = ${JSON.stringify(B.payouts)}, r = ${B.r};`,
          `  let i = 0; while (breaks[i + 1] <= v) i++;`,
          `  const X = mult[i] <= 0 ? 0 : mult[i] + r * (2 * (v - breaks[i]) / (breaks[i + 1] - breaks[i]) - 1);`,
          `  return bids[s - 1] * X;`,
        ] : []),
        `}`,
      ].join('\n');
    },

    toJSON() { return { name: A.name, rtp, maxWin: c[N - 1], steps: N, stepMultiple: m, bids: c, survival: G, hazard, probabilities: p, cum, table, box: B ? B.toJSON() : null }; },
  };
  return A;
}

export function format(A) {
  const pct = x => `${(100 * x).toFixed(4)}%`;
  const lines = [
    `${A.name}   RTP ${A.rtp}   top locker ${A.maxWin}x   bids ${A.steps}` + (A.stepMultiple ? `   step multiple ${A.stepMultiple.toFixed(6)}` : ''),
    '',
    'step  event                        value   P(event)      RN [min, max)             survival≥   survival×value',
  ];
  for (const r of A.table) lines.push(`${String(r.step).padStart(4)}  ${r.event.padEnd(28)} ${String(r.return).padStart(6)}   ${pct(r.p).padStart(10)}   [${r.rnMin.toFixed(6)}, ${r.rnMax.toFixed(6)})   ${r.survivalToHere === null ? '        -' : r.survivalToHere.toFixed(6).padStart(9)}   ${r.survivalTimesReturn === null ? '' : r.survivalTimesReturn.toFixed(6)}`);
  lines.push(`${'total'.padStart(4)}  ${''.padEnd(28)} ${''.padStart(6)}   ${pct(A.p.reduce((s, x) => s + x, 0)).padStart(10)}`);
  if (A.box) {
    const B = A.box;
    lines.push('', `locker: mean ${B.mean.toFixed(6)}   stdev ${B.stdev.toFixed(4)}   r = ${B.r} (${B.fraction} × smallest gap ${B.gap})   method ${B.method}`, 'probability (decreasing)   residual [from, to)      multiple   pays (left → right edge)');
    for (const b of [...B.bands].sort((x, y) => y.p - x.p)) lines.push(`  ${(100 * b.p).toFixed(2).padStart(7)}%                [${b.from.toFixed(4)}, ${b.to.toFixed(4)})   ${(b.multiple + 'x').padStart(7)}    ${b.multiple > 0 ? `${b.range[0].toFixed(4)} → ${b.range[1].toFixed(4)}` : 'empty'}`);
  } else lines.push('', 'locker: flat (X ≡ 1) — identical to the stepper');
  return lines.join('\n');
}
