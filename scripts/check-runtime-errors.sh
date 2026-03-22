#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/client"
echo "[runtime-check] client strict eslint"
npx eslint "src/**/*.{js,jsx,mjs}" \
  --rule 'no-use-before-define: [2,{functions:false,classes:true,variables:true}]' \
  --rule 'no-undef: 2'
echo "[runtime-check] client build"
npm run build
cd "$ROOT_DIR/server"
echo "[runtime-check] server syntax"
find . -type f -name '*.js' -print0 | xargs -0 -n 1 node --check
