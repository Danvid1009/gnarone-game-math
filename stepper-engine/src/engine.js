// Stepper / crash-ladder engine.  See ALGORITHM.md for the math.
//
//   const L = buildLadder({ rtp: 0.97, maxWin: 10, steps: 10 });      // "easy" sheet
//   L.table                // the workbook rows: step, return, P(event), RN interval, survival
//   L.crashStep(u)         // u ~ U[0,1)  ->  K: number of rungs survived (0 = instant crash, N = golden egg)
//   L.start(u)             // round state machine: CONTINUE / CASH_OUT, RGS stepper shape
//
// Design rule (from the workbook): survival to at least rung k is G_k = R / c_k, so that
// G_k · c_k = R at every rung. Continuing is then exactly EV-neutral and every stopping
// rule returns R. Event probabilities are differences of G; one uniform picks the outcome.

import { Rng } from './rng.js';

const round2 = x => Math.round(x * 100) / 100;

/**
 * Either { rtp, maxWin, steps, decimals = 2 } to generate returns c_k = round(m^k), m = maxWin^(1/steps),
 * or   { rtp, returns: [c_1..c_N] } for an explicit ladder (strictly increasing, c_1 > rtp).
 */
export function buildLadder({ rtp, maxWin, steps, returns, decimals = 2, name } = {}) {
  if (!(rtp > 0 && rtp < 1)) throw new Error(`rtp must be in (0,1), got ${rtp}`);
  let c, m = null;
  if (Array.isArray(returns)) {
    c = returns.map(Number);
  } else {
    if (!(maxWin > 1) || !Number.isInteger(steps) || steps < 1) throw new Error('need maxWin > 1 and integer steps ≥ 1 (or explicit returns)');
    m = Math.pow(maxWin, 1 / steps);
    const f = 10 ** decimals;
    c = Array.from({ length: steps }, (_, i) => Math.round(Math.pow(m, i + 1) * f) / f);
  }
  const N = c.length;
  if (N < 1 || c.some(x => !Number.isFinite(x) || x <= 0)) throw new Error('returns must be positive numbers');
  for (let k = 1; k < N; k++) if (!(c[k] > c[k - 1])) throw new Error(`returns must strictly increase (rung ${k + 1})`);
  if (!(c[0] > rtp)) throw new Error(`first return ${c[0]} must exceed rtp ${rtp}, otherwise P(instant crash) < 0`);

  // survival to at least rung k (k = 1..N), G_0 = 1
  const G = [1, ...c.map(ck => rtp / ck)];
  // event k = crash after surviving k rungs (k = 0..N-1); event N = reach the top
  const p = Array.from({ length: N + 1 }, (_, k) => (k < N ? G[k] - G[k + 1] : G[N]));
  const cum = [0];
  for (const x of p) cum.push(cum[cum.length - 1] + x);
  cum[cum.length - 1] = 1;
  // per-step survival hazard: P(survive rung k | reached rung k)
  const survive = c.map((ck, i) => G[i + 1] / G[i]);

  const table = p.map((pk, k) => ({
    step: k,
    event: k === 0 ? 'Instant crash' : k < N ? `Crash after ${c[k - 1]}` : `Golden egg at ${c[N - 1]}`,
    return: k === 0 ? 0 : c[k - 1],
    p: pk,
    rnMin: cum[k], rnMax: cum[k + 1],
    survivalToHere: k === 0 ? null : G[k],
    survivalTimesReturn: k === 0 ? null : G[k] * c[k - 1],
  }));

  const ladder = {
    name: name ?? (m ? `rtp${rtp}-max${maxWin}-n${N}` : `rtp${rtp}-custom${N}`),
    rtp, maxWin: c[N - 1], steps: N, stepMultiple: m, returns: c, survival: G, hazard: survive, p, cum, table,

    /** K = rungs survived before the crash (0..N). N means the golden egg. One uniform. */
    crashStep(u) {
      if (u >= 1) u = 1 - 1e-12;
      let k = 0;
      while (cum[k + 1] <= u) k++;
      return k;
    },

    /** Payout multiple if the player stops after `stopAt` rungs given crash point K. */
    payoutFor(K, stopAt) {
      if (stopAt <= 0) return 0;
      if (stopAt > N) stopAt = N;
      return K >= stopAt ? c[stopAt - 1] : 0;
    },

    /** Exact RTP of the fixed strategy "stop after k rungs" — equals rtp for every k. */
    rtpOfStrategy(k) { return k <= 0 ? 0 : G[k] * c[k - 1]; },

    /**
     * Round state machine in the RGS stepper shape. `start(u)` predetermines K; then
     * `continue_()` / `cashOut()` reveal it rung by rung.
     */
    start(u, { bet = 1 } = {}) {
      const K = ladder.crashStep(u);
      const st = { K, bet, currentStep: 0, currentPayout: 0, totalWinAmount: 0, roundEnded: false,
        steps: c.map((ck, i) => ({ step: i + 1, payout: Math.round(bet * ck), outcome: 'UNDECIDED' })),
        nextAction: ['CONTINUE'] };
      const view = () => ({ currentStep: st.currentStep, currentPayout: st.currentPayout, totalWinAmount: st.totalWinAmount, roundEnded: st.roundEnded, steps: st.steps.map(s => ({ ...s })), nextAction: [...st.nextAction] });
      return {
        view,
        continue_() {
          if (st.roundEnded) throw new Error('round has ended');
          const k = st.currentStep + 1;
          if (k > K) { // crash on this rung
            st.steps[k - 1].outcome = 'CRASH'; st.currentStep = k; st.currentPayout = 0; st.totalWinAmount = 0; st.roundEnded = true; st.nextAction = ['COLLECT'];
          } else {
            st.steps[k - 1].outcome = 'SAFE'; st.currentStep = k; st.currentPayout = st.steps[k - 1].payout;
            if (k === N) { st.totalWinAmount = st.currentPayout; st.roundEnded = true; st.nextAction = ['COLLECT']; }
            else st.nextAction = ['CONTINUE', 'CASH_OUT'];
          }
          return view();
        },
        cashOut() {
          if (st.roundEnded) throw new Error('round has ended');
          if (st.currentStep === 0) throw new Error('nothing to cash out before the first rung');
          st.totalWinAmount = st.currentPayout; st.roundEnded = true; st.nextAction = ['COLLECT'];
          return view();
        },
        /** For audits: the predetermined crash point. Never send to the client mid-round. */
        _crashStep: K,
      };
    },

    /** Seeded Monte Carlo under a stopping rule: policy(k) -> true to cash out after rung k. */
    simulate({ rounds = 100000, seed = 'sim', policy = () => false } = {}) {
      const rng = new Rng(seed, 'payout');
      let tot = 0, sq = 0;
      const crashHist = new Array(N + 1).fill(0);
      for (let i = 0; i < rounds; i++) {
        const K = ladder.crashStep(rng.next());
        crashHist[K]++;
        let k = 0, win = 0;
        while (true) {
          if (k >= N) { win = c[N - 1]; break; }
          if (policy(k) && k > 0) { win = c[k - 1]; break; }
          k++;
          if (k > K) { win = 0; break; }
        }
        tot += win; sq += win * win;
      }
      const mean = tot / rounds, sd = Math.sqrt(Math.max(sq / rounds - mean * mean, 0));
      return { rounds, seed, rtp: mean, stdev: sd, se: sd / Math.sqrt(rounds), crashFreq: crashHist.map(n => n / rounds) };
    },

    /** Dependency-free JS of the crash draw. */
    standalone(name = 'crashStep') {
      return [
        `// Fair ladder: returns ${JSON.stringify(c)}, RTP ${rtp}. Survival to rung k = RTP / c_k, so every stopping rule returns ${rtp}.`,
        `// u: one uniform in [0,1). Returns K = rungs survived (0 = instant crash, ${N} = golden egg). Pay c[k-1] if the player stops at k <= K, else 0.`,
        `function ${name}(u) {`,
        `  const cum = ${JSON.stringify(cum)};`,
        `  if (u >= 1) u = 1 - 1e-12;`,
        `  let k = 0; while (cum[k + 1] <= u) k++;`,
        `  return k;`,
        `}`,
      ].join('\n');
    },

    toJSON() { return { name: ladder.name, rtp, maxWin: c[N - 1], steps: N, stepMultiple: m, returns: c, survival: G, hazard: survive, probabilities: p, cum, table }; },
  };
  return ladder;
}

export function format(L) {
  const pct = x => `${(100 * x).toFixed(4)}%`;
  const lines = [
    `${L.name}   RTP ${L.rtp}   max win ${L.maxWin}x   steps ${L.steps}` + (L.stepMultiple ? `   step multiple ${L.stepMultiple.toFixed(6)}` : ''),
    '',
    'step  event                  return   P(event)      RN [min, max)             survival≥   survival×return',
  ];
  for (const r of L.table) {
    lines.push(`${String(r.step).padStart(4)}  ${r.event.padEnd(22)} ${String(r.return).padStart(6)}   ${pct(r.p).padStart(10)}   [${r.rnMin.toFixed(6)}, ${r.rnMax.toFixed(6)})   ${r.survivalToHere === null ? '        -' : r.survivalToHere.toFixed(6).padStart(9)}   ${r.survivalTimesReturn === null ? '' : r.survivalTimesReturn.toFixed(6)}`);
  }
  lines.push(`${'total'.padStart(4)}  ${''.padEnd(22)} ${''.padStart(6)}   ${pct(L.p.reduce((s, x) => s + x, 0)).padStart(10)}`);
  return lines.join('\n');
}
