#!/usr/bin/env python3
"""python3 scripts/plot.py examples/facts.json examples/  ->  rating.png, paths.png, check.png"""
import json, sys, os
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
d = json.load(open(sys.argv[1])); out = sys.argv[2]
def style(ax):
    ax.set_facecolor('#fcfcfb'); ax.grid(True, color='#e6e4dd', lw=.8); ax.set_axisbelow(True)
    for s in ('top', 'right'): ax.spines[s].set_visible(False)
fig, (a1, a2) = plt.subplots(1, 2, figsize=(13, 4.8), facecolor='#fcfcfb'); style(a1); style(a2)
a1.plot([g for g, _ in d['gaps']], [100 * p for _, p in d['gaps']], color='#2a78d6', lw=2, marker='o', ms=3)
a1.axhline(50, color='#141412', lw=.8, ls='--'); a1.set_xlabel('power gap A − B (Elo, scale 1200)'); a1.set_ylabel('P(A wins) at the bell, %'); a1.set_title('Rating vs power gap (both 100 HP)', loc='left', fontsize=11)
a2.plot([h for h, _ in d['hpGaps']], [100 * p for _, p in d['hpGaps']], color='#1baf7a', lw=2, marker='o', ms=3)
a2.axhline(50, color='#141412', lw=.8, ls='--'); a2.set_xlabel('A health (B has 100)'); a2.set_ylabel('P(A wins) at the bell, %'); a2.set_title('Rating vs HP (equal power)', loc='left', fontsize=11)
plt.tight_layout(); plt.savefig(os.path.join(out, 'rating.png'), dpi=130); plt.close()
fig, axes = plt.subplots(1, 3, figsize=(15, 4.6), facecolor='#fcfcfb')
for ax, p in zip(axes, d['paths']):
    style(ax); t = [0] + [e['tick'] for e in p['log']]
    ax.plot(t, [p['hp']['A']] + [e['hpA'] for e in p['log']], color='#2a78d6', lw=2, label='A health'); ax.plot(t, [p['hp']['B']] + [e['hpB'] for e in p['log']], color='#eb6834', lw=2, label='B health')
    ax2 = ax.twinx(); ax2.plot(t, [100 * p['pA0']] + [100 * e['pA'] for e in p['log']], color='#141412', lw=1.2, ls='--', label='P(A wins) %'); ax2.set_ylim(0, 100); ax2.set_ylabel('live P(A wins), %')
    ax.set_title(f"{p['seed']}: {p['winner']} by {p['how']} after {len(p['log'])} ticks", loc='left', fontsize=10); ax.set_xlabel('tick'); ax.set_ylabel('health'); ax.legend(loc='lower left', frameon=False, fontsize=8)
plt.tight_layout(); plt.savefig(os.path.join(out, 'paths.png'), dpi=130); plt.close()
fig, (a1, a2) = plt.subplots(1, 2, figsize=(13, 4.6), facecolor='#fcfcfb'); style(a1); style(a2)
names = list(d['presets']); x = range(len(names))
a1.bar([i - .2 for i in x], [100 * d['presets'][n]['pA0'] for n in names], width=.4, color='#2a78d6', label='exact grid')
a1.bar([i + .2 for i in x], [100 * d['presets'][n]['sim']['freqA'] for n in names], width=.4, color='#8a877f', label='simulated (100,000 fights)')
a1.set_xticks(list(x)); a1.set_xticklabels(names); a1.set_ylabel('P(A wins), %'); a1.set_title('Exact rating vs simulation', loc='left', fontsize=11); a1.legend(frameon=False)
for j, (k, lab, col) in enumerate([('rtpA', 'opening bet on A', '#2a78d6'), ('rtpB', 'opening bet on B', '#eb6834')]):
    a2.bar([i + (j - 1) * .27 for i in x], [100 * d['presets'][n]['sim'][k] for n in names], width=.27, color=col, label=lab)
a2.bar([i + .27 for i in x], [100 * d['presets'][n]['sim']['live']['rtp'] for n in names], width=.27, color='#1baf7a', label='live bet on A at tick 5 (fair)')
a2.axhline(95, color='#141412', lw=.8, ls='--'); a2.axhline(100, color='#141412', lw=.8, ls=':'); a2.set_xticks(list(x)); a2.set_xticklabels(names); a2.set_ylabel('simulated return, %'); a2.set_ylim(85, 105)
a2.set_title('Opening bets return the RTP; live bets return 1.0', loc='left', fontsize=11); a2.legend(frameon=False, fontsize=8)
plt.tight_layout(); plt.savefig(os.path.join(out, 'check.png'), dpi=130); plt.close(); print('wrote rating.png, paths.png, check.png')
