# auction-engine · Locker Wars

An ascending locker auction as a sequence of raises. Every raise is its own bet: outbid and the bid
comes back in full, rivals fold and the locker opens (a Single Shot draw with mean R × the hammer
price). The house takes 1 − R of the hammer price and nothing else; being outbid is free. See
[ALGORITHM.md](ALGORITHM.md).

```bash
npm test
node bin/build-auction.js --preset storage
npm run fixtures      # examples/api/<preset>/ through the RGS module
```

RGS module: `src/rgs.js` → `createGame({ preset })`; bet types `BID_1 … BID_N`, each with its own
round-number level list (opening chip × the ladder 1, 2, 3, 4, 6, 8); the bet response's `next` field names the next raise. Published at
`https://danvid1009.github.io/gnarone-game-math/auction/api/rgs.js`.
