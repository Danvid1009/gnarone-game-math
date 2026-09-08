// Outcome tables: a finite list of prizes (as multiples of the bet) with probabilities.
//
// The design rule from the RandomSkill manual: RTP is exact BY SUMMATION, never by
// simulation. Everything in here is arithmetic on the table itself; Monte Carlo is
// only used (in verify.js) to prove that the code that samples the table agrees.
//
// Prize values are multiples of the bet (1.5 = pays 1.5x). Bets and wins in the RGS
// contract are integers in minor units (cents), so `toMinor` is the single rounding
// point and `exactRtpAtBet` tells you how much RTP that rounding costs at a given chip.

const EPS = 1e-9;

export function makeTable(rows, opts = {}) {
  const table = rows.map((r, i) => {
    const row = { label: r.label ?? `row${i}`, prize: Number(r.prize), p: Number(r.p) };
    if (r.meta !== undefined) row.meta = r.meta;
    return row;
  });
  validateTable(table, opts);
  return table;
}

/** Rows carry `weight` instead of `p`; weights are normalised to probabilities. */
export function fromWeights(rows, opts) {
  const W = rows.reduce((s, r) => s + Number(r.weight), 0);
  if (!(W > 0)) throw new Error('fromWeights: total weight must be > 0');
  return makeTable(rows.map(r => ({ ...r, p: Number(r.weight) / W })), opts);
}

export function validateTable(table, { tolerance = EPS } = {}) {
  if (!Array.isArray(table) || table.length === 0) throw new Error('table: empty');
  let sum = 0;
  for (const r of table) {
    if (!Number.isFinite(r.p) || r.p < 0) throw new Error(`table: bad probability on "${r.label}"`);
    if (!Number.isFinite(r.prize) || r.prize < 0) throw new Error(`table: bad prize on "${r.label}"`);
    sum += r.p;
  }
  if (Math.abs(sum - 1) > tolerance) throw new Error(`table: probabilities sum to ${sum}, not 1`);
  return true;
}

export function rtp(table) { return table.reduce((s, r) => s + r.p * r.prize, 0); }
export function hitRate(table) { return table.reduce((s, r) => s + (r.prize > 0 ? r.p : 0), 0); }
export function maxWin(table) { return table.reduce((m, r) => Math.max(m, r.prize), 0); }
export function variance(table) {
  const m = rtp(table);
  return table.reduce((s, r) => s + r.p * (r.prize - m) ** 2, 0);
}
export function stdev(table) { return Math.sqrt(variance(table)); }
/** 95% volatility index (1.96 sigma), the usual slot-math figure. */
export function vi95(table) { return 1.96 * stdev(table); }

/** Rows annotated with their RTP contribution, plus totals. */
export function contributions(table) {
  const rows = table.map(r => ({ ...r, rtpContribution: r.p * r.prize }));
  return { rows, rtp: rtp(table), hitRate: hitRate(table), maxWin: maxWin(table), stdev: stdev(table), vi95: vi95(table) };
}

/**
 * Given the non-zero rows as relative weights, solve the zero-row probability that
 * makes the whole table hit `targetRtp` exactly.
 *   rtp = (1 - p0) * E[prize | non-zero]  =>  p0 = 1 - target / E_nz
 */
export function solveZeroRow(nonZeroRows, targetRtp, { zeroLabel = 'zero' } = {}) {
  const W = nonZeroRows.reduce((s, r) => s + Number(r.weight), 0);
  const Enz = nonZeroRows.reduce((s, r) => s + (Number(r.weight) / W) * Number(r.prize), 0);
  if (!(Enz > targetRtp)) {
    throw new Error(`solveZeroRow: E[prize | win] = ${Enz.toFixed(4)} must exceed target RTP ${targetRtp}`);
  }
  const p0 = 1 - targetRtp / Enz;
  return makeTable([
    { label: zeroLabel, prize: 0, p: p0 },
    ...nonZeroRows.map(r => ({ label: r.label, prize: r.prize, p: (1 - p0) * (Number(r.weight) / W), meta: r.meta })),
  ]);
}

/** Multiply every prize by a constant so the table hits `targetRtp`. */
export function scaleToRtp(table, targetRtp) {
  const k = targetRtp / rtp(table);
  return makeTable(table.map(r => ({ ...r, prize: r.prize * k })));
}

/** Returns draw(rng) -> row index, using the cumulative distribution. */
export function sampler(table) {
  const cum = [];
  let acc = 0;
  for (const r of table) { acc += r.p; cum.push(acc); }
  cum[cum.length - 1] = 1; // absorb float dust so u in [0,1) always lands
  return function draw(rng) {
    const u = rng.next();
    for (let i = 0; i < cum.length; i++) if (u < cum[i]) return i;
    return cum.length - 1;
  };
}

export function drawRow(table, rng) {
  return table[sampler(table)(rng)];
}

/** The single rounding point from "multiple of bet" to integer minor units. */
export function toMinor(bet, prizeMultiple) {
  return Math.round(bet * prizeMultiple);
}

/** Realised RTP at a specific chip size after rounding wins to minor units. */
export function exactRtpAtBet(table, bet) {
  return table.reduce((s, r) => s + r.p * toMinor(bet, r.prize), 0) / bet;
}
