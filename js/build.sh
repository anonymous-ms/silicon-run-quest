#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
OUT=silicon-run.js
printf "(() => { 'use strict';\n" > "$OUT"
cat base.v86.js parallel-wafers.v86.js design-workstation.v811.js bootstrap.v86.js >> "$OUT"
printf "\n})();\n//# sourceURL=silicon-run.js\n" >> "$OUT"
node --check "$OUT"
