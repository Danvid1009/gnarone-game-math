#!/usr/bin/env python3
"""python3 scripts/plot.py examples/race.json examples/  → places.png, zones.png"""
import json, sys, os
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
src = sys.argv[1] if len(sys.argv) > 1 else 'examples/race.json'; out = sys.argv[2] if len(sys.argv) > 2 else 'examples'
d = json.load(open(src)); R = d['racers']; P = d['placeP']; odds = d['odds']; Z = d['zones']
def style(ax):
    ax.set_facecolor('#fcfcfb'); ax.grid(True, color='#e6e4dd', lw=.8, axis='y'); ax.set_axisbelow(True)
    for s in ('top', 'right'): ax.spines[s].set_visible(False)
    for s in ('left', 'bottom'): ax.spines[s].set_color('#cfccc3')
cols = ['#2a78d6', '#eb6834', '#1baf7a']
fig, (a1, a2) = plt.subplots(1, 2, figsize=(14, 5.2), facecolor='#fcfcfb', gridspec_kw={'width_ratios': [1.3, 1]})
style(a1); style(a2)
x = range(len(R)); K = len(P[0]); w = 0.8 / K
for k in range(K):
    a1.bar([i + (k - (K - 1) / 2) * w for i in x], [100 * P[i][k] for i in x], width=w, color=cols[k % 3], label=f'P(finish {k + 1})')
a1.set_xticks(list(x)); a1.set_xticklabels([f"{r['name']}\nElo {r['elo']}\nodds {odds[i]:.2f}" for i, r in enumerate(R)], fontsize=9)
a1.set_ylabel('probability (%)'); a1.legend(frameon=False)
a1.set_title(f"Place probabilities per racer.  Every racer returns RTP {d['rtp']} at its odds.", loc='left', fontsize=11, fontweight='600', color='#141412')
a2.set_title(f"Draw zones: {len(Z)} ordered top-{K} finishes, by probability", loc='left', fontsize=11, fontweight='600', color='#141412')
a2.bar(range(len(Z)), [100 * z['p'] for z in Z], width=1, color='#2a78d6', lw=0)
top = "\n".join(f"{z['zone']:>2}  {' › '.join(z['names'])}   {100 * z['p']:.2f}%" for z in Z[:6])
a2.text(0.98, 0.97, top, transform=a2.transAxes, ha='right', va='top', fontsize=8.5, family='monospace', color='#141412', bbox=dict(boxstyle='round,pad=0.4', fc='#fcfcfb', ec='#cfccc3', lw=.6))
a2.set_xlabel('zone (rank by probability)'); a2.set_ylabel('zone width = probability (%)'); a2.set_ylim(0, max(100 * z['p'] for z in Z) * 1.15)
plt.tight_layout(); plt.savefig(os.path.join(out, 'places.png'), dpi=130); print('wrote places.png')
