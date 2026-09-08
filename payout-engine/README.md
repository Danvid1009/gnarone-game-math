# payout-engine

Payouts and a target RTP in, a monotone payout function out. Zero dependencies, Node 20+.
The math is in [ALGORITHM.md](ALGORITHM.md).

```bash
npm test                                                                 # 9 tests
node bin/build-payout.js --payouts 0,0.5,1,2,5,20 --rtp 0.95 --js        # table + standalone payout(u)
node bin/build-payout.js --payouts 0,0.5,1,2,5,20 --rtp 0.95 --method geometric --json
node bin/build-payout.js --payouts 0,0.5,1,2,5,20 --rtp 0.95 --method weights --weights 0,50,30,15,4,1
npm run examples                                                         # rebuilds examples/ (JSON, JS, plots)
```

## What it builds

One uniform draw `u` in [0,1). The axis is cut into intervals whose widths are the assigned
probabilities. Inside interval i the payout is a straight ramp centred on that band's payout:

```
B(u) = a_i + r·(2t − 1),    t = position inside interval i
r    = 0.1 × smallest gap between adjacent non-zero payouts
```

so band i pays `a_i − r` at its left edge rising to `a_i + r` at its right edge, the zero band
pays 0, every band's mean is exactly `a_i`, RTP = Σ pᵢaᵢ exactly, the whole curve is monotone,
and inside each band the payout is exactly uniform on `[a_i − r, a_i + r]`.

## Probability methods

n payouts, two constraints (Σp = 1, Σp·a = RTP), n−2 free choices. `--method` decides:

| method | rule | extra input | character |
|---|---|---|---|
| `maxent` (default) | pᵢ ∝ exp(−λaᵢ), λ solved | none | least-assumption; starves the top prize; lowest variance |
| `geometric` | pᵢ ∝ qⁱ, q solved | none | constant ratio between rungs; feeds the top; highest variance |
| `weights` | pᵢ ∝ wᵢ for wins, zero solved | one weight per payout | your hit-frequency shape, loss rate balances the books |

You can also bypass the solver with `--probabilities p1,...,pn`; both constraints are checked.

## API

```js
import { buildPayout } from './src/engine.js';
const e = buildPayout({ payouts: [0, 0.5, 1, 2, 5, 20], rtp: 0.95, method: 'maxent' });
e.payout(u)                 // multiple of the stake
e.p, e.breaks, e.r          // probabilities, interval edges on [0,1), half-width
e.bands, e.byProbability    // per-band table, sorted
e.rtp, e.hitRate, e.stdev   // exact
e.grid(10000)               // boundaries on x = 10000·u and the integer-grid RTP
e.simulate({ rounds, seed })// seeded Monte Carlo with per-band stats
e.standalone('payout')      // dependency-free JS text of the exact function
e.play({ bet, rng })        // RGS hook: stake in minor units → integer win + math block
```

`e.play` slots straight into `rgs-math/src/contract.js` (`defineGame({ ..., play: e.play })`).

## Layout

```
src/engine.js          the engine
src/rng.js             seeded sfc32 with named streams (for simulate / play)
bin/build-payout.js    CLI: table, --json, --js [name] [--out file]
bin/simulate.js        CLI: writes a simulation JSON for the plotter
scripts/plot.py        curves.png + bands.png from a simulation JSON (matplotlib)
scripts/make-examples.sh
test/engine.test.js
examples/              reference instance: maxent/geometric/weights .json, .txt, payout-*.js, sim.json, curves.png, bands.png
ALGORITHM.md           the algorithm in LaTeX
```

## Frontend

`web/index.html` is a self-contained demo client themed as Red Light, Green Light: the field is
the 0–10000 draw axis painted in zones whose widths are the probabilities, the runner sprints to
where the number landed, and the sloped line above the field shows the payout ramp inside each
zone. Payouts, RTP and the probability method are editable in the side panel and rebuild the
field live; the round panel shows the draw, the zone, the position inside it and the exact
multiple paid. Same math as `src/engine.js`, embedded.
