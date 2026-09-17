// Storage-auction ladder: bids [1.58,2.51,3.98,6.31,10,15.85,25.12,39.81,63.1,100], RTP 0.95. Survival to rung k = RTP / c_k; the locker multiplier has mean 1,
// so taking the locker after any number of bids returns 0.95. u: one uniform in [0,1). s: bids made before the hammer (1..10).
function settle(u, s) {
  const cum = [0,0.3987341772151899,0.6215139442231076,0.7613065326633166,0.8494453248811411,0.905,0.9400630914826499,0.9621815286624205,0.976136649083145,0.9849445324881142,0.9905,1], bids = [1.58,2.51,3.98,6.31,10,15.85,25.12,39.81,63.1,100];
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
