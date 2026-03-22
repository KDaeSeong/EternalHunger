#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")/.."
if [ ! -d node_modules ]; then
  echo "[check-build-local] installing deps"
  npm ci --no-audit --no-fund
fi
echo "[check-build-local] running prebuild"
npm run prebuild
echo "[check-build-local] running next build"
npx next build
