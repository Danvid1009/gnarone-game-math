# Pick One: an $n$-way bet with exact RTP

## 1. Inputs

$n \ge 2$ options with probabilities $p_1,\dots,p_n$ ($\sum p_i = 1$; equal $p_i = 1/n$ unless weights are
given), a target return $R^\ast$, one uniform $U$ per round.

## 2. Draw

Zones $[c_{i-1}, c_i)$ with $c_i = \sum_{k\le i} p_k$. The option whose zone contains $U$ wins:
$\Pr(\text{option } i \text{ wins}) = p_i$ exactly.

## 3. Payout

The player backs option $j$ with stake $S$ and receives

$$
\boxed{\ \text{win} = \begin{cases} S\cdot\dfrac{R^\ast}{p_j} & \text{if } j \text{ wins}\\[6pt] 0 & \text{otherwise}\end{cases}\ }
\qquad\Rightarrow\qquad
\mathbb{E}[\text{win}] = p_j \cdot S\,\frac{R^\ast}{p_j} = S\,R^\ast \ \ \text{for every } j .
$$

Equal options: odds $= n R^\ast$. A coin flip at $R^\ast = 0.95$ pays $1.9\times$; three options pay $2.85\times$;
five pay $4.75\times$. Weighted options pay $R^\ast/p_j$, so a favourite pays less than an outsider and both
return $R^\ast$.

## 4. Variance

$\operatorname{Var}[\text{multiple} \mid \text{back } j] = p_j\,(R^\ast/p_j)^2 - {R^\ast}^2 = R^\ast\bigl(R^\ast/p_j - R^\ast\bigr)$, so
the standard deviation grows as $\sqrt{1/p_j}$: $0.95$ for the coin flip, $1.90$ for five equal options.

## 5. Money

Win $= \operatorname{round}(S \cdot R^\ast/p_j)$, one rounding. With equal options and $S$ divisible by the
denominator of $nR^\ast$ there is no rounding at all.
