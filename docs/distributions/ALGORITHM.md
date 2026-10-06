# Distributions

A library of named distributions behind one uniform. Two uses: **draws**, free sealed samples
for anything a game needs to be random, reproducible and auditable (bot speeds, timings,
Ragency targets); and **money mode**, where a stake pays a multiple sampled from a chosen
distribution, scaled so the mean is exactly the RTP.

## 1. One uniform, one quantile

Every entry is defined by its quantile function $Q(u)$, the inverse of its CDF. A draw is

$$
U \sim \mathrm{Uniform}[0,1), \qquad X = Q(U),
$$

so $X$ has exactly the named distribution, the sample is reproducible from the seed, and the
revealed $u$ lets anyone check it. Discrete entries use their cumulative table; `permutation`
recycles $u$ through a Fisher–Yates shuffle.

| entry | parameters | $Q(u)$ or rule | mean |
|---|---|---|---|
| uniform | $a < b$ | $a + (b-a)u$ | $(a+b)/2$ |
| triangular | $a \le c \le b$ | piecewise square root | $(a+b+c)/3$ |
| normal | $\mu, \sigma > 0$ | $\mu + \sigma \Phi^{-1}(u)$ | $\mu$ |
| lognormal | $\mu, \sigma > 0$ | $e^{\mu + \sigma \Phi^{-1}(u)}$ | $e^{\mu + \sigma^2/2}$ |
| halfnormal | $\sigma > 0$ | $\sigma \Phi^{-1}(\tfrac{1+u}{2})$ | $\sigma\sqrt{2/\pi}$ |
| exponential | $\lambda > 0$ | $-\ln(1-u)/\lambda$ | $1/\lambda$ |
| logistic | $\mu, s > 0$ | $\mu + s \ln\frac{u}{1-u}$ | $\mu$ |
| weibull | $k, \lambda > 0$ | $\lambda(-\ln(1-u))^{1/k}$ | $\lambda\,\Gamma(1 + 1/k)$ |
| pareto | $x_m, \alpha > 0$ | $x_m (1-u)^{-1/\alpha}$ | $\alpha x_m/(\alpha-1)$ for $\alpha > 1$ |
| bernoulli | $p$ | $[u \ge 1-p]$ | $p$ |
| binomial | $n, p$ | cumulative table | $np$ |
| poisson | $\lambda$ | cumulative table | $\lambda$ |
| geometric | $p$ | $\lfloor \ln(1-u)/\ln(1-p) \rfloor$ | $(1-p)/p$ |
| categorical | weights $w_i$ | cumulative table; value $i$, label `OPTION_{i+1}` | — |
| dice | sides $n$ | $1 + \lfloor nu \rfloor$ | $(n+1)/2$ |
| permutation | $n \le 20$ | Fisher–Yates on the recycled $u$ | — |

$\Phi^{-1}$ is Acklam's rational approximation with one Halley refinement; the engine integrates
the same function it samples, so any approximation error cancels in the RTP.

## 2. Money mode

The chosen entry gives the *shape* of the payout. With a floor $m \ge 0$ and a cap $M$,

$$
Y = \operatorname{clamp}(Q(U), m, M), \qquad c = \frac{R}{\mathbb{E}[Y]}, \qquad \text{multiple} = c\,Y,
$$

so $\mathbb{E}[\text{multiple}] = R$ exactly. $\mathbb{E}[Y]$ is a closed sum over the pmf for
discrete entries; for continuous entries it is

$$
\mathbb{E}[Y] = m\,u_m + \int_{u_m}^{u_M} Q(u)\,du + M\,(1 - u_M), \qquad Q(u_m) = m,\ Q(u_M) = M,
$$

with the integral by composite Simpson on the monotone, smooth interior (40 000 panels) and the
end masses exact. The tests check $\mathbb{E}[\text{multiple}]$ against a 400 000-cell midpoint
sum and against simulation. A cap is required when the raw mean is infinite (pareto with
$\alpha \le 1$). The paid range is $[c\,\max(m, \text{support}_{\min}),\ c\,M]$ and the engine
reports it, along with $P(\text{multiple} > 0)$.

## 3. Wire shape

`bet` (bet type `BASE`) pays `round(stake × multiple)` with `nextAction: ["COLLECT"]` and returns
`multiple` and `math { u, raw, scale }`. `draw({ params: { dist, …parameters } })` moves no money
and returns `value`, `u`, the validated parameters, `label` for categorical, and the commitment
(`seedHash`, `seed`) in the same response, since nothing is pending. `open()` lists the library
with parameter documentation and defaults, so a client can build a picker without a spec.

## 4. Reference money presets (RTP 0.95)

| preset | distribution | clamp | scale $c$ | paid range | P(win > 0) |
|---|---|---|---|---|---|
| lognormal | $\mu = 0,\ \sigma = 0.8$ | [0, 50] | see `index.json` | up to 50c | 100% |
| exponential | $\lambda = 1$ | [0, 20] | | up to 20c | 100% |
| uniform | [0, 1] | — | 1.9 | [0, 1.9] | 100% |
| normal-clipped | $\mu = 1,\ \sigma = 0.5$ | [0, 3] | | [0, 3c] | 97.7% |
| pareto | $x_m = 0.5,\ \alpha = 2.5$ | [0, 100] | | [0.5c, 100c] | 100% |
| poisson | $\lambda = 1$ | — | | multiples of c | 63.2% |

The live numbers for each preset are in `distributions/api/<preset>/field.json`.
