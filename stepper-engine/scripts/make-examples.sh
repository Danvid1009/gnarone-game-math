#!/bin/sh
set -e
cd "$(dirname "$0")/.."
for pair in "easy 10" "medium 25" "hard 100"; do
  set -- $pair
  node bin/build-ladder.js --rtp 0.97 --max $2 --steps 10 --name $1 > examples/$1.txt
  node bin/build-ladder.js --rtp 0.97 --max $2 --steps 10 --name $1 --json > examples/$1.json
  node bin/build-ladder.js --rtp 0.97 --max $2 --steps 10 --name $1 --js crashStep --out examples/crash-$1.js
done
node bin/simulate.js --rtp 0.97 --steps 10 --maxes 10,25,100 --rounds 100000 --out examples/sim.json
PY=$(command -v python3); [ -x /opt/anaconda3/bin/python3 ] && PY=/opt/anaconda3/bin/python3
$PY scripts/plot.py examples/sim.json examples/
