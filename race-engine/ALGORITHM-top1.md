# Elo race from one uniform, winner-only payout

The same race as the top-3 engine, $w_i = 10^{(E_i-E_{\max})/400}$ and one uniform $U$ recycled through nested
intervals into the full Plackett–Luce ranking, with only first place paying.

## Payout

$$
\boxed{\ M_{i1} = \frac{R^\ast}{q_{i1}} = \frac{R^\ast\, W}{w_i},\qquad M_{i2} = M_{i3} = 0\ }
$$

Backing racer $i$ returns $q_{i1} M_{i1} = R^\ast$ exactly. There is no feasibility condition: $q_{i1} < 1$
whenever there are at least two racers, so $M_{i1} > R^\ast$ always.

## Properties

- Odds are inversely proportional to strength: a 400-Elo gap is a 10:1 odds ratio.
- Variance when backing $i$ is $R^\ast\,(M_{i1} - R^\ast)$, growing with the odds.
- The full order is still produced and reproducible from the seed; places 2..n are presentation only.

## Reference instance

Twelve racers, Elo $1850 \dots 1300$, $R^\ast = 0.95$: Ace pays $3.52\times$ (27.0% to win), Flint $14.85\times$
(6.4%), Lux $83.4\times$ (1.14%). Every row returns $0.9500$.
