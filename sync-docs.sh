#!/bin/sh
# Refresh the Pages copies of the demos and figures from their source folders.
set -e
cd "$(dirname "$0")"
cp stepper-engine/web/index.html docs/stepper/index.html
cp payout-engine/web/index.html docs/payout/index.html
cp rgs-math/docs/curve-band-sim.html docs/sim/curve-band-sim.html
cp payout-engine/examples/curves.png docs/img/payout-curves.png
cp payout-engine/examples/bands.png docs/img/payout-bands.png
cp stepper-engine/examples/ladders.png docs/img/stepper-ladders.png
cp stepper-engine/examples/strategies.png docs/img/stepper-strategies.png
cp rgs-math/docs/sloped-3methods.png docs/img/sloped-3methods.png
echo "docs/ refreshed"
