# Live Fight

Two fighters trade hits along a biased random walk. Each has a health bar; each tick one of them
lands a hit for a continuous amount of damage; the first to reach zero loses. The win probability
is known exactly at every state, so the opening bet carries the house edge and every bet placed
during the fight is fair. The whole fight is fixed by one seed at the opening bell and revealed
tick by tick.

## 1. Inputs

A fighter is a pair of attribute points; its Elo is their sum:

$$
X \in \{A, B\}: \quad \text{power}_X > 0, \quad \text{hp}_X > 0, \qquad E_X = \text{power}_X + \text{hp}_X, \qquad
N \ (\text{ticks}), \quad \rho \ (\text{grid resolution}), \quad D \ (\text{base damage}), \quad H_0 \ (\text{base health}), \quad r \ (\text{reference points}), \quad s \ (\text{Elo scale}), \quad R \in (0,1).
$$

Defaults: $N = 16$, $\rho = 1$, $D = 16$, $H_0 = 100$, $r = 800$, $s = 400$, $R = 0.95$. An $800/800$ fighter
(Elo 1600) has 100 health and hits for 16 on average. `{ elo, split }` is accepted as sugar, split being
the power share.

## 2. Elo decides who wins; the split decides how

The price of the fight is the Elo formula on the totals, and nothing else:

$$
p^{\ast} = \frac{1}{1 + 10^{(E_B - E_A)/s}} .
$$

A 150-point gap is $70.3\%$, whatever the splits. The split shapes the fight through the two physical
quantities,

$$
H_X = H_0\, \frac{\text{hp}_X}{r} \ (\text{health}), \qquad \mu_X = D\, \frac{\text{power}_X}{r} \ (\text{mean damage}),
$$

and one free number, the chance $p_A$ that a tick's hit belongs to $A$, is solved so that the fight agrees
with the price (section 4). A $1000/600$ puncher against a $600/1000$ tank, both Elo 1600, is a coin flip at
the bell, but the puncher has 75 health and hits for 20 while the tank has 125 and hits for 12.

Damage is half-normal with mean $\mu_X$:

$$
|Z|\,\sigma_X \ \text{with}\ \sigma_X = \mu_X \sqrt{\pi/2},
$$

discretised to the health grid: damage $k\rho$ for $k = 1, \dots, K$ with

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

for $t = N-1, \dots, 0$. $V_t(a, b)$ is exactly $\Pr(A \text{ wins} \mid t, a, b)$ by summation, for a
given landing probability $p_A$.

**Calibration.** $V_0(a_0, b_0)$ is continuous and increasing in $p_A$, from $0$ (A never lands) to
nearly $1$. The engine solves

$$
V_0(a_0, b_0;\, p_A) = p^{\ast}
$$

by the Illinois method on $[0, 1]$, rebuilding the grid at each trial (three to ten passes, well under a
second at $\rho = 1$), and keeps the grid of the solution. From then on the opening rating *is* the Elo
probability to $10^{-10}$, the grid is the fight's true law, and both are reported in `calibration`
(target, achieved, the solved $p_A$, passes). If a target is unreachable, which needs an Elo gap far
outside anything a preset would ship, $p_A$ sits at the bound and the price is the grid's own $V_0$, so
the RTP stays exact in every case.

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

| pairing (power / hp = Elo) | health A / B | damage A / B | solved $p_A$ | $p^{\ast}$ | opening odds A / B |
|---|---|---|---|---|---|
| 800 / 800 = 1600 vs 800 / 800 = 1600 | 100 / 100 | 16 / 16 | 50.0% | 50.0% | 1.90 / 1.90 |
| 850 / 850 = 1700 vs 775 / 775 = 1550 | 106 / 97 | 17 / 15.5 | 54.9% | 70.3% | 1.35 / 3.20 |
| 1000 / 600 = 1600 vs 600 / 1000 = 1600 | 75 / 125 | 20 / 12 | 50.2% | 50.0% | 1.90 / 1.90 |
| 1000 / 600 = 1600 vs 775 / 775 = 1550 | 75 / 97 | 20 / 15.5 | 53.6% | 57.1% | 1.66 / 2.22 |
