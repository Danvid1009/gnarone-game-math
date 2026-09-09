// Experiment: n = 12, payouts [M1, M2, M3] = [x_i, x_i, 1.4] with x_i solved per racer for RTP.
// One recycled uniform per race (nested-interval Plackett–Luce). Twelve bettors, stake 1 each, every race.
//   node scripts/sim-fixed-third.js [races] [rtp] [m3] > examples/sim-fixed-third.json
import { Rng } from '../src/rng.js';
const RACES = Number(process.argv[2] ?? 200000), RTP = Number(process.argv[3] ?? 0.95), M3 = Number(process.argv[4] ?? 1.4);
const ELO = [1850, 1780, 1720, 1680, 1640, 1600, 1560, 1520, 1480, 1430, 1380, 1300];
const n = ELO.length, Emax = Math.max(...ELO);
const w = ELO.map(e => Math.pow(10, (e - Emax) / 400)), W = w.reduce((s, x) => s + x, 0);

// closed-form q_i1, q_i2, q_i3
const q1 = w.map(wi => wi / W);
const q2 = w.map((wi, i) => w.reduce((s, wj, j) => j === i ? s : s + (wj / W) * (wi / (W - wj)), 0));
const q3 = w.map((wi, i) => { let s = 0; for (let j = 0; j < n; j++) if (j !== i) for (let k = 0; k < n; k++) if (k !== i && k !== j) s += (w[j] / W) * (w[k] / (W - w[j])) * (wi / (W - w[j] - w[k])); return s; });
const x = q1.map((_, i) => (RTP - M3 * q3[i]) / (q1[i] + q2[i]));   // M1 = M2 = x_i
const feasible = x.map(xi => xi >= M3);

// one recycled uniform → full ranking
function rank(u) {
  const rem = [...Array(n).keys()], order = [];
  while (rem.length > 1) {
    const tot = rem.reduce((s, i) => s + w[i], 0);
    let a = 0, pick = rem[rem.length - 1], pa = 0, pp = 0;
    for (const i of rem) { const p = w[i] / tot; if (u < a + p) { pick = i; pa = a; pp = p; break; } a += p; }
    if (pp === 0) { pick = rem[rem.length - 1]; pa = 1 - w[pick] / tot; pp = w[pick] / tot; } // float edge
    u = Math.min(Math.max((u - pa) / pp, 0), 1 - 1e-16);
    order.push(pick); rem.splice(rem.indexOf(pick), 1);
  }
  order.push(rem[0]); return order;
}

const rng = new Rng('fixed-third', 'payout');
const tot = new Array(n).fill(0), sq = new Array(n).fill(0), place = Array.from({ length: n }, () => [0, 0, 0]);
const hist = Array.from({ length: n }, () => ({})); let firstHist = new Array(n).fill(0);
for (let r = 0; r < RACES; r++) {
  const o = rank(rng.next());
  firstHist[o[0]]++;
  for (let i = 0; i < n; i++) {
    const pl = o.indexOf(i);
    const m = pl === 0 || pl === 1 ? x[i] : pl === 2 ? M3 : 0;
    if (pl < 3) place[i][pl]++;
    tot[i] += m; sq[i] += m * m;
    const key = m.toFixed(3); hist[i][key] = (hist[i][key] ?? 0) + 1;
  }
}
const rows = ELO.map((elo, i) => {
  const mean = tot[i] / RACES, sd = Math.sqrt(sq[i] / RACES - mean * mean);
  return { racer: i + 1, elo, w: w[i], q1: q1[i], q2: q2[i], q3: q3[i], top3: q1[i] + q2[i] + q3[i], x: x[i], M: [x[i], x[i], M3], feasible: feasible[i], designRtp: q1[i] * x[i] + q2[i] * x[i] + q3[i] * M3, simRtp: mean, se: sd / Math.sqrt(RACES), stdev: sd, simPlace: place[i].map(c => c / RACES), simWin: firstHist[i] / RACES, hist: hist[i] };
});
const pooled = rows.reduce((s, r) => s + r.simRtp, 0) / n;
const out = { RACES, RTP, M3, ELO, rows, pooled, checks: { sumQ1: q1.reduce((s, v) => s + v, 0), sumQ2: q2.reduce((s, v) => s + v, 0), sumQ3: q3.reduce((s, v) => s + v, 0) } };
console.error(`races ${RACES}  rtp ${RTP}  M3 ${M3}   Σq1 ${out.checks.sumQ1.toFixed(6)} Σq2 ${out.checks.sumQ2.toFixed(6)} Σq3 ${out.checks.sumQ3.toFixed(6)}`);
console.error('racer  elo   q1       q2       q3       top3     x=M1=M2   feasible  designRTP  simRTP   ±se      stdev');
for (const r of rows) console.error(`${String(r.racer).padStart(5)} ${r.elo}  ${(100*r.q1).toFixed(2).padStart(6)}%  ${(100*r.q2).toFixed(2).padStart(6)}%  ${(100*r.q3).toFixed(2).padStart(6)}%  ${(100*r.top3).toFixed(2).padStart(6)}%  ${r.x.toFixed(3).padStart(8)}  ${r.feasible ? 'yes' : 'NO '}       ${r.designRtp.toFixed(4)}     ${r.simRtp.toFixed(4)}  ${r.se.toFixed(4)}  ${r.stdev.toFixed(3)}`);
console.error(`pooled RTP over 12 equal bettors: ${pooled.toFixed(4)}`);
console.log(JSON.stringify(out));
