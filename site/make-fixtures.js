#!/usr/bin/env node
// Static fixtures for every engine and preset, generated through the RGS module itself so the files
// match what the live module returns.   node site/make-fixtures.js [engine-folder ...]
//
//   <engine>/examples/api/index.json                     presets, parameters, bet types, realised RTP
//   <engine>/examples/api/<preset>/field.json            frozen config + derived tables + how_to_settle
//   <engine>/examples/api/<preset>/rounds.json           100 seeded rounds: stake and win for every bet type
//   <engine>/examples/api/<preset>/rounds/NNN.json       one round in full (cards, order, ladder…)
//   <engine>/examples/api/<preset>/sample-request.json / sample-response.json   round 007 through the real calls
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const COUNT = 100, STAKE = 1000;
const ENGINES = {
  'payout-engine':  [{ dir: 'examples/api' }],
  'pick-engine':    [{ dir: 'examples/api' }],
  'race-engine':    [{ dir: 'examples/api', opts: { mode: 'top3' } }, { dir: 'examples/api-top1', opts: { mode: 'top1' } }],
  'rumble-engine':  [{ dir: 'examples/api' }],
  'smash-engine':   [{ dir: 'examples/api' }],
  'stepper-engine': [{ dir: 'examples/api' }],
  'auction-engine': [{ dir: 'examples/api' }],
};
const only = process.argv.slice(2);
const seedOf = k => `fixture-${String(k).padStart(3, '0')}`;
const stakeFor = (g, t) => (g.levels(t).includes(STAKE) ? STAKE : g.levels(t)[0]);
const strip = (o, keys) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
const SESSION_KEYS = ['sessionId', 'requestCounter', 'balance', 'currency', 'chipLevels', 'minBet', 'maxBet', 'defaultBet', 'playerAlias', 'seconds', 'rounds', 'winLoss'];

for (const [folder, variants] of Object.entries(ENGINES)) {
  if (only.length && !only.includes(folder)) continue;
  const mod = await import(pathToFileURL(join(root, folder, 'src/rgs.js')).href);
  for (const { dir, opts = {} } of variants) {
    const out = join(root, folder, dir); rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
    const index = { engine: folder, ...opts, stake: STAKE, rounds: COUNT, seeds: `${seedOf(0)} … ${seedOf(COUNT - 1)} (the same seed drives every preset)`, default_preset: mod.DEFAULT_PRESET, presets: {} };
    for (const preset of Object.keys(mod.PRESETS)) {
      const g = mod.createGame({ preset, ...opts }); const pdir = join(out, preset); mkdirSync(join(pdir, 'rounds'), { recursive: true });
      const info = strip(g.open(), SESSION_KEYS);
      const levels = Object.fromEntries(g.betTypes.map(t => [t, g.levels(t)]));
      const N = g.isMultiStep ? (info.steps ?? info.returns?.length ?? info.bids?.length) : null;
      writeFileSync(join(pdir, 'field.json'), JSON.stringify({ preset, engine: folder, ...opts, parameters: g.params, betTypes: g.betTypes, levels, stake_units: 'minor units', multiStep: g.isMultiStep, how_to_settle: g.howToSettle, ...info }, null, 2));
      const rounds = [], totals = {};
      for (let k = 0; k < COUNT; k++) {
        const seed = seedOf(k), results = {}, summary = {};
        for (const t of g.betTypes) {
          const stake = stakeFor(g, t);
          if (!g.isMultiStep) {
            const r = g.simulate({ bet: stake, betType: t, seed });
            results[t] = { stake, win: r.totalWinAmount, ...strip(r, ['seed', 'bet', 'betType', 'steps', 'totalWinAmount', 'nextAction']) };
            summary[t] = { stake, win: r.totalWinAmount }; (totals[t] ??= { staked: 0, won: 0 }).staked += stake; totals[t].won += r.totalWinAmount;
          } else {
            const full = g.simulate({ bet: stake, betType: t, seed, policy: () => 'CONTINUE' });
            const survived = full.totalWinAmount > 0 ? N : full.currentStep - 1;
            const payoutIfTakenAfter = [];
            for (let s = 1; s <= N; s++) {
              const r = g.simulate({ bet: stake, betType: t, seed, policy: v => (v.currentStep >= s ? 'CASH_OUT' : 'CONTINUE') });
              payoutIfTakenAfter.push({ step: s, reachable: s <= survived, win: r.totalWinAmount, ...(r.locker ? { locker: r.locker } : {}) });
              (totals[`${t} · take after ${s}`] ??= { staked: 0, won: 0 }).staked += stake; totals[`${t} · take after ${s}`].won += r.totalWinAmount;
            }
            results[t] = { stake, survived, outcome: survived === N ? 'TOP' : `CRASH_ON_STEP_${survived + 1}`, payoutIfTakenAfter, ...strip(full, ['seed', 'bet', 'betType', 'steps', 'nextAction', 'roundEnded']) };
            summary[t] = { stake, survived, winIfTakenAfter: payoutIfTakenAfter.map(x => x.win) };
          }
        }
        const round = { round: k, seed, results }; rounds.push({ round: k, seed, results: summary });
        writeFileSync(join(pdir, 'rounds', `${String(k).padStart(3, '0')}.json`), JSON.stringify(round, null, 2));
      }
      writeFileSync(join(pdir, 'rounds.json'), JSON.stringify({ preset, count: COUNT, rounds }, null, 1));
      // worked sample through the real calls: round 007, first bet type
      const t = g.betTypes[0], stake = stakeFor(g, t), s = g.open(); const seq = [];
      let r = g.bet({ sessionId: s.sessionId, betAmount: stake, betType: t, seed: seedOf(7) }); seq.push({ call: 'bet', body: { sessionId: s.sessionId, betAmount: stake, betType: t, seed: seedOf(7) }, response: r });
      for (let i = 0; i < 2 && g.isMultiStep && !r.roundEnded; i++) { r = g.nextAction({ roundId: r.roundId, actionCode: 'CONTINUE' }); seq.push({ call: 'next-action', body: { roundId: r.roundId, actionCode: 'CONTINUE' }, response: r }); }
      if (g.isMultiStep && !r.roundEnded) { r = g.nextAction({ roundId: r.roundId, actionCode: 'CASH_OUT' }); seq.push({ call: 'next-action', body: { roundId: r.roundId, actionCode: 'CASH_OUT' }, response: r }); }
      const c = g.collect({ roundId: r.roundId }); seq.push({ call: 'collect', body: { roundId: r.roundId }, response: c });
      writeFileSync(join(pdir, 'sample-request.json'), JSON.stringify({ module: `api/rgs.js`, create: `createGame(${JSON.stringify({ preset, ...opts })})`, calls: seq.map(x => ({ call: x.call, body: x.body })), note: `deterministic: seed ${seedOf(7)}; drop seed for a live roll` }, null, 2));
      writeFileSync(join(pdir, 'sample-response.json'), JSON.stringify({ open: s, calls: seq.map(x => ({ call: x.call, response: x.response })) }, null, 2));
      index.presets[preset] = { parameters: g.params, betTypes: g.betTypes, levels, multiStep: g.isMultiStep, realisedRtp: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, +(v.won / v.staked).toFixed(4)])), files: ['field.json', 'rounds.json', 'rounds/NNN.json', 'sample-request.json', 'sample-response.json'].map(f => `${preset}/${f}`) };
      console.log(`${folder}/${dir}/${preset}: ${g.betTypes.length} bet types, ${COUNT} rounds`);
    }
    writeFileSync(join(out, 'index.json'), JSON.stringify(index, null, 2));
  }
}
