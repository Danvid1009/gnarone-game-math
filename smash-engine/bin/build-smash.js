#!/usr/bin/env node
import { buildSmash, format } from '../src/engine.js';
const a = Object.fromEntries(process.argv.slice(2).map((x, i, arr) => x.startsWith('--') ? [x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : []).filter(x => x.length));
const S = buildSmash(a.rtp ? { rtp: Number(a.rtp) } : {});
if (a.json) console.log(JSON.stringify(S.toJSON(), null, 2)); else console.log(format(S));
