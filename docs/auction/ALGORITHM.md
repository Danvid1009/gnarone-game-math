# Locker Wars

An ascending auction for a storage locker, played as a sequence of raises. Each raise is its own
bet. If the rivals outbid you, your bid comes back in full and you may raise again at the next level,
or walk. If the rivals fold, you win the locker and open it: its contents are a one-shot draw with mean
$R$ times the hammer price. The house takes $1 - R$ of the hammer price and nothing else, a buyer's
premium: being outbid is free.

## 1. Inputs

$$
R \in (0,1), \qquad \rho \in [0,1], \qquad H_1, \dots, H_N \in [0,1), \qquad 1 = m_1 < m_2 < \dots < m_N, \qquad
\{a_1 < \dots < a_m\} \subset [0,\infty), \qquad \phi \in (0, \tfrac12).
$$

- $R$: return to player (0.95).
- $\rho$: fraction of the bid returned when outbid (1: the bid comes back in full).
- $H_k$: probability that the rivals outbid raise $k$. The last stage has $H_N = 0$: the rivals are gone.
- $m_k$: the auctioneer's ladder, round multiples of the opening bid (storage: $1, 2, 3, 4, 6, 8$), so raise $k$ is $b_k = b_1\, m_k$.
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

Under the default every won locker has mean exactly $R$ times the bid, at every stage. The
per-raise alternative instead lowers the locker mean where outbids are frequent so that each raise,
refunds included, returns $R$.

## 4. What a raise returns, and what the auction costs

$$
\mathbb{E}[\text{return of raise } k] = H_k\,\rho + (1 - H_k)\,\mu_k =
\begin{cases} R + H_k\,(\rho - R) & \text{edge on the hammer}\\ R & \text{per-raise.} \end{cases}
$$

With the edge on the hammer and $\rho = 1$, raise $k$ returns $R + H_k(1 - R)$: above $R$ whenever
rivals can still outbid you, exactly $R$ at the last stage. Every raise has non-positive expectation
($-(1-H_k)(1-R)$ per unit) and walking is zero, so no policy is profitable. The expected loss of an
auction is $(1 - R)$ times the expected hammer price, whatever the policy; the return *per unit staked*
is not one number, because refunded stakes count as staked. For the policy "raise until won":

$$
\text{RTP} = \frac{\mathbb{E}[\text{returned}]}{\mathbb{E}[\text{staked}]}, \qquad
\mathbb{E}[\text{loss}] = (1 - R)\,\mathbb{E}[b_{\text{win}}], \qquad
\Pr(\text{win at } k) = (1 - H_k)\prod_{j<k} H_j .
$$

The engine reports these exactly (`policy(m)`), for raising up to any stage $m$.

## 5. Money

Opening bid $b_1$ is a chip level $S$. Raise $k$ is $S\, m_k$, and BID\_k's own level list is $c\, m_k$ for every
chip $c$, so every bid on the ladder is a round number: 5, 10, 15, 20, 30, 40 from a 5.00 opener. An outbid
pays $\operatorname{round}(\rho\,b_k)$; a won locker pays $\operatorname{round}(X_k\,b_k)$.

## 6. Wire shape

Single-call. `bet` with `betType: BID_k` returns `outcome` (OUTBID or WON), `totalWinAmount` (the
refund or the locker contents), `locker { multiplier, band, multiple, contents }` on a win, and
`next { betType, bid }`, the raise the client offers next. Each raise is collected on its own. The
client chains raises with the `next` field; the engine needs no state between them.

## 7. Reference instances ($R = 0.95$ on the hammer price, full refund)

| preset | stages $H_k$ | bid ladder $m_k$ | locker multiples | E[hammer] | always-raise RTP | loss per auction |
|---|---|---|---|---|---|---|
| street | 0.5, 0.35, 0.2, 0 | 1, 2, 3, 4 | 0, 0.5, 1, 2, 5 | 1.71 | 96.8% | 0.086 |
| storage | 0.6, 0.5, 0.4, 0.3, 0.2, 0 | 1, 2, 3, 4, 6, 8 | 0, 0.5, 1, 2, 5, 20 | 2.11 | 97.3% | 0.105 |
| vault | 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0 | 1, 2, 3, 5, 8, 12, 20 | 0, 1, 2, 5, 20, 100 | 2.93 | 97.5% | 0.147 |

Hammer price and loss in units of the opening bid. Every won locker has mean $0.95$ times its bid;
the loss per auction is exactly 5% of the expected hammer price; the last raise can only be won.
