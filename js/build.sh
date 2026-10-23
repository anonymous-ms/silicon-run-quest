#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
OUT="silicon-run.v85.js"
printf "(() => { 'use strict';\n" > "$OUT"
cat base.v85.js parallel-wafers.v85.js design-workstation.v85.js bootstrap.v85.js >> "$OUT"
printf "\n})();\n//# sourceURL=silicon-run.v85.js\n" >> "$OUT"
node --check "$OUT"
echo "Built $OUT"
