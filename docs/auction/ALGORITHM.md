# Locker Wars

An ascending auction for a storage locker, played as a sequence of raises. Each raise is its own
bet. If the rivals outbid you, your bid comes back and you may raise again at the next level, or walk.
If the rivals fold, you win the locker and open it: its contents are a one-shot draw whose mean is set
so that every raise returns exactly the RTP. Being outbid costs nothing; the house edge lives only in
won lockers.

## 1. Inputs

$$
R \in (0,1), \qquad \rho \in [0,1], \qquad H_1, \dots, H_N \in [0,1), \qquad \gamma \ge 1, \qquad
\{a_1 < \dots < a_m\} \subset [0,\infty), \qquad \phi \in (0, \tfrac12).
$$

- $R$: return to player (0.95).
- $\rho$: fraction of the bid returned when outbid (1: the bid comes back in full).
- $H_k$: probability that the rivals outbid raise $k$. The last stage has $H_N = 0$: the rivals are gone.
- $\gamma$: bid growth per raise (1.5), so raise $k$ is $b_k = b_1\,\gamma^{k-1}$.
- $a_1 .. a_m$: the locker's listed multiples (e.g. $0, 0.5, 1, 2, 5, 20$; a $0$ is an empty locker).
- $\phi$: band half-width as a fraction of the smallest positive gap (0.1), as in Single Shot.

## 2. One raise

Raise $k$ stakes $b_k$ and draws $U_k \sim \mathrm{Uniform}[0,1)$.

$$
U_k < H_k \ \Rightarrow\ \text{OUTBID: paid } \rho\, b_k, \qquad
U_k \ge H_k \ \Rightarrow\ \text{WON: paid } X_k\, b_k, \quad X_k = \text{locker}_k\!\left(\frac{U_k - H_k}{1 - H_k}\right).
$$

The residual $(U_k - H_k)/(1 - H_k)$ is uniform on $[0,1)$ conditional on winning, so one uniform
decides both the outcome and the locker.

## 3. The locker at stage $k$

$\text{locker}_k$ is a Single Shot table on the listed multiples: probabilities $p_{k,j}$ solved
(maximum entropy) so that

$$
\sum_j p_{k,j} = 1, \qquad \sum_j p_{k,j}\, a_j = \mu_k, \qquad
\boxed{\;\mu_k = \frac{R - H_k\,\rho}{1 - H_k}\;}
$$

with the sloped-band ramp $a_j + r\,(2t - 1)$ inside band $j$, $r = \phi \cdot \min(a_{j+1} - a_j)$,
so $\mathbb{E}[X_k \mid \text{band } j] = a_j$ exactly and $\mathbb{E}[X_k] = \mu_k$ exactly.

With $\rho = 1$ the locker mean rises as the rivals thin out: for $H = 0.6, 0.5, 0.4, 0.3, 0.2, 0$
it is $0.875, 0.90, 0.917, 0.929, 0.9375, 0.95$. A raise that is rarely outbid pays a richer locker,
because less of its return is coming back as refunds.

## 4. Every raise returns $R$

$$
\mathbb{E}[\text{return of raise } k] = H_k\,\rho + (1 - H_k)\,\mu_k = R .
$$

Raises are independent bets, so any policy (raise once, raise to the end, walk after any outbid)
returns exactly $R$ per unit staked. There is no survival schedule to tune and nothing to game by
timing. The probability of winning the locker at stage $k$ is $(1 - H_k)\prod_{j<k} H_j$, and the
last stage wins with certainty.

## 5. Money

Opening bid $b_1$ is a chip level $S$. Raise $k$ is $\operatorname{round}(S\,\gamma^{k-1})$ and is the bet
type's own level list (BID\_k offers $\operatorname{round}(c\,\gamma^{k-1})$ for every chip $c$). An outbid
pays $\operatorname{round}(\rho\,b_k)$; a won locker pays $\operatorname{round}(X_k\,b_k)$.

## 6. Wire shape

Single-call. `bet` with `betType: BID_k` returns `outcome` (OUTBID or WON), `totalWinAmount` (the
refund or the locker contents), `locker { multiplier, band, multiple, contents }` on a win, and
`next { betType, bid }`, the raise the client offers next. Each raise is collected on its own. The
client chains raises with the `next` field; the engine needs no state between them.

## 7. Reference instances (RTP 0.95, full refund)

| preset | stages $H_k$ | growth | locker multiples | locker means $\mu_k$ |
|---|---|---|---|---|
| street | 0.5, 0.35, 0.2, 0 | 1.5 | 0, 0.5, 1, 2, 5 | 0.90, 0.923, 0.9375, 0.95 |
| storage | 0.6, 0.5, 0.4, 0.3, 0.2, 0 | 1.5 | 0, 0.5, 1, 2, 5, 20 | 0.875 … 0.95 |
| vault | 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0 | 1.6 | 0, 1, 2, 5, 20, 100 | 0.833 … 0.95 |

In every preset each stage satisfies $H_k\rho + (1 - H_k)\mu_k = 0.95$ to machine precision, and
the last raise can only be won.
