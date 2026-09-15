#!/usr/bin/env python3
import json, sys, os
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
sim = json.load(open(sys.argv[1])); out = sys.argv[2]
ns = sorted(int(k) for k in sim)
fig, ax = plt.subplots(figsize=(10, 4.6), facecolor='#fcfcfb'); ax.set_facecolor('#fcfcfb'); ax.grid(True, color='#e6e4dd', lw=.8, axis='y'); ax.set_axisbelow(True)
for s in ('top', 'right'): ax.spines[s].set_visible(False)
ax.bar(range(len(ns)), [sim[str(n)]['odds'] for n in ns], color='#2a78d6', width=.5, label='odds = n × RTP')
ax2 = ax.twinx(); ax2.errorbar(range(len(ns)), [sim[str(n)]['rtp'] for n in ns], yerr=[1.96 * sim[str(n)]['se'] for n in ns], fmt='o', color='#eb6834', capsize=3, label='simulated RTP, 95% CI (200,000 rounds)'); ax2.axhline(0.95, color='#eb6834', lw=1, ls='--'); ax2.set_ylim(0.9, 1.0); ax2.set_ylabel('RTP', color='#eb6834'); ax2.spines['top'].set_visible(False)
ax.set_xticks(range(len(ns))); ax.set_xticklabels([f"{n} options\nstdev {sim[str(n)]['stdev']:.2f}×" for n in ns]); ax.set_ylabel('odds (× stake)')
h1, l1 = ax.get_legend_handles_labels(); h2, l2 = ax2.get_legend_handles_labels(); ax.legend(h1 + h2, l1 + l2, frameon=False, loc='upper left', fontsize=9)
ax.set_title('Pick One at RTP 0.95: equal options pay n × RTP; every option returns exactly the RTP', loc='left', fontsize=11, fontweight='600', color='#141412')
plt.tight_layout(); plt.savefig(os.path.join(out, 'pick.png'), dpi=130); print('wrote pick.png')
