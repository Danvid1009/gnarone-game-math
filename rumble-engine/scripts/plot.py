#!/usr/bin/env python3
import json, sys, os
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
d = json.load(open(sys.argv[1])); sim = json.load(open(sys.argv[2])); out = sys.argv[3]
def style(ax):
    ax.set_facecolor('#fcfcfb'); ax.grid(True, color='#e6e4dd', lw=.8, axis='y'); ax.set_axisbelow(True)
    for s in ('top', 'right'): ax.spines[s].set_visible(False)
fig, (a1, a2) = plt.subplots(1, 2, figsize=(14, 5), facecolor='#fcfcfb'); style(a1); style(a2)
for k, c in [('low', '#2a78d6'), ('high', '#eb6834')]:
    b = d['buckets'][k]; z = b['top']
    a1.bar([f"{k}\nL{x['counts']['LEGENDARY']}R{x['counts']['RARE']}U{x['counts']['UNCOMMON']}C{x['counts']['COMMON']}" for x in z], [100 * x['p'] for x in z], color=c, label=f"{k} bucket (E={b['meanCredits']:.3f}, RTP alone {b['rtpAlone']:.3f})")
a1.tick_params(axis='x', labelsize=7, rotation=60); a1.set_ylabel('probability (%)'); a1.legend(frameon=False, fontsize=9)
a1.set_title('Most likely pack compositions per bucket (hypergeometric, exact)', loc='left', fontsize=11, fontweight='600', color='#141412')
ts = list(d['betTypes'].keys()); x = range(len(ts))
a2.bar(x, [100 * d['betTypes'][t]['pLow'] for t in ts], color='#2a78d6', width=.5, label='P(low bucket), solved for RTP')
a2.set_xticks(list(x)); a2.set_xticklabels([t.replace('_', '\n') for t in ts], fontsize=9); a2.set_ylabel('%')
ax2 = a2.twinx(); ax2.errorbar(list(x), [sim[t]['rtp'] for t in ts], yerr=[1.96 * sim[t]['se'] for t in ts], fmt='o', color='#eb6834', capsize=3, label='simulated RTP, 95% CI'); ax2.axhline(d['rtp'], color='#eb6834', lw=1, ls='--'); ax2.set_ylim(0.9, 1.0); ax2.set_ylabel('RTP', color='#eb6834'); ax2.spines['top'].set_visible(False)
h1, l1 = a2.get_legend_handles_labels(); h2, l2 = ax2.get_legend_handles_labels(); a2.legend(h1 + h2, l1 + l2, frameon=False, fontsize=9, loc='lower left')
a2.set_title(f"Bucket mix per bet type and realised RTP (target {d['rtp']})", loc='left', fontsize=11, fontweight='600', color='#141412')
plt.tight_layout(); plt.savefig(os.path.join(out, 'rumble.png'), dpi=130); print('wrote rumble.png')
