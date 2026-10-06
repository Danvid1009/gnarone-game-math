#!/usr/bin/env node
// node bin/build-dist.js --dist lognormal --mu 0 --sigma 0.8 --max 50 [--min 0] [--rtp 0.95] [--json]
import { buildShot, format, DIST_NAMES } from '../src/engine.js';
const argv = process.argv.slice(2), a = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2), v = argv[i + 1]; a[k] = v === undefined || v.startsWith('--') ? true : (i++, v); }
if (!a.dist) { console.error(`usage: build-dist --dist <${DIST_NAMES.join('|')}> [--<param> value …] [--min 0] [--max ∞] [--rtp 0.95] [--json]`); process.exit(1); }
const { dist, min, max, rtp, json, ...rest } = a; const params = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, k === 'weights' ? String(v).split(',').map(Number) : Number(v)]));
const S = buildShot({ dist, params, min: min !== undefined ? Number(min) : 0, max: max !== undefined ? Number(max) : Infinity, rtp: rtp !== undefined ? Number(rtp) : 0.95 });
console.log(json ? JSON.stringify(S.toJSON(), null, 2) : format(S));
