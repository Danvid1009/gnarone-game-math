// Storage-auction ladder: bids [1.26,1.58,2,2.51,3.16,3.98,5.01,6.31,7.94,10], RTP 0.95. Survival to rung k = RTP / c_k; the locker multiplier has mean 1,
// so taking the locker after any number of bids returns 0.95. u: one uniform in [0,1). s: bids made before the hammer (1..10).
function settle(u, s) {
  const cum = [0,0.24603174603174605,0.3987341772151899,0.525,0.6215139442231076,0.6993670886075949,0.7613065326633166,0.810379241516966,0.849445324881141,0.880352644836272,0.9049999999999999,1], bids = [1.26,1.58,2,2.51,3.16,3.98,5.01,6.31,7.94,10];
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
