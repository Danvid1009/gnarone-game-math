import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRace, eloToStrength } from '../src/engine.js';
import { Rng } from '../src/rng.js';

const ELO = [1850, 1780, 1720, 1680, 1640, 1600, 1560, 1520, 1480, 1430, 1380, 1300];
const RACERS = ELO.map((elo, i) => ({ name: 'R' + (i + 1), elo }));
const close = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

test('elo → strength: pairwise odds are the Elo formula; E_max shift does not change them', () => {
  const a = eloToStrength(1600, 1850), b = eloToStrength(1400, 1850);
  assert.ok(close(a / (a + b), 1 / (1 + Math.pow(10, (1400 - 1600) / 400))));
});

test('closed-form q1, q2, q3 each sum to 1 across racers', () => {
  const R = buildRace({ racers: RACERS, rtp: 0.95 });
  for (const col of [R.q1, R.q2, R.q3]) assert.ok(close(col.reduce((s, x) => s + x, 0), 1));
  assert.ok(close(R.q1[0], R.racers[0].w / R.W));
});

test('place-terms (default): M1 = 1+P, M2 = 1+P/4, M3 = 1+P/5, all > 1, EV = rtp for every racer, bound = rtp', () => {
  const R = buildRace({ racers: RACERS, rtp: 0.95 });
  assert.equal(R.structure.kind, 'place-terms');
  R.M.forEach(([a, b, c], i) => { const P = a - 1; assert.ok(P > 0 && a > b && b > c && c > 1); assert.ok(close(b, 1 + P / 4) && close(c, 1 + P / 5)); assert.ok(close(R.ev[i], 0.95)); });
  assert.ok(close(R.feasibleBound, 0.95));
  assert.ok(close(R.M[0][0], 1.797, 1e-3) && close(R.M[11][0], 51.778, 1e-3));
  const R2 = buildRace({ racers: RACERS, rtp: 0.95, structure: { kind: 'place-terms', place: 1 / 3, show: 1 / 4 } });
  R2.ev.forEach(e => assert.ok(close(e, 0.95))); assert.ok(R2.M[0][1] > R.M[0][1]);
  assert.throws(() => buildRace({ racers: [{ name: 'Goliath', elo: 2300 }, ...RACERS.slice(1)], rtp: 0.95 }), /infeasible field: Goliath/);
  assert.throws(() => buildRace({ racers: RACERS, rtp: 0.95, structure: { kind: 'place-terms', place: 0.2, show: 0.5 } }), /show ≤ place/);
});

test('fixed-third: M1 > M2 > M3 = 1.4, EV = rtp for every racer, θ places M2 between', () => {
  const R = buildRace({ racers: RACERS, rtp: 0.95, structure: { kind: 'fixed-third', m3: 1.4, theta: 0.5 } });
  R.M.forEach(([a, b, c], i) => { assert.ok(a > b && b > c && close(c, 1.4)); assert.ok(close(b, 1.4 + 0.5 * (a - 1.4))); assert.ok(close(R.ev[i], 0.95)); });
  assert.ok(close(R.feasibleBound, 0.95 / 1.4));
});

test('fixed-third: a favourite at or above the bound is rejected with its name', () => {
  const strong = [{ name: 'Goliath', elo: 2100 }, ...RACERS.slice(1)];
  assert.throws(() => buildRace({ racers: strong, rtp: 0.95, structure: { kind: 'fixed-third', m3: 1.4, theta: 0.5 } }), /infeasible field: Goliath/);
});

test('fractions structure still works and is rtp-exact', () => {
  const R = buildRace({ racers: RACERS, rtp: 0.95, structure: { kind: 'fractions', f: [0.6, 0.3, 0.1] } });
  R.ev.forEach(e => assert.ok(close(e, 0.95)));
  assert.ok(close(R.M[0][1] / R.M[0][0], 0.5));
});

test('one recycled uniform produces a valid full ranking whose top-3 lands in the right nested zone', () => {
  const R = buildRace({ racers: RACERS, rtp: 0.95 });
  const Z = R.zones(); assert.equal(Z.length, 12 * 11 * 10); assert.ok(close(Z.reduce((s, z) => s + z.p, 0), 1));
  for (let z = 1; z < Z.length; z++) assert.ok(close(Z[z].from, Z[z - 1].to));
  const rng = new Rng('fin');
  for (let i = 0; i < 3000; i++) {
    const u = rng.next(), fin = R.finish(u);
    assert.deepEqual([...fin.order].sort((a, b) => a - b), [...Array(12).keys()]);
    const zone = Z[fin.zone]; assert.deepEqual(zone.top, fin.top);
    assert.ok(u >= zone.from - 1e-12 && u < zone.to + 1e-12, `u ${u} not in zone [${zone.from}, ${zone.to})`);
  }
  assert.deepEqual(R.finish(0).order[0], 0);            // u = 0 → first interval → racer 0 first
});

test('monte carlo: every racer returns rtp within 4 SE; place frequencies match q', () => {
  const R = buildRace({ racers: RACERS, rtp: 0.95 });
  const S = R.simulate({ rounds: 200000, seed: 'mc' });
  S.forEach((s, i) => {
    assert.ok(Math.abs(s.rtp - 0.95) < 4 * s.se, `racer ${i}: ${s.rtp} se ${s.se}`);
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(s.placeFreq[k] - R.q[i][k]) < 4 * Math.sqrt(R.q[i][k] * (1 - R.q[i][k]) / s.rounds));
  });
});

test('settle, standalone and play()', () => {
  const R = buildRace({ racers: RACERS, rtp: 0.95 });
  const fin = { top: [2, 0, 4] };
  assert.ok(close(R.settle(2, fin, 100).multiple, R.M[2][0])); assert.ok(close(R.settle(0, fin, 100).multiple, R.M[0][1])); assert.equal(R.settle(7, fin, 100).win, 0);
  const fn = new Function(R.standalone('f') + '\nreturn f;')();
  const rng = new Rng('sa');
  for (let i = 0; i < 5000; i++) { const u = rng.next(); assert.deepEqual(fn(u), R.finish(u).order); }
  const a = R.play({ bet: 500, betType: 'R3', rng: new Rng('s') }), b = R.play({ bet: 500, betType: 'R3', rng: new Rng('s') });
  assert.deepEqual(a, b); assert.ok(Number.isInteger(a.totalWinAmount)); assert.equal(a.math.order.length, 12);
});

test('validation', () => {
  assert.throws(() => buildRace({ racers: RACERS.slice(0, 2), rtp: 0.95 }), /three racers/);
  assert.throws(() => buildRace({ racers: RACERS, rtp: 0.95, structure: { kind: 'fixed-third', theta: 1.2 } }), /theta/);
  assert.throws(() => buildRace({ racers: RACERS, rtp: 0.95, structure: { kind: 'fractions', f: [0.5, 0.3] } }), /summing to 1/);
});
