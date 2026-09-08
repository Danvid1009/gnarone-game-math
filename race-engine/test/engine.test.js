import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRace, eloToStrength } from '../src/engine.js';
import { Rng } from '../src/rng.js';

const RACERS = [1800, 1650, 1600, 1500, 1450, 1300].map((elo, i) => ({ name: 'R' + (i + 1), elo }));
const close = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

test('elo → strength reproduces the Elo expected score', () => {
  const a = eloToStrength(1600), b = eloToStrength(1400);
  assert.ok(close(a / (a + b), 1 / (1 + Math.pow(10, (1400 - 1600) / 400))));
});

test('winner-only: zones partition [0,1), P(win) = w/Σw, odds = rtp/P, rtp exact for every racer', () => {
  const R = buildRace({ racers: RACERS, rtp: 0.95 });
  assert.equal(R.zones.length, 6);
  assert.ok(close(R.zones.reduce((s, z) => s + z.p, 0), 1));
  for (let z = 1; z < R.zones.length; z++) { assert.ok(R.zones[z].p <= R.zones[z - 1].p); assert.ok(close(R.zones[z].from, R.zones[z - 1].to)); }
  R.racers.forEach((r, i) => { assert.ok(close(R.winP[i], r.w / R.W)); assert.ok(close(R.odds[i], 0.95 / R.winP[i])); assert.ok(close(R.rtpOf(i), 0.95)); });
});

test('places: ordered top-3 tuples enumerate to n(n-1)(n-2), sum to 1, place probabilities sum to 1 per place, rtp exact', () => {
  const R = buildRace({ racers: RACERS, rtp: 0.95, places: [0.6, 0.3, 0.1] });
  assert.equal(R.zones.length, 6 * 5 * 4);
  assert.ok(close(R.zones.reduce((s, z) => s + z.p, 0), 1));
  for (let k = 0; k < 3; k++) assert.ok(close(R.racers.reduce((s, _, i) => s + R.placeP[i][k], 0), 1), `place ${k + 1}`);
  R.racers.forEach((_, i) => assert.ok(close(R.rtpOf(i), 0.95)));
  // favourite is most likely to win, but everyone's rtp is the same
  assert.ok(R.winP[0] > R.winP[5] && R.odds[0] < R.odds[5]);
});

test('outcome(u) lands in the right zone and finish() fills the rest with a valid permutation', () => {
  const R = buildRace({ racers: RACERS, rtp: 0.95, places: [0.6, 0.3, 0.1] });
  const rng = new Rng('fin');
  for (let i = 0; i < 2000; i++) {
    const u = rng.next(), o = R.outcome(u), Z = R.zones[o.zone];
    assert.ok(u >= Z.from && u < Z.to);
    const fin = R.finish(u, rng);
    assert.deepEqual(fin.order.slice(0, 3), o.top);
    assert.deepEqual([...fin.order].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5]);
  }
});

test('monte carlo: every racer returns the rtp within 4 SE; zone frequencies match probabilities', () => {
  const R = buildRace({ racers: RACERS, rtp: 0.95, places: [0.6, 0.3, 0.1] });
  for (const racer of [0, 2, 5]) {
    const s = R.simulate({ racer, rounds: 200000, seed: 'mc' + racer });
    assert.ok(Math.abs(s.rtp - 0.95) < 4 * s.se, `racer ${racer}: ${s.rtp} se ${s.se}`);
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(s.placeFreq[k] - R.placeP[racer][k]) < 4 * Math.sqrt(R.placeP[racer][k] * (1 - R.placeP[racer][k]) / s.rounds));
  }
  const s = R.simulate({ racer: 0, rounds: 200000, seed: 'z' });
  R.zones.slice(0, 20).forEach(z => assert.ok(Math.abs(s.zoneFreq[z.zone] - z.p) < 4 * Math.sqrt(z.p * (1 - z.p) / s.rounds)));
});

test('settle pays m·f_k for place k and 0 otherwise; standalone reproduces the zone lookup', () => {
  const R = buildRace({ racers: RACERS, rtp: 0.95, places: [0.6, 0.3, 0.1] });
  const o = { top: [2, 0, 4], t: 0.5 };
  assert.ok(close(R.settle(2, o, 100).multiple, R.odds[2] * 0.6));
  assert.ok(close(R.settle(0, o, 100).multiple, R.odds[0] * 0.3));
  assert.equal(R.settle(1, o, 100).win, 0);
  const fn = new Function(R.standalone('f') + '\nreturn f;')();
  const rng = new Rng('sa');
  for (let i = 0; i < 20000; i++) { const u = rng.next(); const a = fn(u), b = R.outcome(u); assert.equal(a.zone, b.zone); assert.deepEqual(a.top, b.top); }
});

test('play() hook: backs a racer by name, integer win in minor units, replayable from seed', () => {
  const R = buildRace({ racers: RACERS, rtp: 0.95, places: [0.6, 0.3, 0.1] });
  const a = R.play({ bet: 500, betType: 'R3', rng: new Rng('seed-1') }), b = R.play({ bet: 500, betType: 'R3', rng: new Rng('seed-1') });
  assert.deepEqual(a, b); assert.ok(Number.isInteger(a.totalWinAmount)); assert.equal(a.math.order.length, 6);
  assert.throws(() => R.play({ bet: 1, betType: 'nobody', rng: new Rng('x') }), /unknown racer/);
});

test('validation', () => {
  assert.throws(() => buildRace({ racers: RACERS, rtp: 0.95, places: [0.5, 0.3] }), /sum to/);
  assert.throws(() => buildRace({ racers: RACERS.slice(0, 2), rtp: 0.95, places: [0.6, 0.3, 0.1] }), /cannot pay/);
  assert.throws(() => buildRace({ racers: [{ name: 'a', elo: 1500 }], rtp: 0.9 }), /two racers/);
  assert.throws(() => buildRace({ racers: Array.from({ length: 12 }, (_, i) => ({ elo: 1500 + i })), rtp: 0.9, places: [0.5, 0.3, 0.2], maxEnumerate: 1000 }), /exceeds/);
});
