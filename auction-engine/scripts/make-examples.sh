#!/bin/sh
set -e
cd "$(dirname "$0")/.."
for pair in "small 5" "medium 10" "large 25" "xl 100"; do
  set -- $pair
  node bin/build-auction.js --rtp 0.95 --max $2 --steps 10 --name $1 > examples/$1.txt
  node bin/build-auction.js --rtp 0.95 --max $2 --steps 10 --name $1 --json > examples/$1.json
  node bin/build-auction.js --rtp 0.95 --max $2 --steps 10 --name $1 --js settle --out examples/settle-$1.js
done
node bin/simulate.js --rtp 0.95 --steps 10 --maxes 5,10,25,100 --rounds 100000 --out examples/sim.json
node scripts/make-fixtures.js
PY=$(command -v python3); [ -x /opt/anaconda3/bin/python3 ] && PY=/opt/anaconda3/bin/python3
$PY scripts/plot.py examples/sim.json examples/
