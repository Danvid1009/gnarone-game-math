// Sloped-band payout.  RTP = Σ p_i·a_i = 0.950000.  r = 0.05 (0.1 × smallest payout gap 0.5).
// Method: weights.  u: one uniform in [0,1).  Band i pays a_i − r at its left edge rising to a_i + r at its right edge.
function payout(u) {
  const breaks = [0,0.24,0.62,0.848,0.962,0.9924,1];
  const payouts = [0,0.5,1,2,5,20];
  const r = 0.05;
  if (u >= 1) u = 1 - 1e-12;
  let i = 0; while (breaks[i + 1] <= u) i++;
  if (payouts[i] <= 0) return 0;
  const t = (u - breaks[i]) / (breaks[i + 1] - breaks[i]);
  return payouts[i] + r * (2 * t - 1);
}
