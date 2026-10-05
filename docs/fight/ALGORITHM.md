# Live Fight

Two fighters trade hits along a biased random walk. Each has a health bar; each tick one of them
lands a hit for a continuous amount of damage; the first to reach zero loses. The win probability
is known exactly at every state, so the opening bet carries the house edge and every bet placed
during the fight is fair. The whole fight is fixed by one seed at the opening bell and revealed
tick by tick.

## 1. Inputs

$$
\text{fighter } X \in \{A, B\}: \quad P_X \ (\text{power, Elo scale}), \quad H_X > 0 \ (\text{health}), \qquad
N \ (\text{ticks}), \quad \rho \ (\text{grid resolution}), \quad D \ (\text{base damage}), \quad \gamma, \ s, \quad R \in (0,1).
$$

Defaults: $N = 16$, $\rho = 0.5$, $D = 16$, $\gamma = 0.25$, $s = 1200$, $R = 0.95$.

## 2. Who lands, and how hard

Relative strength and the chance that a tick's hit belongs to $A$:

$$
w = 10^{(P_A - P_B)/s}, \qquad p_A = \frac{w}{1 + w}, \qquad p_B = 1 - p_A .
$$

With $s = 1200$ a 100-point power gap gives $p_A = 54.8\%$; the gap compounds over many hits, which is
what makes the fight, not the tick, decisive.

Damage is half-normal with a mean that also leans on power:

$$
\mu_A = D\, w^{\gamma}, \qquad \mu_B = D\, w^{-\gamma}, \qquad |Z|\,\sigma_X \ \text{with}\ \sigma_X = \mu_X \sqrt{\pi/2}.
$$

It is discretised to the health grid: damage $k\rho$ for $k = 1, \dots, K$ with

$$
f_X(k) \propto \Pr\big( (k - \tfrac12)\rho \le |Z|\sigma_X < (k + \tfrac12)\rho \big), \qquad f_X(1) \text{ also absorbs } [0, \tfrac12 \rho),
$$

normalised to sum to one, so there are no zero-damage hits and the mean is $\mu_X$ to within the grid.

## 3. State and end rule

The state after $t$ ticks is $(t, a, b)$ with $a, b$ the remaining health in grid cells
($a_0 = H_A/\rho$, $b_0 = H_B/\rho$). Health only decreases. $b = 0$ is a knockout for $A$, $a = 0$ for $B$.
If both stand after tick $N$ a biased coin decides:

$$
V_N(a, b) = \frac{a}{a + b} \qquad (\text{health share; } \tfrac12 \text{ is an option}).
$$

## 4. The win-probability grid

Backward induction from the end rule, with knockouts as absorbing boundaries:

$$
\boxed{\;
V_t(a, b) = p_A \sum_{k} f_A(k)\, \big[\, b - k \le 0 \ ?\ 1 \ :\ V_{t+1}(a, b - k) \,\big]
\;+\; p_B \sum_{k} f_B(k)\, \big[\, a - k \le 0 \ ?\ 0 \ :\ V_{t+1}(a - k, b) \,\big]
\;}
$$

for $t = N-1, \dots, 0$. $V_t(a, b)$ is exactly $\Pr(A \text{ wins} \mid t, a, b)$ by summation. The
opening rating is

$$
p^{\ast} = V_0(a_0, b_0),
$$

one number that folds power and health together (a 1700-power fighter with 70 HP against a
1550 with 120 HP rates 45%).

## 5. One uniform per tick

Tick $t$ draws $U_t \sim \mathrm{Uniform}[0,1)$: $U_t < p_A$ means $A$ lands and the residual $U_t / p_A$
picks the damage cell from $f_A$'s cumulative table; otherwise $B$ lands and $(U_t - p_A)/(1 - p_A)$
picks from $f_B$. If the fight reaches the bell, one more uniform resolves the end coin against
$V_N(a, b)$. The seed therefore fixes the whole fight at bet time.

## 6. Bets

Opening bet on $X$ at the bell:

$$
\text{odds}_A = \frac{R}{p^{\ast}}, \qquad \text{odds}_B = \frac{R}{1 - p^{\ast}}, \qquad
\mathbb{E}[\text{return}] = p^{\ast} \cdot \frac{R}{p^{\ast}} = R \ \text{either side}.
$$

Live bet placed at state $(t, a, b)$ while the fight runs:

$$
\text{odds}_A(t,a,b) = \frac{1}{V_t(a,b)}, \qquad \text{odds}_B(t,a,b) = \frac{1}{1 - V_t(a,b)}, \qquad \mathbb{E}[\text{return}] = 1 .
$$

Live bets are rakeless. The RTP of a session is set by the opening bets alone.

## 7. Why the live prices are fair at every moment

By construction $V_t(a,b) = \mathbb{E}\big[ V_{t+1}(a', b') \mid t, a, b \big]$: the grid is a martingale
along the fight. A bet at $1 / V_t$ on $A$ pays $1/V_t$ with probability exactly $V_t$ (the future is
determined by the seed, but the seed is hidden and the price uses only the public state), so no
timing strategy changes the expected return. The tests check the martingale identity on the grid,
the exact rating against 100,000 simulated fights, and that live bets placed at a fixed tick
return 1.0.

## 8. Wire shape

The fight is a multi-step round: `bet` on `A` or `B` opens it, each `CONTINUE` reveals one tick
(`tick`, `hp`, `pA`, who landed, damage), the round ends on a knockout or after the bell with
`winner` and `how`. Live bets are *linked bets*: a separate `bet` with its own `roundId` that
references the running fight, priced from the public state by `quote`, settled when the fight
ends, collected on its own. Money is integer minor units; wins are `round(stake × odds)`.

## 9. Where the security lives

The fight is fixed by one seed at the bell, so the whole question is who can see it.

1. **Entropy.** The seed is 128 bits from the platform CSPRNG, minted server-side per round.
2. **Derivation.** Tick $k$'s uniform is $U_k = \mathrm{SHA\text{-}256}(\text{seed} \,|\, \text{stream} \,|\, k)$ mapped to 53 bits in $[0,1)$. Seeing any number of hits reveals nothing about the seed (preimage resistance), so no sequence of ticks lets a player predict the next one.
3. **Secrecy.** The seed never leaves the server while the round is open; the client receives only the revealed ticks, exactly what it would receive if each tick were rolled fresh.
4. **Commitment.** The bet response carries $\text{seedHash} = \mathrm{SHA\text{-}256}(\text{``commit''} \,|\, \text{seed})$, so the house is bound to the whole fight before any live money is placed and cannot steer a tick against the live book.
5. **Reveal.** When the round ends every response carries the seed; anyone can recompute the ticks from (2), check the hits they saw, and check the hash from (4). This is the standard provably-fair commit-and-reveal, and it is only possible because the fight is predetermined; a fresh roll per hit cannot offer it.
6. **Prices.** Live quotes use only the public state $(t, a, b)$, never the seed, so the seller of a live bet has no more information than the buyer.

The browser sandbox on the site has none of this protection by construction: the client *is* the server there, so the seed is readable. That is why the sandbox is for integration, not money.

## 10. Reference ratings (RTP 0.95, defaults)

| pairing | $p_A$ | $p^{\ast}$ | opening odds A / B |
|---|---|---|---|
| 1600 / 100 HP vs 1600 / 100 HP | 50.0% | 50.0% | 1.90 / 1.90 |
| 1700 / 100 vs 1550 / 100 | 57.1% | 73.5% | 1.29 / 3.59 |
| 1700 / 70 vs 1550 / 120 | 57.1% | 45.1% | 2.11 / 1.73 |
| 1600 / 130 vs 1600 / 100 | 50.0% | 65.2% | 1.46 / 2.73 |
