import { test } from 'node:test'; import assert from 'node:assert/strict';
import { buildLockerWars } from '../src/engine.js'; import { Rng } from '../src/rng.js';
const close = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

test('every raise returns exactly the rtp by summation: H·ρ + (1 − H)·E[X]; with a full refund the edge lives only in won lockers', () => {
  const A = buildLockerWars({ refund: 0.95 });
  assert.equal(A.N, 6); assert.deepEqual(A.betTypes, ['BID_1', 'BID_2', 'BID_3', 'BID_4', 'BID_5', 'BID_6']);
  for (const s of A.stages) { assert.ok(close(s.rtp, 0.95), `stage ${s.stage}`); assert.ok(close(s.lockerMean, 0.95)); assert.ok(close(s.box.rtp, 0.95)); assert.ok(close(s.box.p.reduce((t, x) => t + x, 0), 1)); }
  // default: full refund, the locker carries the whole edge and its mean rises as rivals thin out
  const F = buildLockerWars(); for (const s of F.stages) { assert.ok(close(s.rtp, 0.95)); assert.ok(close(s.lockerMean, (0.95 - s.outbid) / (1 - s.outbid))); }
  assert.ok(close(F.stages[0].lockerMean, 0.875)); assert.ok(close(F.stages[5].lockerMean, 0.95));
  // bid escalation
  assert.ok(close(A.bidMultiple(1), 1)); assert.ok(close(A.bidMultiple(4), 1.5 ** 3));
});

test('midpoint integration of settle(u, k) over u returns the rtp at every stage; the standalone matches', () => {
  const A = buildLockerWars({ outbid: [0.6, 0.3, 0], locker: { payouts: [0, 0.5, 1, 2, 5, 20] } }); const fn = new Function(A.standalone('f') + '\nreturn f;')();
  for (let k = 1; k <= 3; k++) { const N = 200000; let tot = 0; for (let d = 0; d < N; d++) tot += A.settle((d + 0.5) / N, k); assert.ok(Math.abs(tot / N - 0.95) < 3e-4, `stage ${k}: ${tot / N}`); }
  const rng = new Rng('sa'); for (let i = 0; i < 20000; i++) { const u = rng.next(), k = 1 + (i % 3); assert.ok(close(fn(u, k), A.settle(u, k))); }
});

test('simulate: raise-until-won returns the rtp per unit staked, per stage and overall; outbid frequencies match H', () => {
  for (const cfg of [{}, { refund: 1 }, { outbid: [0.5, 0.35, 0.2, 0], locker: { payouts: [0, 0.5, 1, 2, 5] } }]) {
    const A = buildLockerWars(cfg); const s = A.simulate({ rounds: 100000, seed: 'mc' });
    assert.ok(Math.abs(s.rtp - 0.95) < 0.02, `overall ${s.rtp}`);
    let reach = 1; for (const st of s.perStage) { const n = 100000 * reach; assert.ok(Math.abs(st.rtp - 0.95) < 4 * 3 / Math.sqrt(n) + 1e-9, `stage ${st.stage} ${st.rtp} (n≈${n})`); reach *= A.outbid[st.stage - 1]; }
    // P(won at stage k) = Π_{j<k} H_j · (1 − H_k)
    let alive = 1; for (let k = 1; k <= A.N; k++) { const p = alive * (1 - A.outbid[k - 1]); assert.ok(Math.abs(s.wonAtStage[k] - p) < 4 * Math.sqrt(p * (1 - p) / 100000) + 1e-9, `won at ${k}`); alive *= A.outbid[k - 1]; }
    assert.ok(close(s.wonAtStage[0], 0), 'the last stage always wins');
  }
});

test('play: outcomes, refund and locker fields, next raise, bet types; validation', () => {
  const A = buildLockerWars(); const rng = new Rng('play'); let outbid = 0, won = 0;
  for (let i = 0; i < 2000; i++) { const r = A.play({ bet: 1000, betType: 'BID_2', rng });
    assert.equal(r.stage, 2); assert.deepEqual(r.next, { betType: 'BID_3', bid: 1500 });
    if (r.outcome === 'OUTBID') { outbid++; assert.equal(r.totalWinAmount, 1000); assert.equal(r.refund, 1000); assert.equal(r.locker, null); }
    else { won++; assert.equal(r.refund, 0); assert.ok(r.locker); assert.equal(r.locker.contents, r.totalWinAmount); assert.equal(r.totalWinAmount, Math.round(1000 * r.locker.multiplier)); assert.ok([0, 0.5, 1, 2, 5, 20].includes(r.locker.multiple)); } }
  assert.ok(Math.abs(outbid / 2000 - 0.5) < 0.05);
  const last = A.play({ bet: 1000, betType: 'BID_6', rng }); assert.equal(last.outcome, 'WON'); assert.equal(last.next, null);
  assert.throws(() => A.play({ bet: 1000, betType: 'BID_7', rng }), /BID_1/); assert.throws(() => buildLockerWars({ outbid: [0.96] }), /no value for the locker/); assert.throws(() => buildLockerWars({ growth: 0.5 }), /growth/);
});
