#!/usr/bin/env python3
import json, sys, os
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
d = json.load(open(sys.argv[1])); out = sys.argv[2]; COLS = ['#2a78d6', '#1baf7a', '#eb6834']
def style(ax):
    ax.set_facecolor('#fcfcfb'); ax.grid(True, color='#e6e4dd', lw=.8); ax.set_axisbelow(True)
    for s in ('top', 'right'): ax.spines[s].set_visible(False)
fig, (a1, a2) = plt.subplots(1, 2, figsize=(13, 4.8), facecolor='#fcfcfb'); style(a1); style(a2)
for (name, P), col in zip(d.items(), COLS):
    ks = [s['stage'] for s in P['stages']]
    a1.plot(ks, [100 * s['outbid'] for s in P['stages']], marker='o', color=col, lw=2, label=f'{name}: P(outbid)')
    a1.plot(ks, [100 * s['lockerMean'] for s in P['stages']], marker='s', ls='--', color=col, lw=1.5, label=f'{name}: locker mean %')
a1.axhline(95, color='#141412', lw=.8, ls=':'); a1.set_xlabel('raise k'); a1.set_ylabel('%'); a1.set_title('Rivals thin out, the locker gets richer: H_k and μ_k = (0.95 − H_k)/(1 − H_k)', loc='left', fontsize=10); a1.legend(frameon=False, fontsize=7.5)
for (name, P), col in zip(d.items(), COLS):
    ks = [s['stage'] for s in P['sim']['perStageIndependent']]
    a2.plot(ks, [100 * s['rtp'] for s in P['sim']['perStageIndependent']], marker='o', color=col, lw=2, label=f'{name}: simulated return of raise k')
a2.axhline(95, color='#141412', lw=1, ls='--'); a2.set_ylim(85, 105); a2.set_xlabel('raise k'); a2.set_ylabel('return per unit staked, %'); a2.set_title('Every raise returns the RTP (100,000 draws per raise)', loc='left', fontsize=10); a2.legend(frameon=False, fontsize=8)
plt.tight_layout(); plt.savefig(os.path.join(out, 'stages.png'), dpi=130); plt.close()
fig, ax = plt.subplots(figsize=(9, 4.4), facecolor='#fcfcfb'); style(ax)
for (name, P), col in zip(d.items(), COLS):
    w = P['sim']['wonAtStage']; ax.bar([k + (list(d).index(name) - 1) * 0.27 for k in range(1, len(w))], [100 * x for x in w[1:]], width=0.27, color=col, label=name)
ax.set_xlabel('raise at which the locker was won'); ax.set_ylabel('% of auctions'); ax.set_title('Where auctions end when the player always raises', loc='left', fontsize=11); ax.legend(frameon=False)
plt.tight_layout(); plt.savefig(os.path.join(out, 'won-at.png'), dpi=130); plt.close(); print('wrote stages.png, won-at.png')
