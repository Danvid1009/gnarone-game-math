#!/usr/bin/env python3
"""Plot a simulation written by bin/simulate.js.

    python3 scripts/plot.py examples/sim.json examples/

Writes <outdir>/curves.png (payout vs draw, one panel per method) and
<outdir>/bands.png (distribution inside each band, one row per method).
Needs matplotlib.
"""
import json, sys, os
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt

src = sys.argv[1] if len(sys.argv) > 1 else 'sim.json'
outdir = sys.argv[2] if len(sys.argv) > 2 else '.'
d = json.load(open(src)); N = 10000
BAND_COLS = ['#8a877f', '#2a78d6', '#1baf7a', '#eda100', '#e87ba4', '#4a3aa7', '#008300', '#eb6834']
TITLES = {'maxent': 'maxent  —  pᵢ ∝ exp(−λ·aᵢ)', 'geometric': 'geometric  —  pᵢ ∝ qⁱ', 'weights': 'weights  —  user weights, zero solved'}

def style(ax):
    ax.set_facecolor('#fcfcfb'); ax.grid(True, color='#e6e4dd', lw=.8); ax.set_axisbelow(True)
    for s in ('top', 'right'): ax.spines[s].set_visible(False)
    for s in ('left', 'bottom'): ax.spines[s].set_color('#cfccc3')

methods = list(d['methods'].items())
r = methods[0][1]['r']
pay_str = ' / '.join(str(a) for a in d['payouts'])

# ── curves ──────────────────────────────────────────────────────────────────────────────
fig, axes = plt.subplots(len(methods), 1, figsize=(13, 4.7 * len(methods)), facecolor='#fcfcfb', sharex=True, squeeze=False)
fig.suptitle(f"Sloped bands — payouts {pay_str}×, RTP {d['rtp']}, r = {r:g}  ({min(10000, d['rounds']):,} of {d['rounds']:,} rounds shown)", x=0.01, ha='left', fontsize=11.5, fontweight='600', color='#141412')
ymax = max(d['payouts']) * 1.6
for ax, (m, M) in zip(axes[:, 0], methods):
    style(ax); Bx = M['grid']['boundaries']; bands = M['bands']
    for i, b in enumerate(bands): ax.axvspan(Bx[i], Bx[i + 1], color=BAND_COLS[i % len(BAND_COLS)], alpha=.06, lw=0)
    ax.scatter([p[0] for p in M['pts']], [p[1] for p in M['pts']], s=6, color='#eb6834', alpha=.5, lw=0, zorder=3)
    for i, b in enumerate(bands):
        x0, x1 = Bx[i], Bx[i + 1]
        ax.plot([x0, x1], b['range'], color='#2a78d6', lw=2.4, zorder=4)
        if i > 0: ax.plot([x0, x0], [bands[i - 1]['range'][1], b['range'][0]], color='#2a78d6', lw=1, ls=(0, (3, 4)))
    key = "\n".join(f"band {i}  {100 * b['p']:6.2f}%   " + (f"{b['payout']}× ± {r:g}" if b['payout'] > 0 else "no win") for i, b in enumerate(bands))
    ax.text(150, ymax * 0.85, key, ha='left', va='top', fontsize=8.5, family='monospace', color='#141412', linespacing=1.35, bbox=dict(boxstyle='round,pad=0.4', fc='#fcfcfb', ec='#cfccc3', lw=.6))
    for j, bx in enumerate(Bx[1:-1]):
        ax.axvline(bx, color='#2a78d6', lw=.8, ls=':')
        ax.text(bx, 0.12 if j % 2 == 0 else 0.28, f"{bx:.0f}", ha='center', va='bottom', fontsize=7.5, color='#2a78d6', fontweight='600', bbox=dict(boxstyle='round,pad=0.15', fc='#fcfcfb', ec='none'))
    ax.set_yscale('symlog', linthresh=1, linscale=0.9); ax.set_ylim(-0.1, ymax)
    ticks = [0] + [a for a in d['payouts'] if a > 0]
    ax.set_yticks(ticks); ax.set_yticklabels(['0'] + [f'{a:g}×' for a in ticks[1:]])
    ax.set_xlim(0, N); ax.set_ylabel('paid multiple (symlog)')
    ax.set_title(f"{TITLES.get(m, m)}     hit rate {100 * M['hitRate']:.1f}%   stdev {M['stdev']:.2f}×   simulated RTP {100 * M['simRtp']:.2f}%  (grid {100 * M['grid']['rtp']:.2f}%)", loc='left', fontsize=10.5, color='#141412')
axes[-1, 0].set_xticks(range(0, N + 1, 1000)); axes[-1, 0].set_xlabel('draw x = 10000·u     (blue numbers: band boundaries)')
plt.tight_layout(rect=(0, 0, 1, 0.96)); plt.savefig(os.path.join(outdir, 'curves.png'), dpi=130); plt.close()

# ── per-band distributions ───────────────────────────────────────────────────────────────
nb_ = len(d['payouts'])
fig, axes = plt.subplots(len(methods), nb_, figsize=(3 * nb_, 3.7 * len(methods)), facecolor='#fcfcfb', squeeze=False)
fig.suptitle(f"Distribution inside each band, {d['rounds']:,} rounds per method.  Orange: simulated.  Blue: exact law Uniform[aᵢ − r, aᵢ + r].", x=0.01, ha='left', fontsize=11.5, fontweight='600', color='#141412')
for row_axes, (m, M) in zip(axes, methods):
    for ax, (i, b) in zip(row_axes, enumerate(M['bands'])):
        style(ax); vals = M['perBand'][i]
        if b['payout'] <= 0:
            ax.bar([0], [len(vals)], width=0.6, color=BAND_COLS[0]); ax.set_xlim(-1, 1); ax.set_xticks([0]); ax.set_xticklabels(['0×'])
            ax.set_title(f"{m} · band {i} · no win\np = {100 * b['p']:.2f}%, n = {len(vals):,}", loc='left', fontsize=8.5, color='#141412'); ax.set_ylabel('rounds'); continue
        lo, hi = b['range']; nb = 20
        ax.hist(vals, bins=nb, range=(lo, hi), color='#eb6834', alpha=.85, lw=0)
        ax.axhline(len(vals) / nb, color='#2a78d6', lw=2); ax.axvline(b['payout'], color='#8a877f', lw=1, ls='--')
        ax.set_xlim(lo - 0.15 * (hi - lo), hi + 0.15 * (hi - lo)); ax.set_xticks([lo, b['payout'], hi]); ax.set_xticklabels([f"{lo:.2f}", f"{b['payout']:g}×", f"{hi:.2f}"], fontsize=8)
        mean = sum(vals) / len(vals) if vals else float('nan')
        ax.set_title(f"band {i} · {b['payout']:g}× ± {r:g}\np = {100 * b['p']:.2f}%, n = {len(vals):,}\nmean {mean:.4f}", loc='left', fontsize=8.5, color='#141412')
for ax in axes[-1]: ax.set_xlabel('paid multiple', fontsize=9)
plt.tight_layout(rect=(0, 0, 1, 0.94)); plt.savefig(os.path.join(outdir, 'bands.png'), dpi=120); plt.close()
print(f"wrote {outdir}/curves.png and {outdir}/bands.png")
