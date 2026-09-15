# Rippin Rumble: two-bucket card packs, exact RTP by bucket mix

Reproduces `Math-rippin-rumble-ver4.xlsx`. A bet buys one or more **packs** of $k=5$ cards; each card has a
rarity in {legendary, rare, uncommon, common}; the pack pays per rarity by how many of that rarity it holds.

## 1. Decks and pack composition

Two decks ("buckets"), each a fixed multiset of cards:

| bucket | cost (credits) | legendary | rare | uncommon | common | total |
|---|---|---|---|---|---|---|
| low | 5 | 2 | 5 | 8 | 15 | 30 |
| high | 10 | 5 | 7 | 9 | 6 | 27 |

A pack is $k$ cards drawn **without replacement**, so the rarity counts $(c_L, c_R, c_U, c_C)$ are multivariate
hypergeometric:

$$
\Pr(c) = \frac{\binom{n_L}{c_L}\binom{n_R}{c_R}\binom{n_U}{c_U}\binom{n_C}{c_C}}{\binom{N}{k}},\qquad \sum_r c_r = k .
$$

## 2. Pack payout

Per-card pays $v = (3, 1, 0.5, 0)$ credits and a count multiplier $m(c)$ with $m(5)=100,\ m(4)=10,\ m(3)=3,\ m(2)=2,\ m(1)=1$:

$$
\boxed{\ \text{win}(c) = \sum_{r} c_r\, v_r\, m(c_r)\ }
$$

Expected pack win is exact by summation over the compositions ($\le 56$ of them):
$\mathbb{E}_{\text{low}} = 3.98877$, $\mathbb{E}_{\text{high}} = 9.99425$ credits. Alone, the low bucket returns
$0.7978$ of its cost and the high bucket $0.9994$.

## 3. Bucket mix per bet type

Each bet type has a cost per pack $C$, a number of packs $K$ delivered and $K_p$ paid for (bundles: 11 packs for the
price of 10), so the effective cost per pack is $C_{\text{eff}} = C\,K_p/K$. A pack comes from the low bucket with
probability $\pi$, solved so the return is exact:

$$
\boxed{\ \pi = \frac{C_{\text{eff}}\,R^\ast - \mathbb{E}_{\text{high}}}{\mathbb{E}_{\text{low}} - \mathbb{E}_{\text{high}}}\ }
\qquad\Rightarrow\qquad
\frac{\pi\,\mathbb{E}_{\text{low}} + (1-\pi)\,\mathbb{E}_{\text{high}}}{C_{\text{eff}}} = R^\ast .
$$

| bet type | $C$ | packs | paid | $C_{\text{eff}}$ | $\pi$ (low) | RTP |
|---|---|---|---|---|---|---|
| BASE | 5 | 1 | 1 | 5 | 87.32% | 0.95 |
| BOOSTED | 10 | 1 | 1 | 10 | 8.23% | 0.95 |
| BASE_BUNDLE | 5 | 11 | 10 | 4.545 | 94.51% | 0.95 |
| BOOSTED_BUNDLE | 10 | 11 | 10 | 9.091 | 22.61% | 0.95 |

$R^\ast$ must lie between the two buckets' standalone returns at $C_{\text{eff}}$, otherwise no mix reaches it.

## 4. The draw

One uniform per pack. $u < \pi$ selects the low bucket and $u \leftarrow u/\pi$; otherwise the high bucket and
$u \leftarrow (u-\pi)/(1-\pi)$. The rescaled $u$ is again uniform and picks the composition from its zones
(compositions sorted by probability, laid end to end). Card identities are dealt from a cosmetic stream.
A bundle consumes $K$ uniforms.

## 5. Money

The stake $S$ (minor units) buys $K_p$ paid packs at cost $C$, so one credit is $S/(C\,K_p)$ minor units.
`valuePerCard` $= \operatorname{round}(v_r \cdot S/(CK_p))$; per-rarity `totalValue` $= c_r \cdot$ `valuePerCard`
$\cdot\, m(c_r)$; the pack's `totalPayout` is their sum, matching the `CardPack` wire shape. Max win: five
legendaries from the high bucket, $5\cdot 3\cdot 100 = 1500$ credits $= 150\times$ a BOOSTED stake.
