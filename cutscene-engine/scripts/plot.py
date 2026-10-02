#!/usr/bin/env python3
import json, sys, os
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
d = json.load(open(sys.argv[1])); out = sys.argv[2]
def style(ax):
    ax.set_facecolor('#fcfcfb'); ax.grid(True, color='#e6e4dd', lw=.8); ax.set_axisbelow(True)
    for s in ('top', 'right'): ax.spines[s].set_visible(False)
fig, (a1, a2) = plt.subplots(1, 2, figsize=(13, 4.6), facecolor='#fcfcfb'); style(a1); style(a2)
names = list(d['presets']); x = list(range(len(names)))
a1.bar([i - .2 for i in x], [100 * d['presets'][n]['pA'] for n in names], width=.4, color='#2a78d6', label='P(A wins) = Live Fight rating')
a1.bar([i + .2 for i in x], [100 * d['presets'][n]['sim']['freqA'] for n in names], width=.4, color='#8a877f', label='simulated coin (100,000)')
for i, n in enumerate(names): a1.annotate(f"A {d['presets'][n]['odds']['A']:.2f}x\nB {d['presets'][n]['odds']['B']:.2f}x", (i, 100 * d['presets'][n]['pA']), xytext=(0, 6), textcoords='offset points', ha='center', fontsize=8)
a1.set_xticks(x); a1.set_xticklabels(names); a1.set_ylabel('%'); a1.set_ylim(0, 100); a1.set_title('Main bet: one biased coin at the fight rating', loc='left', fontsize=11); a1.legend(frameon=False, fontsize=8)
sn = list(d['side']); xs = list(range(len(sn)))
a2.bar(xs, [100 * d['side'][n]['rtp'] for n in sn], color='#1baf7a'); a2.axhline(95, color='#141412', lw=.8, ls='--')
for i, n in enumerate(sn): a2.annotate(' / '.join(f"{o:.2f}x" for o in d['side'][n]['odds']) if d['side'][n]['odds'] else 'bands ' + ', '.join(str(p) for p in d['side'][n]['payouts']), (i, 100 * d['side'][n]['rtp']), xytext=(0, 4), textcoords='offset points', ha='center', fontsize=7.5)
a2.set_xticks(xs); a2.set_xticklabels(sn, fontsize=8); a2.set_ylim(85, 100); a2.set_ylabel('simulated return, %'); a2.set_title('Side-bet library: every entry returns its RTP', loc='left', fontsize=11)
plt.tight_layout(); plt.savefig(os.path.join(out, 'cutscene.png'), dpi=130); plt.close(); print('wrote cutscene.png')
