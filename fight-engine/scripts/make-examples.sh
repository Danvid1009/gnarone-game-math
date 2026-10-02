#!/bin/sh
set -e; cd "$(dirname "$0")/.."
node scripts/facts.js > examples/facts.json
node ../site/make-fixtures.js fight-engine
PY=$(command -v python3); [ -x /opt/anaconda3/bin/python3 ] && PY=/opt/anaconda3/bin/python3
$PY scripts/plot.py examples/facts.json examples/
