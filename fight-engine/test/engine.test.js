import { test } from 'node:test'; import assert from 'node:assert/strict';
import { buildFight, damageTable } from '../src/engine.js'; import { Rng } from '../src/rng.js';
const close = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

test('damage table: discretised half-normal, sums to 1, mean close to the target, sampler follows cum', () => {
  const d = damageTable(16, 0.5); assert.ok(close(d.p.reduce((s, x) => s + x, 0), 1)); assert.ok(Math.abs(d.mean - 16) < 0.3, `mean ${d.mean}`);
  assert.equal(d.sample(0), 1); assert.equal(d.sample(0.999999), d.k.length);
  for (let i = 0; i < d.cum.length - 1; i++) assert.equal(d.sample(d.cum[i]), i + 1);
});

test('even fighters are exactly 50/50; more power or more HP strictly helps; opening bets return the RTP on both sides', () => {
  const E = buildFight({ A: { power: 1600, hp: 100 }, B: { power: 1600, hp: 100 } }); assert.ok(close(E.pA0, 0.5, 1e-12));
  let last = 0.5; for (const gap of [50, 100, 200, 400]) { const F = buildFight({ A: { power: 1600 + gap, hp: 100 }, B: { power: 1600, hp: 100 } }); assert.ok(F.pA0 > last); last = F.pA0; }
  last = 0.5; for (const hp of [110, 130, 160]) { const F = buildFight({ A: { power: 1600, hp }, B: { power: 1600, hp: 100 } }); assert.ok(F.pA0 > last); last = F.pA0; }
  const F = buildFight({ A: { power: 1700, hp: 70 }, B: { power: 1550, hp: 120 } });
  assert.ok(close(F.pA0 * F.odds.A, 0.95)); assert.ok(close((1 - F.pA0) * F.odds.B, 0.95));
});

test('the win-probability grid is a martingale: V_t(a,b) = E[V_{t+1}] over the next hit, at every alive state', () => {
  const F = buildFight({ A: { power: 1650, hp: 60 }, B: { power: 1580, hp: 80 }, ticks: 12 });
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
  for (const cfg of [{ A: { power: 1600, hp: 100 }, B: { power: 1600, hp: 100 } }, { A: { power: 1700, hp: 100 }, B: { power: 1550, hp: 100 } }, { A: { power: 1700, hp: 70 }, B: { power: 1550, hp: 120 } }]) {
    const F = buildFight(cfg); const s = F.simulate({ rounds: 100000, seed: 'mc', liveAt: 6 });
    assert.ok(Math.abs(s.freqA - F.pA0) < 4 * s.se, `freq ${s.freqA} vs ${F.pA0}`);
    assert.ok(Math.abs(s.rtpA - 0.95) < 4 * s.se * F.odds.A + 1e-9, `rtpA ${s.rtpA}`); assert.ok(Math.abs(s.rtpB - 0.95) < 4 * s.se * F.odds.B + 1e-9, `rtpB ${s.rtpB}`);
    assert.ok(Math.abs(s.live.rtp - 1) < 0.02, `live ${s.live.rtp}`);
  }
});

test('play() is deterministic from the uniform source and every logged pA is the grid value of the logged state', () => {
  const F = buildFight({ A: { power: 1620, hp: 100 }, B: { power: 1600, hp: 90 } });
  const a = F.play(new Rng('det')), b = F.play(new Rng('det')); assert.deepEqual(a, b);
  for (const e of a.log) assert.ok(close(e.pA, F.prob(e.tick, e.hpA, e.hpB), 1e-12));
  assert.ok(a.log.every(e => e.damage > 0)); assert.ok(['KO', 'DECISION'].includes(a.how));
  const last = a.log[a.log.length - 1]; if (a.how === 'KO') assert.ok(last.hpA === 0 || last.hpB === 0); else assert.ok(last.hpA > 0 && last.hpB > 0 && a.ticks === F.ticks);
});

test('round state machine: CONTINUE reveals one tick at a time; the opening bet settles at the opening odds', () => {
  const F = buildFight({ A: { power: 1600, hp: 100 }, B: { power: 1600, hp: 100 } });
  for (const betType of ['A', 'B']) {
    const r = F.start(new Rng('round'), { bet: 1000, betType }); let v = r.view(); assert.equal(v.tick, 0); assert.deepEqual(v.nextAction, ['CONTINUE']); assert.ok(close(v.pA, 0.5));
    let n = 0; while (!v.roundEnded) { v = r.continue_(); n++; assert.equal(v.tick, n); assert.ok(v.last.damage > 0); }
    assert.deepEqual(v.nextAction, ['COLLECT']); assert.equal(v.winner, r._fight.winner);
    assert.equal(v.totalWinAmount, v.winner === betType ? Math.round(1000 * F.odds[betType]) : 0); assert.equal(v.odds.live, null);
    assert.throws(() => r.continue_(), /ended/);
  }
});
