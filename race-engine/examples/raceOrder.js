// Plackett–Luce race from one uniform. Racers ["Ace","Bolt","Cinder","Dash","Ember","Flint","Gale","Hex","Iris","Jolt","Kite","Lux"], Elo [1850,1780,1720,1680,1640,1600,1560,1520,1480,1430,1380,1300].
// Returns the full finishing order (racer indices). Pay M[i][k] for racer i finishing k-th (k<3): M = [[1.7966,1.1992,1.1593],[2.6953,1.4238,1.3391],[3.9474,1.7369,1.5895],[5.1091,2.0273,1.8218],[6.5998,2.4,2.12],[8.4976,2.8744,2.4995],[10.9024,3.4756,2.9805],[13.9417,4.2354,3.5883],[17.7769,5.1942,4.3554],[24.006,6.7515,5.6012],[32.3209,8.8302,7.2642],[51.7783,13.6946,11.1557]]. RTP 0.95 for every racer.
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
