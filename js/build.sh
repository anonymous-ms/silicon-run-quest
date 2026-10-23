#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
OUT=silicon-run.v89.js
printf "(() => { 'use strict';\n" > "$OUT"
cat base.v86.js parallel-wafers.v86.js design-workstation.v89.js bootstrap.v86.js >> "$OUT"
printf "\n})();\n//# sourceURL=silicon-run.v89.js\n" >> "$OUT"
node --check "$OUT"
