import { test } from 'node:test'; import assert from 'node:assert/strict';
import * as mod from '../src/rgs.js'; import { assertBrowserSafe, assertPresetFixtures, playOnce } from '../../site/rgs-test-helpers.js';
test('rgs module is browser-safe', () => { assertBrowserSafe(new URL('../src/rgs.js', import.meta.url)); });
test('every preset builds, replays fixture round 007 through the live calls, and follows the balance semantics', () => { assertPresetFixtures(mod, {}, new URL('../examples/api/', import.meta.url)); });
test('bid levels cover every reachable amount and every amount factors into one (chip, multiple); a raise chain follows next.bid', () => {
  const g = mod.createGame({ preset: 'storage' }); assert.deepEqual(g.betTypes, ['BID_1', 'BID_2', 'BID_3', 'BID_4', 'BID_5', 'BID_6']);
  assert.deepEqual(g.levels('BID_1').slice(0, 3), [100, 200, 500]); assert.deepEqual(g.levels('BID_2').slice(0, 3), [200, 400, 1000]); assert.deepEqual(g.levels('BID_3').slice(0, 4), [300, 400, 600, 800]);
  for (const preset of Object.keys(mod.PRESETS)) { const h = mod.createGame({ preset }); for (let k = 1; k <= h.engine.N; k++) for (const amt of h.levels(`BID_${k}`)) { const hits = h.engine.reach[k - 1].filter(m => mod.LEVELS.some(c => Math.round(c * m) === amt)); assert.equal(hits.length, 1, `${preset} BID_${k} ${amt} → ${hits}`); } }
  const s = g.open(); let bal = s.balance, bet = 1000, k = 1;
  for (let i = 0; i < 6; i++) { const r = g.bet({ sessionId: s.sessionId, betAmount: bet, betType: `BID_${k}`, seed: `chain${i}` }); assert.equal(r.balance, bal - bet); const c = g.collect({ roundId: r.roundId }); bal = c.balance; assert.equal(bal, r.balance + r.totalWinAmount); if (r.outcome === 'WON' || !r.next) break; bet = r.next.bid; k++; assert.ok(g.levels(`BID_${k}`).includes(bet), 'the next bid is a valid level of the next stage'); }
  playOnce(g, { betType: 'BID_3', betAmount: g.levels('BID_3')[2] });
});
