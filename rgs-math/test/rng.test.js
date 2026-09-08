import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng, newSeed } from '../src/rng.js';

test('same seed and stream reproduce the sequence', () => {
  const a = new Rng('abc', 'payout'), b = new Rng('abc', 'payout');
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
});

test('different streams from one seed are independent sequences', () => {
  const a = new Rng('abc', 'payout'), b = new Rng('abc', 'shaping');
  let same = 0;
  for (let i = 0; i < 100; i++) if (a.next() === b.next()) same++;
  assert.equal(same, 0);
});

test('uniform in [0,1) with sane mean', () => {
  const r = new Rng(newSeed());
  let s = 0; const N = 100000;
  for (let i = 0; i < N; i++) { const u = r.next(); assert.ok(u >= 0 && u < 1); s += u; }
  assert.ok(Math.abs(s / N - 0.5) < 0.005);
});
