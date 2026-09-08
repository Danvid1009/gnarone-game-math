// Fair ladder: returns [1.26,1.58,2,2.51,3.16,3.98,5.01,6.31,7.94,10], RTP 0.97. Survival to rung k = RTP / c_k, so every stopping rule returns 0.97.
// u: one uniform in [0,1). Returns K = rungs survived (0 = instant crash, 10 = golden egg). Pay c[k-1] if the player stops at k <= K, else 0.
function crashStep(u) {
  const cum = [0,0.23015873015873023,0.38607594936708867,0.515,0.6135458167330676,0.6930379746835442,0.7562814070351758,0.8063872255489021,0.8462757527733755,0.8778337531486146,0.9029999999999999,1];
  if (u >= 1) u = 1 - 1e-12;
  let k = 0; while (cum[k + 1] <= u) k++;
  return k;
}
