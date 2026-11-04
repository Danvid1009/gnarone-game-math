import { test } from 'node:test'; import assert from 'node:assert/strict';
import * as mod from '../src/rgs.js'; import { assertBrowserSafe, assertPresetFixtures, playOnce } from '../../site/rgs-test-helpers.js';
test('rgs module is browser-safe', () => { assertBrowserSafe(new URL('../src/rgs.js', import.meta.url)); });
test('every preset builds, replays fixture round 007 through the live calls, and follows the balance semantics', () => { assertPresetFixtures(mod, {}, new URL('../examples/api/', import.meta.url)); });
test('linked live bets: quoted fair from the current state, settle with the fight, own collect', () => {
  const g = mod.createGame({ preset: 'favourite' }); assert.ok(g.hasLinkedBets && g.isMultiStep);
  let found = 0;
  for (let n = 0; n < 40 && found < 3; n++) {
    const s = g.open(); let r = g.bet({ sessionId: s.sessionId, betAmount: 1000, betType: 'A', seed: `live${n}` });
    for (let k = 0; k < 3 && !r.roundEnded; k++) r = g.nextAction({ roundId: r.roundId, actionCode: 'CONTINUE' });
    if (r.roundEnded) continue; found++;
    const q = g.quote({ roundId: r.roundId }); assert.equal(q.step, 3); assert.ok(Math.abs(q.odds.A * q.pA - 1) < 1e-12); assert.ok(Math.abs(q.odds.B * (1 - q.pA) - 1) < 1e-12);
    assert.ok(Math.abs(q.pA - g.engine.prob(3, r.hp.A, r.hp.B)) < 1e-12, 'quote is the grid value of the public state');
    const live = g.linkedBet({ sessionId: s.sessionId, roundId: r.roundId, betAmount: 500, betType: 'B' }); assert.equal(live.balance, s.balance - 1000 - 500); assert.equal(live.odds, q.odds.B);
    while (!r.roundEnded) r = g.nextAction({ roundId: r.roundId, actionCode: 'CONTINUE' });
    const child = g.getRound(live.roundId); assert.equal(child.ended, true); assert.equal(child.totalWinAmount, r.winner === 'B' ? Math.round(500 * live.odds) : 0);
    g.collect({ roundId: r.roundId }); const b = g.collect({ roundId: live.roundId }).balance;
    assert.equal(b, s.balance - 1500 + r.totalWinAmount + child.totalWinAmount);
    assert.equal(r.totalWinAmount, r.winner === 'A' ? Math.round(1000 * g.engine.odds.A) : 0);
  }
  assert.ok(found >= 1);
  playOnce(g, { betType: 'B' });
});
test('live bets at one tick are capped at 3× the opening stake; the cap resets each tick and quote() reports the room', () => {
  const g = mod.createGame({ preset: 'even' }); assert.equal(g.linkedMaxMultiple, 3);
  let done = false;
  for (let n = 0; n < 40 && !done; n++) {
    const s = g.open({ balance: 1000000 }); let r = g.bet({ sessionId: s.sessionId, betAmount: 1000, betType: 'A', seed: `cap${n}` });
    r = g.nextAction({ roundId: r.roundId, actionCode: 'CONTINUE' }); if (r.roundEnded) continue;
    let q = g.quote({ roundId: r.roundId }); assert.deepEqual(q.cap, { multiple: 3, maxBet: 3000, placed: 0, remaining: 3000 });
    g.linkedBet({ sessionId: s.sessionId, roundId: r.roundId, betAmount: 2500, betType: 'B' });
    q = g.quote({ roundId: r.roundId }); assert.equal(q.cap.placed, 2500); assert.equal(q.cap.remaining, 500);
    assert.throws(() => g.linkedBet({ sessionId: s.sessionId, roundId: r.roundId, betAmount: 1000, betType: 'A' }), /exceeds the per-step cap at step 1: 3000 \(3× the opening stake 1000\), 2500 already placed, 500 remaining/);
    g.linkedBet({ sessionId: s.sessionId, roundId: r.roundId, betAmount: 500, betType: 'A' });
    assert.throws(() => g.linkedBet({ sessionId: s.sessionId, roundId: r.roundId, betAmount: 100, betType: 'A' }), /0 remaining/);
    r = g.nextAction({ roundId: r.roundId, actionCode: 'CONTINUE' }); if (r.roundEnded) continue;
    q = g.quote({ roundId: r.roundId }); assert.equal(q.step, 2); assert.deepEqual(q.cap, { multiple: 3, maxBet: 3000, placed: 0, remaining: 3000 }, 'a new tick opens a fresh 3× window');
    g.linkedBet({ sessionId: s.sessionId, roundId: r.roundId, betAmount: 2500, betType: 'B' });
    assert.equal(g.getSession(s.sessionId).balance, 1000000 - 1000 - 2500 - 500 - 2500);
    done = true;
  }
  assert.ok(done);
  const u = mod.createGame({ preset: 'even', liveCap: null }); assert.equal(u.linkedMaxMultiple, null);
});
test('roster: any two named fighters pair into a calibrated fight priced by the Elo formula', () => {
  const names = Object.keys(mod.ROSTER); assert.ok(names.length >= 6);
  const M = mod.matchupMatrix(); assert.deepEqual(M.names, names);
  for (let i = 0; i < names.length; i++) for (let j = 0; j < names.length; j++) {
    const a = mod.ROSTER[names[i]], b = mod.ROSTER[names[j]];
    assert.ok(Math.abs(M.pA[i][j] - 1 / (1 + 10 ** (((b.power + b.hp) - (a.power + a.hp)) / 400))) < 1e-12);
    assert.ok(Math.abs(M.pA[i][j] + M.pA[j][i] - 1) < 1e-12, 'the matrix is antisymmetric');
  }
  for (let i = 0; i < names.length; i++) for (let j = i; j < names.length; j++) {
    const g = mod.createGame({ A: names[i], B: names[j] }); const F = g.engine;
    assert.equal(g.preset, `${names[i]}-v-${names[j]}`); assert.equal(F.fighters.A.name, names[i]); assert.equal(F.fighters.B.name, names[j]);
    assert.ok(F.calibration.calibrated && F.calibration.solved, `${g.preset} calibrates`);
    assert.ok(Math.abs(F.pA0 - M.pA[i][j]) < 1e-8, `${g.preset}: grid price ${F.pA0} is the matrix entry ${M.pA[i][j]}`);
  }
  const T = mod.rosterTable(); assert.equal(T.length, names.length); assert.deepEqual(T.find(r => r.name === 'brawler'), { name: 'brawler', power: 800, hp: 800, elo: 1600, split: 0.5, health: 100, damage: 16 });
});
test('roster pairing and the equivalent preset settle the same round from the same seed', () => {
  const a = mod.createGame({ A: 'cannon', B: 'tank' }), b = mod.createGame({ preset: 'glass-cannon' });
  for (const g of [a, b]) { const s = g.open(); let r = g.bet({ sessionId: s.sessionId, betAmount: 1000, betType: 'A', seed: 'same' }); while (!r.roundEnded) r = g.nextAction({ roundId: r.roundId, actionCode: 'CONTINUE' }); g._last = r; }
  assert.equal(a._last.winner, b._last.winner); assert.equal(a._last.totalWinAmount, b._last.totalWinAmount); assert.equal(a._last.tick, b._last.tick);
  assert.throws(() => mod.createGame({ A: 'nobody', B: 'tank' }), /unknown fighter "nobody"/);
  const c = mod.createGame({ A: 'champion', B: { power: 700, hp: 700 } }); assert.equal(c.preset, 'champion-v-700/700'); assert.ok(Math.abs(c.engine.pA0 - 1 / (1 + 10 ** ((1400 - 1900) / 400))) < 1e-8);
});
