# gnarone-game-math

Payout math for the Rollerz RGS. Live demos: **https://danvid1009.github.io/gnarone-game-math/**

| folder | what | docs |
|---|---|---|
| [`payout-engine/`](payout-engine) | Sloped-band payout: payouts + RTP in, monotone `payout(u)` out. Probability rules maxent / geometric / weights; `r = 0.1 × min payout gap`. Demo: Red Light, Green Light. | [ALGORITHM.md](payout-engine/ALGORITHM.md) |
| [`stepper-engine/`](stepper-engine) | Fair crash ladder: survival to rung k is `RTP / c_k`, so every stopping rule returns the RTP. Demo: Glass Bridge. | [ALGORITHM.md](stepper-engine/ALGORITHM.md) |
| [`rgs-math/`](rgs-math) | The Rollerz provider contract (`defineGame`), a mock RGS server, table/curve tooling, RTP verification, example providers. | [README](rgs-math/README.md) |
| [`docs/`](docs) | The static site GitHub Pages serves: landing page, both demos, the curve-band simulation page, figures. | |

Each engine is zero-dependency Node 20+: `npm test` in any folder. The demos are single
self-contained HTML files (`*/web/index.html`); `docs/` holds copies for Pages, so after editing a
demo run `./sync-docs.sh` to refresh them.

Every round in every engine is one uniform draw fixed at bet time. RTP is exact by summation, never
by simulation; Monte Carlo is used only to check that the sampling code agrees with the arithmetic.
