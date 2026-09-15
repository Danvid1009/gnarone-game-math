# smash-engine (Game of Three / GO3)

Rock n Smash math from `Rock n Smash.xlsx`, reproduced exactly: 0–3 rocks crushed from a fixed table, a gem
bonus on 2 or 3 with a weighted multiplier table (mean 3.667), BASE and BOOSTED modes. RTP by summation:
0.970667 / 0.9715. Optional `rtp` target scales the win column so the mode hits it exactly.

```bash
npm test
node bin/build-smash.js             # tables, zones, RTP
node bin/build-smash.js --rtp 0.95  # scale wins to a target
npm run examples
```

`buildSmash({ rtp? })` → `.modes`, `.outcome(u, mode)`, `.play({ bet, betType, rng })` (returns
`totalWinAmount`, `count`, `hasBonus`, `multiplier`: the `Go3BetResult` fields), `.simulate()`.
Demo: `web/index.html`. Math: [ALGORITHM.md](ALGORITHM.md).
