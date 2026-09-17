# Storage-auction ladder

A stepper with a locker on top. The player bids for a storage locker against rival bidders; each
successful bid raises what the locker is worth; at any point the player can let the hammer fall
and take the locker at its current value; if a rival outbids first, the round is lost. The one
thing that is not a stepper: when the hammer falls the player does not receive the rung value
flat. They open the locker, and its contents are a one-shot draw around that value. Because the
draw has mean exactly 1, every stopping rule still returns the RTP, and one uniform still
decides the whole round.

## 1. Inputs

$$
R \in (0,1), \qquad M > 1, \qquad N \in \mathbb{N}, \qquad
\{a_1 < \dots < a_n\} \subset [0,\infty), \qquad \phi \in (0, \tfrac12)
$$

- $R$: return to player (0.95 here).
- $M$: value of the locker at the top of the ladder, as a multiple of the stake. Four sizes: SMALL 5, MEDIUM 10, LARGE 25, XL 100.
- $N$: number of bids to the top (10).
- $a_1,\dots,a_n$: the listed locker multiples (default $0.25, 0.5, 1, 2, 5$; a $0$ is allowed and means an empty locker).
- $\phi$: band half-width as a fraction of the smallest gap between positive multiples (0.1).

## 2. The ladder (identical to the stepper)

$$
m = M^{1/N}, \qquad c_k = \operatorname{round}_2\!\left(m^{k}\right), \quad k = 1,\dots,N ,
$$

is what the locker is worth after $k$ successful bids. Survival to at least rung $k$:

$$
\boxed{\; G_0 = 1, \qquad G_k = \frac{R}{c_k} \;}
\qquad\Longrightarrow\qquad G_k\, c_k = R \ \text{ for every } k .
$$

The chance that the rivals fold on bid $k$, given the player got there:

$$
h_k = \frac{G_k}{G_{k-1}} = \begin{cases} R / c_1, & k = 1 \quad (\text{the only bid that carries the edge}),\\[4pt] c_{k-1} / c_k, & k \ge 2 \quad (\text{every later bid is a fair bet}). \end{cases}
$$

With $K$ the number of successful bids before a rival wins the locker ($K = N$ means the auction
runs to the top and hammers automatically):

$$
\Pr(K = 0) = 1 - G_1, \qquad \Pr(K = k) = G_k - G_{k+1} \ (1 \le k < N), \qquad \Pr(K = N) = G_N ,
$$

which telescope to 1. Cumulative sums $e_0 = 0,\ e_{k+1} = e_k + \Pr(K = k)$ tile $[0,1)$ and

$$
K(u) = k \iff u \in [\,e_k,\ e_{k+1}) .
$$

## 3. The locker (a Single Shot table with mean 1)

Probabilities $p_1,\dots,p_n$ for the listed multiples solve

$$
\sum_j p_j = 1, \qquad \sum_j p_j\, a_j = 1 ,
$$

by maximum entropy, $p_j \propto e^{-\lambda a_j}$ with $\lambda$ found by bisection (or
$p_j \propto q^{\,j}$, or supplied directly). Cumulative sums $b_0 = 0,\ b_{j} = b_{j-1} + p_j$
tile $[0,1)$ once more. Let

$$
r = \phi \cdot \min_{j}\,(a_{j+1} - a_j) \quad \text{over adjacent positive multiples}, \qquad a_1 - r > 0 \ \text{required when } a_1 > 0 .
$$

The locker multiplier for a residual $v \in [0,1)$ landing in band $j$ is the straight ramp

$$
\boxed{\; X(v) = \begin{cases} a_j + r\,(2t - 1), & a_j > 0,\\ 0, & a_j = 0, \end{cases} \qquad t = \frac{v - b_{j-1}}{b_j - b_{j-1}} \;}
$$

so $\mathbb{E}[X \mid \text{band } j] = a_j$ exactly and

$$
\mathbb{E}[X] = \sum_j p_j\, a_j = 1 .
$$

With the default multiples, $r = 0.1 \times 0.25 = 0.025$ and the maxent probabilities are
$29.76\%,\ 27.12\%,\ 22.52\%,\ 15.52\%,\ 5.09\%$ for $0.25\times,\ 0.5\times,\ 1\times,\ 2\times,\ 5\times$.

## 4. One uniform, recycled

The locker needs its own draw $v$, but the round still uses a single $U \sim \mathrm{Uniform}[0,1)$.
$K$ is read off the interval $U$ falls in, and the leftover position inside that interval is
rescaled:

$$
v = \frac{U - e_K}{e_{K+1} - e_K} .
$$

Conditional on $K$, $v$ is $\mathrm{Uniform}[0,1)$ and independent of $K$, so the locker draw
carries no information about where the rivals would have won, and vice versa. The hammer can
fall at any rung $s \le K$ and the same $v$ is used, which is legitimate because the player's
choice of $s$ depends only on having survived, never on $v$.

## 5. Payout

If the hammer falls after $s \ge 1$ successful bids (or the auction reaches $s = N$):

$$
\boxed{\; B(K, v, s) = \begin{cases} c_s \, X(v), & s \le K,\\ 0, & s > K \quad (\text{outbid first}). \end{cases} \;}
$$

## 6. Strategy-proofness

For the fixed rule "take the locker after $s$ bids", using independence of $K$ and $v$:

$$
\mathbb{E}[B] = \Pr(K \ge s)\; c_s\; \mathbb{E}[X] = G_s\, c_s \cdot 1 = R .
$$

Bidding once more from rung $s$ is worth $h_{s+1}\, c_{s+1}\, \mathbb{E}[X] = c_s$, exactly the
value already held, so every decision is EV-neutral and every stopping rule, fixed or adaptive,
returns $R$. Setting $X \equiv 1$ (a flat locker) recovers the stepper exactly. The locker adds
variance only:

$$
\operatorname{Var}[B] = G_s\, c_s^{2}\, \mathbb{E}[X^2] - R^2, \qquad
\mathbb{E}[X^2] = \sum_j p_j \left(a_j^2 + \tfrac{r^2}{3}\right) .
$$

## 7. Money

Stake $S$ in minor units. The ladder shown to the client is $\operatorname{round}(S\, c_k)$ per
rung (the "locker value"); on the hammer the win is $\operatorname{round}\big(\operatorname{round}(S\, c_s)\, X\big)$.
Being outbid pays 0. The round speaks the RGS stepper shape unchanged: BID is `CONTINUE`, the
hammer is `CASH_OUT`, then `COLLECT`; the reveal adds a `locker { multiplier, band, contents }`
field to the final state.

## 8. Reference instances (RTP 0.95, N = 10, default locker)

| | SMALL ($M=5$) | MEDIUM ($M=10$) | LARGE ($M=25$) | XL ($M=100$) |
|---|---|---|---|---|
| step multiple $m$ | 1.1746 | 1.2589 | 1.3797 | 1.5849 |
| $c_1$ | 1.17 | 1.26 | 1.38 | 1.58 |
| $c_5$ | 2.24 | 3.16 | 5 | 10 |
| $c_{10}$ | 5 | 10 | 25 | 100 |
| $\Pr(K=0)$ outbid on the first bid | 0.1880 | 0.2460 | 0.3116 | 0.3987 |
| $\Pr(K=10)$ hammer at the top | 0.1900 | 0.0950 | 0.0380 | 0.0095 |
| largest single win, $c_{10}(a_n + r)$ | 25.1× | 50.3× | 125.6× | 502.5× |

Every column satisfies $G_k c_k = 0.95$ at all ten rungs, $\sum_k \Pr(K=k) = 1$, and
$\mathbb{E}[X] = 1$, so every hammer rule returns 0.95 exactly.
