import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSmash } from '../src/engine.js';
import { Rng } from '../src/rng.js';
const close = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;
const S = buildSmash();

test('reproduces Rock n Smash.xlsx: gem mean 3.6667, base RTP 0.97067, boosted RTP 0.9715, per-count returns', () => {
  assert.ok(close(S.gemMean, 3.6666666666666665));
  assert.ok(close(S.modes.BASE.rtp, 0.97066666666666679, 1e-12));
  assert.ok(close(S.modes.BOOSTED.rtp, 0.97150000000000014, 1e-12));
  assert.ok(close(S.modes.BASE.returnByCount[3], 0.45333333333333337, 1e-12));
  assert.ok(close(S.modes.BASE.returnByCount[2], 0.31733333333333336, 1e-12));
  assert.ok(close(S.modes.BOOSTED.returnByCount[3], 0.69000000000000006, 1e-12));
  assert.ok(close(S.modes.BASE.rows.find(r => r.count === 0).p, 0.24));
  assert.ok(close(S.modes.BOOSTED.rows.find(r => r.count === 0).p, 0.12));
});

test('zones partition [0,1); max win is 3 rocks + 10× gem', () => {
  for (const m of Object.values(S.modes)) {
    assert.ok(close(m.zones.reduce((s, z) => s + z.p, 0), 1));
    for (let i = 1; i < m.zones.length; i++) assert.ok(close(m.zones[i].from, m.zones[i - 1].to));
  }
  assert.ok(close(S.modes.BASE.maxMultiple, 50)); assert.ok(close(S.modes.BOOSTED.maxMultiple, 25));
  assert.equal(S.modes.BASE.zones.length, 4 + 2 * 6);
});

test('optional rtp target scales the win column exactly', () => {
  const T = buildSmash({ rtp: 0.95 });
  assert.ok(close(T.modes.BASE.rtp, 0.95) && close(T.modes.BOOSTED.rtp, 0.95));
  assert.ok(close(T.modes.BASE.scale, 0.95 / 0.97066666666666679));
});

test('play(): Go3BetResult fields; replayable; monte carlo within 4 SE', () => {
  const r = S.play({ bet: 200, betType: 'BASE', rng: new Rng('s') });
  assert.ok([0, 1, 2, 3].includes(r.count)); assert.equal(typeof r.hasBonus, 'boolean'); assert.equal(r.totalWinAmount, Math.round(200 * r.multiplier));
  assert.deepEqual(S.play({ bet: 200, betType: 'BASE', rng: new Rng('s') }), r);
  for (const t of ['BASE', 'BOOSTED']) {
    const s = S.simulate({ betType: t, rounds: 200000, seed: 'mc' + t });
    assert.ok(Math.abs(s.rtp - S.modes[t].rtp) < 4 * s.se, `${t}: ${s.rtp} vs ${S.modes[t].rtp}`);
    S.modes[t].rows.forEach(row => assert.ok(Math.abs(s.countFreq[row.count] - row.p) < 4 * Math.sqrt(row.p * (1 - row.p) / s.rounds)));
  }
});
