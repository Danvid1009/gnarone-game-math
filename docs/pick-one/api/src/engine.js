// Pick One engine. See ALGORITHM.md.
//
// n options with probabilities p_i (equal by default). One uniform picks the winning option from zones of
// width p_i. The player backs option j and is paid odds_j = RTP / p_j if j wins, else 0. Every option
// returns exactly RTP. n = 2 with equal probabilities is a coin flip paying 2·RTP.
import { Rng } from './rng.js';

export function buildPick({ n, probabilities, weights, labels, rtp = 0.95 } = {}) {
  if (!(rtp > 0 && rtp < 1)) throw new Error('rtp must be in (0,1)');
  let p;
  if (Array.isArray(probabilities)) { p = probabilities.map(Number); const s = p.reduce((a, b) => a + b, 0); if (Math.abs(s - 1) > 1e-9) throw new Error(`probabilities sum to ${s}, not 1`); }
  else if (Array.isArray(weights)) { const W = weights.reduce((a, b) => a + Number(b), 0); p = weights.map(w => Number(w) / W); }
  else { if (!Number.isInteger(n) || n < 2) throw new Error('n must be an integer ≥ 2'); p = Array(n).fill(1 / n); }
  n = p.length; if (n < 2 || p.some(x => !(x > 0))) throw new Error('need ≥ 2 options with positive probability');
  const names = labels ?? Array.from({ length: n }, (_, i) => n === 2 ? ['HEADS', 'TAILS'][i] : `OPTION_${i + 1}`);
  const odds = p.map(x => rtp / x);
  const cum = [0]; for (const x of p) cum.push(cum[cum.length - 1] + x); cum[n] = 1;
  const options = names.map((name, i) => ({ index: i, name, p: p[i], odds: odds[i], from: cum[i], to: cum[i + 1], stdev: Math.sqrt(p[i] * odds[i] ** 2 - rtp * rtp) }));
  const outcome = u => { if (u >= 1) u = 1 - 1e-15; let i = 0; while (i < n - 1 && cum[i + 1] <= u) i++; return i; };
  function play({ bet, betType, rng }) {
    const j = names.indexOf(betType); if (j < 0) throw new Error(`unknown option "${betType}"; options: ${names.join(', ')}`);
    const u = rng.next(), w = outcome(u), hit = w === j;
    return { totalWinAmount: hit ? Math.round(bet * odds[j]) : 0, math: { u, winner: w, winnerName: names[w], backed: j, hit, odds: odds[j] } };
  }
  function simulate({ betType = names[0], rounds = 200000, seed = 'pick', bet = 100 } = {}) {
    const rng = new Rng(seed, 'payout'); let tot = 0, sq = 0; const wins = new Array(n).fill(0);
    for (let i = 0; i < rounds; i++) { const r = play({ bet, betType, rng }); const x = r.totalWinAmount / bet; tot += x; sq += x * x; wins[r.math.winner]++; }
    const mean = tot / rounds, sd = Math.sqrt(Math.max(sq / rounds - mean * mean, 0));
    return { betType, rounds, rtp: mean, stdev: sd, se: sd / Math.sqrt(rounds), winFreq: wins.map(w => w / rounds) };
  }
  const standalone = (fn = 'pickOutcome') => `// Pick One: ${n} options, RTP ${rtp}. odds = ${JSON.stringify(odds.map(x => +x.toFixed(6)))}. u: one uniform in [0,1). Returns the winning option index.\nfunction ${fn}(u) {\n  const cum = ${JSON.stringify(cum)};\n  if (u >= 1) u = 1 - 1e-15;\n  let i = 0; while (i < cum.length - 2 && cum[i + 1] <= u) i++;\n  return i;\n}`;
  return { n, rtp, names, p, odds, cum, options, outcome, play, simulate, standalone, toJSON() { return { n, rtp, options }; } };
}

export function format(P) {
  const pct = x => `${(100 * x).toFixed(4)}%`;
  return [`${P.n} options   RTP ${P.rtp}`, '', 'option        P(win)       odds        EV      stdev   RN [from, to)',
    ...P.options.map(o => `${o.name.padEnd(12)} ${pct(o.p).padStart(9)}   ${o.odds.toFixed(4).padStart(8)}   ${(o.p * o.odds).toFixed(4)}  ${o.stdev.toFixed(3).padStart(6)}   [${o.from.toFixed(6)}, ${o.to.toFixed(6)})`)].join('\n');
}
