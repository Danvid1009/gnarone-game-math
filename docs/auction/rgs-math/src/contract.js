// The Rollerz RGS provider contract, as observed on the SDK Provider Playground
// (SDK 0.1.4, bridge at test.rollerz.dev, math servers at math-test-nl.reelsoft.net).
//
// A "provider" is one game's math. The RGS backend exposes four routes per provider
// and the client SDK calls them in this order:
//
//   POST /api/<provider>/open        {sessionId, serverUrl?, internalClientCode?}  -> session
//   POST /api/<provider>/valid-bets  {betType}                                     -> {levels: number[]}
//   POST /api/<provider>/bet         {betAmount, betType}                          -> round
//   POST /api/<provider>/next-action {roundId, actionCode}   (multi-step games)    -> round
//   POST /api/<provider>/collect     {roundId}                                     -> {balance}
//
// Money is ALWAYS an integer in minor units (cents). Observed balance semantics:
//   bet response      balance = balance - bet            (win NOT yet credited)
//   next-action       balance unchanged
//   collect           balance = balance + totalWinAmount
//
// Randomness and commitment: every uniform an engine sees comes from HashRng (SHA-256 of seed | stream | k);
// the seed is 128 bits from the platform CSPRNG and stays server-side. The bet response carries
// `seedHash` = sha256('commit|' + seed) so the house is bound before any live money; `seed` is revealed on
// every response once the round has ended, so the round can be recomputed and checked against the hash.
//
// `defineGame` turns a pure `play()` function into an object with those handlers, so a
// math module never touches HTTP, sessions or balances. Keep play() pure in (bet,
// betType, rng) and the round is replayable from its seed.

const randomUUID = () => globalThis.crypto.randomUUID();   // Node ≥ 20 and browsers
import { HashRng, newSeed, commit } from './rng.js';

export const DEFAULT_CURRENCY = {
  code: 'USD', prefix: '$', suffix: '', grouping: ',', decimal: '.', precision: 1, denomination: 1,
};

export const COLLECT = ['COLLECT'];

function assertMinor(n, what) {
  if (!Number.isInteger(n) || n < 0) throw new Error(`${what} must be a non-negative integer in minor units, got ${n}`);
}

/**
 * spec = {
 *   id:              string, used as the provider name in routes
 *   betTypes:        string[]          e.g. ['BASE','BOOSTED'] or ['EASY','MEDIUM','HARD']
 *   defaultBetType?: string            defaults to betTypes[0]
 *   boostedBetType?: string | null
 *   levels:          (betType) => number[]   valid chip sizes in minor units
 *   play:            ({bet, betType, rng, seed, session}) => {
 *                      totalWinAmount: integer minor units (final win for single-shot games)
 *                      nextAction?:    string[]   defaults to ['COLLECT']
 *                      roundEnded?:    boolean    defaults to true
 *                      state?:         any        hidden server-side state for step()
 *                      ...anything else is returned to the client as-is (e.g. `math`)
 *                    }
 *   step?:           ({round, actionCode, rng}) => same shape as play(); only for multi-step games
 *   linked?:         { price: ({round}) => ({ odds: { [betType]: multiple, ... }, ...public }),
 *                      settle: ({round, child}) => integer win }
 *                    enables linkedBet(): extra money placed on a running multi-step round (live bets),
 *                    priced from the round's current state and settled when the round ends
 *   side?:           ({bet, params, rng, seed, session}) => { totalWinAmount, ...public }
 *                    enables sideBet(): an independent single-call bet with free-form params (a side-bet
 *                    library), its own round and collect, unrelated to any running round
 *   currency?, startingBalance?, minBet?, maxBet?, defaultBet?, sessionExtras?
 * }
 */
export function defineGame(spec) {
  const {
    id, betTypes, levels, play, step = null, linked = null, side = null,
    defaultBetType = betTypes?.[0], boostedBetType = null,
    currency = DEFAULT_CURRENCY, startingBalance = 100000,
    minBet, maxBet, defaultBet, sessionExtras = {},
  } = spec;

  if (!id) throw new Error('defineGame: id required');
  if (!Array.isArray(betTypes) || betTypes.length === 0) throw new Error('defineGame: betTypes must be non-empty');
  if (!betTypes.includes(defaultBetType)) throw new Error(`defineGame: defaultBetType "${defaultBetType}" not in betTypes`);
  if (boostedBetType !== null && !betTypes.includes(boostedBetType)) throw new Error(`defineGame: boostedBetType "${boostedBetType}" not in betTypes`);
  if (typeof levels !== 'function') throw new Error('defineGame: levels(betType) function required');
  if (typeof play !== 'function') throw new Error('defineGame: play() function required');
  for (const t of betTypes) {
    const lv = levels(t);
    if (!Array.isArray(lv) || lv.length === 0) throw new Error(`defineGame: levels("${t}") must be non-empty`);
    lv.forEach(v => assertMinor(v, `levels("${t}") entry`));
  }

  const sessions = new Map();
  const rounds = new Map();

  function requireBetType(betType) {
    if (!betTypes.includes(betType)) throw new Error(`invalid betType "${betType}". Allowed: [${betTypes.join(', ')}]`);
    return betType;
  }
  function requireSession(sessionId) {
    const s = sessions.get(sessionId);
    if (!s) throw new Error(`unknown session "${sessionId}". Call open first.`);
    return s;
  }
  function requireRound(roundId) {
    const r = rounds.get(roundId);
    if (!r) throw new Error(`unknown roundId "${roundId}"`);
    return r;
  }
  function splitResult(out, what) {
    if (!out || typeof out !== 'object') throw new Error(`${what}() must return an object`);
    assertMinor(out.totalWinAmount, `${what}().totalWinAmount`);
    const { state, roundEnded, nextAction, totalWinAmount, roundId, ...pub } = out;
    return {
      pub,
      totalWinAmount,
      roundEnded: roundEnded ?? true,
      nextAction: nextAction ?? ((roundEnded ?? true) ? COLLECT : []),
      state: state ?? null,
    };
  }
  function publicRound(round, pub) {
    if (round.linked) return { roundId: round.roundId, parentRoundId: round.parentRoundId, parentSeedHash: round.parentSeedHash, balance: sessions.get(round.sessionId).balance, totalBetAmount: round.totalBetAmount, totalWinAmount: round.totalWinAmount, betType: round.betType, odds: round.odds, placedAtStep: round.placedAtStep, roundEnded: round.ended, nextAction: round.nextAction };
    return {
      roundId: round.roundId,
      seedHash: round.seedHash,
      ...(round.ended ? { seed: round.seed } : {}),
      balance: sessions.get(round.sessionId).balance,
      totalBetAmount: round.totalBetAmount,
      totalWinAmount: round.totalWinAmount,
      ...pub,
      ...(game.isMultiStep ? { roundEnded: round.ended } : {}),
      nextAction: round.nextAction,
    };
  }

  const game = {
    id, betTypes, defaultBetType, boostedBetType, currency, spec,
    isMultiStep: typeof step === 'function',
    hasLinkedBets: !!linked,
    hasSideBets: !!side,

    levels(betType = defaultBetType) { return levels(requireBetType(betType)); },

    open({ sessionId = randomUUID(), balance = startingBalance, ...extra } = {}) {
      let s = sessions.get(sessionId);
      if (!s) {
        assertMinor(balance, 'balance');
        s = { sessionId, balance, requestCounter: 0, rounds: 0, winLoss: 0, openedAt: Date.now() };
        sessions.set(sessionId, s);
      }
      const lv = levels(defaultBetType);
      return {
        sessionId,
        requestCounter: s.requestCounter,
        balance: s.balance,
        currency,
        chipLevels: lv,
        minBet: minBet ?? Math.min(...lv),
        maxBet: maxBet ?? Math.max(...lv),
        defaultBet: defaultBet ?? lv[Math.min(1, lv.length - 1)],
        playerAlias: 'Player',
        seconds: Math.floor((Date.now() - s.openedAt) / 1000),
        rounds: s.rounds,
        winLoss: s.winLoss,
        ...sessionExtras,
        ...extra,
      };
    },

    validBets({ betType = defaultBetType } = {}) {
      return { levels: levels(requireBetType(betType)) };
    },

    bet({ sessionId, betAmount, betType = defaultBetType, seed = newSeed() }) {
      const s = requireSession(sessionId);
      requireBetType(betType);
      assertMinor(betAmount, 'betAmount');
      const lv = levels(betType);
      if (!lv.includes(betAmount)) throw new Error(`Invalid bet amount ${betAmount} for betType ${betType}. Valid bets: ${lv.join(', ')}`);
      if (s.balance < betAmount) throw new Error('insufficient balance');

      const rng = new HashRng(seed, 'payout');
      const r = splitResult(play({ bet: betAmount, betType, rng, seed, session: s }), 'play');

      s.balance -= betAmount;
      s.requestCounter += 1;
      s.rounds += 1;

      const round = {
        roundId: randomUUID(), sessionId, seed, seedHash: commit(seed), betType,
        totalBetAmount: betAmount, totalWinAmount: r.totalWinAmount,
        ended: r.roundEnded, nextAction: r.nextAction, settled: false, state: r.state, steps: 0,
      };
      rounds.set(round.roundId, round);
      return publicRound(round, r.pub);
    },

    nextAction({ roundId, actionCode }) {
      if (!game.isMultiStep) throw new Error(`${id}: next-action not supported (single-shot game)`);
      const round = requireRound(roundId);
      if (round.ended) throw new Error(`round ${roundId} has ended`);
      if (!round.nextAction.includes(actionCode)) throw new Error(`actionCode "${actionCode}" not allowed. Allowed: [${round.nextAction.join(', ')}]`);
      round.steps += 1;
      const rng = new HashRng(round.seed, `step:${round.steps}`);
      const r = splitResult(step({ round: { ...round, state: round.state }, actionCode, rng }), 'step');
      round.totalWinAmount = r.totalWinAmount;
      round.ended = r.roundEnded;
      round.nextAction = r.nextAction;
      round.state = r.state;
      if (round.ended && round.children) for (const cid of round.children) {
        const child = rounds.get(cid);
        child.totalWinAmount = linked.settle({ round, child }); assertMinor(child.totalWinAmount, 'linked.settle()');
        child.ended = true; child.nextAction = COLLECT;
      }
      return publicRound(round, r.pub);
    },

    /** An independent side bet from the provider's library: params are free-form and validated by spec.side. */
    sideBet({ sessionId, betAmount, params = {}, seed = newSeed() }) {
      if (!side) throw new Error(`${id}: side bets not supported`);
      const s = requireSession(sessionId);
      assertMinor(betAmount, 'betAmount');
      const lv = levels(defaultBetType);
      if (!lv.includes(betAmount)) throw new Error(`Invalid bet amount ${betAmount}. Valid bets: ${lv.join(', ')}`);
      if (s.balance < betAmount) throw new Error('insufficient balance');
      const rng = new HashRng(seed, 'side');
      const out = side({ bet: betAmount, params, rng, seed, session: s });
      if (!out || typeof out !== 'object') throw new Error('side() must return an object');
      assertMinor(out.totalWinAmount, 'side().totalWinAmount');
      const { totalWinAmount, ...pub } = out;
      s.balance -= betAmount; s.requestCounter += 1; s.rounds += 1;
      const round = { roundId: randomUUID(), sessionId, seed, seedHash: commit(seed), betType: `SIDE:${params.kind ?? 'side'}`, totalBetAmount: betAmount, totalWinAmount, ended: true, nextAction: COLLECT, settled: false, side: true, params };
      rounds.set(round.roundId, round);
      return { roundId: round.roundId, seedHash: round.seedHash, seed, balance: s.balance, totalBetAmount: betAmount, totalWinAmount, side: params, ...pub, nextAction: COLLECT };
    },

    /** Current prices for extra money on a running round (live bets). Public, no side effects. */
    quote({ roundId }) {
      if (!linked) throw new Error(`${id}: linked bets not supported`);
      const round = requireRound(roundId);
      if (round.linked) throw new Error('quote the parent round, not a linked bet');
      if (round.ended) throw new Error(`round ${roundId} has ended`);
      const q = linked.price({ round });
      return { roundId, step: round.steps, ...q };
    },

    /**
     * Place a linked bet: new money on a running multi-step round, priced from its current state.
     * The bet is its own round (own roundId, own collect) and settles when the parent ends.
     */
    linkedBet({ sessionId, roundId, betAmount, betType }) {
      if (!linked) throw new Error(`${id}: linked bets not supported`);
      const s = requireSession(sessionId);
      const parent = requireRound(roundId);
      if (parent.linked) throw new Error('link to the parent round, not to another linked bet');
      if (parent.sessionId !== sessionId) throw new Error('round belongs to another session');
      if (parent.ended) throw new Error(`round ${roundId} has ended`);
      assertMinor(betAmount, 'betAmount');
      const lv = levels(parent.betType);
      if (!lv.includes(betAmount)) throw new Error(`Invalid bet amount ${betAmount}. Valid bets: ${lv.join(', ')}`);
      if (s.balance < betAmount) throw new Error('insufficient balance');
      const q = linked.price({ round: parent });
      if (!q.odds || !(betType in q.odds)) throw new Error(`invalid linked betType "${betType}". Allowed: [${Object.keys(q.odds ?? {}).join(', ')}]`);
      s.balance -= betAmount; s.requestCounter += 1; s.rounds += 1;
      const child = { roundId: randomUUID(), parentRoundId: roundId, parentSeedHash: parent.seedHash, sessionId, betType, odds: q.odds[betType], placedAtStep: parent.steps,
        totalBetAmount: betAmount, totalWinAmount: 0, ended: false, nextAction: [], settled: false, linked: true };
      rounds.set(child.roundId, child);
      (parent.children ??= []).push(child.roundId);
      return { roundId: child.roundId, parentRoundId: roundId, parentSeedHash: parent.seedHash, balance: s.balance, totalBetAmount: betAmount, totalWinAmount: 0, betType, odds: child.odds, placedAtStep: child.placedAtStep, roundEnded: false, nextAction: [] };
    },

    collect({ roundId }) {
      const round = requireRound(roundId);
      if (!round.ended) throw new Error(`round ${roundId} has not ended; finish the round before collecting`);
      const s = requireSession(round.sessionId);
      if (!round.settled) {
        s.balance += round.totalWinAmount;
        s.winLoss += round.totalWinAmount - round.totalBetAmount;
        round.settled = true;
      }
      return { balance: s.balance };
    },

    /** Server-side view of a round (for audit / replay checks). */
    getRound(roundId) { return rounds.get(roundId) ?? null; },
    getSession(sessionId) { return sessions.get(sessionId) ?? null; },

    /**
     * Pure simulation: runs play() (and, for multi-step games, step() under `policy`)
     * with no session or balance side effects. Used by verify.js and by replay/audit.
     * policy(view, stepIndex) -> actionCode; default: keep taking the first allowed action.
     */
    simulate({ bet, betType = defaultBetType, seed = newSeed(), policy = null }) {
      requireBetType(betType);
      const rng = new HashRng(seed, 'payout');
      let r = splitResult(play({ bet, betType, rng, seed, session: null }), 'play');
      let view = { totalBetAmount: bet, totalWinAmount: r.totalWinAmount, ...r.pub, nextAction: r.nextAction };
      let state = r.state;
      let steps = 0;
      while (!r.roundEnded && game.isMultiStep) {
        steps += 1;
        const actionCode = policy ? policy(view, steps) : r.nextAction[0];
        if (!r.nextAction.includes(actionCode)) throw new Error(`simulate: policy chose "${actionCode}", allowed [${r.nextAction.join(', ')}]`);
        const round = { seed, betType, totalBetAmount: bet, totalWinAmount: r.totalWinAmount, state, steps, nextAction: r.nextAction };
        r = splitResult(step({ round, actionCode, rng: new HashRng(seed, `step:${steps}`) }), 'step');
        state = r.state;
        view = { totalBetAmount: bet, totalWinAmount: r.totalWinAmount, ...r.pub, roundEnded: r.roundEnded, nextAction: r.nextAction };
        if (steps > 10000) throw new Error('simulate: runaway round');
      }
      return { seed, bet, betType, steps, ...view };
    },
  };
  return game;
}
