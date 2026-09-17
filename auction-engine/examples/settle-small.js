// Storage-auction ladder: bids [1.17,1.38,1.62,1.9,2.24,2.63,3.09,3.62,4.26,5], RTP 0.95. Survival to rung k = RTP / c_k; the locker multiplier has mean 1,
// so taking the locker after any number of bids returns 0.95. u: one uniform in [0,1). s: bids made before the hammer (1..10).
function settle(u, s) {
  const cum = [0,0.18803418803418803,0.31159420289855067,0.4135802469135803,0.5,0.5758928571428572,0.6387832699619772,0.6925566343042071,0.7375690607734806,0.7769953051643192,0.81,1], bids = [1.17,1.38,1.62,1.9,2.24,2.63,3.09,3.62,4.26,5];
  if (u >= 1) u = 1 - 1e-12;
  let K = 0; while (cum[K + 1] <= u) K++;                 // successful bids before the rival wins
  if (s < 1 || s > K) return 0;                             // outbid before the hammer
  if (s > 10) s = 10;
  const v = (u - cum[K]) / (cum[K + 1] - cum[K]);         // recycled residual: the locker draw
  const breaks = [0,0.29757173827099437,0.5687287943457514,0.7938826387002067,0.9491200098530563,1], mult = [0.25,0.5,1,2,5], r = 0.025;
  let i = 0; while (breaks[i + 1] <= v) i++;
  const X = mult[i] <= 0 ? 0 : mult[i] + r * (2 * (v - breaks[i]) / (breaks[i + 1] - breaks[i]) - 1);
  return bids[s - 1] * X;
}
