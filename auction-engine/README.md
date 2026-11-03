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

RGS module: `src/rgs.js` → `createGame({ preset })`; bet types `BID_1 … BID_N`, each with a round-number level list
(opening chip × every multiple the stage can reach; the auctioneer's increment is drawn per raise); the bet response's `next` field names the next raise (null when the locker is won). `BUY_NOW` takes the locker outright at a fixed multiple of the opener (the max bet), same locker, mean 0.95 × the price. Published at
`https://danvid1009.github.io/gnarone-game-math/auction/api/rgs.js`.
