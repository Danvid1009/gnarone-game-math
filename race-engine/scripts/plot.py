#!/usr/bin/env python3
"""python3 scripts/plot.py examples/race.json examples/  → places.png (q per racer + multipliers)"""
import json, sys, os
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
src = sys.argv[1] if len(sys.argv) > 1 else 'examples/race.json'; out = sys.argv[2] if len(sys.argv) > 2 else 'examples'
d = json.load(open(src)); R = d['racers']; q = d['q']; M = d['M']
def style(ax):
    ax.set_facecolor('#fcfcfb'); ax.grid(True, color='#e6e4dd', lw=.8, axis='y'); ax.set_axisbelow(True)
    for s in ('top', 'right'): ax.spines[s].set_visible(False)
    for s in ('left', 'bottom'): ax.spines[s].set_color('#cfccc3')
cols = ['#2a78d6', '#eb6834', '#1baf7a']
fig, (a1, a2) = plt.subplots(1, 2, figsize=(15, 5.4), facecolor='#fcfcfb')
style(a1); style(a2); x = range(len(R)); w = 0.26
for k in range(3):
    a1.bar([i + (k - 1) * w for i in x], [100 * q[i][k] for i in x], width=w, color=cols[k], label=f'q_i{k + 1} (finish {k + 1})')
a1.plot(list(x), [100 * d['feasibleBound']] * len(R), color='#8a877f', lw=1, ls='--', label=f"feasibility bound RTP/M₃ = {100 * d['feasibleBound']:.1f}% (on top-3 sum)")
a1.plot(list(x), [100 * t for t in d['top3']], 'o-', color='#141412', lw=1, ms=4, label='top-3 probability')
a1.set_xticks(list(x)); a1.set_xticklabels([f"{r['name']}\n{r['elo']}" for r in R], fontsize=8); a1.set_ylabel('%'); a1.legend(frameon=False, fontsize=8.5)
a1.set_title('Closed-form win / place / show probabilities', loc='left', fontsize=11, fontweight='600', color='#141412')
for k, lab in enumerate(['M₁ (solved)', 'M₂ = M₃ + θ(M₁ − M₃)', 'M₃ (fixed)']):
    a2.bar([i + (k - 1) * w for i in x], [M[i][k] for i in x], width=w, color=cols[k], label=lab)
a2.set_yscale('log'); a2.set_xticks(list(x)); a2.set_xticklabels([r['name'] for r in R], fontsize=8); a2.set_ylabel('multiple of stake (log)'); a2.legend(frameon=False, fontsize=8.5)
s = d['structure']; a2.set_title(f"Payout multipliers, RTP {d['rtp']} for every racer.  M₃ = {s.get('m3', 1.4)}, θ = {s.get('theta', 0.5)}", loc='left', fontsize=11, fontweight='600', color='#141412')
plt.tight_layout(); plt.savefig(os.path.join(out, 'places.png'), dpi=130); print('wrote places.png')
