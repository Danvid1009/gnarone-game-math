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

test('sha256 known answers; HashRng is deterministic, uniform in [0,1), stream-separated; commit hides the seed', async () => {
  const { sha256Hex, HashRng, commit } = await import('../src/rng.js');
  assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(sha256Hex('The quick brown fox jumps over the lazy dog'), 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592');
  const a = new HashRng('s', 'payout'), b = new HashRng('s', 'payout'), c = new HashRng('s', 'step:1');
  const xs = Array.from({ length: 2000 }, () => a.next()); const ys = Array.from({ length: 2000 }, () => b.next());
  assert.deepEqual(xs, ys); assert.ok(xs.every(u => u >= 0 && u < 1)); assert.notEqual(xs[0], c.next());
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length; assert.ok(Math.abs(mean - 0.5) < 0.03, `mean ${mean}`);
  assert.equal(commit('seed-1').length, 64); assert.notEqual(commit('seed-1'), sha256Hex('seed-1')); assert.notEqual(commit('seed-1'), commit('seed-2'));
});
