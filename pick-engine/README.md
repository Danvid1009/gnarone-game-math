# pick-engine (Pick One)

An n-way bet with exact RTP: 2, 3, 5, … options with probabilities pᵢ (equal by default, or weighted); one
uniform picks the winner; backing option j pays RTP / pⱼ on a hit. Coin flip at RTP 0.95 pays 1.9×.

```bash
npm test
node bin/build-pick.js --n 2
node bin/build-pick.js --weights 5,3,2 --labels RED,GREEN,BLUE --js
npm run examples
```

`buildPick({ n | weights | probabilities, labels?, rtp })` → `.options`, `.outcome(u)`, `.play({ bet, betType, rng })`,
`.simulate()`, `.standalone()`. Demo: `web/index.html`. Math: [ALGORITHM.md](ALGORITHM.md).
