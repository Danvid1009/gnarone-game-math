# race-engine

Elo-rated racers in, exact win and place probabilities, a single-draw outcome zone table and RTP-exact
odds out. Zero dependencies, Node 20+. The math is in [ALGORITHM.md](ALGORITHM.md).

```bash
npm test
node bin/build-race.js --elo 1800,1650,1600,1500,1450,1300 --rtp 0.95                      # winner only
node bin/build-race.js --elo 1800,1650,1600,1500,1450,1300 --rtp 0.95 --places 0.6,0.3,0.1  # 1st/2nd/3rd
npm run examples
```

## The model

Strength `w = 10^(elo/400)` (so pairwise win odds are Elo's own formula). Finishing order is
Plackett–Luce: the next finisher is drawn from those still running with probability proportional to
strength. Every ordered top-K finish has a closed-form probability; the tuples are sorted by
probability and laid out as zones on [0,1), so one uniform picks the paying part of the result.
Backing racer i pays `m_i · f_k` for finishing k-th, with `m_i = RTP / Σ_k f_k P_i(k)`, so every racer
returns exactly the RTP.

## API

```js
import { buildRace } from './src/engine.js';
const R = buildRace({ racers: [{ name: 'Ace', elo: 1800 }, ...], rtp: 0.95, places: [0.6, 0.3, 0.1] });
R.zones, R.placeP, R.winP, R.odds     // the tables
R.outcome(u)                          // { zone, top: [i, j, k], t }
R.finish(u, rng)                      // full order; top-K from u, rest cosmetic
R.settle(i, outcome, stake)           // { place, multiple, win }
R.simulate({ racer, rounds, seed })   // Monte Carlo
R.play({ bet, betType: 'Ace', rng })  // RGS hook: totalWinAmount + math block
R.standalone()                        // dependency-free zone lookup
```

## Frontend

`web/index.html` is the demo: six lanes, editable Elos, back a racer, winner-only or 1/2/3 payouts,
one draw fixes the podium, the rest of the field is filled cosmetically, and the zone table shows
where the number landed.
