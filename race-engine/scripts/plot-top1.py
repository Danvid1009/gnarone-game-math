#!/usr/bin/env python3
import json, sys, os
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
src = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else 'examples'
d = json.load(open(src)); R = d['racers']; q1 = [q[0] for q in d['q']]; M1 = [m[0] for m in d['M']]
fig, ax = plt.subplots(figsize=(12, 5), facecolor='#fcfcfb'); ax.set_facecolor('#fcfcfb'); ax.grid(True, color='#e6e4dd', lw=.8, axis='y'); ax.set_axisbelow(True)
for s in ('top', 'right'): ax.spines[s].set_visible(False)
x = range(len(R)); ax.bar(x, [100 * v for v in q1], color='#2a78d6', width=.6, label='P(win) = wᵢ / W')
ax2 = ax.twinx(); ax2.plot(list(x), M1, 'o-', color='#eb6834', lw=1.5, label='odds M₁ = RTP / P(win)'); ax2.set_yscale('log'); ax2.set_ylabel('odds (log)', color='#eb6834'); ax2.spines['top'].set_visible(False)
ax.set_xticks(list(x)); ax.set_xticklabels([f"{r['name']}\n{r['elo']}" for r in R], fontsize=9); ax.set_ylabel('%')
h1, l1 = ax.get_legend_handles_labels(); h2, l2 = ax2.get_legend_handles_labels(); ax.legend(h1 + h2, l1 + l2, frameon=False, loc='upper center')
ax.set_title(f"Top 1: win probability per racer and the odds that return RTP {d['rtp']} for every racer", loc='left', fontsize=11, fontweight='600', color='#141412')
plt.tight_layout(); plt.savefig(os.path.join(out, 'top1.png'), dpi=130); print('wrote top1.png')
