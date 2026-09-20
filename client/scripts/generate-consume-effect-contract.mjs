// Generate the browser ES module from the server's dependency-free contract.
// --check is read-only and refuses stale output instead of rewriting a build.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const sourceUrl = new URL('../../server/utils/consumeEffectContract.js', import.meta.url);
const targetUrl = new URL('../src/utils/consumeEffectContract.js', import.meta.url);
const source = readFileSync(sourceUrl, 'utf8').replaceAll('\r\n', '\n');
const exportLine = /module\.exports = (\{[^\n]+\});\s*$/;
if (!exportLine.test(source)) throw new Error('Consume effect contract exports must remain an explicit final object.');
const digest = createHash('sha256').update(source).digest('hex');
const generated = `// Generated from server/utils/consumeEffectContract.js; do not edit.\n// Source SHA-256: ${digest}\n`
  + source.replace(exportLine, 'export $1;\n');
let current;
try { current = readFileSync(targetUrl, 'utf8'); } catch { /* No generated module yet. */ }
if (process.argv.includes('--check')) {
  if (current !== generated) throw new Error('Consume effect contract is missing or stale. Run generate-consume-effect-contract.mjs.');
} else if (current !== generated) writeFileSync(targetUrl, generated);
console.log(`CONSUME_EFFECT_CONTRACT ${digest} ${process.argv.includes('--check') ? 'verified' : 'generated'}`);
