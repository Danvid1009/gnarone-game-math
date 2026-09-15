import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRumble, compositions, DEFAULT } from '../src/engine.js';
import { Rng } from '../src/rng.js';
const close = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;
const R = buildRumble();

test('reproduces the workbook: bucket averages, per-rarity rows, mix and RTP per bet type', () => {
  assert.ok(close(R.buckets.low.meanCredits, 3.9887724025655062, 1e-9));
  assert.ok(close(R.buckets.high.meanCredits, 9.9942524464263602, 1e-9));
  assert.ok(close(R.buckets.low.perRarity.LEGENDARY, 1.1379310344827585, 1e-9));
  assert.ok(close(R.buckets.low.perRarity.UNCOMMON, 1.5333529816288436, 1e-9));
  assert.ok(close(R.buckets.high.perRarity.RARE, 2.8245385854081508, 1e-9));
  assert.ok(close(R.betTypes.BASE.pLow, 0.87324450470655313, 1e-9));
  assert.ok(close(R.betTypes.BOOSTED.pLow, 0.082300239583946902, 1e-9));
  assert.ok(close(R.betTypes.BASE_BUNDLE.pLow, 0.94514852880860833, 1e-9));
  assert.ok(close(R.betTypes.BOOSTED_BUNDLE.pLow, 0.22610828778805736, 1e-9));
  for (const bt of Object.values(R.betTypes)) assert.ok(close(bt.rtp, 0.95));
});

test('compositions are a partition: probabilities sum to 1, zones contiguous, hypergeometric counts', () => {
  for (const b of Object.values(R.buckets)) {
    assert.ok(close(b.zones.reduce((s, z) => s + z.p, 0), 1));
    for (let i = 1; i < b.zones.length; i++) assert.ok(close(b.zones[i].from, b.zones[i - 1].to));
    assert.ok(b.zones.every(z => Object.values(z.counts).reduce((s, c) => s + c, 0) === 5));
  }
  // low bucket has only 2 legendaries: no composition with 3+
  assert.ok(R.buckets.low.zones.every(z => z.counts.LEGENDARY <= 2));
  // sheet: P(exactly 2 legendary | low) = 3276/142506
  const p2 = R.buckets.low.zones.filter(z => z.counts.LEGENDARY === 2).reduce((s, z) => s + z.p, 0);
  assert.ok(close(p2, 3276 / 142506, 1e-12));
});

test('play(): result shape matches RippinRumbleBetResult; totalValue = count × valuePerCard × multiplier', () => {
  const r = R.play({ bet: 500, betType: 'BASE', rng: new Rng('s1') });
  assert.equal(r.cardPacks.length, 1); const p = r.cardPacks[0];
  assert.equal(p.cards.length, 5);
  for (const k of ['common', 'uncommon', 'rare', 'legendary']) assert.equal(p[k].totalValue, p[k].count * p[k].valuePerCard * p[k].multiplier);
  assert.equal(p.totalPayout, p.common.totalValue + p.uncommon.totalValue + p.rare.totalValue + p.legendary.totalValue);
  assert.equal(r.totalWinAmount, p.totalPayout);
  assert.equal(R.play({ bet: 5000, betType: 'BASE_BUNDLE', rng: new Rng('b') }).cardPacks.length, 11);
  assert.deepEqual(R.play({ bet: 500, betType: 'BASE', rng: new Rng('s1') }), r, 'replayable');
});

test('monte carlo: every bet type within 4 SE of 0.95; bucket share matches P(low)', () => {
  for (const t of Object.keys(R.betTypes)) {
    const s = R.simulate({ betType: t, rounds: t.includes('BUNDLE') ? 20000 : 150000, seed: 'mc' + t });
    assert.ok(Math.abs(s.rtp - 0.95) < 4 * s.se, `${t}: ${s.rtp} se ${s.se}`);
    assert.ok(Math.abs(s.lowShare - R.betTypes[t].pLow) < 0.01, `${t} low share ${s.lowShare}`);
  }
});

test('rtp outside the bucket range is rejected', () => {
  assert.throws(() => buildRumble({ rtp: 0.3 }), /unreachable/);
});
