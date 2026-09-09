// Plackett–Luce race from one uniform. Racers ["Ace","Bolt","Cinder","Dash","Ember","Flint","Gale","Hex","Iris","Jolt","Kite","Lux"], Elo [1850,1780,1720,1680,1640,1600,1560,1520,1480,1430,1380,1300].
// Returns the full finishing order (racer indices). Pay M[i][k] for racer i finishing k-th (k<3): M = [[1.4551,1.4276,1.4],[2.2518,1.8259,1.4],[3.4385,2.4192,1.4],[4.5653,2.9827,1.4],[6.0256,3.7128,1.4],[7.8951,4.6475,1.4],[10.272,5.836,1.4],[13.2822,7.3411,1.4],[17.0854,9.2427,1.4],[23.2675,12.3338,1.4],[31.5239,16.462,1.4],[50.8513,26.1257,1.4]]. RTP 0.95 for every racer.
function raceOrder(u) {
  const w = [1,0.6683439175686147,0.47315125896148047,0.3758374042884442,0.29853826189179594,0.23713737056616552,0.18836490894898006,0.14962356560944334,0.11885022274370183,0.08912509381337455,0.06683439175686146,0.042169650342858224];
  const rem = w.map((_, i) => i), order = [];
  if (u >= 1) u = 1 - 1e-15;
  while (rem.length > 1) {
    const tot = rem.reduce((s, i) => s + w[i], 0);
    let a = 0, pick = rem[rem.length - 1], pa = 1 - w[pick] / tot, pp = w[pick] / tot;
    for (const i of rem) { const p = w[i] / tot; if (u < a + p) { pick = i; pa = a; pp = p; break; } a += p; }
    u = Math.min(Math.max((u - pa) / pp, 0), 1 - 1e-15);          // recycle the uniform
    order.push(pick); rem.splice(rem.indexOf(pick), 1);
  }
  order.push(rem[0]); return order;
}
