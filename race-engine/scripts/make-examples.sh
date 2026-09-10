#!/bin/sh
set -e
cd "$(dirname "$0")/.."
E=1850,1780,1720,1680,1640,1600,1560,1520,1480,1430,1380,1300; N=Ace,Bolt,Cinder,Dash,Ember,Flint,Gale,Hex,Iris,Jolt,Kite,Lux
node bin/build-race.js --elo $E --rtp 0.95 --names $N > examples/place-terms.txt
node bin/build-race.js --elo $E --rtp 0.95 --names $N --fixed-third 1.4 > examples/fixed-third.txt
node bin/build-race.js --elo $E --rtp 0.95 --names $N --json > examples/race.json
node bin/build-race.js --elo $E --rtp 0.95 --names $N --js | sed -n '/^\/\/ Plackett/,$p' > examples/raceOrder.js
node bin/build-race.js --elo $E --rtp 0.95 --names $N --fractions 0.6,0.3,0.1 > examples/fractions.txt
node scripts/sim-place-terms.js 200000 0.95 0.25 0.2 > examples/sim-place-terms.json 2> examples/sim-place-terms.txt
node scripts/make-fixtures.js > /dev/null
PY=$(command -v python3); [ -x /opt/anaconda3/bin/python3 ] && PY=/opt/anaconda3/bin/python3
$PY scripts/plot.py examples/race.json examples/
$PY scripts/plot-sim.py examples/sim-place-terms.json examples/
