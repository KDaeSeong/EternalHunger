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

function verificationSources(mode, mutatePath = '') {
  return vm.runInNewContext(`${wrapperBody}\nverificationSourceHashes();`, {
    mode, root: fileURLToPath(root), createHash, join,
    readFileSync: (path, encoding) => {
      const content = readFileSync(path, encoding);
      return resolve(path) === mutatePath ? `${content}\n// Independent test mutation.\n` : content;
    },
  }, { timeout: 10000 });
}
const growthProofPaths = ['scripts/check-growth-progress-inventory.mjs', 'scripts/check-growth-fulfillment-match.mjs',
  'scripts/lib/run-random-isolation-match.mjs', 'scripts/lib/register-simulation-modules.mjs'];
for (const mode of ['growth', 'performance', 'growth-focus-unit', 'initial-weapon-goal-unit', 'full']) {
  const sourceHashes = verificationSources(mode);
  for (const path of growthProofPaths) {
    assert.equal(typeof sourceHashes[path], 'string', `${mode} must fingerprint ${path}.`);
    const changed = verificationSources(mode, fileURLToPath(new URL(path, root)));
    assert.notEqual(changed[path], sourceHashes[path], 'Changing a growth proof must invalidate same-source verification.');
  }
}
console.log('PASS growth proof and fixture mutations invalidate all applicable verification modes');

for (const mode of ['authored-opening-unit', 'growth', 'performance', 'growth-focus-unit',
  'initial-weapon-goal-unit', 'full']) {
  const path = 'scripts/check-authored-goal-material-reservation.mjs';
  const before = verificationSources(mode);
  const after = verificationSources(mode, fileURLToPath(new URL(path, root)));
  assert.equal(typeof before[path], 'string', `${mode} must fingerprint the authored material reservation proof.`);
  assert.notEqual(after[path], before[path], 'Changing the real recipe reservation proof must invalidate its receipt.');
}
console.log('PASS authored material reservation proof mutations invalidate their growth verification modes');

for (const path of ['scripts/check-growth-plan.mjs', 'scripts/check-growth-progress-inventory.mjs',
  'scripts/check-growth-observation.mjs', 'scripts/check-custom-crafting.mjs', 'scripts/check-detonation-rules.mjs',
  'scripts/check-late-growth-goals.mjs', 'scripts/check-late-growth-decision-index.mjs',
  'scripts/check-boss-loot-sharing.mjs', 'scripts/check-phase-runtime-performance.mjs', 'scripts/check-team-tactics.mjs',
  'scripts/check-team-resource-goals.mjs', 'scripts/check-team-purchase-goals.mjs',
  'scripts/check-team-boss-goals.mjs', 'scripts/check-simulation-phase-worker-input.mjs']) {
  const before = verificationSources('authored-opening-unit');
  const after = verificationSources('authored-opening-unit', fileURLToPath(new URL(path, root)));
  assert.equal(typeof before[path], 'string');
  assert.notEqual(after[path], before[path], 'Authored acquisition/initialization proofs must invalidate the receipt.');
}
console.log('PASS authored opening acquisition and initialization proof mutations invalidate their verification mode');
for (const path of ['scripts/check-growth-fulfillment-match.mjs', 'scripts/check-custom-shared-growth-match.mjs',
  'scripts/lib/run-random-isolation-match.mjs']) {
  const before = verificationSources('authored-opening-match');
  const after = verificationSources('authored-opening-match', fileURLToPath(new URL(path, root)));
  assert.equal(typeof before[path], 'string');
  assert.notEqual(after[path], before[path], 'Authored opening match fixtures and source overlays must invalidate the receipt.');
}
console.log('PASS authored opening full-match and bounded replay proof mutations invalidate their verification mode');

const customGrowthProofPaths = {
  'custom-growth-expanded-match': ['scripts/check-custom-shared-growth-match.mjs'],
  'custom-shared-growth-match': ['scripts/check-custom-shared-growth-match.mjs'],
  'authored-opening-match': ['scripts/check-custom-shared-growth-match.mjs'],
  'custom-growth-unit': ['scripts/check-growth-plan.mjs', 'scripts/check-growth-capacity.mjs',
    'scripts/check-deep-custom-recipe-routes.mjs', 'scripts/check-deep-custom-recipe-growth.mjs',
    'scripts/check-team-tactics.mjs', 'scripts/check-team-regroup.mjs', 'scripts/check-team-resource-goals.mjs',
    'scripts/check-team-purchase-goals.mjs', 'scripts/lib/team-purchase-fixture.mjs',
    'scripts/check-match-distribution-metrics.mjs', 'scripts/lib/match-distribution-diagnostics.mjs',
    'scripts/lib/movement-reversal-trace.mjs'],
};
for (const [mode, paths] of Object.entries(customGrowthProofPaths)) {
  const before = verificationSources(mode);
  for (const path of [...paths, 'scripts/generate-simulation-version.mjs',
    'scripts/check-verification-fingerprint.mjs', 'scripts/lib/run-random-isolation-match.mjs',
    'scripts/lib/match-distribution-frame-tracker.mjs']) {
    assert.equal(typeof before[path], 'string', `${mode} must fingerprint ${path}.`);
    const after = verificationSources(mode, fileURLToPath(new URL(path, root)));
    assert.notEqual(after[path], before[path], 'Changing a custom growth proof, fixture, tracker, or verification policy must invalidate its receipt.');
  }
}
console.log('PASS expanded custom match and blocked-growth regroup proofs invalidate their verification modes');

for (const mode of ['guest-equipment-unit', 'guest-equipment-match', 'build', 'runtime-build', 'full']) {
  const before = verificationSources(mode);
  for (const path of ['scripts/check-guest-equipment-goals.mjs', 'scripts/check-guest-equipment-goals-ui.mjs',
    'scripts/lib/hook-handler-harness.mjs',
    'src/app/simulation/_components/SimulationGuestEquipmentGoals.js',
    'src/app/simulation/_components/SimulationLocalCharacterEditor.js',
    'src/app/simulation/_components/SimulationPregameRosterSetup.js',
    'src/app/simulation/_components/SimulationMainStage.js', 'src/styles/ERSimulation.css']) {
    assert.equal(typeof before[path], 'string', `${mode} must fingerprint ${path}.`);
    const after = verificationSources(mode, fileURLToPath(new URL(path, root)));
    assert.notEqual(after[path], before[path], 'Guest goal UI, storage bridge and verification changes must invalidate their receipt.');
  }
}
for (const path of ['scripts/check-team-survival-contribution.mjs', 'scripts/check-team-retreat-survival.mjs',
  'scripts/lib/run-combat-scenario.mjs', 'scripts/check-verification-fingerprint.mjs']) {
  const before = verificationSources('team-survival');
  const after = verificationSources('team-survival', fileURLToPath(new URL(path, root)));
  assert.equal(typeof before[path], 'string');
  assert.notEqual(after[path], before[path], 'Cover survival proof and fixture changes must invalidate their receipt.');
}
console.log('PASS guest equipment UI bridge and real cover survival proof mutations invalidate their verification modes');

for (const path of ['scripts/check-planning-power-snapshot.mjs', 'scripts/check-move-power-sort-match.mjs',
  'scripts/lib/run-random-isolation-match.mjs', 'scripts/check-team-tactics.mjs', 'scripts/check-live-frames.mjs']) {
  const before = verificationSources('move-power-sort');
  const after = verificationSources('move-power-sort', fileURLToPath(new URL(path, root)));
  assert.equal(typeof before[path], 'string');
  assert.notEqual(after[path], before[path], 'Changing a sorting proof must invalidate its verification receipt.');
}
console.log('PASS sorting reference, fixture and boundary test mutations invalidate their verification mode');
for (const path of ['scripts/check-simulation-cooperative-yield.mjs', 'scripts/check-simulation-phase-worker-match.mjs',
  'scripts/lib/simulation-phase-worker-host.mjs', 'scripts/lib/run-random-isolation-match.mjs']) {
  const before = verificationSources('frame-transport');
  const after = verificationSources('frame-transport', fileURLToPath(new URL(path, root)));
  assert.equal(typeof before[path], 'string');
  assert.notEqual(after[path], before[path], 'Changing a finite-transport proof must invalidate its verification receipt.');
}
console.log('PASS finite-transport source-stream proofs and fixtures invalidate their verification mode');
for (const mode of ['safe-route-unit', 'safe-route-match']) {
  for (const path of ['scripts/check-safe-route-facts.mjs', 'scripts/lib/run-random-isolation-match.mjs']) {
    const before = verificationSources(mode);
    const after = verificationSources(mode, fileURLToPath(new URL(path, root)));
    assert.equal(typeof before[path], 'string');
    assert.notEqual(after[path], before[path], 'Changing the fresh route oracle or match harness must invalidate its receipt.');
  }
}
for (const path of ['scripts/check-team-resource-goals.mjs', 'scripts/check-team-purchase-goals.mjs',
  'scripts/check-team-coordination-scheduling.mjs', 'scripts/check-planning-power-snapshot.mjs',
  'scripts/lib/match-distribution-diagnostics.mjs', 'scripts/lib/movement-reversal-trace.mjs',
  'scripts/lib/team-purchase-fixture.mjs']) {
  const before = verificationSources('safe-route-unit');
  const after = verificationSources('safe-route-unit', fileURLToPath(new URL(path, root)));
  assert.equal(typeof before[path], 'string');
  assert.notEqual(after[path], before[path], 'Changing a team route boundary test must invalidate its receipt.');
}
console.log('PASS safe-route full-match oracle and team-decision fixture mutations invalidate their verification modes');
const kioskQuoteSharedPaths = ['scripts/check-kiosk-movement-quote-cache.mjs',
  'scripts/lib/run-random-isolation-match.mjs', 'scripts/generate-simulation-version.mjs',
  'scripts/check-verification-fingerprint.mjs'];
for (const mode of ['kiosk-quote-unit', 'kiosk-quote-match']) {
  const before = verificationSources(mode);
  for (const path of kioskQuoteSharedPaths) {
    assert.equal(typeof before[path], 'string', `${mode} must fingerprint ${path}.`);
    const after = verificationSources(mode, fileURLToPath(new URL(path, root)));
    assert.notEqual(after[path], before[path], 'Changing a kiosk quote proof, fixture, generator, or fingerprint checker must invalidate its verification receipt.');
  }
}
const kioskQuoteUnitPaths = ['scripts/check-procurement-transactions.mjs',
  'scripts/check-kiosk-catalog-contract.mjs', 'scripts/check-market-item-policy.mjs',
  'scripts/check-team-purchase-goals.mjs', 'scripts/check-default-kiosk-goals.mjs',
  'scripts/check-kiosk-material-identity.mjs', 'scripts/check-kiosk-exchange-inputs.mjs',
  'scripts/check-kiosk-goal-exchanges.mjs', 'scripts/lib/team-purchase-fixture.mjs',
  'eslint.runtime.config.mjs'];
const kioskQuoteUnitBefore = verificationSources('kiosk-quote-unit');
for (const path of kioskQuoteUnitPaths) {
  assert.equal(typeof kioskQuoteUnitBefore[path], 'string', `kiosk-quote-unit must fingerprint ${path}.`);
  const after = verificationSources('kiosk-quote-unit', fileURLToPath(new URL(path, root)));
  assert.notEqual(after[path], kioskQuoteUnitBefore[path], 'Changing a kiosk quote unit proof, shared fixture, or lint boundary must invalidate its verification receipt.');
}
const safeRouteFixtureBefore = verificationSources('safe-route-unit');
const safeRouteFixtureAfter = verificationSources('safe-route-unit',
  fileURLToPath(new URL('scripts/lib/team-purchase-fixture.mjs', root)));
assert.equal(typeof safeRouteFixtureBefore['scripts/lib/team-purchase-fixture.mjs'], 'string');
assert.notEqual(safeRouteFixtureAfter['scripts/lib/team-purchase-fixture.mjs'],
  safeRouteFixtureBefore['scripts/lib/team-purchase-fixture.mjs'],
  'Changing the safe-route team-purchase fixture helper must invalidate its verification receipt.');
console.log('PASS kiosk quote unit/match and safe-route shared fixture mutations invalidate their verification modes');
for (const mode of ['build', 'phase-worker-release', 'formation-paired', 'module-resolution-compat']) {
  const sourceHashes = verificationSources(mode);
  for (const path of ['scripts/lib/register-simulation-modules.mjs', 'scripts/lib/simulation-module-resolution.mjs']) {
    assert.equal(typeof sourceHashes[path], 'string', `${mode} must fingerprint ${path}.`);
    const changed = verificationSources(mode, fileURLToPath(new URL(path, root)));
    assert.notEqual(changed[path], sourceHashes[path], 'Changing a module-resolution policy must invalidate same-source verification.');
  }
}
console.log('PASS module registration and resolution policy mutations invalidate applicable verification modes');
console.log(JSON.stringify({ pass: true, checks: 16, engine: base.wrapper,
  scope: 'source-only verification/version fingerprint and read-only mutations; not a full gate or browser timing' }));
