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
