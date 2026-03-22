#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLIENT_DIR="$ROOT_DIR/client"
SERVER_DIR="$ROOT_DIR/server"

printf '\n[1/3] client dependencies\n'
cd "$CLIENT_DIR"
if [ ! -d node_modules ]; then
  npm ci --no-audit --no-fund
fi

printf '\n[2/3] client eslint\n'
npm run lint -- .

printf '\n[3/3] server syntax check\n'
cd "$SERVER_DIR"
if [ ! -d node_modules ]; then
  npm ci --no-audit --no-fund
fi
node <<'NODE'
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const exts = new Set(['.js', '.mjs', '.cjs']);
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (exts.has(path.extname(entry.name))) files.push(full);
  }
}

walk(root);
let failed = 0;
for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) failed += 1;
}
console.log(`checked ${files.length} server files`);
if (failed > 0) process.exit(1);
NODE

echo "\nJS validation passed."
