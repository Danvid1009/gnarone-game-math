# auction-engine · Locker Wars

An ascending locker auction as a sequence of raises. Every raise is its own bet: outbid and the bid
comes back, rivals fold and the locker opens (a Single Shot draw whose mean makes the raise return
exactly the RTP). Being outbid costs nothing; the edge lives only in won lockers. See
[ALGORITHM.md](ALGORITHM.md).

```bash
npm test
node bin/build-auction.js --preset storage
npm run fixtures      # examples/api/<preset>/ through the RGS module
```

RGS module: `src/rgs.js` → `createGame({ preset })`; bet types `BID_1 … BID_N`, each with its own
round-number level list (opening chip × the ladder 1, 2, 3, 4, 6, 8); the bet response's `next` field names the next raise. Published at
`https://danvid1009.github.io/gnarone-game-math/auction/api/rgs.js`.
