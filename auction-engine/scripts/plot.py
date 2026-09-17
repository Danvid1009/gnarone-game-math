#!/usr/bin/env python3
"""python3 scripts/plot.py examples/sim.json examples/  ->  ladders.png, locker.png, strategies.png"""
import json, sys, os
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
src = sys.argv[1] if len(sys.argv) > 1 else 'sim.json'; outdir = sys.argv[2] if len(sys.argv) > 2 else '.'
d = json.load(open(src)); COLS = ['#2a78d6', '#1baf7a', '#eda100', '#eb6834']
def style(ax):
    ax.set_facecolor('#fcfcfb'); ax.grid(True, color='#e6e4dd', lw=.8); ax.set_axisbelow(True)
    for s in ('top', 'right'): ax.spines[s].set_visible(False)
    for s in ('left', 'bottom'): ax.spines[s].set_color('#cfccc3')
ladders = list(d['ladders'].items()); N = d['steps']

# 1. bids per rung and survival, four sizes
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5.5), facecolor='#fcfcfb')
for ax in (ax1, ax2): style(ax)
for (name, L), col in zip(ladders, COLS):
    ks = list(range(1, N + 1))
    ax1.plot(ks, L['bids'], marker='o', color=col, lw=2, label=f"{name}: top {L['maxWin']}×, step ×{L['stepMultiple']:.3f}")
    ax2.plot([0] + ks, L['survival'], marker='o', color=col, lw=2, label=name)
ax1.set_yscale('log'); ax1.set_xticks(range(1, N + 1)); ax1.set_xlabel('successful bids k'); ax1.set_ylabel('locker value c_k (× stake, log)')
ax1.set_title(f"Locker value per rung — c_k = round(M^(k/N), 2), same rungs as the stepper", loc='left', fontsize=11, color='#141412'); ax1.legend(frameon=False, fontsize=9)
ax2.set_yscale('log'); ax2.set_xticks(range(0, N + 1)); ax2.set_xlabel('successful bids k'); ax2.set_ylabel('P(not outbid before rung k), log')
ax2.set_title(f"Survival — G_k = RTP / c_k, so G_k · c_k = {d['rtp']} at every rung", loc='left', fontsize=11, color='#141412'); ax2.legend(frameon=False, fontsize=9)
plt.tight_layout(); plt.savefig(os.path.join(outdir, 'ladders.png'), dpi=130); plt.close()

# 2. the locker: X(v) over the residual, and the payout distribution for "take after 5" (medium), design vs simulated
B = ladders[1][1]['box']; L = ladders[1][1]
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5), facecolor='#fcfcfb')
for ax in (ax1, ax2): style(ax)
vs = [i / 4000 for i in range(4000)]
def X(v):
    i = 0
    while B['breaks'][i + 1] <= v: i += 1
    a = B['payouts'][i]
    return 0 if a <= 0 else a + B['r'] * (2 * (v - B['breaks'][i]) / (B['breaks'][i + 1] - B['breaks'][i]) - 1)
ax1.plot(vs, [X(v) for v in vs], color='#2a78d6', lw=2)
for b in B['bands']:
    ax1.axvspan(b['from'], b['to'], color=('#2a78d6' if b['index'] % 2 else '#eb6834'), alpha=.06)
    ax1.annotate(f"{b['multiple']}×\n{100*b['p']:.1f}%", ((b['from'] + b['to']) / 2, b['multiple']), xytext=(0, 10), textcoords='offset points', ha='center', fontsize=8.5)
ax1.set_yscale('log'); ax1.set_xlabel('residual v = (u − e_K) / (e_{K+1} − e_K)'); ax1.set_ylabel('locker multiplier X (log)')
ax1.set_title(f"The locker — sloped bands, r = {B['r']}, E[X] = {B['mean']:.4f}", loc='left', fontsize=11, color='#141412')
rule = L['rules']['take after 5']; k = 5; Gk = L['survival'][k]; ck = L['bids'][k - 1]
labels = ['outbid\n(0)'] + [f"{a}× · {ck}\n= {a*ck:.2f}" for a in B['payouts']]
design = [1 - Gk] + [Gk * p for p in B['probabilities']]; sim = [rule['outbidFreq']] + rule['bandFreq']
xs = list(range(len(labels)))
ax2.bar([x - .2 for x in xs], design, width=.4, color='#1baf7a', alpha=.85, label='design')
ax2.bar([x + .2 for x in xs], sim, width=.4, color='#8a877f', alpha=.7, label=f"simulated ({d['rounds']:,} rounds)")
ax2.set_xticks(xs); ax2.set_xticklabels(labels, fontsize=8); ax2.set_ylabel('probability')
ax2.set_title(f"'Take after 5', medium: P(outbid) = 1 − G_5, P(band j) = G_5·p_j; mean {Gk:.3f}·{ck}·1 = {d['rtp']}", loc='left', fontsize=10, color='#141412'); ax2.legend(frameon=False, fontsize=9)
plt.tight_layout(); plt.savefig(os.path.join(outdir, 'locker.png'), dpi=130); plt.close()

# 3. strategy-proofness
fig, ax = plt.subplots(figsize=(12, 5), facecolor='#fcfcfb'); style(ax)
rules = list(ladders[0][1]['rules'].keys()); x = list(range(len(rules)))
for j, ((name, L), col) in enumerate(zip(ladders, COLS)):
    ys = [L['rules'][r]['rtp'] for r in rules]; es = [1.96 * L['rules'][r]['se'] for r in rules]
    ax.errorbar([xi + (j - 1.5) * 0.18 for xi in x], ys, yerr=es, fmt='o', color=col, capsize=3, lw=1.5, label=name)
ax.axhline(d['rtp'], color='#141412', lw=1, ls='--'); ax.text(len(rules) - 0.5, d['rtp'], f"  design RTP {d['rtp']}", va='center', fontsize=9)
ax.set_xticks(x); ax.set_xticklabels(rules); ax.set_ylabel('simulated RTP (95% CI)')
ax.set_title(f"Strategy-proof: every hammer rule returns the design RTP, locker included  ({d['rounds']:,} rounds per point)", loc='left', fontsize=11, color='#141412'); ax.legend(frameon=False)
plt.tight_layout(); plt.savefig(os.path.join(outdir, 'strategies.png'), dpi=130); plt.close()
print(f"wrote {outdir}/ladders.png, locker.png, strategies.png")
