#!/usr/bin/env python3
"""python3 scripts/plot-sim.py examples/sim-place-terms.json examples/  → sim-place-terms.png"""
import json, sys, os
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
src = sys.argv[1] if len(sys.argv) > 1 else 'examples/sim-place-terms.json'; out = sys.argv[2] if len(sys.argv) > 2 else 'examples'
d = json.load(open(src)); R = d['rows']; n = len(R)
def style(ax):
    ax.set_facecolor('#fcfcfb'); ax.grid(True, color='#e6e4dd', lw=.8, axis='y'); ax.set_axisbelow(True)
    for s in ('top', 'right'): ax.spines[s].set_visible(False)
    for s in ('left', 'bottom'): ax.spines[s].set_color('#cfccc3')
fig, ax = plt.subplots(1, 3, figsize=(17, 5.4), facecolor='#fcfcfb', gridspec_kw={'width_ratios': [1.2, 1.2, 1]})
for a in ax: style(a)
xs = list(range(n)); labels = [f"{r['racer']}\n{r['elo']}" for r in R]; w = 0.27
for k, (c, lab) in enumerate([('#2a78d6', 'M₁ = 1 + P'), ('#eb6834', 'M₂ = 1 + P/4'), ('#1baf7a', 'M₃ = 1 + P/5')]):
    ax[0].bar([i + (k - 1) * w for i in xs], [r['M'][k] for r in R], width=w, color=c, label=lab)
ax[0].set_yscale('log'); ax[0].set_xticks(xs); ax[0].set_xticklabels(labels, fontsize=8); ax[0].set_ylabel('multiple of stake (log)'); ax[0].legend(frameon=False, loc='upper left')
ax[0].set_title('Per-racer place-terms multipliers', loc='left', fontsize=11, fontweight='600', color='#141412')
ax[1].axhline(d['RTP'], color='#2a78d6', lw=2, label=f"design RTP {d['RTP']} (exact, every racer)")
ax[1].errorbar(xs, [r['simRtp'] for r in R], yerr=[1.96 * r['se'] for r in R], fmt='o', color='#eb6834', ecolor='#eb6834', capsize=3, label=f"simulated, {d['RACES']:,} races, 95% CI")
ax[1].axhline(d['pooled'], color='#8a877f', lw=1, ls='--', label=f"pooled over {n} bettors {d['pooled']:.4f}")
ax[1].set_xticks(xs); ax[1].set_xticklabels(labels, fontsize=8); ax[1].set_ylim(0.88, 1.02); ax[1].set_ylabel('return per unit staked'); ax[1].legend(frameon=False, loc='lower left', fontsize=9)
ax[1].set_title('Realised RTP per racer', loc='left', fontsize=11, fontweight='600', color='#141412')
for r, c, lab in [(R[0], '#2a78d6', f"racer 1 (Elo {R[0]['elo']})"), (R[-1], '#eb6834', f"racer {n} (Elo {R[-1]['elo']})")]:
    h = r['hist']; keys = sorted(h, key=float); vals = [100 * h[k] / d['RACES'] for k in keys]
    ax[2].bar([float(k) for k in keys], vals, width=[0.35 if float(k) < 3 else 0.06 * float(k) for k in keys], color=c, alpha=.75, label=lab)
    for k, v in zip(keys, vals):
        if v > 2: ax[2].text(float(k), v + 1, f"{v:.1f}%", ha='center', fontsize=7.5, color=c)
ax[2].set_xscale('symlog', linthresh=2); ax[2].set_xlim(-0.5, 80); ax[2].set_ylabel('% of races'); ax[2].set_xlabel('multiple paid (symlog)'); ax[2].legend(frameon=False, fontsize=9)
ax[2].set_title('Payout distribution: favourite vs outsider', loc='left', fontsize=11, fontweight='600', color='#141412')
fig.suptitle(f"n = {n} racers, one recycled uniform per race, stake 1 on every racer every race.  Place terms: 2nd pays {d['PA']:g}, 3rd pays {d['PB']:g} of the win profit; win profit solved per racer for RTP {d['RTP']}.", x=0.01, ha='left', fontsize=11.5, fontweight='600', color='#141412')
plt.tight_layout(rect=(0, 0, 1, 0.93)); plt.savefig(os.path.join(out, 'sim-place-terms.png'), dpi=130); print('wrote sim-place-terms.png')
