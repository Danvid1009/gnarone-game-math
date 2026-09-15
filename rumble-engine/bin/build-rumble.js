#!/usr/bin/env node
import { buildRumble, format } from '../src/engine.js';
const a = Object.fromEntries(process.argv.slice(2).map((x, i, arr) => x.startsWith('--') ? [x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : []).filter(x => x.length));
const R = buildRumble({ rtp: a.rtp ? Number(a.rtp) : 0.95 });
if (a.json) console.log(JSON.stringify(R.toJSON(), null, 2)); else console.log(format(R));
