#!/usr/bin/env node
// node bin/build-auction.js [--preset storage] [--rtp 0.95] [--refund 1] [--outbid 0.6,0.5,0.4,0.3,0.2,0] [--bids 1,2,3,4,6,8] [--payouts 0,0.5,1,2,5,20] [--json] [--js]
import { buildLockerWars, format } from '../src/engine.js'; import { PRESETS } from '../src/rgs.js';
const argv = process.argv.slice(2), a = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2), v = argv[i + 1]; a[k] = v === undefined || v.startsWith('--') ? true : (i++, v); }
const base = PRESETS[a.preset ?? 'storage'] ?? {}; const list = s => String(s).split(',').map(Number);
const A = buildLockerWars({ ...base, ...(a.rtp ? { rtp: Number(a.rtp) } : {}), ...(a.refund ? { refund: Number(a.refund) } : {}), ...(a.outbid ? { outbid: list(a.outbid) } : {}), ...(a.bids ? { bids: list(a.bids) } : {}), ...(a.payouts ? { locker: { ...(base.locker ?? {}), payouts: list(a.payouts) } } : {}), name: a.preset ?? 'storage' });
console.log(a.json ? JSON.stringify(A.toJSON(), null, 2) : format(A)); if (a.js) console.log('\n' + A.standalone());
