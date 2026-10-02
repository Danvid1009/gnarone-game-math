# Cutscene Fight

One bet on who wins, decided by a single biased coin; a predetermined cutscene that plays the
result out; and a library of independent side bets the developer may call at any point.

## 1. The main bet

The fight is rated with the Live Fight grid: $p^{\ast} = V_0(a_0, b_0)$, the exact probability
that $A$ beats $B$ given both fighters' power and health (see the Live Fight write-up). The
outcome is one uniform:

$$
U < p^{\ast} \Rightarrow A \text{ wins}, \quad \text{else } B, \qquad
\text{odds}_A = \frac{R}{p^{\ast}}, \quad \text{odds}_B = \frac{R}{1 - p^{\ast}}, \quad
\mathbb{E}[\text{return}] = R \text{ either side}.
$$

## 2. The cutscene is cosmetic

A Live Fight trajectory is drawn from a *derived* stream of the same seed and redrawn until its
winner matches the coin (the first match is used; on average $1 / \max(p^{\ast}, 1 - p^{\ast})$
draws). The script carries every hit, the health after each, and whether it ended by knockout or
decision. It never changes the payout: the coin already did. Because the derived stream is
deterministic, the same seed gives the same cutscene.

## 3. Side bets

Each side bet is a single independent draw from its own stream, priced at its own RTP $R_s$.
Options are placeholders `OPTION_1 .. OPTION_n` that the client reskins.

| kind | parameters | outcome | pays on a hit |
|---|---|---|---|
| `coin` | $p$ = P(OPTION_1) | $U < p$ ⇒ OPTION_1 | $R_s / p$ or $R_s / (1 - p)$ |
| `pick` | $n$, or weights, or probabilities $p_i$ | zone of $U$ | $R_s / p_i$ |
| `single-shot` | payouts $a_1..a_m$, method | sloped band of $U$ | the band's ramp, mean $a_i$ |

Every kind returns exactly $R_s$ for every option by construction ($p_i \cdot R_s / p_i = R_s$;
the Single Shot bands have mean $a_i$ and $\sum p_i a_i = R_s$). Side bets are unlimited in
number, independent of the fight and of each other, and each has its own round and collect.

## 4. Wire shape

`bet` on `A` or `B` returns the winner, the win and the full cutscene script with
`nextAction: ["COLLECT"]`. A side bet is `sideBet({ betAmount, params })` where `params` is a
library name (`coin`, `biased-coin`, `pick-3`, `pick-weighted`, `shot-classic`) or raw
parameters (`{ kind, p | n | weights | probabilities | payouts, pick, rtp }`); it returns its own
`roundId`, outcome and win, also with `nextAction: ["COLLECT"]`.
