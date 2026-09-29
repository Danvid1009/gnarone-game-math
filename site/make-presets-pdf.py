#!/usr/bin/env python3
"""Preset catalogue PDF.   node site/preset-facts.js > facts.json && python3 site/make-presets-pdf.py facts.json PRESETS.pdf"""
import json, sys, subprocess, datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether

facts = json.load(open(sys.argv[1])); out = sys.argv[2]
try: sha = subprocess.check_output(['/opt/homebrew/bin/git', 'rev-parse', '--short', 'HEAD'], text=True).strip()
except Exception: sha = ''
BASE = 'https://danvid1009.github.io/gnarone-game-math'
INK, INK2, LINE, ACCENT, PANEL = colors.HexColor('#141412'), colors.HexColor('#555a66'), colors.HexColor('#cfccc3'), colors.HexColor('#c8265a'), colors.HexColor('#f3f2ee')
ss = getSampleStyleSheet()
H1 = ParagraphStyle('h1', parent=ss['Title'], fontName='Helvetica-Bold', fontSize=22, leading=26, alignment=0, textColor=INK, spaceAfter=4)
H2 = ParagraphStyle('h2', parent=ss['Heading2'], fontName='Helvetica-Bold', fontSize=14.5, leading=18, textColor=INK, spaceBefore=10, spaceAfter=4)
H3 = ParagraphStyle('h3', parent=ss['Heading3'], fontName='Helvetica-Bold', fontSize=10.5, leading=13, textColor=ACCENT, spaceBefore=8, spaceAfter=2)
P = ParagraphStyle('p', parent=ss['Normal'], fontName='Helvetica', fontSize=9.3, leading=12.6, textColor=INK, spaceAfter=4)
SM = ParagraphStyle('sm', parent=P, fontSize=8.2, leading=10.6, textColor=INK2)
CODE = ParagraphStyle('code', parent=P, fontName='Courier', fontSize=8.2, leading=10.5, backColor=PANEL, borderPadding=(4, 6, 4, 6), spaceBefore=3, spaceAfter=6)
TC = ParagraphStyle('tc', parent=P, fontSize=8.3, leading=10.4, spaceAfter=0)
TH = ParagraphStyle('th', parent=TC, fontName='Helvetica-Bold', textColor=INK2, fontSize=7.6)

def tbl(rows, widths=None, zebra=True):
    data = [[Paragraph(str(c), TH) for c in rows[0]]] + [[Paragraph(str(c), TC) for c in r] for r in rows[1:]]
    t = Table(data, colWidths=widths, repeatRows=1, hAlign='LEFT')
    st = [('LINEBELOW', (0, 0), (-1, 0), 0.8, LINE), ('LINEBELOW', (0, 1), (-1, -1), 0.3, LINE), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
          ('LEFTPADDING', (0, 0), (-1, -1), 4), ('RIGHTPADDING', (0, 0), (-1, -1), 4), ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 3)]
    if zebra:
        for i in range(1, len(data)):
            if i % 2 == 0: st.append(('BACKGROUND', (0, i), (-1, i), PANEL))
    t.setStyle(TableStyle(st)); return t

def para(t, s=P): return Paragraph(t, s)
def section(title, blurb, params, presets, custom, who=None):
    els = [para(title, H2), para(blurb)]
    els += [para('Parameters', H3), tbl(params, [40*mm, 30*mm, 38*mm, 74*mm])]
    els += [para('Presets', H3), presets]
    if who: els += [para('Who each preset is for', H3), tbl(who, [34*mm, 148*mm])]
    els += [para('Customizability', H3)] + [para(c) for c in custom]
    return els

story = []
story += [para('GnarOne Game Math', H1), para('Preset catalogue and customizability guide for the Rollerz SDK integration', ParagraphStyle('sub', parent=P, fontSize=11.5, leading=15, textColor=INK2)),
          para(f'{datetime.date.today().isoformat()} · build {sha} · {BASE}', SM), Spacer(1, 6)]
story += [para('1. How presets work', H2),
  para('Every engine is published as a browser module that implements the RGS provider contract and rolls locally. The SDK creates a game from a <b>preset name</b>, never from raw parameters:'),
  para("import { createGame } from '" + BASE + "/&lt;game&gt;/api/rgs.js';<br/>const g = createGame({ preset: 'MEDIUM' });<br/>const s = g.open();                                             // session, balance, chip levels, preset tables<br/>let r = g.bet({ sessionId: s.sessionId, betAmount: 1000, betType: 'MEDIUM' });<br/>r = g.nextAction({ roundId: r.roundId, actionCode: 'CONTINUE' });  // multi-step games only<br/>g.collect({ roundId: r.roundId });", CODE),
  para('A preset is a frozen configuration: the game parameters, the target RTP and the chip levels. Each preset is its own folder under <b>&lt;game&gt;/api/&lt;preset&gt;/</b> holding <b>field.json</b> (the config, the derived tables and the settlement rule), <b>rounds.json</b> and <b>rounds/NNN.json</b> (100 pre-drawn rounds from seeds fixture-000 to fixture-099, settled for every bet type) and a worked <b>sample-request / sample-response</b> pair. <b>index.json</b> at the game level lists presets, parameters and the realised RTP over the fixtures. Passing <b>seed</b> on a bet reproduces any fixture round through the live calls.'),
  para('Money is always an integer in minor units. The bet response carries the balance minus the stake; collect adds the win. Every engine has exact RTP by construction for every bet type and, for the multi-step games, for every stopping rule; the Node test suites verify this by summation and by simulation.'),
  para('Three levels of customization', H3),
  tbl([['level', 'what changes', 'who does it', 'turnaround'],
       ['Runtime', 'bet type and bet amount per round; which preset the client opens', 'client / SDK', 'none'],
       ['Preset', 'a new row in a parameter table below (payout array, Elo field, top multiplier, RTP...)', 'GnarOne, via the preset config', 'same day: config, RTP verification, fixtures, publish'],
       ['Structural', 'new mechanics or rules outside the parameter tables (payout structure, deck design, step rules)', 'GnarOne, ticket', 'design + math + tests']], [24*mm, 78*mm, 40*mm, 40*mm]),
  para('Anything not in a parameter table is structural. Anything in a table is a preset request: we add the row, verify the RTP exactly, generate the fixtures and publish it under its own folder.'),
  para('Global parameters (every engine)', H3),
  tbl([['parameter', 'type', 'default', 'constraint'], ['rtp', 'number', 'per engine', '0 &lt; rtp &lt; 1; other constraints listed per engine'],
       ['levels', 'integer[] minor units', '100, 200, 500, 1000, 2500, 5000, 10000', 'non-empty; a bet must equal one of them'],
       ['startingBalance', 'integer', '100000', 'demo wallet in the sandbox only']], [40*mm, 30*mm, 50*mm, 62*mm]),
  PageBreak()]

# ---- Stepper
st = facts['stepper']
story += section('2. Stepper', 'A fair crash ladder (RTP 0.97). Ten rungs; the player CONTINUEs or CASH_OUTs after each; one uniform drawn at bet time fixes where the ladder breaks. Survival to rung k is RTP / c<sub>k</sub>, so the first step carries the whole house edge and every later step is a fair bet: every stopping rule returns exactly the RTP. Multi-step wire shape (CONTINUE, CASH_OUT, COLLECT).',
  [['parameter', 'type', 'default', 'constraint'], ['rtp', 'number', '0.97', ''], ['maxWin', 'number', '(preset)', 'greater than 1; sets c<sub>k</sub> = round(maxWin<super>k/steps</super>, 2)'], ['steps', 'integer', '10', '1 to 20 sensible'], ['returns', 'number[]', 'derived', 'alternative to maxWin/steps: strictly increasing, c<sub>1</sub> greater than rtp']],
  tbl([['preset', 'top win', 'rungs', 'rung 1 pays', 'P(instant crash)', 'P(reach the top)']] + [[s['name'], f"{s['maxWin']}x", s['steps'], f"{s['returns'][0]}x", f"{s['instantCrash']}%", f"{s['reachTop']}%"] for s in st], [26*mm, 22*mm, 18*mm, 26*mm, 40*mm, 40*mm]),
  ['<b>Runtime:</b> the bet type is the preset name (the live Stepper sends difficulty as the bet type), so a client that offers three difficulties opens three games. Bet amount from the level list.',
   '<b>Preset:</b> any top multiplier, any step count, any RTP. The rung schedule is derived, or an explicit list of rungs can be given instead (for example a slow start and a steep finish). The only constraint is that the first rung pays more than the RTP, otherwise the instant-crash probability would be negative.',
   '<b>Structural (ticket):</b> anything that changes the survival rule, for example a non-zero payout on a crash, insurance, or a bonus rung. Those change the strategy-proofness argument and need a new derivation.'],
  [['EASY', 'first-time players; the ladder is survivable and the top is reachable one round in ten'], ['MEDIUM', 'the default; meaningful climbs with a 25x ceiling'], ['HARD', 'high-variance players; every rung is a real risk, 100x once in a hundred rounds']])
story.append(PageBreak())

# ---- Single Shot
ss_ = facts['singleShot']
story += section('3. Single Shot', 'One draw, one payout (RTP 0.95). The unit interval is cut into bands whose widths are the probabilities; inside a band the paid multiple ramps linearly from a - r to a + r with r = 0.1 x the smallest gap between positive payouts, so the mean of each band is exactly its listed payout and the RTP is exact by summation. A zero band pays exactly 0. Single-call wire shape.',
  [['parameter', 'type', 'default', 'constraint'], ['rtp', 'number', '0.95', 'strictly between the smallest and largest payout'], ['payouts', 'number[]', '(preset)', 'distinct, non-negative, at most one 0, at least two positive'], ['method', 'geometric | maxent | weights', 'geometric', 'how probabilities are assigned to hit the RTP'], ['weights', 'number[]', '-', 'method weights only: relative frequencies of the winning payouts (the entry for 0 is ignored); the probability of the 0 payout is then computed so the RTP is exact'], ['fraction', 'number', '0.1', 'band half-width as a fraction of the smallest gap; fixed, not exposed']],
  tbl([['preset', 'payouts (x stake)', 'P(win)', 'stdev', 'band probabilities']] + [[s['name'], ', '.join(str(p) for p in s['payouts']), f"{s['hitRate']}%", f"{s['stdev']}x", ' / '.join(f"{a}x {p}%" for a, p in s['probs'])] for s in ss_], [24*mm, 34*mm, 16*mm, 16*mm, 92*mm]),
  ['<b>Runtime:</b> one bet type (BASE); only the amount varies.',
   '<b>Preset:</b> the payout array itself is the input, so a new table is a preset row, not a design change: send the multiples you want and the RTP, we publish the folder. Geometric is the default probability method (each higher payout is a fixed factor rarer); maxent gives the flattest distribution that hits the RTP; weights lets you dictate the relative frequency of the winning payouts, and the engine then sets the probability of the 0 payout so the RTP is exact (p<sub>0</sub> = 1 - RTP / E[payout | win]). Any RTP between the smallest and largest payout works.<br/><b>Direct input:</b> because the RTP is exact by construction for any valid array, the SDK may also pass <b>payouts</b> (and optionally <b>method</b> and <b>weights</b>) straight to createGame instead of a preset name; the engine validates the array and throws on an invalid one. Presets exist for the fixtures and for reproducibility, not because other arrays are unsafe.',
   '<b>Structural (ticket):</b> non-linear ramps inside a band, bands that overlap, or a payout that depends on the bet size.'],
  [['classic', 'the reference table; wins half the time, 20x top'], ['steady', 'low variance; wins 72% of spins, nothing above 3x'], ['spiky', 'high variance; wins a third of the time, rare 100x'], ['always-pays', 'never returns zero; the top is capped at 5x']])
story.append(PageBreak())

# ---- Race
rc = facts['race']
story += section('4. Top 3 and Top 1', 'An Elo race (RTP 0.95). Strength is 10<super>Elo/400</super>; one uniform is recycled into the full finishing order (Plackett-Luce), so win, place and show probabilities are closed-form. Top 3 pays stake plus profit for first, a quarter of that profit for second and a fifth for third, with the profit solved per racer so every racer returns exactly the RTP. Top 1 pays the winner only at RTP / P(win). Single-call wire shape; the bet type is the racer name.',
  [['parameter', 'type', 'default', 'constraint'], ['rtp', 'number', '0.95', ''], ['racers', '{ name, elo }[]', '(preset)', '3 to 20 racers'], ['mode', 'top3 | top1', 'top3', 'Top 1 is the same field paid winner-only'], ['structure', '{ place, show }', '1/4, 1/5', 'Top 3 only: fractions of the win profit paid for 2nd and 3rd']],
  tbl([['preset', 'racers', 'Elo range', 'favourite wins', 'outsider wins', 'Top 3 multipliers, favourite', 'Top 1 odds fav / outsider']] + [[r['name'], r['n'], f"{r['elo'][0]} to {r['elo'][1]}", f"{r['favWin']}%", f"{r['longWin']}%", ' / '.join(f"{m}x" for m in r['favM']), f"{r['top1FavOdds']}x / {r['top1LongOdds']}x"] for r in rc], [26*mm, 14*mm, 26*mm, 24*mm, 24*mm, 36*mm, 32*mm]),
  ['<b>Runtime:</b> the bet type is any racer name from the preset; the client can show the odds from open() before the first bet.',
   '<b>Preset:</b> any number of racers with any Elo values, so a new field is a preset row. For Top 3 we check one feasibility condition: the favourite\'s probability of finishing in the first three must stay below the RTP (field-12 sits at ' + f"{rc[0]['favTop3']}%" + ', field-6 at ' + f"{rc[2]['favTop3']}%" + '); a field with a very dominant favourite fails it and we tell you the largest Elo gap that works. The place and show fractions (1/4, 1/5) can be changed per preset. Top 1 has no feasibility condition.',
   '<b>Structural (ticket):</b> exotic bets (exacta, trifecta), fixed-odds tables that do not return the RTP per racer, in-race cash-out, or racer-specific edges.'],
  [['field-12', 'the reference field: clear favourite, long shots at the back'], ['field-8', 'fewer choices with a similar odds spread'], ['field-6', 'short field for quick rounds; shortest prices'], ['field-12-tight', 'near-even field; Top 1 odds cluster between 7x and 21x, Top 3 pays 3.9x for the favourite']])
story.append(PageBreak())

# ---- Rumble
rm = facts['rumble']
story += section('5. Rip and Rumble', 'Card packs from two decks (workbook Math-rippin-rumble-ver4). A pack is five cards drawn without replacement; each rarity pays count x value x multiplier(count), an exact hypergeometric sum. Each bet type draws from the low deck with the one probability that makes the expected win divided by the cost equal the RTP. Bundles give eleven packs for the price of ten. Single-call wire shape.',
  [['parameter', 'type', 'default', 'constraint'], ['rtp', 'number', '0.95', 'must lie between the two decks\' own returns; the low/high mix is solved'], ['credit', 'integer minor units', '100', 'price of one credit; a BASE pack costs 5 credits'], ['betTypes', 'table', 'BASE 5 / BOOSTED 10 / BASE_BUNDLE 5x10 (11 packs) / BOOSTED_BUNDLE 10x10 (11)', 'cost in credits, packs dealt, packs paid'], ['decks, pays, multipliers', 'workbook tables', 'ver4', 'structural']],
  tbl([['preset', 'RTP', 'P(low deck) BASE', 'BOOSTED', 'BASE_BUNDLE', 'BOOSTED_BUNDLE', 'stdev (x stake) BASE / BOOSTED']] + [[r['name'], r['rtp'], f"{r['pLow']['BASE']}%", f"{r['pLow']['BOOSTED']}%", f"{r['pLow']['BASE_BUNDLE']}%", f"{r['pLow']['BOOSTED_BUNDLE']}%", f"{r['sd']['BASE']} / {r['sd']['BOOSTED']}"] for r in rm], [28*mm, 14*mm, 28*mm, 22*mm, 26*mm, 30*mm, 34*mm]),
  ['<b>Runtime:</b> four bet types; the amount must be a multiple of the pack price (cost x paid packs x credit), so BASE bets are 500, 1000, 2500, 5000 minor units and BASE_BUNDLE 5000, 10000, 25000, 50000.',
   '<b>Preset:</b> the RTP (we re-solve the deck mix, which is why 0.93 and 0.97 are presets), the credit price, and the bet-type table (pack costs, bundle sizes). Note that BOOSTED_BUNDLE is not in the current live SDK bet-type list; drop it from the preset or add it to the SDK.',
   '<b>Structural (ticket):</b> deck composition, per-rarity pays, the count multipliers, pack size, or a third deck. Each changes the hypergeometric tables and needs re-verification against a new workbook.'],
  [['sheet-v4', 'the reference sheet at 0.95'], ['sheet-v4-0.93', 'tighter margin; same feel'], ['sheet-v4-0.97', 'looser margin; same feel']])
story.append(PageBreak())

# ---- Smash
sm = facts['smash']
story += section('6. Game of Three', 'Rock n Smash (workbook Rock n Smash.xlsx). Three rocks; a fixed table gives how many break (0 to 3) and pays 5 / 1 / 0.5 / 0; on two or three breaks a gem fires with a fixed chance and multiplies the win by 2x to 10x from a weighted table (mean 3.667). The RTP is the exact sum over 16 outcome zones. Single-call wire shape.',
  [['parameter', 'type', 'default', 'constraint'], ['rtp', 'number', 'as sheet', 'if set, the win table is scaled so both modes return it'], ['modes', 'rows (count probabilities, gem chance, wins)', 'BASE, BOOSTED from the workbook', 'structural'], ['gems', 'weighted table 2x to 10x', 'workbook', 'structural']],
  tbl([['preset', 'BASE RTP', 'BASE hit rate', 'BASE stdev', 'BOOSTED RTP', 'BOOSTED hit rate', 'BOOSTED stdev']] + [[s['name'], f"{s['modes']['BASE']['rtp']}%", f"{s['modes']['BASE']['hit']}%", f"{s['modes']['BASE']['stdev']}x", f"{s['modes']['BOOSTED']['rtp']}%", f"{s['modes']['BOOSTED']['hit']}%", f"{s['modes']['BOOSTED']['stdev']}x"] for s in sm], [26*mm, 22*mm, 26*mm, 24*mm, 26*mm, 30*mm, 28*mm]),
  ['<b>Runtime:</b> two bet types, BASE and BOOSTED; BOOSTED is the SDK\'s boosted bet type.',
   '<b>Preset:</b> the RTP target. We keep the workbook\'s hit probabilities and gem chances and scale the win amounts, so the feel of the game is unchanged and only the payouts move.',
   '<b>Structural (ticket):</b> different break probabilities, gem odds or the gem multiplier table, more rocks, or a separate bonus round.'],
  [['sheet', 'exact workbook numbers, 97.07% and 97.15%'], ['rtp-0.95', 'the same game at a 95% return']])
story.append(PageBreak())

# ---- Pick
pk = facts['pick']
story += section('7. Pick One', 'An n-way bet with exact RTP (0.95). Each option owns a zone of the unit interval of width p; backing option j pays RTP / p<sub>j</sub> on a hit, so every option returns exactly the RTP regardless of how the probabilities are chosen. Single-call wire shape; the bet type is the option name.',
  [['parameter', 'type', 'default', 'constraint'], ['rtp', 'number', '0.95', ''], ['n', 'integer', '(preset)', 'at least 2 equal options'], ['weights', 'number[]', '-', 'alternative to n; positive, any scale'], ['labels', 'string[]', 'HEADS / TAILS or OPTION_i', 'one per option']],
  tbl([['preset', 'options (probability, odds)']] + [[p['name'], ', '.join(f"{n} ({q}%, {o}x)" for n, q, o in p['options'])] for p in pk], [26*mm, 156*mm]),
  ['<b>Runtime:</b> the bet type is any option name; the amount from the level list.',
   '<b>Preset:</b> any number of options, equal or weighted, any labels, any RTP. This is the most freely customizable engine: a preset is literally the option list.<br/><b>Direct input:</b> as with Single Shot, the SDK may pass <b>n</b> or <b>weights</b> and <b>labels</b> directly to createGame; the odds are exact for any input.',
   '<b>Structural (ticket):</b> multi-pick bets, partial payouts for near misses, or options whose probability depends on earlier rounds.'],
  [['coin', 'two-way 1.9x flip'], ['three', 'three equal doors at 2.85x'], ['five', 'five equal doors at 4.75x'], ['weighted', 'unequal odds on labelled options, 1.9x to 4.75x']])
story.append(PageBreak())

# ---- Auction
au = facts['auction']
story += section('8. Storage Auction (provisional)', 'The Stepper ladder with a locker on top (RTP 0.95). CONTINUE is a bid, an outbid is the crash, CASH_OUT is the hammer: the player takes the locker at its current value and opens it, and the contents are a Single Shot draw whose mean is exactly 1, so every take rule still returns the RTP. The locker draw is the recycled residual of the same uniform. Wire shape identical to Stepper plus a <b>locker</b> field on the final state. The numbers are provisional while the design is being finalised; the wire shape is final.',
  [['parameter', 'type', 'default', 'constraint'], ['rtp', 'number', '0.95', ''], ['maxWin, steps', 'as Stepper', 'steps 10', 'first bid value greater than rtp'], ['box.payouts', 'number[]', '0.25, 0.5, 1, 2, 5', 'locker multiples; probabilities solved so the mean is exactly 1'], ['box.method', 'maxent | geometric', 'maxent', '']],
  tbl([['preset', 'top value', 'bid 1 value', 'P(outbid on bid 1)', 'P(reach the top)', 'largest single win']] + [[a['name'], f"{a['bids'][-1]}x", f"{a['bids'][0]}x", f"{a['instantOutbid']}%", f"{a['reachTop']}%", f"{a['maxWin']}x (top value x 5x locker)"] for a in au], [24*mm, 22*mm, 24*mm, 36*mm, 32*mm, 44*mm]),
  ['<b>Runtime:</b> the bet type is the locker size (the preset name); amount from the level list.',
   '<b>Preset:</b> top value, bid count and RTP as in Stepper, plus the locker table: any list of multiples, including 0 for an empty locker, with probabilities solved to mean 1. A flat locker (X = 1) reproduces the Stepper exactly.',
   '<b>Structural (ticket):</b> refunds on an outbid, escalating bid sizes with money returned between rounds, or a locker whose mean is not 1. These are under discussion and would be a new engine version rather than a preset.'],
  [['SMALL', 'gentle ladder, 5x top'], ['MEDIUM', '10x top'], ['LARGE', '25x top'], ['XL', '100x top; a 5x locker at the top pays 500x']])

story += [PageBreak(), para('Appendix A: race fields', H2), para('Every racer in every Top 3 / Top 1 preset, with the closed-form win probability and the multipliers each mode pays (Top 3: first / second / third; Top 1: winner).')]
for r in rc:
    story += [para(f"{r['name']}  ({r['n']} racers, Elo {r['elo'][0]} to {r['elo'][1]})", H3),
              tbl([['racer', 'Elo', 'P(win)', 'Top 1 pays', 'Top 3 pays 1st / 2nd / 3rd']] + [[n, e, f"{q}%", f"{o}x", ' / '.join(f"{m}x" for m in M)] for n, e, q, o, M in r['field']], [30*mm, 22*mm, 26*mm, 30*mm, 74*mm])]
story += [Spacer(1, 10), para('Appendix B: files per game', H2),
  para(BASE + '/&lt;game&gt;/api/rgs.js — the module (createGame)<br/>' + BASE + '/&lt;game&gt;/api/index.json — presets, parameters, bet types, realised RTP<br/>' + BASE + '/&lt;game&gt;/api/&lt;preset&gt;/field.json — frozen config, derived tables, how_to_settle<br/>' + BASE + '/&lt;game&gt;/api/&lt;preset&gt;/rounds.json, rounds/NNN.json — 100 seeded rounds settled for every bet type<br/>' + BASE + '/&lt;game&gt;/api/&lt;preset&gt;/sample-request.json, sample-response.json — round 007 through the real calls', CODE),
  para('Games: stepper, single-shot, top-3, top-1, rip-rumble, game-of-three, pick-one, auction. Each page also carries the full algorithm write-up, figures, and a playable demo.', SM)]

def footer(c, d):
    c.saveState(); c.setFont('Helvetica', 7.5); c.setFillColor(INK2)
    c.drawString(18*mm, 10*mm, 'GnarOne Game Math · preset catalogue'); c.drawRightString(A4[0] - 18*mm, 10*mm, f'page {d.page}'); c.restoreState()
doc = SimpleDocTemplate(out, pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=16*mm, bottomMargin=16*mm, title='GnarOne Game Math — Preset catalogue', author='GnarOne Labs')
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print('wrote', out)
