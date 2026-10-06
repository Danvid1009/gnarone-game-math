# dist-engine

Distributions: a library of named distributions behind one uniform (inverse-CDF sampling), used for
free sealed draws and for a money mode that pays a sampled multiple scaled to an exact RTP. See
[ALGORITHM.md](ALGORITHM.md).

```bash
npm test
node bin/build-dist.js --dist lognormal --mu 0 --sigma 0.8 --max 50        # money mode table
node bin/build-dist.js --dist poisson --lambda 1
npm run fixtures
```

RGS module `src/rgs.js`: `createGame({ preset })` → `bet` (money) and `draw({ params: { dist, … } })`
(free, sealed, committed). Library: uniform, triangular, normal, lognormal, halfnormal, exponential,
logistic, weibull, pareto, bernoulli, binomial, poisson, geometric, categorical, dice, permutation.
