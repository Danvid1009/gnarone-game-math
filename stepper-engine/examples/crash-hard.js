// Fair ladder: returns [1.58,2.51,3.98,6.31,10,15.85,25.12,39.81,63.1,100], RTP 0.97. Survival to rung k = RTP / c_k, so every stopping rule returns 0.97.
// u: one uniform in [0,1). Returns K = rungs survived (0 = instant crash, 10 = golden egg). Pay c[k-1] if the player stops at k <= K, else 0.
function crashStep(u) {
  const cum = [0,0.38607594936708867,0.6135458167330676,0.7562814070351758,0.8462757527733755,0.9029999999999999,0.938801261829653,0.9613853503184713,0.9756342627480532,0.9846275752773375,0.9903,1];
  if (u >= 1) u = 1 - 1e-12;
  let k = 0; while (cum[k + 1] <= u) k++;
  return k;
}
