# Elo race from one uniform, with RTP-exact top-3 payouts

$$
\boxed{\ \text{Elo array} + \text{one } U[0,1) \ \rightarrow\ \text{fair race ranking} \ \rightarrow\ \text{top-3 payout}\ }
$$

## 1. Inputs

$n \ge 3$ racers with ratings $E = [E_1,\dots,E_n]$, a target return $R^\ast\in(0,1)$, a fixed third-place
multiple $M_3$ (default $1.4$), a shape parameter $\theta\in(0,1)$ (default $0.5$), and exactly one RNG call
$U\sim\mathrm{Uniform}[0,1)$ per race.

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

## 7. Payout structure

Backing racer $i$ with a unit stake pays $M_{i1}$ for first, $M_{i2}$ for second, $M_{i3}$ for third, $0$
otherwise, with

$$
\boxed{\ M_{i3} = M_3\ (\text{fixed}),\qquad M_{i2} = M_3 + \theta\,(M_{i1} - M_3),\qquad
q_{i1}M_{i1} + q_{i2}M_{i2} + q_{i3}M_{i3} = R^\ast\ }
$$

Solving,

$$
\boxed{\ M_{i1} = \frac{R^\ast - M_3\bigl(q_{i3} + (1-\theta)\,q_{i2}\bigr)}{q_{i1} + \theta\, q_{i2}}\ }
$$

Second place sits a fixed fraction $\theta$ of the way from third to first, so $M_{i1} > M_{i2} > M_{i3}$
holds whenever $M_{i1} > M_3$.

## 8. Feasibility

$$
M_{i1} > M_3 \iff \boxed{\ R^\ast > M_3\,(q_{i1}+q_{i2}+q_{i3})\ }
$$

independent of $\theta$. A field is admissible when no racer's top-3 probability reaches $R^\ast/M_3$
($67.86\%$ for $R^\ast = 0.95$, $M_3 = 1.4$). A field that fails is rejected, naming the racer: otherwise
winning could not pay more than coming third.

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
$R^\ast = 0.95$, $M_3 = 1.4$, $\theta = 0.5$. Bound $67.86\%$; the favourite sits at $66.36\%$.

| racer | Elo | $q_{i1}$ | $q_{i2}$ | $q_{i3}$ | $M_{i1}$ | $M_{i2}$ | $M_{i3}$ | stdev |
|---|---|---|---|---|---|---|---|---|
| 1 | 1850 | 26.97% | 22.06% | 17.33% | 1.455 | 1.428 | 1.400 | 0.68 |
| 2 | 1780 | 18.02% | 17.44% | 16.12% | 2.252 | 1.826 | 1.400 | 0.95 |
| 3 | 1720 | 12.76% | 13.28% | 13.56% | 3.438 | 2.419 | 1.400 | 1.28 |
| 6 | 1600 | 6.40% | 7.16% | 8.04% | 7.895 | 4.648 | 1.400 | 2.19 |
| 9 | 1480 | 3.21% | 3.70% | 4.32% | 17.085 | 9.243 | 1.400 | 3.42 |
| 12 | 1300 | 1.14% | 1.34% | 1.60% | 50.851 | 26.126 | 1.400 | 6.14 |

Every row returns $0.9500$. Over $200{,}000$ simulated races with a unit stake on every racer, each
racer's realised return was within about one standard error of $0.95$ and the pooled return was $0.9497$.
