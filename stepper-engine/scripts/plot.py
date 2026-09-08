#!/usr/bin/env python3
"""python3 scripts/plot.py examples/sim.json examples/  ->  ladders.png, crash.png, strategies.png"""
import json, sys, os
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt

src = sys.argv[1] if len(sys.argv) > 1 else 'sim.json'
outdir = sys.argv[2] if len(sys.argv) > 2 else '.'
d = json.load(open(src))
COLS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4']
def style(ax):
    ax.set_facecolor('#fcfcfb'); ax.grid(True, color='#e6e4dd', lw=.8); ax.set_axisbelow(True)
    for s in ('top', 'right'): ax.spines[s].set_visible(False)
    for s in ('left', 'bottom'): ax.spines[s].set_color('#cfccc3')
ladders = list(d['ladders'].items())

# 1. ladders: return per rung, and survival to each rung (log y)
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5.5), facecolor='#fcfcfb')
for ax in (ax1, ax2): style(ax)
for (name, L), col in zip(ladders, COLS):
    ks = list(range(1, L['steps'] + 1))
    ax1.plot(ks, L['returns'], marker='o', color=col, lw=2, label=f"{name}: max {L['maxWin']}×, step ×{L['stepMultiple']:.3f}")
    ax2.plot([0] + ks, L['survival'], marker='o', color=col, lw=2, label=name)
    for k, (c, g) in enumerate(zip(L['returns'], L['survival'][1:]), 1):
        if k in (1, 5, 10): ax2.annotate(f"{100*g:.1f}%", (k, g), xytext=(4, 4), textcoords='offset points', fontsize=7.5, color=col)
ax1.set_yscale('log'); ax1.set_xticks(range(1, 11)); ax1.set_xlabel('rung k'); ax1.set_ylabel('return c_k (× stake, log)')
ax1.set_title(f"Returns per rung  —  c_k = round(M^(k/N), 2), RTP {d['rtp']}", loc='left', fontsize=11, color='#141412'); ax1.legend(frameon=False, fontsize=9)
ax2.set_yscale('log'); ax2.set_xticks(range(0, 11)); ax2.set_xlabel('rung k'); ax2.set_ylabel('P(survive to at least rung k), log')
ax2.set_title("Survival  —  G_k = RTP / c_k, so G_k · c_k = RTP at every rung", loc='left', fontsize=11, color='#141412'); ax2.legend(frameon=False, fontsize=9)
plt.tight_layout(); plt.savefig(os.path.join(outdir, 'ladders.png'), dpi=130); plt.close()

# 2. crash-point distribution: design vs simulated
fig, axes = plt.subplots(1, len(ladders), figsize=(5 * len(ladders), 4.6), facecolor='#fcfcfb', squeeze=False)
for ax, (name, L), col in zip(axes[0], ladders, COLS):
    style(ax); N = L['steps']; ks = list(range(N + 1))
    sim = L['rules']['never stop']['crashFreq']
    ax.bar([k - 0.2 for k in ks], L['probabilities'], width=0.4, color=col, alpha=.85, label='design P(event)')
    ax.bar([k + 0.2 for k in ks], sim, width=0.4, color='#8a877f', alpha=.7, label=f"simulated ({d['rounds']:,} rounds)")
    ax.set_xticks(ks); ax.set_xticklabels(['crash\ninstant'] + [f"after\n{k}" for k in range(1, N)] + ['golden\negg'], fontsize=7.5)
    ax.set_title(f"{name}  (max {L['maxWin']}×) — where the single RN lands", loc='left', fontsize=10, color='#141412'); ax.set_ylabel('probability')
    ax.legend(frameon=False, fontsize=8)
plt.tight_layout(); plt.savefig(os.path.join(outdir, 'crash.png'), dpi=130); plt.close()

# 3. strategy-proofness: simulated RTP under each stopping rule, with 95% CI
fig, ax = plt.subplots(figsize=(12, 5), facecolor='#fcfcfb'); style(ax)
rules = list(ladders[0][1]['rules'].keys()); x = list(range(len(rules)))
for j, ((name, L), col) in enumerate(zip(ladders, COLS)):
    ys = [L['rules'][r]['rtp'] for r in rules]; es = [1.96 * L['rules'][r]['se'] for r in rules]
    ax.errorbar([xi + (j - 1) * 0.22 for xi in x], ys, yerr=es, fmt='o', color=col, capsize=3, lw=1.5, label=name)
ax.axhline(d['rtp'], color='#141412', lw=1, ls='--'); ax.text(len(rules) - 0.5, d['rtp'], f"  design RTP {d['rtp']}", va='center', fontsize=9)
ax.set_xticks(x); ax.set_xticklabels(rules); ax.set_ylabel('simulated RTP (95% CI)')
ax.set_title(f"Strategy-proof: every stopping rule returns the design RTP  ({d['rounds']:,} rounds per point)", loc='left', fontsize=11, color='#141412')
ax.legend(frameon=False)
plt.tight_layout(); plt.savefig(os.path.join(outdir, 'strategies.png'), dpi=130); plt.close()
print(f"wrote {outdir}/ladders.png, crash.png, strategies.png")
