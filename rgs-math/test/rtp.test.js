// The tests that matter: every module's realised RTP agrees with its design number.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rtp } from '../src/table.js';
import { monteCarlo, assertRtp } from '../src/verify.js';
import * as outcome from '../games/outcome-table.js';
import * as fruit from '../games/fruit-fusion.js';
import * as ladder from '../games/ladder.js';
import * as slingshot from '../games/slingshot.js';

const N = Number(process.env.TEST_ROUNDS ?? 60000);

test('outcome-table: design RTP is exactly 75% and MC agrees', () => {
  assert.ok(Math.abs(rtp(outcome.OUTCOME_TABLE) - 0.75) < 1e-12);
  assertRtp(monteCarlo(outcome.game, { bet: 2500, rounds: N }), 0.75);
});

test('outcome-table: payout never depends on the base/secondary split', () => {
  for (let i = 0; i < 2000; i++) {
    const r = outcome.game.simulate({ bet: 500, seed: `split-${i}` });
    assert.equal(r.totalWinAmount, Math.round(500 * r.math.prize));
    assert.ok(Math.abs(r.math.baseTarget * r.math.secondary - r.math.prize) < 1e-9);
  }
});

test('fruit-fusion: solved zero row makes the band table exactly 95%', () => {
  assert.ok(Math.abs(rtp(fruit.OUTCOME_TABLE) - 0.95) < 1e-12);
  assertRtp(monteCarlo(fruit.game, { bet: 1000, rounds: N }), 0.95);
  for (let i = 0; i < 500; i++) {
    const r = fruit.game.simulate({ bet: 100, seed: `ff-${i}` });
    const row = fruit.OUTCOME_TABLE.find(x => x.label === r.math.band);
    assert.ok(r.math.scoreTarget >= row.meta.score[0] && r.math.scoreTarget <= row.meta.score[1]);
  }
});

test('ladder: hazards <-> ladder round-trip and every step pays RTP', () => {
  const m = ladder.CHICKENX_MEDIUM_MULTIPLES;
  const p = ladder.solveLadderHazards(m, 0.96);
  assert.ok(p.every(x => x > 0 && x <= 1));
  // cumulative survival × payout = RTP at every rung
  let cum = 1;
  for (let k = 0; k < m.length; k++) { cum *= p[k]; assert.ok(Math.abs(cum * m[k] - 0.96) < 1e-9); }
  const pay = ladder.ladderFromHazards(125, p, 0.96);
  pay.forEach((v, k) => assert.ok(Math.abs(v - m[k] * 125) <= 1));
});

test('ladder: RTP is strategy-proof (MC under three stopping rules)', () => {
  const policies = [
    v => v.currentStep >= 1 ? 'CASH_OUT' : 'CONTINUE',
    v => v.currentStep >= 5 ? 'CASH_OUT' : 'CONTINUE',
    () => 'CONTINUE',
  ];
  for (const betType of ['BEGINNER', 'MEDIUM', 'INSANE']) {
    for (const policy of policies) {
      assertRtp(monteCarlo(ladder.game, { betType, bet: 5000, rounds: N, policy }), ladder.TARGET_RTP, { z: 4 });
    }
  }
});

test('slingshot: SCALE solves the reference player to 80%, sharp player runs hot', () => {
  const ref = monteCarlo(slingshot.game, { betType: 'REFERENCE', bet: 2500, rounds: N });
  assertRtp(ref, 0.80, { z: 4 });
  const sharp = monteCarlo(slingshot.game, { betType: 'SHARP', bet: 2500, rounds: N });
  assertRtp(sharp, slingshot.SHARP_RTP, { z: 4 });
  assert.ok(slingshot.SHARP_RTP > 1.1, `sharp RTP ${slingshot.SHARP_RTP} should exceed 110%`);
});
