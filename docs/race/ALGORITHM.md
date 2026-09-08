# Plackett–Luce race with RTP-exact odds

Racers carry a rating; the finishing order is random but respects the ratings; the player backs one
racer and is paid on where it finishes. One uniform draw fixes the paying part of the result, and the
return is exact by summation for every racer.

## 1. Inputs

$$
\text{racers } 1..n \text{ with Elo } e_i,\qquad R^\ast\in(0,1),\qquad
\text{place fractions } f_1\ge f_2\ge\cdots\ge f_K\ge 0,\ \ \sum_k f_k = 1,\ \ K\le n .
$$

Winner-only is the special case $K=1$, $f_1 = 1$.

## 2. Rating to strength

$$
w_i = 10^{\,e_i/400}
$$

This is the Elo scale itself: for two racers, $\Pr(i \text{ beats } j) = \dfrac{w_i}{w_i + w_j} = \dfrac{1}{1+10^{(e_j-e_i)/400}}$,
the Elo expected-score formula. A 400-point gap is a 10:1 strength ratio.

## 3. Race model (Plackett–Luce)

With $S$ the set of racers still running,

$$
\Pr(i \text{ finishes next} \mid S) = \frac{w_i}{\sum_{j\in S} w_j}.
$$

The probability of an ordered top-$K$ finish $(i_1, i_2, \dots, i_K)$ is the product

$$
\boxed{\;
P(i_1,\dots,i_K) \;=\; \prod_{k=1}^{K} \frac{w_{i_k}}{\,W - \sum_{m<k} w_{i_m}\,},\qquad W=\sum_{j=1}^{n} w_j .
\;}
$$

Summed over all $n!/(n-K)!$ ordered tuples this is exactly $1$. Equivalently, give racer $i$ the score
$\log w_i + G_i$ with $G_i$ independent standard Gumbel noise and sort descending; the top-$K$ has the
law above. The rest of the order (places $K{+}1..n$) is drawn the same way from a cosmetic stream and
never touches the payout.

## 4. Outcome zones

Sort the tuples by probability, decreasing, and lay them end to end on $[0,1)$:

$$
c_0 = 0,\qquad c_z = \sum_{y\le z} P_y,\qquad Z_z = [\,c_{z-1},\,c_z) .
$$

For $U\sim\mathrm{Uniform}[0,1)$, $\Pr(U\in Z_z) = P_z$ exactly. One draw, one zone, one top-$K$.
With six racers and three paying places there are $120$ zones; with winner-only, $n$.

## 5. Place probabilities

$$
P_i(k) \;=\; \sum_{\text{tuples with } i_k = i} P(i_1,\dots,i_K),\qquad
\sum_{i} P_i(k) = 1 \ \text{ for every } k .
$$

$P_i(1) = w_i / W$ in closed form; higher places are sums over the enumeration.

## 6. Odds

Backing racer $i$ with stake $S$ pays $S\, m_i\, f_k$ if $i$ finishes $k$-th ($k\le K$), else $0$. Set

$$
\boxed{\; m_i \;=\; \frac{R^\ast}{\sum_{k=1}^{K} f_k\, P_i(k)} \;}
$$

Then for every racer

$$
\mathbb{E}[\text{multiple}\mid \text{back } i] \;=\; m_i \sum_k f_k P_i(k) \;=\; R^\ast ,
$$

so the favourite and the outsider return the same $R^\ast$: the player chooses variance, not
expectation. The paid multiple's standard deviation when backing $i$ is
$\sqrt{\sum_k P_i(k)\,(m_i f_k)^2 - {R^\ast}^2}$, which grows with the odds.

## 7. Money

Stake $S$ is an integer in minor units; the win is $\operatorname{round}(S\, m_i f_k)$, rounded once.
An optional fixed neighbourhood on the odds, $m_i \pm r$ with $r$ a fraction of the smallest gap between
distinct odds and the position inside the zone setting where in the band the payout lands, is
mean-preserving exactly as in the payout engine; it is off by default here.

## 8. Procedure

1. $w_i = 10^{e_i/400}$.
2. Enumerate ordered top-$K$ tuples with their product probabilities (§3); sort decreasing; cumulate into zones (§4).
3. Accumulate $P_i(k)$ (§5); set $m_i = R^\ast / \sum_k f_k P_i(k)$ (§6).
4. Per round: draw $u$, find its zone by binary search, read the top-$K$; fill the remaining order from a cosmetic stream; pay the backed racer by its place.

## 9. Reference instance

Six racers at Elo 1800 / 1650 / 1600 / 1500 / 1450 / 1300, $R^\ast = 0.95$, places $0.6 / 0.3 / 0.1$.

| racer | Elo | $P(1)$ | $P(2)$ | $P(3)$ | odds $m_i$ | stdev |
|---|---|---|---|---|---|---|
| Ace | 1800 | 47.50% | 29.19% | 15.29% | 2.449 | 0.54 |
| Bolt | 1650 | 20.03% | 25.41% | 24.56% | 4.299 | 0.95 |
| Cinder | 1600 | 15.02% | 20.17% | 24.03% | 5.440 | 1.14 |
| Dash | 1500 | 8.45% | 12.05% | 16.80% | 9.166 | 1.65 |
| Ember | 1450 | 6.33% | 9.20% | 13.28% | 12.046 | 1.95 |
| Flint | 1300 | 2.67% | 3.99% | 6.05% | 27.920 | 3.14 |

Every row returns $0.9500$ exactly. The most likely finish, Ace › Bolt › Cinder, has probability 8.38%
and owns $[0, 0.0838)$ of the draw.
