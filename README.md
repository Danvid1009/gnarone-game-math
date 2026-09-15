# gnarone-game-math

Payout math for the Rollerz RGS. Live: **https://danvid1009.github.io/gnarone-game-math/** — pages `stepper/`, `single-shot/`, `top-3/`, `top-1/`, `rip-rumble/`, `game-of-three/`, `pick-one/` (old `payout/` and `race/` redirect; the `race/api/` fixtures are mirrored so shared links keep working).

| folder | what | docs |
|---|---|---|
| [`payout-engine/`](payout-engine) | **Single Shot.** Sloped-band payout: payouts + RTP in, monotone `payout(u)` out. Probability rules maxent / geometric / weights; `r = 0.1 × min payout gap`. Demo: Red Light, Green Light. | [ALGORITHM.md](payout-engine/ALGORITHM.md) |
| [`stepper-engine/`](stepper-engine) | **Stepper.** Fair crash ladder: survival to rung k is `RTP / c_k`, so every stopping rule returns the RTP. Demo: Glass Bridge. | [ALGORITHM.md](stepper-engine/ALGORITHM.md) |
| [`race-engine/`](race-engine) | Elo race from one recycled uniform (Plackett–Luce, exact). Two site pages: **Top 3** (place-terms payouts 1 / ¼ / ⅕, RTP-exact per racer) and **Top 1** (winner only, odds = RTP / P(win)). Static fixture API for each. | [ALGORITHM.md](race-engine/ALGORITHM.md) · [ALGORITHM-top1.md](race-engine/ALGORITHM-top1.md) |
| [`rumble-engine/`](rumble-engine) | **Rip & Rumble.** Two-deck 5-card packs (hypergeometric), per-rarity count × pays × multiplier, bucket mix solved per bet type for exact RTP. Reproduces `Math-rippin-rumble-ver4.xlsx`. | [ALGORITHM.md](rumble-engine/ALGORITHM.md) |
| [`smash-engine/`](smash-engine) | **Game of Three** (GO3 / Rock n Smash). 0–3 rocks, gem bonus 2–10×, exact RTP by summation. Reproduces `Rock n Smash.xlsx`. | [ALGORITHM.md](smash-engine/ALGORITHM.md) |
| [`pick-engine/`](pick-engine) | **Pick One.** n-way bet with exact RTP; a hit pays RTP / pᵢ. | [ALGORITHM.md](pick-engine/ALGORITHM.md) |
| [`rgs-math/`](rgs-math) | The Rollerz provider contract (`defineGame`), a mock RGS server, table/curve tooling, RTP verification, example providers. | [README](rgs-math/README.md) |
| [`docs/`](docs) | The static site GitHub Pages serves: one page per engine (demo, typeset algorithm, figures, source). Generated, do not edit by hand. | |
| [`site/`](site) | The site generator: `engines.json` lists the engines, `build.js` renders `docs/`. | |

Each engine is zero-dependency Node 20+: `npm test` in any folder. The demos are single
self-contained HTML files (`*/web/index.html`). `docs/` is generated: after editing a demo, an
ALGORITHM.md or a figure, run `node site/build.js`. To add a new model, give it the same shape
(`web/index.html`, `ALGORITHM.md`, `examples/*.png`), add an entry to `site/engines.json`, rebuild.

Every round in every engine is one uniform draw fixed at bet time. RTP is exact by summation, never
by simulation; Monte Carlo is used only to check that the sampling code agrees with the arithmetic.
