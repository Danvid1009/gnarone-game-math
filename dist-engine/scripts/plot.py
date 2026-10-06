#!/usr/bin/env python3
import json, sys, os, math
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
d = json.load(open(sys.argv[1])); out = sys.argv[2]
def style(ax):
    ax.set_facecolor('#fcfcfb'); ax.grid(True, color='#e6e4dd', lw=.8); ax.set_axisbelow(True)
    for s in ('top', 'right'): ax.spines[s].set_visible(False)
names = list(d['presets']); fig, axes = plt.subplots(2, 3, figsize=(15, 8), facecolor='#fcfcfb')
for ax, n in zip(axes.flat, names):
    style(ax); p = d['presets'][n]; xs = p['samples']; hi = min(max(xs), (p['maxMultiple'] or max(xs)))
    ax.hist(xs, bins=60, range=(0, min(hi, 8)), color='#2a78d6', alpha=.85, density=True)
    ax.axvline(p['rtp'], color='#141412', lw=1.2, ls='--'); ax.text(p['rtp'], ax.get_ylim()[1] * .9, f"  mean {p['rtp']}  (sim {p['sim']['rtp']:.4f})", fontsize=8)
    ax.set_title(f"{n}: {p['dist']} {json.dumps(p['params'])}  scale {p['scale']:.3f}", loc='left', fontsize=9.5); ax.set_xlabel('paid multiple (shown to 8x)'); ax.set_ylabel('density')
plt.tight_layout(); plt.savefig(os.path.join(out, 'shapes.png'), dpi=130); plt.close()
lib = d['library']; fig, axes = plt.subplots(3, 5, figsize=(16, 9), facecolor='#fcfcfb')
for ax, (n, e) in zip(axes.flat, lib.items()):
    style(ax); us = [u for u, _ in e['q']]; qs = [q for _, q in e['q']]
    (ax.step if e['kind'] == 'discrete' else ax.plot)(us, qs, color='#eb6834' if e['kind'] == 'discrete' else '#2a78d6', lw=2)
    ax.set_title(f"{n}  {json.dumps(e['params'])}", loc='left', fontsize=8.5); ax.set_xlabel('u'); ax.set_ylabel('Q(u)')
    if isinstance(e['mean'], (int, float)) and math.isfinite(e['mean']): ax.axhline(e['mean'], color='#141412', lw=.8, ls='--')
plt.tight_layout(); plt.savefig(os.path.join(out, 'library.png'), dpi=120); plt.close(); print('wrote shapes.png, library.png')
