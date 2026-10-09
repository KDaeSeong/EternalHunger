import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import vm from 'node:vm';

// Evaluate only the actual source fingerprint bodies. Do not start commands,
// read archived match results or write version/output files in this check.
const root = new URL('../', import.meta.url);
const wrapperSource = readFileSync(new URL('scripts/run-eternal-hunger-verification.mjs', root), 'utf8');
const generatorSource = readFileSync(new URL('scripts/generate-simulation-version.mjs', root), 'utf8');
const wrapperBody = wrapperSource.slice(wrapperSource.indexOf('function fingerprint()'), wrapperSource.indexOf('\nconst result ='));
const generatorBody = generatorSource.slice(generatorSource.indexOf('const paths ='), generatorSource.indexOf('\nconst target ='));
assert.ok(wrapperBody.startsWith('function fingerprint()') && generatorBody.startsWith('const paths ='),
  'The check must evaluate the real fingerprint implementation.');

const policyPath = fileURLToPath(new URL('../shared/marketItemPolicy.cjs', root));
const runtimePath = fileURLToPath(new URL('src/app/simulation/_lib/simulationFrameRuntime.js', root));
function versions({ mutatePath = '', crlf = false } = {}) {
  const pathsRead = new Set();
  const read = (path, encoding) => {
    const absolute = resolve(path instanceof URL ? fileURLToPath(path) : path);
    pathsRead.add(absolute);
    let content = readFileSync(path, encoding);
    if (absolute === mutatePath) content += '\n// Independent fingerprint mutation.\n';
    if (crlf) content = content.replaceAll('\r\n', '\n').replaceAll('\n', '\r\n');
    return content;
  };
  const common = { createHash, readdirSync, readFileSync: read, join, URL };
  const wrapper = vm.runInNewContext(`${wrapperBody}\nfingerprint();`,
    { ...common, root: fileURLToPath(root) }, { timeout: 10000 });
  const generator = vm.runInNewContext(`${generatorBody}\nversion;`,
    { ...common, root }, { timeout: 10000 });
  return { wrapper, generator, pathsRead };
}

const base = versions();
assert.equal(base.wrapper, base.generator, 'Verification must cover exactly the current engine version sources.');
console.log('PASS verification fingerprints match the real version generator');

const changedPolicy = versions({ mutatePath: policyPath });
assert.notEqual(changedPolicy.wrapper, base.wrapper, 'Changing shared food/water policy must invalidate same-engine verification.');
assert.equal(changedPolicy.wrapper, changedPolicy.generator);
assert.ok(changedPolicy.pathsRead.has(policyPath));
console.log('PASS shared market policy mutations invalidate both fingerprints');

const changedRuntime = versions({ mutatePath: runtimePath });
assert.notEqual(changedRuntime.wrapper, base.wrapper);
assert.equal(changedRuntime.wrapper, changedRuntime.generator);
console.log('PASS simulation runtime mutations remain covered');

const lineEndings = versions({ crlf: true });
assert.equal(lineEndings.wrapper, base.wrapper);
assert.equal(lineEndings.generator, base.generator);
console.log('PASS CRLF normalization retains cross-platform engine identity');

const strategyOutputStatement = wrapperSource.match(/^if \(\['strategy-paired', 'formation-paired'\]\.includes\(mode\)\) commands\[mode\] \+= .*;$/m)?.[0];
assert.ok(strategyOutputStatement, 'Check the actual strategy output argument, not a replacement command.');
for (const mode of ['strategy-paired', 'formation-paired']) {
  const strategyCommand = vm.runInNewContext(`${strategyOutputStatement}\ncommands[mode];`, {
    mode, commands: { [mode]: 'npm run analyze:strategy-comparison --' },
    runId: '2000-01-01T00-00-00.000Z-00000000-0000-4000-8000-000000000000',
  }, { timeout: 1000 });
  assert.match(strategyCommand, / --output=\.verification-runs\/[A-Za-z0-9.-]+\/strategy-comparison\.json$/);
  assert.ok(!strategyCommand.includes('"') && !strategyCommand.includes("'"),
    'The safe relative output path must not acquire literal Windows npm quotes.');
}
console.log('PASS strategy output uses the actual shell-safe unquoted relative path');
console.log(JSON.stringify({ pass: true, checks: 5, engine: base.wrapper,
  scope: 'source-only verification/version fingerprint and read-only mutations; not a full gate or browser timing' }));
