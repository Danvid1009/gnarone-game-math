# fight-engine

Live Fight: a biased damage walk between two fighters with an exact win-probability grid. Opening bet at RTP ÷ P(win); live bets during the fight are linked bets at fair odds 1 ÷ P. See [ALGORITHM.md](ALGORITHM.md).

```bash
npm test
node bin/build-fight.js --a 1700,100 --b 1550,100
npm run fixtures      # examples/api/<preset>/ through the RGS module
```

RGS module: `src/rgs.js` → `createGame({ preset })`; presets in `PRESETS`. Published at
`https://danvid1009.github.io/gnarone-game-math/fight/api/rgs.js`.
