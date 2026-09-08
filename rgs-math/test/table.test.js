import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTable, fromWeights, rtp, hitRate, solveZeroRow, scaleToRtp, sampler, exactRtpAtBet, toMinor } from '../src/table.js';
import { Rng } from '../src/rng.js';

test('makeTable rejects probabilities that do not sum to 1', () => {
  assert.throws(() => makeTable([{ prize: 1, p: 0.5 }, { prize: 0, p: 0.4 }]), /sum to/);
});

test('rtp is exact by summation', () => {
  const t = makeTable([{ prize: 0, p: 0.5 }, { prize: 1, p: 0.3 }, { prize: 2, p: 0.2 }]);
  assert.ok(Math.abs(rtp(t) - 0.7) < 1e-12);
  assert.ok(Math.abs(hitRate(t) - 0.5) < 1e-12);
});

test('solveZeroRow lands the target exactly', () => {
  const t = solveZeroRow([{ prize: 1, weight: 6 }, { prize: 2, weight: 3 }, { prize: 5, weight: 1 }], 0.9);
  assert.ok(Math.abs(rtp(t) - 0.9) < 1e-12);
  assert.throws(() => solveZeroRow([{ prize: 0.5, weight: 1 }], 0.9), /must exceed/);
});

test('scaleToRtp preserves probabilities and hits target', () => {
  const t = fromWeights([{ prize: 1, weight: 1 }, { prize: 3, weight: 1 }]);
  const s = scaleToRtp(t, 0.8);
  assert.ok(Math.abs(rtp(s) - 0.8) < 1e-12);
  assert.equal(s[0].p, t[0].p);
});

test('sampler frequencies match probabilities', () => {
  const t = makeTable([{ prize: 0, p: 0.7 }, { prize: 1, p: 0.25 }, { prize: 10, p: 0.05 }]);
  const draw = sampler(t);
  const rng = new Rng('sampler-test');
  const counts = [0, 0, 0];
  const N = 200000;
  for (let i = 0; i < N; i++) counts[draw(rng)]++;
  for (let i = 0; i < 3; i++) {
    const se = Math.sqrt(t[i].p * (1 - t[i].p) / N);
    assert.ok(Math.abs(counts[i] / N - t[i].p) < 4 * se, `row ${i}: ${counts[i] / N} vs ${t[i].p}`);
  }
});

test('rounding to minor units is visible in exactRtpAtBet', () => {
  const t = makeTable([{ prize: 0, p: 0.5 }, { prize: 0.15, p: 0.5 }]);
  assert.equal(toMinor(10, 0.15), 2);              // 1.5 cents rounds to 2
  assert.ok(Math.abs(exactRtpAtBet(t, 10) - 0.1) < 1e-12);    // paid 2 on 10 half the time
  assert.ok(Math.abs(exactRtpAtBet(t, 1000) - 0.075) < 1e-12); // exact at a big chip
});
