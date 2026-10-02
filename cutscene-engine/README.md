# cutscene-engine

Cutscene Fight: one bet on the winner (biased coin from the Live Fight rating), a cosmetic predetermined cutscene, and a side-bet library (coin, pick, single shot) the developer can call any number of times. See [ALGORITHM.md](ALGORITHM.md).

```bash
npm test
node bin/build-cutscene.js --a 1700,100 --b 1550,100
npm run fixtures      # examples/api/<preset>/ through the RGS module
```

RGS module: `src/rgs.js` → `createGame({ preset })`; presets in `PRESETS`. Published at
`https://danvid1009.github.io/gnarone-game-math/cutscene/api/rgs.js`.
