# fight-engine

Live Fight: two fighters rated by Elo (attribute points power + hp; the sum prices the fight, the split shapes it), a biased damage walk with an exact win-probability grid calibrated to the Elo price. Opening bet at RTP ÷ P(win); live bets during the fight are linked bets at fair odds 1 ÷ P, capped per tick at 3× the opening stake. See [ALGORITHM.md](ALGORITHM.md).

```bash
npm test
node bin/build-fight.js --a 850,850 --b 775,775      # power,hp attribute points; or --a 1600:0.625 (elo:split)
npm run fixtures      # examples/api/<preset>/ through the RGS module
```

RGS module: `src/rgs.js` → `createGame({ preset })`; presets in `PRESETS`. Published at
`https://danvid1009.github.io/gnarone-game-math/fight/api/rgs.js`.
