#!/bin/sh
set -e; cd "$(dirname "$0")/.."
node bin/build-pick.js --n 2 > examples/coin.txt
node bin/build-pick.js --n 5 --js > examples/five.txt
node bin/build-pick.js --weights 5,3,2 --labels RED,GREEN,BLUE --json > examples/weighted.json
node -e "import('./src/engine.js').then(({buildPick})=>{const out={};for(const n of [2,3,5,8]){const P=buildPick({n,rtp:0.95});out[n]=P.simulate({rounds:200000,seed:'ex'+n});out[n].odds=P.odds[0]}console.log(JSON.stringify(out,null,1))})" > examples/sim.json
PY=$(command -v python3); [ -x /opt/anaconda3/bin/python3 ] && PY=/opt/anaconda3/bin/python3
$PY scripts/plot.py examples/sim.json examples/
