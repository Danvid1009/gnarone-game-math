// Storage-auction ladder: bids [1.38,1.9,2.63,3.62,5,6.9,9.52,13.13,18.12,25], RTP 0.95. Survival to rung k = RTP / c_k; the locker multiplier has mean 1,
// so taking the locker after any number of bids returns 0.95. u: one uniform in [0,1). s: bids made before the hammer (1..10).
function settle(u, s) {
  const cum = [0,0.31159420289855067,0.5,0.6387832699619772,0.7375690607734806,0.8099999999999999,0.8623188405797101,0.9002100840336134,0.9276466108149276,0.9475717439293598,0.962,1], bids = [1.38,1.9,2.63,3.62,5,6.9,9.52,13.13,18.12,25];
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
