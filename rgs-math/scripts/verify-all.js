// Prints the design RTP, the per-chip rounding effect and a Monte Carlo check for
// every game module. Run: npm run verify   (ROUNDS=500000 npm run verify for tighter CIs)

import { modules } from '../games/index.js';
import { contributions } from '../src/table.js';
import { monteCarlo, exactReport, formatMc } from '../src/verify.js';
import { exactRtpAtBetJittered } from '../src/curve.js';
import { ladderFromHazards } from '../games/ladder.js';

const ROUNDS = Number(process.env.ROUNDS ?? 100000);
const pct = x => `${(100 * x).toFixed(3)}%`;

for (const [name, mod] of Object.entries(modules)) {
  const { game, meta } = mod;
  console.log(`\n=== ${game.id}  (${name})  target RTP ${pct(meta.targetRtp)}`);

  if (meta.table && !meta.curve) {
    const c = contributions(meta.table);
    console.log(`  design RTP ${pct(c.rtp)}  hit rate ${pct(c.hitRate)}  max win ${c.maxWin}x  stdev ${c.stdev.toFixed(3)}x  VI95 ${c.vi95.toFixed(3)}`);
    for (const r of c.rows) console.log(`    ${r.label.padEnd(10)} prize ${String(r.prize).padStart(6)}x  p ${r.p.toFixed(6)}  contributes ${pct(r.rtpContribution)}`);
    const ex = exactReport(meta.table, game.levels());
    console.log(meta.jitter ? `  RTP after rounding, per chip (dispersion: ${meta.jitter.name}, r=${meta.jitter.r.toFixed(4)}):` : '  RTP after rounding wins to minor units, per chip:');
    for (const b of ex.perBet) {
      const realised = meta.jitter ? exactRtpAtBetJittered(meta.table, b.bet, meta.jitter) : b.rtp;
      const loss = c.rtp - realised;
      console.log(`    bet ${String(b.bet).padStart(6)}  ${pct(realised)}  (rounding ${loss >= 0 ? '-' : '+'}${pct(Math.abs(loss))})`);
    }
  }

  if (meta.curve) {
    const cv = meta.curve;
    console.log(`  ${cv.kind === 'step' ? 'step function' : 'curve'} RTP ${pct(cv.rtp())} (exact)  hit rate ${pct(cv.hitRate())}  max win ${cv.maxWin().toFixed(4)}x  stdev ${cv.stdev().toFixed(3)}x`);
    if (cv.kind === 'step') console.log('  steps: ' + cv.levels.map((a, i) => `[${cv.breaks[i]}, ${cv.breaks[i + 1]}) → ${a.toFixed(4)}x`).join('  '));
    else console.log('  knots: ' + cv.knots.map(k => `(${k.u}, ${k.a.toFixed(4)}x)`).join('  '));
    console.log(`  RTP after rounding, per chip (dispersion: ${meta.band.name}, r=${(meta.band.r ?? 0).toFixed(4)}):`);
    for (const bet of game.levels()) {
      const plain = cv.exactRtpAtBet(bet), banded = cv.exactRtpAtBetBanded(bet, meta.band);
      console.log(`    bet ${String(bet).padStart(6)}  no band ${pct(plain)}   with band ${pct(banded)}`);
    }
  }

  if (name === 'ladder') {
    console.log('  Exact RTP of the rounded ladder, cashing out at rung k (min..max over k), per chip:');
    for (const [diff, { survive }] of Object.entries(meta.difficulty)) {
      const line = game.levels().map(bet => {
        const pay = ladderFromHazards(bet, survive, meta.targetRtp);
        let cum = 1, lo = Infinity, hi = -Infinity;
        pay.forEach((p, k) => { cum *= survive[k]; const r = cum * p / bet; lo = Math.min(lo, r); hi = Math.max(hi, r); });
        return `${String(bet).padStart(5)}: ${pct(lo)}..${pct(hi)}`;
      }).join('  ');
      console.log(`    ${diff.padEnd(9)} ${line}`);
    }
  }

  for (const betType of game.betTypes) {
    const bets = game.levels(betType);
    for (const bet of [bets[0], bets[bets.length - 1]]) {
      let target = name === 'slingshot' && betType === 'SHARP' ? meta.sharpRtp : meta.targetRtp;
      // Multi-step games: MC under "cash out at rung 3" so the CI is readable; the
      // strategy-proof block below covers other stopping rules. The target is the EXACT
      // RTP of the rounded ladder at rung 3 for this chip, so rounding drift at small
      // chips shows up in the exact table above, not as a false MC alarm here.
      const policy = game.isMultiStep ? (v => v.currentStep >= 3 ? 'CASH_OUT' : 'CONTINUE') : null;
      if (name === 'ladder') {
        const { survive } = meta.difficulty[betType];
        const pay = ladderFromHazards(bet, survive, meta.targetRtp);
        const k = Math.min(3, pay.length);
        target = survive.slice(0, k).reduce((a, b) => a * b, 1) * pay[k - 1] / bet;
      }
      console.log(formatMc(monteCarlo(game, { betType, bet, rounds: ROUNDS, policy }), target));
    }
  }

  if (name === 'ladder') {
    console.log('  Ladder is strategy-proof: RTP under three stopping rules (MEDIUM, bet 125):');
    for (const [label, policy] of [
      ['cash out at step 1', v => v.currentStep >= 1 ? 'CASH_OUT' : 'CONTINUE'],
      ['cash out at step 7', v => v.currentStep >= 7 ? 'CASH_OUT' : 'CONTINUE'],
      ['never cash out', () => 'CONTINUE'],
    ]) {
      const mc = monteCarlo(game, { betType: 'MEDIUM', bet: 125, rounds: ROUNDS, policy });
      console.log(`    ${label.padEnd(20)} RTP ${pct(mc.rtp)}  CI [${pct(mc.ci95[0])}, ${pct(mc.ci95[1])}]`);
    }
  }
}
