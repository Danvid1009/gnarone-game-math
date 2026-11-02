# Locker Wars

An ascending auction for a storage locker, played as a sequence of raises. Each raise is its own
bet. If the rivals outbid you, your bid comes back in full and you may raise again at the next level,
or walk. If the rivals fold, you win the locker and open it: its contents are a one-shot draw whose mean is
solved so that the raise, refund included, returns exactly $R$. Being outbid is free; the RTP is fixed at $R$
for every raise and therefore for every raise-or-walk policy.

## 1. Inputs

$$
R \in (0,1), \qquad \rho \in [0,1], \qquad H_1, \dots, H_N \in [0,1), \qquad D_1, \dots, D_{N-1} \subset \mathbb{N}_{>0}, \qquad
\{a_1 < \dots < a_m\} \subset [0,\infty), \qquad \phi \in (0, \tfrac12).
$$

- $R$: return to player (0.95).
- $\rho$: fraction of the bid returned when outbid (1: the bid comes back in full).
- $H_k$: probability that the rivals outbid raise $k$. The last stage has $H_N = 0$: the rivals are gone.
- $D_k$: the auctioneer's increments between raise $k$ and $k+1$, in units of the opening bid (storage: $\{1\}, \{1,2\}, \{1,2\}, \{2,3\}, \{2,4\}$). The multiple $m_1 = 1$ and $m_{k+1} = m_k + d_k$ with $d_k$ drawn uniformly from $D_k$, so raise $k$ is $b_k = b_1\, m_k$ and the ladder varies from auction to auction while every bid stays a round number.
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

Under the default (`edge: 'per-raise'`) the locker mean is $\mu_k = (R - H_k\rho)/(1 - H_k)$: lower where
outbids are frequent, exactly $R$ at the last stage, so that each raise, refund included, returns $R$. The
hammer alternative (`edge: 'hammer'`) instead gives every won locker mean exactly $R$, a buyer's premium on
the hammer price.

## 4. What a raise returns, and what the auction costs

$$
\mathbb{E}[\text{return of raise } k] = H_k\,\rho + (1 - H_k)\,\mu_k =
\begin{cases} R & \text{per-raise (default)}\\ R + H_k\,(\rho - R) & \text{edge on the hammer.} \end{cases}
$$

Per-raise: every raise returns $R$, so the return per unit staked is $R$ for any policy, and the expected loss
of an auction is $(1 - R)$ times the expected total stake. Walking is zero and every raise loses $(1-R)$ per
unit, so no policy is profitable. With the edge on the hammer and $\rho = 1$, raise $k$ would instead return
$R + H_k(1 - R)$, above $R$ while rivals can still outbid you, and the return per unit staked would depend on
the policy. For the policy "raise until won":

$$
\text{RTP} = \frac{\mathbb{E}[\text{returned}]}{\mathbb{E}[\text{staked}]}, \qquad
\mathbb{E}[\text{loss}] = \mathbb{E}[\text{staked}] - \mathbb{E}[\text{returned}], \qquad
\Pr(\text{win at } k) = (1 - H_k)\prod_{j<k} H_j .
$$

The engine reports these exactly (`policy(m)`), for raising up to any stage $m$.

## 5. Money

Opening bid $b_1$ is a chip level $S$. Raise $k$ is $S\, m_k$. BID\_k's level list is $c\, m$ for every chip $c$ and
every multiple $m$ the stage can reach, and the shipped presets are chosen so each amount factors into exactly
one (chip, multiple) pair, which is how a stateless engine knows the opener. The increment $d_k$ is drawn from a
derived stream of raise $k$'s own seed, so it is committed with the raise and replayable, and the response names
the next bid. From a 5.00 opener a storage auction might run 5, 10, 15, 25, 35, 45 or 5, 10, 20, 25, 40, 50. An outbid
pays $\operatorname{round}(\rho\,b_k)$; a won locker pays $\operatorname{round}(X_k\,b_k)$.

## 6. Wire shape

Single-call. `bet` with `betType: BID_k` returns `outcome` (OUTBID or WON), `totalWinAmount` (the
refund or the locker contents), `locker { multiplier, band, multiple, contents }` on a win, and
`next { betType, bid, increment, multiple }`, the raise the client offers next (null on a win, and after the last raise). Each raise is collected on its own. The
client chains raises with the `next` field; the engine needs no state between them.

## 7. Reference instances ($R = 0.95$ per raise, full refund)

| preset | stages $H_k$ | increments $D_k$ | reachable multiples at the top | locker multiples |
|---|---|---|---|---|
| street | 0.5, 0.35, 0.2, 0 | 1 · 1,2 · 1,2 | 4 to 6 | 0, 0.5, 1, 2, 5 |
| storage | 0.6, 0.5, 0.4, 0.3, 0.2, 0 | 1 · 1,2 · 1,2 · 2,3 · 2,4 | 8 to 13 | 0, 0.5, 1, 2, 5, 20 |
| vault | 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0 | 1 · 1,2 · 2,3 · 2,3,5 · 3,5 · 4,6,8 | 14 to 25 | 0, 1, 2, 5, 20, 100 |

Locker means per stage: street 0.900, 0.923, 0.938, 0.95; storage 0.875, 0.90, 0.917, 0.929, 0.9375, 0.95;
vault 0.833, 0.875, 0.90, 0.917, 0.929, 0.9375, 0.95. Expected stake, expected hammer price and loss per
auction are reported exactly by the engine for each preset (`policy()`); the RTP per unit staked is 0.95 for
every preset and every policy. The last raise can only be won.
