# rgs-math

> The standalone payout engine (sloped bands, three probability methods, LaTeX write-up)
> now lives in [`../payout-engine`](../payout-engine/README.md). This folder keeps the RGS
> contract, the mock server, the table/curve tooling and the example providers.

Math modules that speak the Rollerz RGS provider contract, plus the tooling to prove
their RTP. Zero dependencies, Node 20+.

```bash
npm test          # table arithmetic, contract shapes, RTP (exact + Monte Carlo)
npm run verify    # full RTP report for every game (ROUNDS=500000 for tighter CIs)
npm run serve     # mock RGS on :8790 exposing /api/<game>/{open,valid-bets,bet,next-action,collect}
```

## How the framework fits together

Observed from the SDK Provider Playground (`rollerz-playground-testing.up.railway.app`,
SDK client 0.1.4) by reading the shipped bundles and driving live rounds:

```
game page ──window.RollerzSDK──▶ hidden iframe (test.rollerz.dev/bridge.html)
                                   │  postMessage {type:"API_CALL", endpoint, body}
                                   ▼  fetch(origin + endpoint) with X-Client-Id / X-Session-Id / X-Game-Id
                              Rollerz RGS backend  ──▶  math server (serverUrl, e.g. math-test-nl.reelsoft.net/<game>/mock)
```

Four providers exist today: `go3`, `stepper`, `rippinrumble`, and `gp` (generic). All of
them use the same five routes; `gp` is the one that takes an arbitrary `serverUrl` plus an
`internalClientCode` at `open`, so it is the slot a new math server plugs into. A math
module for this platform is therefore **a function from (bet, betType, RNG) to a round
result**, exposed behind those routes. That is exactly what `defineGame` in
`src/contract.js` produces.

### The contract (what the client actually receives)

Money is always an **integer in minor units** (cents). Displayed with the session's
`currency` block, which on the test environment is `precision: 1` (100000 -> `$999.5`… ie.
the display divides by 100 and keeps one decimal).

| route | request body | response |
|---|---|---|
| `open` | `{sessionId, serverUrl?, internalClientCode?}` | `{sessionId, requestCounter, balance, currency, chipLevels[], minBet, maxBet, defaultBet, playerAlias, seconds, rounds, winLoss, ...}` |
| `valid-bets` | `{betType}` | `{levels: number[]}` |
| `bet` | `{betAmount, betType}` | `{roundId, balance, totalBetAmount, totalWinAmount, nextAction, ...game fields}` |
| `next-action` | `{roundId, actionCode}` | same shape as `bet` (multi-step games) |
| `collect` | `{roundId}` | `{balance}` |

Balance semantics, verified live: the `bet` response shows `balance − bet` with the win
**not** yet credited; `collect` credits `totalWinAmount`. `nextAction` is `["COLLECT"]` for
single-shot games and `["CONTINUE"]` / `["CONTINUE","CASH_OUT"]` / `["COLLECT"]` for the
stepper, which also carries `difficulty, currentStep, currentPayout, steps[], roundEnded`.

Bet types are per provider (`BASE`/`BOOSTED`, `BASE_BUNDLE`, `BEGINNER…INSANE`) and the
client validates the amount against `valid-bets` before it ever calls `bet`. The `gp`
provider's bet types are declared client-side with `configureBetTypes`, and its dev-mode
response shape is `{roundId, balance, totalBetAmount, totalWinAmount, nextAction, math}`,
so `math` is the conventional home for game-specific reveal data.

## Writing a math module

```js
import { defineGame } from '../src/contract.js';
import { makeTable, sampler, toMinor } from '../src/table.js';

const TABLE = makeTable([{ prize: 0, p: 0.6 }, { prize: 1.5, p: 0.3 }, { prize: 5, p: 0.1 }]); // RTP 0.95
const draw = sampler(TABLE);

export const game = defineGame({
  id: 'my-game',
  betTypes: ['BASE'],
  levels: () => [10, 50, 250, 500, 2500],          // minor units
  play({ bet, betType, rng }) {                      // PURE. Same seed => same round.
    const row = TABLE[draw(rng)];
    return { totalWinAmount: toMinor(bet, row.prize), math: { prize: row.prize } };
  },
});
```

Rules the contract enforces for you: bet types and chip levels are validated the same way
the SDK does, `totalWinAmount` must be an integer, sessions and balances live outside
`play()`, and every round is replayable from its seed (`game.simulate({bet, betType, seed})`).
Multi-step games add a `step({round, actionCode, rng})` function and return
`roundEnded: false` plus `state` from `play()`; see `games/ladder.js`.

## The example modules (`games/`)

| module | model | target | how RTP is fixed |
|---|---|---|---|
| `outcome-table.js` | predetermined prize + joint rank draw (RandomSkill manual §3) | 75% | table sums to target by construction |
| `fruit-fusion.js` | prize bands from the Fruit Fusion deck, speed secondary | 95% | `solveZeroRow` computes the No-Win probability |
| `jittered-table.js` | the 75% table with a fixed ±0.03 neighbourhood around every non-zero prize | 75% | symmetric band, mean unchanged |
| `curve-band.js` | whiteboard: step function on the 0–1 draw (5 regions), fixed ±0.05 band | 97% | levels from the ramp's midpoints, Σ Δu·level = 0.97 |
| `ladder.js` | ChickenX-style stepper | 96% | `payout_k = bet·RTP/Πp_i` (strategy-proof); `solveLadderHazards` inverts a given ladder |
| `slingshot.js` | emergent per-hit draw table (contrast case) | 80% at reference skill | `solveScale` by bisection, floor included; `SHARP` bet type shows the drift |

Ladder caveat from `npm run verify`: rounding each rung to whole cents is only RTP-exact when
the chip is large relative to the rung spacing. At a 5-cent chip the rounded BEGINNER ladder
pays anywhere from 88% to 103% depending on where you cash out; from 125 cents up the drift
is under ±0.4%. Pick chip levels (or round the ladder to a coarser grid) with that table open.

`src/table.js` has the arithmetic: `rtp`, `hitRate`, `stdev`, `vi95`, `contributions`,
`solveZeroRow`, `scaleToRtp`, `fromWeights`, and `exactRtpAtBet(table, bet)`, which shows
how much RTP rounding to whole cents costs at each chip size. `src/verify.js` runs Monte
Carlo through the real `simulate()` path and `assertRtp` fails a test if the sample is more
than 3.5 SE from the design number: if that ever fires, the code is wrong, not the table.

## Wiring it up to the real RGS

The playground can't be pointed at localhost: its bridge posts to `test.rollerz.dev`, and
that backend then calls the math server. To exercise a module against the live RGS you need
two things this repo does not contain:

1. The **backend to math-server protocol** (what the RGS sends to `serverUrl` and expects
   back). The session's `serverUrl` values (`…/rockandsmash-v102/mock`,
   `…/chickenx-v117/mock`, `…/rippinrumble-v102/mock`) show the live math servers are
   Reelsoft mocks, so the wire format is Reelsoft's, not the SDK's. Ask the Rollerz team for
   that spec or a sample request/response pair, and add a thin adapter in `server/` that
   maps it onto `game.open/bet/collect`. The math itself does not change.
2. A **publicly reachable URL** for that adapter (Railway, or an ngrok tunnel during dev),
   passed to the playground either as `?server=https://…` or in the GP "Server URL" field
   with a client code.

Until then `npm run serve` gives the exact client-facing shapes locally:

```bash
curl -s localhost:8790/api/fruit-fusion/open -d '{"sessionId":"s1"}' -H 'content-type: application/json'
curl -s localhost:8790/api/fruit-fusion/bet  -d '{"sessionId":"s1","betAmount":100,"betType":"BASE"}' -H 'content-type: application/json'
```

## Payouts in, probabilities out (`src/step-band.js`)

```bash
node scripts/build-step.js --payouts 0,0.5,1,2,5,20 --rtp 0.95                 # maxent (default)
node scripts/build-step.js --payouts 0,0.5,1,2,5,20 --rtp 0.95 --method geometric
node scripts/build-step.js --payouts 0,0.5,1,2,5,20 --rtp 0.95 --method weights --weights 0,50,30,15,4,1
```

`buildFromPayouts({ payouts, rtp, method })` takes the payout multiples and the target RTP and
assigns the probabilities. n payouts, two constraints (Σp = 1, Σp·a = RTP), so n−2 degrees
of freedom, spent by `method`: **maxent** (default) picks `p_i ∝ exp(−λ a_i)` with λ solved
for the RTP, the maximum-entropy distribution, i.e. the assignment that adds nothing beyond
the RTP itself and falls monotonically with payout; **geometric** picks `p_i ∝ qⁱ` over the
payouts sorted ascending with q solved; **weights** takes your relative weights for the
winning payouts and solves the zero payout's probability. RTP must sit strictly inside the
payout range. r is still `0.1 × minimum distance between adjacent distinct non-zero payouts`.

**Interpolation.** `--interp sloped` (default): band i is a straight ramp centred on its
payout, from `aᵢ − r` at the left edge of its interval to `aᵢ + r` at the right edge, so
`A(u) = aᵢ + r·(2t − 1)` with t the position inside the interval. One uniform draw does
everything; `E[A | band i] = aᵢ` exactly, `R = Σ pᵢaᵢ`, the curve is monotone because
`aᵢ + r < aᵢ₊₁ − r`, and inside band i the payout is exactly `Uniform[aᵢ − r, aᵢ + r]`. In JS:
`buildSloped(...)`, `payout(u)`. Also available: `--interp step` (flat level per interval,
plus an independent ±r noise draw) and `--interp linear` (payouts as knots with ramps
between them, `R = Σ Δuᵢ·(aᵢ+aᵢ₊₁)/2`; `buildTrapezoid`). `grid(N)` gives the x = N·u
projection and the integer-grid RTP.

## Intervals in, payout levels out

```bash
node scripts/build-step.js --p 0.3,0.125,0.125,0.25,0.2 --rtp 0.97 --shape 0,1,3,6,9.4 --js
node scripts/build-step.js --p 0.3,0.125,0.125,0.25,0.2 --rtp 0.97 --growth 2
node scripts/build-step.js --p 0.3,0.125,0.125,0.25,0.2 --rtp 0.97 --levels 0,0.25,0.75,1.5,x
```

Inputs are the intervals (a probability vector, Σ p = 1) and the target RTP. Region i occupies
`[p₁+…+pᵢ₋₁, p₁+…+pᵢ)` of the draw, so its probability is exactly pᵢ.

**Degrees of freedom.** n intervals give n payout levels. Σ pᵢaᵢ = RTP removes one and a
no-win interval pins another at 0, leaving n−2 free. Spend them one of three ways:
`--shape` gives the payout ratios and the whole vector is scaled to the RTP; `--growth g`
builds a geometric ladder c, c·g, c·g², … over the paying intervals and solves c;
`--levels` gives explicit multiples with one `x` solved. In every mode the band half-width is
derived, never chosen: `r = 0.1 × minimum distance between adjacent distinct non-zero levels`.
Zero levels pay 0 with no band and the build fails if the lowest band would touch zero.

The result carries `payout(u, v)` (u picks the region, v places the prize in its band), a
`byProbability` listing in decreasing order, `standalone()` for a dependency-free copy of the
exact function, and `toGame({id, chips})` to wrap it as an RGS provider. `--json` prints the
spec; `--js` prints the standalone function.

## The two-layer payout model (`src/curve.js`)

```
U ~ Uniform(0,1)            base draw   (or D = floor(N·U) on an N-value RNG grid)
A = A(U)                    design curve: piecewise-linear through knots (u_i, a_i)
B ~ F(· | A, U)             dispersion rule: adds variance, never changes the mean

constraints   ∫₀¹ A(u) du = Σ Δu_i (a_i + a_{i+1}) / 2 = R*        E[B | U=u] = A(u)
consequence   E[B] = R*,   and for stake S,  E[S·B] = S·R*
```

`A(u)` controls the economics, `F` controls the feel. Each lives in its own object and each
constraint has its own check:

- **`makeCurve(knots)`** owns the first constraint. `rtp()` is the trapezoid sum (exact),
  `solveKnot(i, R*)` sets any one knot height in closed form (RTP is linear in each `a_i`),
  `scaleTo(R*)` rescales all of them. `discretize(curve, N)` gives the N-value RNG version:
  knot `u_i` sits at RNG value `N·u_i`; reading the curve at the cell midpoint reproduces the
  integral exactly when knots fall on cell boundaries, reading at `floor(N·U)/N` biases a
  hair low, and the object reports both.
- **`makeStepCurve({breaks, levels})`** is the step-function form of `A(u)`: one constant
  payout level per draw region, `RTP = Σ Δu_i · level_i`. It is the discrete table laid out
  along the draw axis (`toTable()` returns it as one), with `solveLevel(i, R*)`, `scaleTo`,
  and exact per-chip rounding reports. `stepFromLinear(curve, sub)` turns a sketched ramp
  into a staircase whose RTP equals the ramp's for any subdivision (midpoint rule). This is
  the form to ship: it never intersects zero and reads as a step function.
- **`dispersion.*`** rules own the second constraint. The default is **`fixedGap(anchors)`**:
  one fixed absolute half-width `r = 0.1 · (smallest gap between adjacent distinct non-zero
  payout levels)`, `B = A + ε, ε ~ U(−r, r)` for every non-zero level, and the zero level
  pays exactly 0 with no band. Adjacent bands are separated by at least 0.8 of a gap, and
  the rule throws if the lowest band would reach zero. Also available: `none()`,
  `multiplicativeUniform(r)`, `additiveUniform(r)`. Any object
  `{ name, support(a,u), sample(a,u,rng) }` is a valid rule.
- **`verifyConditionalMean(curve, rule)`** checks `E[B|U=u] = A(u)` numerically on a grid of
  u and flags negative samples. Run it on every custom rule; the tests run it on the
  built-ins and on a two-point rule (pays 0.5A or 1.5A) to show the invariant is all that
  matters.
- **`curve.draw(rule)`** samples one round: layer 1 from the payout stream, layer 2 from an
  independent stream derived from the same seed, so U ⟂ V and both replay from one seed.
  `exactRtpAtBet(bet)` and `exactRtpAtBetBanded(bet, rule)` report the realised RTP after
  rounding to cents, per chip.

The discrete table is the special case of a step-function `A` (see `jitteredDraw` /
`exactRtpAtBetJittered` for the same band logic on a table). Example modules:
`games/curve-band.js` (whiteboard breakpoints 30k/42.5k/55k/80k as a step function with
levels 0/0.25/0.75/1.5/2.35, RTP 0.97, smallest gap 0.5 → r = 0.05) and
`games/jittered-table.js` (the 75% table, prizes 0/0.2/0.5/1.5/4/20/100 → gap 0.3 → r = 0.03,
so 1.5× pays in [1.47, 1.53] and the zero row stays 0).

Rounding: a continuous prize rounded to cents is not bias-free at small chips. Both
constructions report the exact realised RTP per chip (`npm run verify`), so you can see
where the design number and the paid number diverge and pick chip levels accordingly.
