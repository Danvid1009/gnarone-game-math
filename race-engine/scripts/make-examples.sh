#!/bin/sh
set -e
cd "$(dirname "$0")/.."
E=1800,1650,1600,1500,1450,1300; N=Ace,Bolt,Cinder,Dash,Ember,Flint
node bin/build-race.js --elo $E --rtp 0.95 --names $N > examples/winner-only.txt
node bin/build-race.js --elo $E --rtp 0.95 --places 0.6,0.3,0.1 --names $N > examples/places.txt
node bin/build-race.js --elo $E --rtp 0.95 --places 0.6,0.3,0.1 --names $N --json > examples/race.json
node bin/build-race.js --elo $E --rtp 0.95 --places 0.6,0.3,0.1 --names $N --js | sed -n '/^\/\/ Plackett/,$p' > examples/raceOutcome.js
PY=$(command -v python3); [ -x /opt/anaconda3/bin/python3 ] && PY=/opt/anaconda3/bin/python3
$PY scripts/plot.py examples/race.json examples/
