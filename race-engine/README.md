# race-engine

Elo array + one uniform → fair Plackett–Luce ranking → RTP-exact top-3 payouts. Zero dependencies,
Node 20+. The math is in [ALGORITHM.md](ALGORITHM.md).

```bash
npm test
node bin/build-race.js --elo 1850,1780,1720,1680,1640,1600,1560,1520,1480,1430,1380,1300 --rtp 0.95
node bin/build-race.js --elo ... --rtp 0.95 --m3 1.4 --theta 0.5 --js        # standalone raceOrder(u)
node bin/build-race.js --elo ... --rtp 0.95 --fractions 0.6,0.3,0.1          # alternative purse-split pricing
npm run examples
```

## The model

`w = 10^((elo − elo_max)/400)`. One uniform picks the winner from intervals sized by strength; the
leftover of that same number is rescaled to [0,1) and picks second, and so on: the whole order from one
RNG call, distributed exactly Plackett–Luce. Win, place and show probabilities `q_i1, q_i2, q_i3` are
closed-form. Third pays a fixed `M3` (1.4), second sits `θ` (0.5) of the way from third to first, first
is solved so `q_i1 M_i1 + q_i2 M_i2 + q_i3 M_i3 = RTP` for every racer. A field where any racer's
top-3 probability reaches `RTP / M3` is rejected.

## API

```js
import { buildRace } from './src/engine.js';
const R = buildRace({ racers: [{ name, elo }, ...], rtp: 0.95 });                         // fixed-third default
const R = buildRace({ racers, rtp, structure: { kind: 'fixed-third', m3: 1.4, theta: 0.5 } });
R.q1, R.q2, R.q3, R.top3, R.M, R.ev, R.feasibleBound
R.finish(u)                       // { order, top, zone, path }  — full ranking from one uniform
R.zones() / R.zonesByProbability()// n(n−1)(n−2) nested podium intervals
R.settle(i, fin, stake)           // { place, multiple, win }
R.simulate({ rounds, seed })      // per-racer Monte Carlo, unit stake on every racer
R.play({ bet, betType: 'Ace', rng })   // RGS hook
R.standalone()                    // dependency-free raceOrder(u)
```

## Frontend

`web/index.html`: twelve lanes, editable Elos, RTP, M₃ and θ; back a racer; one recycled uniform
runs the race; the podium zones list shows where the number landed. Infeasible fields are refused
with the offending racer named.

`scripts/sim-fixed-third.js` is the experiment behind the reference table (200,000 races, unit stake
on every racer).
