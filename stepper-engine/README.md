# stepper-engine

Fair crash ladder for the Stepper provider. RTP, max win and rung count in; the rung returns,
the survival curve, the single-RN crash table and a round state machine out. Zero dependencies,
Node 20+. The math is in [ALGORITHM.md](ALGORITHM.md); the design is the one in
`stepper crash game ver 2.xlsx`, reproduced to the cent by the tests.

```bash
npm test
node bin/build-ladder.js --rtp 0.97 --max 10 --steps 10          # easy sheet
node bin/build-ladder.js --rtp 0.97 --max 100 --steps 10 --js    # hard sheet + standalone crashStep(u)
node bin/build-ladder.js --rtp 0.96 --returns 1.1,1.25,1.5,2,3,5 # explicit rungs
npm run examples                                                 # rebuilds examples/ (tables, JSON, JS, plots)
```

## The rule

Returns `c_k = round(M^(k/N), 2)`. Survival to rung k is `G_k = RTP / c_k`, so
`G_k · c_k = RTP` at every rung. Event probabilities are the differences of `G`; they sum to 1
and one uniform draw picks the crash point at bet time. Because continuing is EV-neutral at
every rung, **every stopping rule returns the RTP**. The player picks volatility, not return.

## API

```js
import { buildLadder } from './src/engine.js';
const L = buildLadder({ rtp: 0.97, maxWin: 25, steps: 10 });   // or { rtp, returns: [...] }
L.returns, L.survival, L.hazard, L.p, L.cum, L.table              // the workbook columns
L.crashStep(u)                 // rungs survived K (0 = instant crash, N = golden egg)
L.payoutFor(K, stopAt)         // c_stopAt if stopAt <= K else 0
L.rtpOfStrategy(k)             // exact: equals rtp for every k
L.start(u, { bet })            // round: .continue_() / .cashOut() / .view()  in the RGS stepper shape
L.simulate({ rounds, seed, policy })   // policy(k) -> true to cash out after rung k
L.standalone('crashStep')      // dependency-free JS of the crash draw
```

`L.start` produces exactly the fields the live Stepper provider returns: `currentStep`,
`currentPayout`, `steps[{step, payout, outcome}]`, `roundEnded`, `nextAction`
(`CONTINUE` → `CONTINUE, CASH_OUT` → `COLLECT`). Wiring it to `rgs-math/src/contract.js` is a
`play()` that calls `start(rng.next(), {bet})` and a `step()` that forwards the action.

## Layout

```
src/engine.js        buildLadder, format
src/rng.js           seeded sfc32
bin/build-ladder.js  CLI: table, --json, --js [name] [--out]
bin/simulate.js      three difficulties × stopping rules → JSON
scripts/plot.py      ladders.png, crash.png, strategies.png
scripts/make-examples.sh
test/engine.test.js  workbook reproduction, telescoping, state machine, MC under 4 rules
examples/            easy/medium/hard .txt .json crash-*.js, sim.json, plots
ALGORITHM.md
```

## Frontend

`web/index.html` is a self-contained demo client in the style of the glass-bridge game: two
panes per rung, tap one to step, cash out any time, ten rungs to the golden egg. It embeds the
same ladder math as `src/engine.js` (RTP 0.97, max win 10 / 25 / 100 for easy / medium / hard),
draws one uniform at bet time to fix the crash rung, and shows the survival odds, the EV of the
next step and the round's draw once it ends. Open the file directly or publish it as-is.
