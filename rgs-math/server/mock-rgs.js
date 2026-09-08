// Zero-dependency mock of the RGS provider routes, backed by the math modules.
//
//   POST /api/<gameId>/open | valid-bets | bet | next-action | collect
//   POST /api/gp/...   alias for the game named in GP_GAME (default: outcome-table)
//   GET  /             lists games and their bet types
//
// This mirrors what the Rollerz backend does in front of a math server, so a module can
// be exercised end to end with curl before it is wired to the real RGS. The public
// playground talks to test.rollerz.dev, not to this server; see README "Wiring it up".

import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { games } from '../games/index.js';

const PORT = Number(process.env.PORT ?? 8790);
const GP_GAME = process.env.GP_GAME ?? 'outcome-table';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Client-Id, X-Session-Id, X-Game-Origin, X-Game-Id',
};

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e6) reject(new Error('body too large')); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

const ROUTES = {
  'open': (g, b) => g.open(b),
  'valid-bets': (g, b) => g.validBets(b),
  'bet': (g, b) => g.bet(b),
  'next-action': (g, b) => g.nextAction(b),
  'collect': (g, b) => g.collect(b),
};

export function createServer() {
  return http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
    const url = new URL(req.url, 'http://x');
    if (req.method === 'GET' && url.pathname === '/') {
      return send(res, 200, {
        games: Object.values(games).map(g => ({ id: g.id, betTypes: g.betTypes, defaultBetType: g.defaultBetType, multiStep: g.isMultiStep, routes: Object.keys(ROUTES).map(r => `/api/${g.id}/${r}`) })),
        gpAlias: GP_GAME,
      });
    }
    const m = url.pathname.match(/^\/api\/([^/]+)\/([^/]+)$/);
    if (!m || req.method !== 'POST') return send(res, 404, { message: 'not found' });
    const [, provider, route] = m;
    const game = games[provider === 'gp' ? GP_GAME : provider];
    const handler = ROUTES[route];
    if (!game || !handler) return send(res, 404, { message: `unknown provider/route ${provider}/${route}` });
    try {
      const body = await readJson(req);
      // The RGS session id arrives in the body on open() and as X-Session-Id afterwards.
      if (!body.sessionId && req.headers['x-session-id']) body.sessionId = req.headers['x-session-id'];
      send(res, 200, handler(game, body));
    } catch (e) {
      send(res, 400, { message: e.message });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createServer().listen(PORT, () => {
    console.log(`mock RGS on http://localhost:${PORT}  (gp -> ${GP_GAME}; games: ${Object.keys(games).join(', ')})`);
  });
}
