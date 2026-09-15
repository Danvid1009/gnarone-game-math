#!/usr/bin/env python3
import json, sys, os
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
d = json.load(open(sys.argv[1])); sim = json.load(open(sys.argv[2])); out = sys.argv[3]
def style(ax):
    ax.set_facecolor('#fcfcfb'); ax.grid(True, color='#e6e4dd', lw=.8, axis='y'); ax.set_axisbelow(True)
    for s in ('top', 'right'): ax.spines[s].set_visible(False)
fig, axes = plt.subplots(1, 2, figsize=(14, 5), facecolor='#fcfcfb')
for ax, (m, c) in zip(axes, [('BASE', '#2a78d6'), ('BOOSTED', '#eb6834')]):
    style(ax); M = d['modes'][m]; z = M['zones']
    ax.bar(range(len(z)), [100 * x['p'] for x in z], color=c, width=.8)
    ax.set_xticks(range(len(z))); ax.set_xticklabels([f"{x['count']}r" + (f"\n{x['gem']}×" if x['gem'] else '') for x in z], fontsize=8)
    ax.set_yscale('log'); ax.set_ylabel('probability (%, log)'); ax.set_xlabel('outcome zone (rocks crushed, gem)')
    ax2 = ax.twinx(); ax2.plot(range(len(z)), [x['multiple'] for x in z], 'o-', color='#141412', lw=1, ms=4, label='multiple of stake'); ax2.set_yscale('log'); ax2.set_ylabel('multiple (log)'); ax2.spines['top'].set_visible(False); ax2.legend(frameon=False, fontsize=9)
    s = sim[m]; ax.set_title(f"{m}: exact RTP {M['rtp']:.4f}, simulated {s['rtp']:.4f} ± {1.96 * s['se']:.4f}", loc='left', fontsize=10.5, fontweight='600', color='#141412')
plt.tight_layout(); plt.savefig(os.path.join(out, 'smash.png'), dpi=130); print('wrote smash.png')
