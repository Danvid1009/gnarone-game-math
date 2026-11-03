# cutscene-engine

Cutscene Fight: one bet on the winner (a biased coin at the Elo price of power + hp attribute points; the split only shapes the cutscene), a cosmetic predetermined cutscene, and a side-bet library (coin, pick, single shot) the developer can call any number of times. See [ALGORITHM.md](ALGORITHM.md).

```bash
npm test
node bin/build-cutscene.js --a 850,850 --b 775,775      # power,hp attribute points; or elo:split
npm run fixtures      # examples/api/<preset>/ through the RGS module
```

RGS module: `src/rgs.js` → `createGame({ preset })`; presets in `PRESETS`. Published at
`https://danvid1009.github.io/gnarone-game-math/cutscene/api/rgs.js`.
