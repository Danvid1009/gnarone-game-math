# Sloped-band payout function

The engine turns a list of payout multiples and a target return into a single function
$B:[0,1)\to\mathbb{R}_{\ge 0}$ that maps one uniform draw to the multiple of the stake to pay.
The return is exact by construction, the function is monotone, and every payout varies
inside a fixed neighbourhood of its design value.

## 1. Inputs

$$
a_1 < a_2 < \cdots < a_n ,\qquad a_i \ge 0 ,\qquad R^\ast \in (a_1,\, a_n),\qquad \phi = 0.1
$$

- $a_i$: payout multiples (one may be $0$, the no-win outcome).
- $R^\ast$: target return to player.
- $\phi$: band fraction, fixed at $0.1$. Any $\phi<\tfrac12$ keeps adjacent bands disjoint.

## 2. Probabilities

Find $p_1,\dots,p_n$ with

$$
\sum_{i=1}^{n} p_i = 1 ,\qquad \sum_{i=1}^{n} p_i\,a_i = R^\ast ,\qquad p_i > 0 .
$$

Two constraints on $n$ unknowns leave $n-2$ degrees of freedom. One of three rules spends them.

**Maximum entropy** (default). The distribution with the largest entropy subject to the two
constraints is the Gibbs form

$$
p_i = \frac{e^{-\lambda a_i}}{\sum_{j} e^{-\lambda a_j}},
\qquad
\lambda \;\text{ solves }\; \sum_i p_i(\lambda)\,a_i = R^\ast .
$$

$\sum_i p_i(\lambda)a_i$ is strictly decreasing in $\lambda$, so the root is unique and found by
bisection. $\lambda>0$ when $R^\ast$ is below the plain mean of the $a_i$; probability then
falls exponentially with payout.

**Geometric.** With payouts indexed in ascending order $i=0,\dots,n-1$,

$$
p_i = \frac{q^{\,i}}{\sum_j q^{\,j}},
\qquad
q \;\text{ solves }\; \sum_i p_i(q)\,a_i = R^\ast .
$$

Adjacent probabilities share a constant ratio $q$, regardless of the payout gap between them.

**Weights.** Requires $a_1 = 0$. Given relative weights $w_i>0$ for the winning payouts,

$$
\bar a = \frac{\sum_{i\ge2} w_i a_i}{\sum_{i\ge2} w_i},
\qquad
p_1 = 1 - \frac{R^\ast}{\bar a},
\qquad
p_i = (1-p_1)\,\frac{w_i}{\sum_{j\ge2} w_j}\quad (i\ge2),
$$

valid when $\bar a > R^\ast$. The winning distribution is exactly the shape typed; only the
no-win probability is solved.

## 3. Intervals on the draw axis

Cumulative sums place the payouts side by side on $[0,1)$:

$$
c_0 = 0,\qquad c_i = \sum_{k=1}^{i} p_k ,\qquad I_i = [\,c_{i-1},\, c_i) .
$$

For $U\sim\mathrm{Uniform}[0,1)$, $\Pr(U\in I_i)=p_i$ exactly. On an $N$-value RNG the same
intervals sit at $[\,N c_{i-1},\, N c_i)$ with $x = N\,U$; the reference grid is $N=10000$.

## 4. Neighbourhood half-width

$$
g = \min_{i:\,a_i>0,\ a_{i+1}>0}\bigl(a_{i+1}-a_i\bigr),
\qquad
r = \phi\, g .
$$

Because $r<\tfrac{g}{2}$, the bands $[a_i-r,\,a_i+r]$ of adjacent winning payouts are disjoint,
and the smallest winning payout satisfies $a_{\min}-r>0$ (checked; the build fails otherwise).
The zero payout gets no band.

## 5. The payout function

For $u\in I_i$ let $t = \dfrac{u-c_{i-1}}{c_i-c_{i-1}}\in[0,1)$ be the position inside the interval. Then

$$
\boxed{\;
B(u) =
\begin{cases}
0, & a_i = 0,\\[6pt]
a_i + r\,(2t-1), & a_i > 0 .
\end{cases}
\;}
$$

Band $i$ is a straight ramp from $a_i-r$ at the left edge of $I_i$ to $a_i+r$ at the right
edge, centred on $a_i$. One uniform draw fixes both the band and the position within it.

## 6. Properties

**Conditional mean.** $t$ is uniform on $[0,1)$ given $U\in I_i$, so

$$
\mathbb{E}\bigl[B \mid U\in I_i\bigr] = a_i + r\,\bigl(2\,\mathbb{E}[t]-1\bigr) = a_i .
$$

**Return.** By iterated expectation,

$$
\mathbb{E}[B] = \sum_i p_i\,\mathbb{E}\bigl[B\mid U\in I_i\bigr] = \sum_i p_i\,a_i = R^\ast ,
$$

with no simulation and no correction term. For a stake $S$, $\mathbb{E}[S\,B]=S\,R^\ast$.

**Distribution inside a band.**

$$
B \mid U\in I_i \;\sim\; \mathrm{Uniform}\bigl[a_i-r,\ a_i+r\bigr] ,
\qquad
\mathrm{Var}\bigl[B\mid U\in I_i\bigr] = \frac{r^2}{3}.
$$

**Monotonicity.** $B$ is non-decreasing on $[0,1)$: each ramp rises, and at every boundary
$a_i + r < a_{i+1} - r$.

**Variance.**

$$
\mathrm{Var}[B] = \sum_{i:\,a_i>0} p_i\Bigl(a_i^2 + \tfrac{r^2}{3}\Bigr) - {R^\ast}^2 .
$$

**Hit rate.** $\sum_{i:\,a_i>0} p_i$.

## 7. Money

The stake $S$ is an integer in minor units. The win is $\operatorname{round}(S\,B(u))$, rounded
once. Because $B$ is continuous inside each band, rounding to whole units averages out over the
band and the realised return at a chip size stays at $R^\ast$ to within the width of one unit
divided by $S$.

## 8. Integer RNG

On a grid $D=\lfloor N U\rfloor$, read the function at the cell midpoint
$u=\tfrac{D+\tfrac12}{N}$. The grid return $\tfrac1N\sum_{D} B\!\left(\tfrac{D+1/2}{N}\right)$
equals $R^\ast$ exactly when every $N c_i$ is an integer; otherwise it differs by at most
$\tfrac{a_n}{N}$ per boundary that falls inside a cell.

## 9. Procedure

1. Sort the payouts ascending; carry weights along.
2. Solve $p$ by the chosen rule (§2).
3. Build $c_0,\dots,c_n$ (§3).
4. Compute $g$ and $r=\phi g$; assert $a_{\min}-r>0$ (§4).
5. Emit $B(u)$ (§5). Ten lines of JavaScript, no dependencies, replayable from the seed of $u$.

## 10. Reference instance

$a = (0,\ 0.5,\ 1,\ 2,\ 5,\ 20)$, $R^\ast=0.95$, $\phi=0.1$, so $g=0.5$ and $r=0.05$.

| band | $a_i$ | maxent $p_i$ | geometric $p_i$ | weights $50/30/15/4/1$ $p_i$ | pays |
|---|---|---|---|---|---|
| 0 | 0 | 0.3080 | 0.4895 | 0.2400 | 0 |
| 1 | 0.5 | 0.2599 | 0.2546 | 0.3800 | 0.45 → 0.55 |
| 2 | 1 | 0.2193 | 0.1325 | 0.2280 | 0.95 → 1.05 |
| 3 | 2 | 0.1561 | 0.0689 | 0.1140 | 1.95 → 2.05 |
| 4 | 5 | 0.0563 | 0.0359 | 0.0304 | 4.95 → 5.05 |
| 5 | 20 | 0.0003 | 0.0187 | 0.0076 | 19.95 → 20.05 |

All three columns satisfy $\sum p_i a_i = 0.95$. Standard deviations of $B$: 1.25, 2.82, 1.92.
