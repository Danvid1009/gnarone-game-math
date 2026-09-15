#!/bin/sh
set -e; cd "$(dirname "$0")/.."
node bin/build-smash.js > examples/smash.txt
node bin/build-smash.js --json > examples/smash.json
node -e "import('./src/engine.js').then(({buildSmash})=>{const S=buildSmash();console.log(JSON.stringify({BASE:S.simulate({betType:'BASE',rounds:300000,seed:'exB'}),BOOSTED:S.simulate({betType:'BOOSTED',rounds:300000,seed:'exX'})},null,1))})" > examples/sim.json
PY=$(command -v python3); [ -x /opt/anaconda3/bin/python3 ] && PY=/opt/anaconda3/bin/python3
$PY scripts/plot.py examples/smash.json examples/sim.json examples/
