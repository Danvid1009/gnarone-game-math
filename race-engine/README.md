# race-engine

Elo array + one uniform → fair Plackett–Luce ranking → RTP-exact top-3 payouts. Zero dependencies,
Node 20+. The math is in [ALGORITHM.md](ALGORITHM.md).

```bash
npm test
node bin/build-race.js --elo 1850,1780,1720,1680,1640,1600,1560,1520,1480,1430,1380,1300 --rtp 0.95
node bin/build-race.js --elo ... --rtp 0.95 --place 0.25 --show 0.2 --js     # place terms (default) + standalone raceOrder(u)
node bin/build-race.js --elo ... --rtp 0.95 --fixed-third 1.4 --theta 0.5    # alternative: fixed third place
node bin/build-race.js --elo ... --rtp 0.95 --fractions 0.6,0.3,0.1          # alternative: purse-split pricing
npm run examples
```

## The model

`w = 10^((elo − elo_max)/400)`. One uniform picks the winner from intervals sized by strength; the
leftover of that same number is rescaled to [0,1) and picks second, and so on: the whole order from one
RNG call, distributed exactly Plackett–Luce. Win, place and show probabilities `q_i1, q_i2, q_i3` are
closed-form. Payouts are place terms: every podium finish returns the stake plus a profit, the win
profit `P` is solved per racer so `q_i1 (1+P) + q_i2 (1+P/4) + q_i3 (1+P/5) = RTP`, and second and third
pay a quarter and a fifth of it. So `M1 > M2 > M3 > 1` always, every racer returns exactly the RTP, and a
field where any racer's top-3 probability reaches the RTP is rejected.

## API

```js
import { buildRace } from './src/engine.js';
const R = buildRace({ racers: [{ name, elo }, ...], rtp: 0.95 });                         // place-terms default
const R = buildRace({ racers, rtp, structure: { kind: 'place-terms', place: 1/4, show: 1/5 } });
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

`web/index.html`: twelve lanes, editable Elos, RTP and the two place fractions; back a racer; one
recycled uniform runs the race; the podium zones list shows where the number landed. Infeasible fields
are refused with the offending racer named.

`scripts/sim-place-terms.js` runs 200,000 races with a unit stake on every racer and writes the data
behind `examples/sim-place-terms.png`.
