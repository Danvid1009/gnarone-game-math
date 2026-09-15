# Game of Three (GO3): rocks crushed, gem bonus, exact RTP by summation

Reproduces `Rock n Smash.xlsx`. The player smashes three rocks; the result is how many were crushed
$c\in\{0,1,2,3\}$, whether a gem bonus fired, and the win multiplier.

## 1. Tables

Per mode, a rock table $(p_c,\ g_c,\ w_c)$: probability of crushing $c$ rocks, probability a gem fires given $c$,
and the win in base chips. $p_0 = 1 - \sum_{c\ge1} p_c$.

| mode | $c$ | $p_c$ | $g_c$ | $w_c$ |
|---|---|---|---|---|
| BASE | 3 / 2 / 1 / 0 | 0.08 / 0.28 / 0.40 / 0.24 | 0.05 / 0.05 / 0 / 0 | 5 / 1 / 0.5 / 0 |
| BOOSTED | 3 / 2 / 1 / 0 | 0.23 / 0.34 / 0.31 / 0.12 | 0.075 / 0.075 / 0 / 0 | 5 / 1 / 0.5 / 0 |

Gem multipliers $G$ with weights: $10\times$ (1), $8\times$ (1), $5\times$ (2), $4\times$ (3), $3\times$ (4), $2\times$ (7);
$\mathbb{E}[G] = 66/18 = 3.6667$. A BOOSTED stake is two base chips, so its multiple of stake divides by $d=2$.

## 2. Payout and return

$$
\boxed{\ \text{multiple}(c, \text{gem}) = \frac{w_c}{d}\cdot\begin{cases} G & \text{gem fired}\\ 1 & \text{otherwise}\end{cases}\ }
\qquad
\boxed{\ R = \frac{1}{d}\sum_{c} p_c\, w_c\,\bigl(g_c\,\mathbb{E}[G] + 1 - g_c\bigr)\ }
$$

BASE: $R = 0.970667$. BOOSTED: $R = 0.9715$. Both exact; the 30% "alternate animation" on $c\ge2$ is cosmetic
and carries no value. Optionally the win column is scaled by a constant so $R$ hits a target exactly.

## 3. The draw

One uniform. The outcomes $(c, \text{gem})$ are laid out as zones of width $p_c\,g_c\,\Pr(G)$ (gem) and
$p_c\,(1-g_c)$ (no gem), sorted by multiple. BASE has $4 + 2\cdot 6 = 16$ zones; the largest multiple is
$3$ rocks $+\ 10\times$ gem $= 50\times$ (BASE) or $25\times$ (BOOSTED). The result carries `count`,
`hasBonus`, `multiplier`, matching `Go3BetResult`.
