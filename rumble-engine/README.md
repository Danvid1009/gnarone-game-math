# rumble-engine

Rippin Rumble math from `Math-rippin-rumble-ver4.xlsx`, reproduced to 1e-9. Two decks (low / high), 5-card
packs without replacement, per-rarity `count × pays × multiplier(count)`, and a bucket-mix probability per
bet type solved so the return is exactly the target RTP. Bundles are 11 packs for the price of 10.

```bash
npm test
node bin/build-rumble.js            # tables: buckets, per-rarity E[win], mix per bet type
node bin/build-rumble.js --rtp 0.9  # different target (must sit between the two buckets' standalone returns)
npm run examples
```

`buildRumble({ rtp })` → `.buckets`, `.betTypes`, `.drawPack(u, betType)`, `.play({ bet, betType, rng })`
(returns `totalWinAmount` + `cardPacks` in the `RippinRumbleBetResult` shape), `.simulate()`.
Demo: `web/index.html`. Math: [ALGORITHM.md](ALGORITHM.md).
