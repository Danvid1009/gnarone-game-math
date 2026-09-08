// Fair ladder: returns [1.38,1.9,2.63,3.62,5,6.9,9.52,13.13,18.12,25], RTP 0.97. Survival to rung k = RTP / c_k, so every stopping rule returns 0.97.
// u: one uniform in [0,1). Returns K = rungs survived (0 = instant crash, 10 = golden egg). Pay c[k-1] if the player stops at k <= K, else 0.
function crashStep(u) {
  const cum = [0,0.2971014492753623,0.4894736842105263,0.6311787072243347,0.7320441988950277,0.806,0.8594202898550725,0.898109243697479,0.9261233815689262,0.9464679911699779,0.9612,1];
  if (u >= 1) u = 1 - 1e-12;
  let k = 0; while (cum[k + 1] <= u) k++;
  return k;
}
