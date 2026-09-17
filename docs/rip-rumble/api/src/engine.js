// Rippin Rumble engine. See ALGORITHM.md. Reproduces `Copy of Math-rippin-rumble-ver4.xlsx`.
//
// A pack is 5 cards drawn WITHOUT replacement from one of two decks ("buckets"). Per rarity the pack
// pays count × paysPerCard × multiplier(count). Which bucket a pack comes from is drawn with a
// probability solved per bet type so that E[win]/cost = RTP exactly. Card identities are cosmetic.
import { Rng } from './rng.js';

export const RARITIES = ['LEGENDARY', 'RARE', 'UNCOMMON', 'COMMON'];
export const DEFAULT = {
  rtp: 0.95, packSize: 5,
  pays: { LEGENDARY: 3, RARE: 1, UNCOMMON: 0.5, COMMON: 0 },               // credits per card
  multiplier: { 5: 100, 4: 10, 3: 3, 2: 2, 1: 1, 0: 0 },                    // by count of that rarity in the pack
  buckets: {
    low:  { cost: 5,  deck: { LEGENDARY: 2, RARE: 5, UNCOMMON: 8, COMMON: 15 } },
    high: { cost: 10, deck: { LEGENDARY: 5, RARE: 7, UNCOMMON: 9, COMMON: 6 } },
  },
  bundleRatio: 10,                                                           // paid packs per free pack: 11 packs for the price of 10
  betTypes: {
    BASE:           { cost: 5,  packs: 1,  paidPacks: 1 },
    BOOSTED:        { cost: 10, packs: 1,  paidPacks: 1 },
    BASE_BUNDLE:    { cost: 5,  packs: 11, paidPacks: 10 },
    BOOSTED_BUNDLE: { cost: 10, packs: 11, paidPacks: 10 },
  },
};

const comb = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); };

/** All pack compositions (counts per rarity summing to packSize) with exact hypergeometric probability and payout in credits. */
export function compositions(deck, pays, multiplier, packSize = 5) {
  const N = RARITIES.reduce((s, r) => s + deck[r], 0), total = comb(N, packSize), out = [];
  const rec = (i, left, counts, ways) => {
    if (i === RARITIES.length - 1) {
      const r = RARITIES[i]; if (left > deck[r]) return;
      const c = { ...counts, [r]: left }, w = ways * comb(deck[r], left);
      out.push({ counts: c, p: w / total, credits: RARITIES.reduce((s, q) => s + c[q] * pays[q] * (multiplier[c[q]] ?? 0), 0) });
      return;
    }
    const r = RARITIES[i];
    for (let k = 0; k <= Math.min(left, deck[r]); k++) rec(i + 1, left - k, { ...counts, [r]: k }, ways * comb(deck[r], k));
  };
  rec(0, packSize, {}, 1);
  out.sort((a, b) => b.p - a.p);
  let acc = 0; for (const z of out) { z.from = acc; acc += z.p; z.to = acc; } if (out.length) out[out.length - 1].to = 1;
  return out;
}

export function buildRumble(cfg = {}) {
  const C = { ...DEFAULT, ...cfg, pays: { ...DEFAULT.pays, ...(cfg.pays ?? {}) }, multiplier: { ...DEFAULT.multiplier, ...(cfg.multiplier ?? {}) }, buckets: { ...DEFAULT.buckets, ...(cfg.buckets ?? {}) }, betTypes: { ...DEFAULT.betTypes, ...(cfg.betTypes ?? {}) } };
  if (!(C.rtp > 0 && C.rtp < 1)) throw new Error('rtp must be in (0,1)');
  const buckets = {};
  for (const [name, b] of Object.entries(C.buckets)) {
    const zones = compositions(b.deck, C.pays, C.multiplier, C.packSize);
    const mean = zones.reduce((s, z) => s + z.p * z.credits, 0), m2 = zones.reduce((s, z) => s + z.p * z.credits ** 2, 0);
    // per-rarity marginal expectation (the sheet's "Total win" rows)
    const perRarity = Object.fromEntries(RARITIES.map(r => [r, zones.reduce((s, z) => s + z.p * z.counts[r] * C.pays[r] * (C.multiplier[z.counts[r]] ?? 0), 0)]));
    buckets[name] = { name, ...b, zones, meanCredits: mean, sdCredits: Math.sqrt(m2 - mean * mean), rtpAlone: mean / b.cost, perRarity, deckSize: RARITIES.reduce((s, r) => s + b.deck[r], 0) };
  }
  const lo = buckets.low, hi = buckets.high;
  const betTypes = {};
  for (const [t, bt] of Object.entries(C.betTypes)) {
    const effCost = bt.cost * bt.paidPacks / bt.packs;                        // credits paid per pack received
    const pLow = (effCost * C.rtp - hi.meanCredits) / (lo.meanCredits - hi.meanCredits);
    if (!(pLow >= 0 && pLow <= 1)) throw new Error(`${t}: bucket mix ${pLow.toFixed(4)} out of [0,1]; RTP ${C.rtp} unreachable between buckets (${lo.rtpAlone.toFixed(3)} .. ${hi.meanCredits / effCost})`);
    const ev = pLow * lo.meanCredits + (1 - pLow) * hi.meanCredits;           // per pack, credits
    const sd = Math.sqrt(pLow * (lo.sdCredits ** 2 + lo.meanCredits ** 2) + (1 - pLow) * (hi.sdCredits ** 2 + hi.meanCredits ** 2) - ev * ev);
    betTypes[t] = { ...bt, effCost, pLow, pHigh: 1 - pLow, evCreditsPerPack: ev, sdCreditsPerPack: sd, rtp: ev / effCost, sdMultiple: sd * Math.sqrt(bt.packs) / (bt.cost * bt.paidPacks) };
  }

  /** One pack from one uniform: bucket first, composition from the recycled remainder. */
  function drawPack(u, t) {
    const bt = betTypes[t]; if (u >= 1) u = 1 - 1e-15;
    const bucket = u < bt.pLow ? lo : hi; u = bucket === lo ? u / bt.pLow : (u - bt.pLow) / (1 - bt.pLow);
    let z = 0; const Z = bucket.zones; while (z < Z.length - 1 && Z[z].to <= u) z++;
    return { bucket: bucket.name, zone: z, counts: Z[z].counts, credits: Z[z].credits, p: Z[z].p * (bucket === lo ? bt.pLow : 1 - bt.pLow) };
  }
  /** Cosmetic card identities for a composition. */
  function dealCards(counts, rng) {
    const cards = [];
    for (const r of RARITIES) { const ids = new Set(); while (ids.size < counts[r]) ids.add(1 + rng.int(20)); for (const id of [...ids].sort((a, b) => a - b)) cards.push({ rarity: r, id, name: `${r[0]}${String(id).padStart(2, '0')}` }); }
    return cards;
  }
  /** A full bet: `bet` minor units of type `t`; one uniform per pack from `rng`. Returns the RippinRumbleBetResult body. */
  function play({ bet, betType = 'BASE', rng }) {
    const bt = betTypes[betType]; if (!bt) throw new Error(`unknown betType ${betType}`);
    if (!Number.isInteger(bet) || bet <= 0) throw new Error('bet must be a positive integer (minor units)');
    const unit = bet / (bt.cost * bt.paidPacks);                              // minor units per credit
    const cosmetic = rng.derive ? rng.derive('cards') : rng;
    const packs = []; let total = 0;
    for (let k = 0; k < bt.packs; k++) {
      const u = rng.next(), d = drawPack(u, betType);
      const pack = { cards: dealCards(d.counts, cosmetic), totalPayout: 0, _u: u, _bucket: d.bucket };
      for (const r of RARITIES) {
        const c = d.counts[r], vpc = Math.round(C.pays[r] * unit), mult = C.multiplier[c] ?? 0;
        pack[r.toLowerCase()] = { count: c, valuePerCard: vpc, multiplier: mult, totalValue: c * vpc * mult };
        pack.totalPayout += c * vpc * mult;
      }
      total += pack.totalPayout; packs.push(pack);
    }
    return { totalWinAmount: total, cardPacks: packs.map(({ _u, _bucket, ...p }) => p), math: { betType, unit, packs: packs.map(p => ({ u: p._u, bucket: p._bucket })) } };
  }
  function simulate({ betType = 'BASE', rounds = 100000, seed = 'rumble', bet } = {}) {
    const bt = betTypes[betType]; bet ??= bt.cost * bt.paidPacks * 100;
    const rng = new Rng(seed, 'payout'); let tot = 0, sq = 0; const bucketCount = { low: 0, high: 0 };
    for (let i = 0; i < rounds; i++) { const r = play({ bet, betType, rng }); const m = r.totalWinAmount / bet; tot += m; sq += m * m; for (const p of r.math.packs) bucketCount[p.bucket]++; }
    const mean = tot / rounds, sd = Math.sqrt(Math.max(sq / rounds - mean * mean, 0));
    return { betType, rounds, bet, rtp: mean, stdev: sd, se: sd / Math.sqrt(rounds), lowShare: bucketCount.low / (bucketCount.low + bucketCount.high) };
  }
  return { config: C, buckets, betTypes, drawPack, play, simulate,
    toJSON() { return { rtp: C.rtp, pays: C.pays, multiplier: C.multiplier, buckets: Object.fromEntries(Object.entries(buckets).map(([k, b]) => [k, { cost: b.cost, deck: b.deck, meanCredits: b.meanCredits, sdCredits: b.sdCredits, rtpAlone: b.rtpAlone, perRarity: b.perRarity, zones: b.zones.length, top: b.zones.slice(0, 8) }])), betTypes }; } };
}

export function format(R) {
  const pct = x => `${(100 * x).toFixed(3)}%`, L = [];
  for (const b of Object.values(R.buckets)) {
    L.push(`${b.name.toUpperCase()} bucket  cost ${b.cost}  deck L${b.deck.LEGENDARY}/R${b.deck.RARE}/U${b.deck.UNCOMMON}/C${b.deck.COMMON} (${b.deckSize})  avg win ${b.meanCredits.toFixed(4)}  sd ${b.sdCredits.toFixed(4)}  RTP alone ${b.rtpAlone.toFixed(4)}  ${b.zones.length} compositions`);
    L.push('   per rarity E[win]: ' + RARITIES.map(r => `${r} ${b.perRarity[r].toFixed(4)}`).join('  '));
  }
  L.push('', 'bet type        cost packs paid  eff cost   P(low)     P(high)    E/pack     RTP      sd(×stake)');
  for (const [t, bt] of Object.entries(R.betTypes)) L.push(`${t.padEnd(15)} ${String(bt.cost).padStart(4)} ${String(bt.packs).padStart(5)} ${String(bt.paidPacks).padStart(4)}  ${bt.effCost.toFixed(4).padStart(8)}   ${pct(bt.pLow).padStart(8)}   ${pct(bt.pHigh).padStart(8)}   ${bt.evCreditsPerPack.toFixed(4)}   ${bt.rtp.toFixed(4)}   ${bt.sdMultiple.toFixed(3)}`);
  return L.join('\n');
}
