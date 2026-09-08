# Stepper crash ladder

A fair ladder: the player climbs rungs one at a time, may cash out after any rung, and a
single random number drawn at bet time decides where the ladder breaks. The survival
probabilities are chosen so that stopping at **any** rung has the same expected return, which
makes the RTP independent of player strategy.

## 1. Inputs

$$
R \in (0,1), \qquad M > 1, \qquad N \in \mathbb{N}
$$

- $R$: target return to player (the workbook uses $0.97$).
- $M$: maximum win as a multiple of the stake (10, 25, 100 for easy, medium, hard).
- $N$: number of rungs (10).

## 2. Returns per rung

$$
m = M^{1/N}, \qquad c_k = \operatorname{round}_2\!\left(m^{k}\right), \quad k = 1,\dots,N ,
$$

so $c_N = M$ and each rung multiplies the previous by $m$ (before rounding to two decimals).
Any strictly increasing $c_1<\cdots<c_N$ with $c_1 > R$ may be substituted.

## 3. Survival

The probability of surviving to at least rung $k$ is defined by

$$
\boxed{\; G_0 = 1, \qquad G_k = \frac{R}{c_k}, \quad k = 1,\dots,N \;}
$$

so that

$$
G_k \, c_k = R \qquad \text{for every } k .
$$

Because the $c_k$ are rounded before $G_k$ is computed, the identity holds exactly for the
rounded ladder, not just for $m^k$.

The per-rung hazard follows:

$$
h_k = \Pr(\text{survive rung } k \mid \text{reached rung } k) = \frac{G_k}{G_{k-1}} =
\begin{cases} R / c_1, & k = 1,\\[4pt] c_{k-1} / c_k, & k \ge 2. \end{cases}
$$

## 4. Event probabilities

Let $K$ be the number of rungs survived, $K \in \{0,1,\dots,N\}$.

$$
\Pr(K = 0) = 1 - \frac{R}{c_1} \qquad\text{(instant crash)}
$$

$$
\Pr(K = k) = G_k - G_{k+1} = \frac{R}{c_k} - \frac{R}{c_{k+1}}, \qquad 1 \le k \le N-1 \qquad\text{(crash after rung } k\text{)}
$$

$$
\Pr(K = N) = G_N = \frac{R}{c_N} = \frac{R}{M} \qquad\text{(golden egg)}
$$

These telescope: $\sum_{k=0}^{N} \Pr(K=k) = 1 - G_1 + (G_1 - G_N) + G_N = 1$.

## 5. The single random number

Cumulative sums place the events side by side on $[0,1)$:

$$
e_0 = 0, \qquad e_{k+1} = e_k + \Pr(K = k), \qquad K(u) = k \iff u \in [\,e_k,\ e_{k+1}) .
$$

One draw $U \sim \mathrm{Uniform}[0,1)$ fixes $K$ at bet time. On a 10 000-value RNG the
same intervals sit at $[\,10000\,e_k,\ 10000\,e_{k+1})$. The round then reveals $K$ rung by
rung: rung $k$ shows SAFE if $k \le K$ and CRASH if $k = K+1$.

## 6. Payout

If the player stops after rung $s \ge 1$ (or reaches $s = N$):

$$
\boxed{\; B(K, s) = \begin{cases} c_s, & s \le K,\\ 0, & s > K. \end{cases} \;}
$$

## 7. Strategy-proofness

For the fixed rule "stop after rung $s$":

$$
\mathbb{E}[B] = \Pr(K \ge s)\, c_s = G_s\, c_s = R .
$$

Continuing from rung $s$ to $s+1$ has expected value $h_{s+1}\, c_{s+1} = \dfrac{c_s}{c_{s+1}}\, c_{s+1} = c_s$,
exactly what is already held, so every decision is EV-neutral and every stopping rule, fixed
or adaptive, returns $R$. Volatility, not return, is what the player chooses.

## 8. Money

Stake $S$ in minor units; the ladder shown to the client is $\operatorname{round}(S\,c_k)$ per
rung and the win is that rounded figure. Rounding drift is visible only at chip sizes small
relative to the rung spacing.

## 9. Reference instance (RTP 0.97, N = 10)

| | easy ($M=10$) | medium ($M=25$) | hard ($M=100$) |
|---|---|---|---|
| step multiple $m$ | 1.2589 | 1.3797 | 1.5849 |
| $c_1 \ldots c_{10}$ | 1.26, 1.58, 2, 2.51, 3.16, 3.98, 5.01, 6.31, 7.94, 10 | 1.38, 1.9, 2.63, 3.62, 5, 6.9, 9.52, 13.13, 18.12, 25 | 1.58, 2.51, 3.98, 6.31, 10, 15.85, 25.12, 39.81, 63.1, 100 |
| $\Pr(K=0)$ instant crash | 0.2302 | 0.2971 | 0.3861 |
| $\Pr(K=1)$ | 0.1559 | 0.1924 | 0.2275 |
| $\Pr(K=10)$ golden egg | 0.0970 | 0.0388 | 0.0097 |

Every column satisfies $G_k c_k = 0.97$ at all ten rungs and $\sum_k \Pr(K=k) = 1$.
