# auction-engine

Storage-auction ladder for the Rollerz RGS: the stepper's fair crash ladder with a one-shot
locker reveal when the hammer falls. RTP, top locker value and bid count in; the bid ladder,
the survival curve, the locker table, a single-RN settle function and a round state machine out.
Zero dependencies, Node 20+. The math is in [ALGORITHM.md](ALGORITHM.md).

```bash
npm test
node bin/build-auction.js --rtp 0.95 --max 25 --steps 10             # LARGE locker
node bin/build-auction.js --rtp 0.95 --max 100 --steps 10 --js       # XL + standalone settle(u, s)
node bin/build-auction.js --rtp 0.95 --max 10 --steps 10 --box 0.5,1,2,4   # your own locker multiples (mean 1 solved)
node bin/build-auction.js --rtp 0.95 --max 10 --steps 10 --no-box    # flat locker = the stepper exactly
npm run fixtures                                                     # examples/api/: 100 seeded rounds × 4 sizes
npm run examples                                                     # tables, JSON, JS, fixtures, plots
```

## The rule

Same math as the stepper. Locker value after k successful bids `c_k = round(M^(k/N), 2)`;
survival `G_k = RTP / c_k`, so the first bid carries the whole edge and every later bid is a fair
bet. On the hammer the player receives `c_s · X`, where `X` is a Single Shot draw over the listed
locker multiples (default 0.25 / 0.5 / 1 / 2 / 5) with `E[X] = 1` exactly. `X` is drawn from the
residual of the same uniform that placed the crash, so one RN decides the round and
**every hammer rule returns the RTP**. Being outbid pays 0.

## API

```js
import { buildAuction, buildBox } from './src/engine.js';
const A = buildAuction({ rtp: 0.95, maxWin: 25, steps: 10 });      // or { rtp, returns: [...] }, box: {...} | false
A.bids, A.survival, A.hazard, A.p, A.cum, A.table, A.box            // ladder + locker
A.draw(u)                      // { K, v, X, band }: bids survived, recycled residual, locker multiplier
A.settle(u, s)                 // payout multiple if the hammer falls after s bids
A.rtpOfStrategy(s)             // exact: equals rtp for every s
A.varianceOfStrategy(s)        // exact
A.start(u, { bet })            // round: .bid() / .take() / .view()  (aliases continue_ / cashOut) in the RGS stepper shape
A.simulate({ rounds, seed, policy })   // policy(k) -> true to take the locker after k bids
A.standalone('settle')         // dependency-free JS of settle(u, s)
```

The final view carries `locker: { multiplier, band, contents }` next to the stepper fields
(`currentStep`, `currentPayout`, `steps[]`, `roundEnded`, `nextAction`).

## Static sample API

`examples/api/<size>/` for `small`, `medium`, `large`, `xl`: `field.json` (bids, survival, event
intervals, locker table, settlement rule), `rounds.json` / `rounds/NNN.json` (100 seeded rounds,
each with `bidsSurvived`, the locker multiplier, and the win for every possible hammer point at a
1000-unit stake), `sample-request.json` / `sample-response.json` (round 007 played bet → BID →
BID → CASH_OUT). Published at `https://danvid1009.github.io/gnarone-game-math/auction/api/`.
