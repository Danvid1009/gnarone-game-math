#!/bin/sh
# Rebuild everything in examples/ for the reference inputs.
set -e
cd "$(dirname "$0")/.."
P=0,0.5,1,2,5,20; R=0.95; W=0,50,30,15,4,1
for m in maxent geometric weights; do
  node bin/build-payout.js --payouts $P --rtp $R --method $m --weights $W --json > examples/$m.json
  node bin/build-payout.js --payouts $P --rtp $R --method $m --weights $W --js payout --out examples/payout-$m.js
  node bin/build-payout.js --payouts $P --rtp $R --method $m --weights $W > examples/$m.txt
done
node bin/simulate.js --payouts $P --rtp $R --methods maxent,geometric,weights --weights $W --rounds 100000 --out examples/sim.json
PY=$(command -v python3); [ -x /opt/anaconda3/bin/python3 ] && PY=/opt/anaconda3/bin/python3
$PY scripts/plot.py examples/sim.json examples/
