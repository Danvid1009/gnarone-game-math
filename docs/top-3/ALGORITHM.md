# Elo race from one uniform, with RTP-exact top-3 payouts

$$
\boxed{\ \text{Elo array} + \text{one } U[0,1) \ \rightarrow\ \text{fair race ranking} \ \rightarrow\ \text{top-3 payout}\ }
$$

## 1. Inputs

$n \ge 3$ racers with ratings $E = [E_1,\dots,E_n]$, a target return $R^\ast\in(0,1)$, place terms
$0 < \beta \le \alpha \le 1$ (defaults $\alpha = \tfrac14$ for second, $\beta = \tfrac15$ for third), and exactly
one RNG call $U\sim\mathrm{Uniform}[0,1)$ per race.

## 2. Elo to race weights

$$
\boxed{\ w_i = 10^{(E_i - E_{\max})/400}\ }
$$

Subtracting $E_{\max}$ is for numerical stability only. Pairwise odds are Elo's own:

$$
\Pr(i \text{ beats } j) = \frac{w_i}{w_i+w_j} = \frac{1}{1+10^{(E_j-E_i)/400}} .
$$

## 3. First place from the single draw

Over the remaining racers $S$ (initially all), normalise $p_i = w_i / \sum_{j\in S} w_j$ and partition $[0,1)$
into consecutive intervals of those widths. The interval containing $U$ names the first finisher $i$; call
its interval $[a,\, a+p_i)$.

## 4. Recycle the same draw

$$
\boxed{\ U \leftarrow \frac{U - a}{p_i}\ }
$$

Conditional on $U$ having landed in $[a, a+p_i)$, the rescaled value is again exactly $\mathrm{Uniform}[0,1)$.
Remove racer $i$, renormalise the survivors, repeat. After $n-1$ steps the ranking is complete:

$$
\boxed{\ R = [r_1, r_2, \dots, r_n]\ }
$$

## 5. Distribution of the ranking

$$
\boxed{\ P(R) = \prod_{k=1}^{n-1} \frac{w_{r_k}}{\sum_{j=k}^{n} w_{r_j}}\ }
$$

This is Plackett–Luce exactly. Every ranking owns a sub-interval of the original $[0,1)$ whose length is its
probability, so the procedure is a measure-preserving map, not a simulation heuristic. Floating point:
$U$ carries 53 bits and each step spends about $\log_2(1/p)$ of them, so the paying places are decided by
the high bits and the tail of a large field by the low ones. Payouts are unaffected; a cosmetic caveat
for the deep tail.

## 6. Top-3 probabilities, closed form

With $W = \sum_i w_i$:

$$
\boxed{\ q_{i1} = \frac{w_i}{W}\ }
\qquad
\boxed{\ q_{i2} = \sum_{j\ne i} \frac{w_j}{W}\,\frac{w_i}{W-w_j}\ }
\qquad
\boxed{\ q_{i3} = \sum_{j\ne i}\ \sum_{\substack{k\ne i\\ k\ne j}} \frac{w_j}{W}\,\frac{w_k}{W-w_j}\,\frac{w_i}{W-w_j-w_k}\ }
$$

Checks: $\sum_i q_{i1} = \sum_i q_{i2} = \sum_i q_{i3} = 1$.

## 7. Payout structure (place terms)

Backing racer $i$ with a unit stake returns the stake plus a profit on any podium finish. The win profit is
$P_i$; second and third pay fixed fractions of it, the each-way convention:

$$
\boxed{\ M_{i1} = 1 + P_i,\qquad M_{i2} = 1 + \alpha P_i,\qquad M_{i3} = 1 + \beta P_i,\qquad
q_{i1}M_{i1} + q_{i2}M_{i2} + q_{i3}M_{i3} = R^\ast\ }
$$

Solving for the one free number per racer,

$$
\boxed{\ P_i = \frac{R^\ast - (q_{i1}+q_{i2}+q_{i3})}{q_{i1} + \alpha\, q_{i2} + \beta\, q_{i3}}\ }
$$

Because $\beta \le \alpha \le 1$ and $P_i > 0$, the ordering $M_{i1} > M_{i2} > M_{i3} > 1$ holds automatically:
every place pays more than the stake and nothing has to be special-cased.

## 8. Feasibility

$$
P_i > 0 \iff \boxed{\ q_{i1}+q_{i2}+q_{i3} < R^\ast\ }
$$

independent of $\alpha, \beta$. A field is admissible when no racer's top-3 probability reaches the RTP
($95\%$ here). A field that fails is rejected, naming the racer: a bet that lands on the podium more often
than the RTP cannot be paid a positive profit and still return $R^\ast$.

## 9. Return

$$
\mathbb{E}[\text{payout} \mid \text{back } i] = q_{i1}M_{i1} + q_{i2}M_{i2} + q_{i3}M_{i3} = R^\ast
\quad\text{for every } i,
$$

so over $N$ races $\text{total payout}/\text{total wager} \to R^\ast$ regardless of which racers are backed.
The favourite and the outsider are the same bet at different variance. Stake $S$ in minor units pays
$\operatorname{round}(S\,M_{ik})$, rounded once.

## 10. Reference instance

Twelve racers, Elo $1850, 1780, 1720, 1680, 1640, 1600, 1560, 1520, 1480, 1430, 1380, 1300$;
$R^\ast = 0.95$, $\alpha = \tfrac14$, $\beta = \tfrac15$. Bound $95\%$; the favourite sits at $66.36\%$.

| racer | Elo | $q_{i1}$ | $q_{i2}$ | $q_{i3}$ | $P_i$ | $M_{i1}$ | $M_{i2}$ | $M_{i3}$ | stdev |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1850 | 26.97% | 22.06% | 17.33% | 0.797 | 1.797 | 1.199 | 1.159 | 0.72 |
| 2 | 1780 | 18.02% | 17.44% | 16.12% | 1.695 | 2.695 | 1.424 | 1.339 | 1.02 |
| 3 | 1720 | 12.76% | 13.28% | 13.56% | 2.947 | 3.947 | 1.737 | 1.589 | 1.35 |
| 6 | 1600 | 6.40% | 7.16% | 8.04% | 7.498 | 8.498 | 2.874 | 2.500 | 2.19 |
| 9 | 1480 | 3.21% | 3.70% | 4.32% | 16.777 | 17.777 | 5.194 | 4.355 | 3.32 |
| 12 | 1300 | 1.14% | 1.34% | 1.60% | 50.778 | 51.778 | 13.695 | 11.156 | 5.84 |

Every row returns $0.9500$. Two alternative structures remain available: *fixed-third* ($M_3$ fixed,
$M_2 = M_3 + \theta(M_1 - M_3)$, bound $R^\ast/M_3$) and *fractions* (one scale per racer, shared shape).
