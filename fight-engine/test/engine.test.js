import { test } from 'node:test'; import assert from 'node:assert/strict';
import { buildFight, damageTable, eloProbability } from '../src/engine.js'; import { Rng } from '../src/rng.js';
const close = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

test('damage table: discretised half-normal, sums to 1, mean close to the target, sampler follows cum', () => {
  const d = damageTable(16, 0.5); assert.ok(close(d.p.reduce((s, x) => s + x, 0), 1)); assert.ok(Math.abs(d.mean - 16) < 0.3, `mean ${d.mean}`);
  assert.equal(d.sample(0), 1); assert.equal(d.sample(0.999999), d.k.length);
  for (let i = 0; i < d.cum.length - 1; i++) assert.equal(d.sample(d.cum[i]), i + 1);
});

test('Elo prices the fight: P(A) is the Elo formula on power + hp, hit by calibrating the landing rate; the split changes the fight, not the price', () => {
  const E = buildFight({ A: { power: 800, hp: 800 }, B: { power: 800, hp: 800 } }); assert.ok(close(E.pA0, 0.5, 1e-9)); assert.deepEqual(E.elo, { A: 1600, B: 1600 }); assert.deepEqual(E.hp, { A: 100, B: 100 });
  assert.ok(close(eloProbability(1700, 1550), 1 / (1 + Math.pow(10, -150 / 400))));
  for (const [a, b] of [[{ power: 850, hp: 850 }, { power: 775, hp: 775 }], [{ power: 1000, hp: 600 }, { power: 600, hp: 1000 }], [{ power: 600, hp: 1200 }, { power: 900, hp: 700 }], [{ elo: 1650, split: 0.6 }, { elo: 1500 }]]) {
    const F = buildFight({ A: a, B: b }); assert.ok(close(F.pA0, eloProbability(F.elo.A, F.elo.B), 1e-9), `${JSON.stringify([a, b])}: ${F.pA0} vs ${F.calibration.target}`); assert.ok(F.calibration.calibrated && F.calibration.solved);
    assert.ok(close(F.pA0 * F.odds.A, 0.95)); assert.ok(close((1 - F.pA0) * F.odds.B, 0.95)); }
  // same Elo, different split: same price, different fight
  const G = buildFight({ A: { power: 1000, hp: 600 }, B: { power: 600, hp: 1000 } }); assert.ok(close(G.pA0, 0.5, 1e-9)); assert.deepEqual(G.hp, { A: 75, B: 125 }); assert.ok(G.damage.A.mean > 19 && G.damage.B.mean < 13);
  const sG = G.simulate({ rounds: 20000, seed: 'split' }), sE = E.simulate({ rounds: 20000, seed: 'split' }); assert.ok(Math.abs(sG.freqA - 0.5) < 0.02 && Math.abs(sE.freqA - 0.5) < 0.02);
  // more Elo strictly helps, whatever the split
  let last = 0.5; for (const gap of [50, 100, 200, 400]) { const F = buildFight({ A: { power: 800 + gap / 2, hp: 800 + gap / 2 }, B: { power: 800, hp: 800 } }); assert.ok(F.pA0 > last); last = F.pA0; }
  // sugar and validation
  const S = buildFight({ A: { elo: 1600, split: 0.625 }, B: { power: 800, hp: 800 } }); assert.deepEqual(S.fighters.A, { power: 1000, hp: 600, elo: 1600, split: 0.625 });
  const P = buildFight({ A: { power: 800, hp: 800 }, B: { power: 800, hp: 800 }, pLand: 0.6 }); assert.ok(P.pA0 > 0.5 && !P.calibration.solved);
  assert.throws(() => buildFight({ A: { power: 0, hp: 800 }, B: { power: 800, hp: 800 } }), /power > 0/); assert.throws(() => buildFight({ A: { elo: 1600, split: 1 }, B: { power: 800, hp: 800 } }), /split/);
});

test('the win-probability grid is a martingale: V_t(a,b) = E[V_{t+1}] over the next hit, at every alive state', () => {
  const F = buildFight({ A: { power: 900, hp: 500 }, B: { power: 750, hp: 650 }, ticks: 12 });
  const { A: dA, B: dB } = F.damage, pA = F.pLand.A;
  for (let t = 0; t < F.ticks; t++) for (let i = 1; i <= F.cells.A; i += 7) for (let j = 1; j <= F.cells.B; j += 9) {
    let e = 0;
    for (let k = 0; k < dA.p.length; k++) { const jj = j - dA.k[k]; e += pA * dA.p[k] * (jj <= 0 ? 1 : F.prob(t + 1, i * F.res, jj * F.res)); }
    for (let k = 0; k < dB.p.length; k++) { const ii = i - dB.k[k]; e += (1 - pA) * dB.p[k] * (ii <= 0 ? 0 : F.prob(t + 1, ii * F.res, j * F.res)); }
    assert.ok(close(e, F.prob(t, i * F.res, j * F.res), 1e-12), `t=${t} i=${i} j=${j}`);
  }
  // end rule
  assert.ok(close(F.prob(F.ticks, 30, 10), 0.75)); assert.equal(F.prob(5, 10, 0), 1); assert.equal(F.prob(5, 0, 10), 0);
});

test('simulation agrees with the exact grid: win frequency, opening-bet RTP, KO rate, and live bets at fair odds return 1.0', () => {
  for (const cfg of [{ A: { power: 800, hp: 800 }, B: { power: 800, hp: 800 } }, { A: { power: 850, hp: 850 }, B: { power: 775, hp: 775 } }, { A: { power: 1000, hp: 600 }, B: { power: 600, hp: 1000 } }]) {
    const F = buildFight(cfg); const s = F.simulate({ rounds: 100000, seed: 'mc', liveAt: 6 });
    assert.ok(Math.abs(s.freqA - F.pA0) < 4 * s.se, `freq ${s.freqA} vs ${F.pA0}`);
    assert.ok(Math.abs(s.rtpA - 0.95) < 4 * s.se * F.odds.A + 1e-9, `rtpA ${s.rtpA}`); assert.ok(Math.abs(s.rtpB - 0.95) < 4 * s.se * F.odds.B + 1e-9, `rtpB ${s.rtpB}`);
    assert.ok(Math.abs(s.live.rtp - 1) < 0.02, `live ${s.live.rtp}`);
  }
});

test('play() is deterministic from the uniform source and every logged pA is the grid value of the logged state', () => {
  const F = buildFight({ A: { power: 820, hp: 800 }, B: { power: 800, hp: 720 } });
  const a = F.play(new Rng('det')), b = F.play(new Rng('det')); assert.deepEqual(a, b);
  for (const e of a.log) assert.ok(close(e.pA, F.prob(e.tick, e.hpA, e.hpB), 1e-12));
  assert.ok(a.log.every(e => e.damage > 0)); assert.ok(['KO', 'DECISION'].includes(a.how));
  const last = a.log[a.log.length - 1]; if (a.how === 'KO') assert.ok(last.hpA === 0 || last.hpB === 0); else assert.ok(last.hpA > 0 && last.hpB > 0 && a.ticks === F.ticks);
});

test('round state machine: CONTINUE reveals one tick at a time; the opening bet settles at the opening odds', () => {
  const F = buildFight({ A: { power: 800, hp: 800 }, B: { power: 800, hp: 800 } });
  for (const betType of ['A', 'B']) {
    const r = F.start(new Rng('round'), { bet: 1000, betType }); let v = r.view(); assert.equal(v.tick, 0); assert.deepEqual(v.nextAction, ['CONTINUE']); assert.ok(close(v.pA, 0.5));
    let n = 0; while (!v.roundEnded) { v = r.continue_(); n++; assert.equal(v.tick, n); assert.ok(v.last.damage > 0); }
    assert.deepEqual(v.nextAction, ['COLLECT']); assert.equal(v.winner, r._fight.winner);
    assert.equal(v.totalWinAmount, v.winner === betType ? Math.round(1000 * F.odds[betType]) : 0); assert.equal(v.odds.live, null);
    assert.throws(() => r.continue_(), /ended/);
  }
});
