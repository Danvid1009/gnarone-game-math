// Sloped-band payout.  RTP = Σ p_i·a_i = 0.950000.  r = 0.05 (0.1 × smallest payout gap 0.5).
// Method: maxent.  u: one uniform in [0,1).  Band i pays a_i − r at its left edge rising to a_i + r at its right edge.
function payout(u) {
  const breaks = [0,0.3080260888755427,0.5679233634032415,0.7872119098815822,0.9433268246673004,0.999655525998475,1];
  const payouts = [0,0.5,1,2,5,20];
  const r = 0.05;
  if (u >= 1) u = 1 - 1e-12;
  let i = 0; while (breaks[i + 1] <= u) i++;
  if (payouts[i] <= 0) return 0;
  const t = (u - breaks[i]) / (breaks[i + 1] - breaks[i]);
  return payouts[i] + r * (2 * t - 1);
}
