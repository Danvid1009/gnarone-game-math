// A stand-in for window.RollerzSDK that runs the published engine modules in the page.
//
// Same surface as the Rollerz SDK (init, <provider>.openGame({ preset }) / setPreset / getSession / getBetTypes /
// getDefaultBetType / getValidBets({ betType }) / placeBet(amount, { betType }) / step(roundId) / collect(roundId)),
// same result shapes (Go3BetResult, StepperBetResult, SingleShotBetResult, PickOneBetResult, Top1/Top3BetResult,
// RippinRumbleBetResult), amounts in minor units. A game written against it runs unchanged on the real SDK;
// this file only exists so the sample games play without a server. Extra providers the SDK does not have yet
// (auction, fight, cutscene) are exposed in the same style as a proposal.
//
// Not secure: the engine runs client-side here, so the seed is in the page. Use it for integration, not money.

const PROVIDERS = {
  go3:          { slug: 'game-of-three', shape: (r) => ({ count: r.count, multiplier: r.multiplier, hasBonus: r.hasBonus }) },
  stepper:      { slug: 'stepper',       shape: (r) => ({ difficulty: r.difficulty, currentStep: r.currentStep, currentPayout: r.currentPayout, steps: r.steps, roundEnded: r.roundEnded }), multiStep: true },
  rippinrumble: { slug: 'rip-rumble',    shape: (r) => ({ cardPacks: r.cardPacks.map(p => ({ cards: p.cards.map(c => ({ rarity: c.rarity })), common: p.common, uncommon: p.uncommon, rare: p.rare, legendary: p.legendary, totalPayout: p.totalPayout })) }) },
  singleShot:   { slug: 'single-shot',   shape: (r) => ({ multiplier: r.math.multiple, band: r.math.band }) },
  pickOne:      { slug: 'pick-one',      shape: (r) => ({ winner: r.math.winnerName, multiplier: r.math.hit ? r.math.odds : 0 }) },
  top1:         { slug: 'top-1',         shape: (r) => ({ order: r.math.names, place: r.math.order.indexOf(r.math.backed) + 1, multiplier: r.math.multiple }), extra: { mode: 'top1' } },
  top3:         { slug: 'top-3',         shape: (r) => ({ order: r.math.names, place: r.math.order.indexOf(r.math.backed) + 1, multiplier: r.math.multiple }) },
  // proposed providers, not in the SDK yet
  auction:      { slug: 'auction',       shape: (r) => ({ size: r.size, currentStep: r.currentStep, currentPayout: r.currentPayout, steps: r.steps, roundEnded: r.roundEnded, locker: r.locker }), multiStep: true },
  fight:        { slug: 'fight',         shape: (r) => ({ tick: r.tick, ticksMax: r.ticksMax, hp: r.hp, pA: r.pA, odds: r.odds, last: r.last, winner: r.winner, how: r.how, decision: r.decision, roundEnded: r.roundEnded }), multiStep: true, linked: true },
  cutscene:     { slug: 'cutscene',      shape: (r) => ({ winner: r.winner, odds: r.odds, cutscene: r.cutscene }), side: true },
};

const base = (r) => ({ roundId: r.roundId, balance: r.balance, totalBetAmount: r.totalBetAmount, totalWinAmount: r.totalWinAmount, nextAction: r.roundEnded === true ? [] : r.nextAction, seedHash: r.seedHash, ...(r.seed ? { seed: r.seed } : {}) });

function makeProvider(name, def) {
  let mod = null, g = null, s = null, preset = null; const open = new Map();   // roundId → last view of a running multi-step round
  const load = async () => (mod ??= await import(`../${def.slug}/api/rgs.js`));
  const session = () => { const live = g.getSession(s.sessionId); return { sessionId: s.sessionId, requestCounter: live.requestCounter, balance: live.balance, currency: s.currency, chipLevels: g.levels(g.defaultBetType), minBet: Math.min(...g.levels(g.defaultBetType)), maxBet: Math.max(...g.levels(g.defaultBetType)), defaultBet: s.defaultBet, preset }; };
  const need = () => { if (!g) throw new Error(`${name}: no session; call openGame() first`); };
  const openOn = async (p, balance) => { const m = await load(); const want = p ?? m.DEFAULT_PRESET; if (!m.PRESETS[want]) throw new Error(`${name}: unknown preset "${want}"; presets: ${Object.keys(m.PRESETS).join(', ')}`); preset = want; g = m.createGame({ preset, ...(def.extra ?? {}) }); s = g.open(balance === undefined ? {} : { balance }); open.clear(); return session(); };
  const shaped = (r) => ({ ...base(r), ...def.shape(r) });
  const P = {
    async openGame({ preset: p } = {}) { return openOn(p, g ? g.getSession(s.sessionId).balance : undefined); },
    async setPreset(p) { need(); if (open.size) throw new Error(`A round is in progress (${[...open.keys()][0]}); collect it before changing the preset.`); await openOn(p, g.getSession(s.sessionId).balance); },
    async getSession() { return g ? session() : null; },
    getBetTypes() { need(); return [...g.betTypes]; },
    getDefaultBetType() { need(); return g.defaultBetType; },
    getValidBets({ betType } = {}) { need(); const t = betType ?? g.defaultBetType; if (!g.betTypes.includes(t)) throw new Error(`invalid betType ${t}`); return g.levels(t); },
    async placeBet(betAmount, { betType } = {}) { need(); const t = betType ?? g.defaultBetType; if (!g.betTypes.includes(t)) throw new Error(`invalid betType ${t}`); const r = g.bet({ sessionId: s.sessionId, betAmount, betType: t }); if (def.multiStep && !r.roundEnded) open.set(r.roundId, r); return shaped(r); },
    async collect(roundId) { need(); let v = open.get(roundId); if (v && !v.roundEnded && v.nextAction.includes('CASH_OUT')) { v = g.nextAction({ roundId, actionCode: 'CASH_OUT' }); } if (v && !v.roundEnded) throw new Error(`round ${roundId} offers only ${v.nextAction.join(', ')}; it cannot be collected yet`); open.delete(roundId); const c = g.collect({ roundId }); const rd = g.getRound(roundId); return { balance: c.balance, totalWinAmount: rd.totalWinAmount, ...(v ? { currentStep: v.currentStep, currentPayout: v.currentPayout, locker: v.locker ?? null } : {}), seedHash: rd.seedHash, seed: rd.seed }; },
  };
  // SDK semantics: a step that ends the round (crash, or the top of the ladder) settles it with no collect
  if (def.multiStep) P.step = async (roundId) => { need(); const v = open.get(roundId); if (v && !v.nextAction.includes('CONTINUE')) throw new Error(`round ${roundId} offers ${v.nextAction.join(', ') || 'nothing'}; it cannot step`); const r = g.nextAction({ roundId, actionCode: 'CONTINUE' }); if (r.roundEnded) { const c = g.collect({ roundId }); open.delete(roundId); return { ...shaped(r), balance: c.balance }; } open.set(roundId, r); return shaped(r); };
  if (def.linked) { P.quote = async (roundId) => { need(); return g.quote({ roundId }); }; P.placeLiveBet = async (roundId, betAmount, { betType } = {}) => { need(); return g.linkedBet({ sessionId: s.sessionId, roundId, betAmount, betType }); }; P.getRound = (roundId) => g.getRound(roundId); }
  if (def.side) P.placeSideBet = async (betAmount, params) => { need(); const r = g.sideBet({ sessionId: s.sessionId, betAmount, params }); return r; };
  P.getLibrary = () => { need(); return s; };   // the open() extras: tables, odds, side-bet library — what the SDK's preset catalogue carries
  return P;
}

let gameId = null;
const sdk = {
  isLocal: true,
  async init(id) { gameId = id; },
  getGameId() { return gameId; },
  async getUser() { return { balance: null }; },
  async close() {},
  on() {}, off() {},
  async call() { throw new Error('local SDK: no network'); },
};
for (const [name, def] of Object.entries(PROVIDERS)) sdk[name] = makeProvider(name, def);
export default sdk;
