// Mechanical ES-module mirror of the dependency-free server contract.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const sourceUrl = new URL('../../server/utils/equipmentEffectContract.js', import.meta.url);
const targetUrl = new URL('../src/utils/equipmentEffectContract.js', import.meta.url);
const source = readFileSync(sourceUrl, 'utf8').replaceAll('\r\n', '\n');
const exportLine = /module\.exports = (\{[^\n]+\});\s*$/;
if (!exportLine.test(source)) throw new Error('Equipment effect exports must remain an explicit final object.');
const digest = createHash('sha256').update(source).digest('hex');
const generated = `// Generated from server/utils/equipmentEffectContract.js; do not edit.\n// Source SHA-256: ${digest}\n`
  + source.replace(exportLine, 'export $1;\n');
let current;
try { current = readFileSync(targetUrl, 'utf8'); } catch { /* First generation. */ }
if (process.argv.includes('--check')) {
  if (current !== generated) throw new Error('Equipment effect contract is missing or stale. Run generate-equipment-effect-contract.mjs.');
} else if (current !== generated) writeFileSync(targetUrl, generated);
console.log(`EQUIPMENT_EFFECT_CONTRACT ${digest} ${process.argv.includes('--check') ? 'verified' : 'generated'}`);
