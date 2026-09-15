#!/usr/bin/env node
// node bin/build-pick.js --n 2 --rtp 0.95 | --weights 1,1,2 | --probabilities 0.5,0.3,0.2  [--labels a,b,c] [--json] [--js]
import { buildPick, format } from '../src/engine.js';
const a = Object.fromEntries(process.argv.slice(2).map((x, i, arr) => x.startsWith('--') ? [x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : []).filter(x => x.length));
const list = s => String(s).split(',');
const P = buildPick({ n: a.n ? Number(a.n) : undefined, weights: a.weights ? list(a.weights).map(Number) : undefined, probabilities: a.probabilities ? list(a.probabilities).map(Number) : undefined, labels: a.labels ? list(a.labels) : undefined, rtp: a.rtp ? Number(a.rtp) : 0.95 });
if (a.json) console.log(JSON.stringify(P.toJSON(), null, 2)); else console.log(format(P));
if (a.js !== undefined) console.log('\n' + P.standalone());
