import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defineGame } from '../src/contract.js';
import { game as outcome } from '../games/outcome-table.js';
import { game as ladder } from '../games/ladder.js';

test('open/valid-bets/bet/collect round trip with observed balance semantics', () => {
  const s = outcome.open({ sessionId: 'sess-1', balance: 100000 });
  assert.equal(s.balance, 100000);
  assert.deepEqual(s.chipLevels, outcome.levels());
  assert.equal(s.currency.code, 'USD');
  assert.deepEqual(outcome.validBets({ betType: 'BASE' }), { levels: outcome.levels() });

  const r = outcome.bet({ sessionId: 'sess-1', betAmount: 50, betType: 'BASE', seed: 'fixed' });
  assert.equal(r.totalBetAmount, 50);
  assert.equal(r.balance, 100000 - 50, 'bet response balance excludes the win');
  assert.deepEqual(r.nextAction, ['COLLECT']);
  assert.ok(Number.isInteger(r.totalWinAmount));
  assert.ok(r.math && typeof r.math.prize === 'number');

  const c = outcome.collect({ roundId: r.roundId });
  assert.equal(c.balance, 100000 - 50 + r.totalWinAmount, 'collect credits the win');
  assert.deepEqual(outcome.collect({ roundId: r.roundId }), c, 'collect is idempotent');
});

test('bet validation matches the SDK errors', () => {
  outcome.open({ sessionId: 'sess-2' });
  assert.throws(() => outcome.bet({ sessionId: 'sess-2', betAmount: 33 }), /Invalid bet amount 33/);
  assert.throws(() => outcome.bet({ sessionId: 'sess-2', betAmount: 50, betType: 'NOPE' }), /invalid betType/);
  assert.throws(() => outcome.bet({ sessionId: 'nope', betAmount: 50 }), /unknown session/);
});

test('same seed replays the same round', () => {
  const a = outcome.simulate({ bet: 250, seed: 'replay-me' });
  const b = outcome.simulate({ bet: 250, seed: 'replay-me' });
  assert.deepEqual(a, b);
});

test('multi-step ladder follows the stepper contract', () => {
  ladder.open({ sessionId: 'lad-1', balance: 10000 });
  const r = ladder.bet({ sessionId: 'lad-1', betAmount: 125, betType: 'MEDIUM', seed: 'ladder-seed' });
  assert.equal(r.difficulty, 'MEDIUM');
  assert.equal(r.currentStep, 0);
  assert.equal(r.steps.length, 20);
  assert.ok(r.steps.every(s => s.outcome === 'UNDECIDED'));
  assert.deepEqual(r.nextAction, ['CONTINUE']);
  assert.equal(r.balance, 10000 - 125);
  assert.throws(() => ladder.collect({ roundId: r.roundId }), /not ended/);

  let cur = ladder.nextAction({ roundId: r.roundId, actionCode: 'CONTINUE' });
  assert.equal(cur.currentStep, 1);
  assert.ok(['SAFE', 'CRASH'].includes(cur.steps[0].outcome));
  if (!cur.roundEnded) {
    assert.deepEqual(cur.nextAction, ['CONTINUE', 'CASH_OUT']);
    assert.equal(cur.currentPayout, cur.steps[0].payout);
    cur = ladder.nextAction({ roundId: r.roundId, actionCode: 'CASH_OUT' });
    assert.equal(cur.totalWinAmount, cur.steps[0].payout);
  } else {
    assert.equal(cur.totalWinAmount, 0);
  }
  assert.equal(cur.roundEnded, true);
  assert.equal(r.roundEnded, false);
  assert.deepEqual(cur.nextAction, ['COLLECT']);
  const c = ladder.collect({ roundId: r.roundId });
  assert.equal(c.balance, 10000 - 125 + cur.totalWinAmount);
});

test('defineGame validates its spec', () => {
  assert.throws(() => defineGame({ id: 'x', betTypes: [], levels: () => [1], play: () => ({ totalWinAmount: 0 }) }), /betTypes/);
  assert.throws(() => defineGame({ id: 'x', betTypes: ['A'], defaultBetType: 'B', levels: () => [1], play: () => ({}) }), /defaultBetType/);
  assert.throws(() => defineGame({ id: 'x', betTypes: ['A'], levels: () => [1.5], play: () => ({}) }), /minor units/);
  const g = defineGame({ id: 'x', betTypes: ['A'], levels: () => [10], play: () => ({ totalWinAmount: 2.5 }) });
  g.open({ sessionId: 's' });
  assert.throws(() => g.bet({ sessionId: 's', betAmount: 10 }), /totalWinAmount/);
});

test('linked bets: priced from the running round, settled when it ends, own collect', () => {
  // toy race-to-3: CONTINUE flips a coin; A wins at +3, B at -3. Live price = fair P(A) from the current position.
  const P = (x) => (x + 3) / 6;
  const g = defineGame({
    id: 'toy-fight', betTypes: ['A', 'B'], levels: () => [100, 1000],
    play: ({ rng }) => ({ totalWinAmount: 0, roundEnded: false, nextAction: ['CONTINUE'], state: { x: 0, u: Array.from({ length: 50 }, () => rng.next()) }, x: 0 }),
    step: ({ round }) => { const st = round.state; st.x += st.u[round.steps - 1] < 0.5 ? 1 : -1; const done = Math.abs(st.x) >= 3; return { totalWinAmount: done && st.x > 0 && round.betType === 'A' ? Math.round(round.totalBetAmount * 2) : done && st.x < 0 && round.betType === 'B' ? Math.round(round.totalBetAmount * 2) : 0, roundEnded: done, nextAction: done ? ['COLLECT'] : ['CONTINUE'], state: st, x: st.x }; },
    linked: { price: ({ round }) => ({ odds: { A: 1 / P(round.state.x), B: 1 / (1 - P(round.state.x)) }, pA: P(round.state.x) }),
              settle: ({ round, child }) => ((round.state.x > 0 ? 'A' : 'B') === child.betType ? Math.round(child.totalBetAmount * child.odds) : 0) },
  });
  assert.ok(g.hasLinkedBets);
  const s = g.open();
  let r = g.bet({ sessionId: s.sessionId, betAmount: 100, betType: 'A', seed: 'linked' });
  assert.throws(() => g.linkedBet({ sessionId: s.sessionId, roundId: r.roundId, betAmount: 55, betType: 'A' }), /Valid bets/);
  assert.throws(() => g.linkedBet({ sessionId: s.sessionId, roundId: r.roundId, betAmount: 100, betType: 'C' }), /invalid linked betType/);
  r = g.nextAction({ roundId: r.roundId, actionCode: 'CONTINUE' });
  const q = g.quote({ roundId: r.roundId }); assert.equal(q.step, 1); assert.ok(Math.abs(q.odds.A * q.pA - 1) < 1e-12, 'fair price');
  const live = g.linkedBet({ sessionId: s.sessionId, roundId: r.roundId, betAmount: 1000, betType: 'B' });
  assert.equal(live.parentRoundId, r.roundId); assert.equal(live.balance, 100000 - 100 - 1000); assert.equal(live.odds, q.odds.B); assert.equal(live.placedAtStep, 1); assert.deepEqual(live.nextAction, []);
  assert.throws(() => g.collect({ roundId: live.roundId }), /has not ended/);
  assert.throws(() => g.quote({ roundId: live.roundId }), /parent/);
  while (!r.roundEnded) r = g.nextAction({ roundId: r.roundId, actionCode: 'CONTINUE' });
  const child = g.getRound(live.roundId); assert.equal(child.ended, true); assert.deepEqual(child.nextAction, ['COLLECT']);
  const winner = r.x > 0 ? 'A' : 'B';
  assert.equal(child.totalWinAmount, winner === 'B' ? Math.round(1000 * live.odds) : 0);
  const b1 = g.collect({ roundId: r.roundId }).balance, b2 = g.collect({ roundId: live.roundId }).balance;
  assert.equal(b2, 100000 - 100 - 1000 + r.totalWinAmount + child.totalWinAmount); assert.ok(b2 >= b1);
  assert.throws(() => g.linkedBet({ sessionId: s.sessionId, roundId: r.roundId, betAmount: 100, betType: 'A' }), /has ended/);
  assert.throws(() => g.quote({ roundId: r.roundId }), /has ended/);
});
