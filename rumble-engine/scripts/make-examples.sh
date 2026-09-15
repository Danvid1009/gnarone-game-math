#!/bin/sh
set -e; cd "$(dirname "$0")/.."
node bin/build-rumble.js > examples/rumble.txt
node bin/build-rumble.js --json > examples/rumble.json
node -e "
import('./src/engine.js').then(({buildRumble})=>{const R=buildRumble();const out={};for(const t of Object.keys(R.betTypes))out[t]=R.simulate({betType:t,rounds:t.includes('BUNDLE')?30000:200000,seed:'ex'+t});console.log(JSON.stringify(out,null,1))})" > examples/sim.json
PY=$(command -v python3); [ -x /opt/anaconda3/bin/python3 ] && PY=/opt/anaconda3/bin/python3
$PY scripts/plot.py examples/rumble.json examples/sim.json examples/
