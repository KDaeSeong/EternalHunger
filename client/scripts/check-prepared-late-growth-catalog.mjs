import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

const lateUrl = new URL('../src/app/simulation/_lib/lateGrowthTargetRuntime.js', import.meta.url).href;
const worker = process.argv.find(arg => arg.startsWith('--worker='))?.slice(9);
const seed = process.argv.find(arg => arg.startsWith('--seed='))?.slice(7) || '1101';
function sourceFingerprint() {
  const root = new URL('../', import.meta.url);
  const paths = ['src/app/simulation/tacticalSkillTable.js', '../shared/marketItemPolicy.cjs',
    'src/app/simulation/_generated/simulationEngineVersion.js',
    'scripts/check-prepared-late-growth-catalog.mjs', 'scripts/lib/register-simulation-modules.mjs',
    'scripts/lib/run-random-isolation-match.mjs'];
  for (const dir of ['src/app/simulation/_lib', 'src/utils']) {
    for (const file of readdirSync(new URL(`${dir}/`, root))) if (file.endsWith('.js')) paths.push(`${dir}/${file}`);
  }
  const hash = createHash('sha256');
  for (const path of paths.sort()) hash.update(path).update('\0')
    .update(readFileSync(new URL(path, root), 'utf8').replaceAll('\r\n', '\n')).update('\0');
  return hash.digest('hex');
}
const sourcesBefore = sourceFingerprint();
const probe = { recipeReads: 0, overlays: 0 };
globalThis.__preparedLateCatalogProbe = probe;
const hook = registerHooks({ load(url, context, nextLoad) {
  const loaded = nextLoad(url, context);
  if (url !== lateUrl) return loaded;
  let source = typeof loaded.source === 'string' ? loaded.source : new TextDecoder().decode(loaded.source);
  source = source.replaceAll('\r\n', '\n');
  const imports = "import { getCraftRecipeTerms } from './gearRecipeGuardRuntime.js';";
  assert.equal(source.split(imports).length, 2);
  source = source.replace(imports, "import { getCraftRecipeTerms as readRecipeTerms } from './gearRecipeGuardRuntime.js';")
    + '\nconst getCraftRecipeTerms = (...args) => { globalThis.__preparedLateCatalogProbe.recipeReads++; return readRecipeTerms(...args); };';
  if (worker === 'reference') {
    const boundary = 'const preparedCatalog = lockedCatalogFacts(items);';
    assert.equal(source.split(boundary).length, 2, 'Disable only the prepared catalogue index, not gameplay.');
    source = source.replace(boundary, 'const preparedCatalog = null;');
    probe.overlays++;
  }
  return { ...loaded, source };
} });

try {
  const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
  const { createSimulationRunInput, prepareSimulationRunInput } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
  const { getLateGrowthTargets } = await import(lateUrl);
  const fixture = JSON.parse(await createRandomIsolationInput(seed));
  const makeInput = (items = fixture.items) => createSimulationRunInput({ activeMap: fixture.map,
    settings: fixture.settings, survivors: fixture.survivors, runSeed: seed, publicItems: items }, { getItem: () => null });
  const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  if (worker) {
    const input = makeInput();
    const result = await runRandomIsolationMatch(null, { savedInput: input });
    console.log(JSON.stringify({ worker, inputDigest: digest(input), evidence: result.evidence,
      finalFrameDigest: digest(result.finalFrame), logsDigest: digest(result.logs), probe }));
  } else {
    const slots = ['weapon', 'head', 'clothes', 'arm', 'shoes'];
    const gear = (id, slot, tier = 5, extra = {}) => ({ _id: id, itemKey: `${id}-key`, name: id,
      category: 'equipment', type: slot === 'weapon' ? '무기' : '방어구', equipSlot: slot, tier,
      weaponType: slot === 'weapon' ? '권총' : '',
      recipe: { ingredients: [{ itemId: 'ore', qty: 1 }], resultQty: 1, creditsCost: 2 }, ...extra });
    const actor = (extra = {}) => ({ _id: 'prepared-catalog-actor', hp: 100, maxHp: 100, weaponType: '권총',
      inventory: [{ itemId: 'ore', qty: 2 }], equipped: {}, goalLoadouts: {}, ...extra });
    const prepare = items => prepareSimulationRunInput(makeInput(items)).state.publicItems;
    let passed = 0, failed = 0, comparisons = 0;
    const check = (name, run) => {
      try { run(); passed++; console.log(`PASS ${name}`); }
      catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
    };
    const compare = (who, prepared, options) => {
      // An unbranded detached copy executes the fresh mutable scan. Its live
      // quantities, authored goals and recipe validation remain independent.
      const before = structuredClone(who);
      const raw = structuredClone(prepared);
      const expected = getLateGrowthTargets(who, raw, options);
      const actual = getLateGrowthTargets(who, prepared, options);
      assert.deepEqual(actual, expected);
      actual.targets.forEach(target => assert.ok(prepared.includes(target), 'Return the real prepared item.'));
      assert.deepEqual(who, before);
      comparisons++;
      return actual;
    };
    const assertDeepFrozen = (value, seen = new Set()) => {
      if (!value || typeof value !== 'object' || seen.has(value)) return;
      seen.add(value);
      assert.ok(Object.isFrozen(value), 'Every object in the owned JSON catalogue must be frozen.');
      for (const child of Object.values(value)) assertDeepFrozen(child, seen);
    };

    check('only the owned prepared catalogue is frozen; editable and saved originals stay mutable', () => {
      const original = [gear('head', 'head')], input = makeInput(original);
      const prepared = prepareSimulationRunInput(input).state.publicItems;
      assert.notEqual(prepared, input.publicItems);
      assertDeepFrozen(prepared);
      assert.equal(Object.isFrozen(original), false);
      assert.equal(Object.isFrozen(input.publicItems), false);
      input.publicItems[0].recipe.resultQty = 0;
      original[0].recipe.ingredients[0].qty = 99;
      assert.equal(prepared[0].recipe.resultQty, 1);
      assert.equal(prepared[0].recipe.ingredients[0].qty, 1);
      assert.throws(() => { prepared[0].recipe.resultQty = 0; }, TypeError);
      compare(actor(), prepared);
    });

    check('a warm prepared index reuses recipe facts while rebuilding every actor decision', () => {
      const prepared = prepare(slots.flatMap(slot => [gear(`${slot}-a`, slot), gear(`${slot}-b`, slot, 6)]));
      assertDeepFrozen(prepared);
      getLateGrowthTargets(actor(), prepared);
      const warmReads = probe.recipeReads;
      assert.ok(warmReads > 0);
      for (let i = 0; i < 20; i++) getLateGrowthTargets(actor({ weaponType: i % 2 ? '활' : '권총',
        inventory: [{ itemId: 'ore', qty: i % 3 }] }), prepared, { authoredOnly: i % 4 === 0 });
      assert.equal(probe.recipeReads, warmReads, 'Warm calls cannot re-normalize immutable recipes.');
      for (const qty of [0, 1, 2, '2', -1, 'invalid']) for (const weaponType of ['권총', '활']) {
        for (const tier of [0, 4, 5, 6]) for (const authoredOnly of [false, true]) {
          compare(actor({ weaponType, inventory: [{ itemId: 'ore', qty }, ...slots.map(slot => ({
            ...gear(`worn-${slot}`, slot, tier), itemId: `worn-${slot}`, qty: 1 }))] }), prepared, { authoredOnly });
        }
      }
    });

    check('global first-valid aliases, invalid recipes, duplicate inputs and authored order are exact', () => {
      const prepared = prepare([gear('first', 'clothes', 5, { itemKey: 'collision' }),
        gear('second', 'head', 5, { itemKey: 'collision' }),
        gear('invalid', 'head', 5, { recipe: { ingredients: [{ itemId: 'ore', qty: 0 }] } }),
        gear('duplicate', 'head', 6, { recipe: { ingredients: [{ itemId: 'ore', qty: 1 },
          { itemId: 'ore', qty: 2 }], resultQty: 1, creditsCost: 0 } }),
        gear('other', 'weapon', 6, { weaponType: '활' })]);
      for (const key of ['collision', 'second', 'invalid-key', 'duplicate-key', 'missing']) {
        const who = actor({ goalLoadouts: { legend: { headKey: key }, transcend: { weaponKey: 'other-key' } } });
        compare(who, prepared); compare(who, prepared, { authoredOnly: true });
      }
      assert.ok(compare(actor({ goalLoadouts: { legend: { headKey: 'collision' } } }), prepared).issues
        .some(row => row.slot === 'head'));
      compare(actor({ inventory: [{ itemId: 'ore', qty: 3 }] }), prepared);
    });

    check('separate preparations cannot share a stale recipe, alias or candidate order', () => {
      const input = makeInput([gear('a', 'head'), gear('b', 'head')]);
      const first = prepareSimulationRunInput(input).state.publicItems;
      getLateGrowthTargets(actor(), first);
      input.publicItems[0].recipe.resultQty = 0;
      const second = prepareSimulationRunInput(input).state.publicItems;
      assert.deepEqual(compare(actor(), first).targets.map(item => item._id), ['a', 'b']);
      assert.deepEqual(compare(actor(), second).targets.map(item => item._id), ['b']);
      input.publicItems.reverse(); input.publicItems[1].recipe.resultQty = 1;
      const third = prepareSimulationRunInput(input).state.publicItems;
      assert.deepEqual(compare(actor(), third).targets.map(item => item._id), ['a', 'b']);
      assert.notEqual(first[0], third[1]);
    });

    check('ordinary mutable and sparse inputs are never frozen or cached', () => {
      const items = Array(5); items[1] = gear('a', 'head'); items[4] = gear('b', 'head');
      assert.deepEqual(getLateGrowthTargets(actor(), items).targets.map(item => item._id), ['a', 'b']);
      items[1].recipe.resultQty = 0;
      assert.deepEqual(getLateGrowthTargets(actor(), items).targets.map(item => item._id), ['b']);
      delete items[4]; items[0] = gear('c', 'shoes', 6);
      assert.deepEqual(getLateGrowthTargets(actor(), items).targets.map(item => item._id), ['c']);
      assert.equal(Object.isFrozen(items), false); assert.equal(Object.isFrozen(items[0]), false);
    });

    console.log(JSON.stringify({ passed, failed, comparisons, scope: 'prepared JSON-owned catalogue versus fresh mutable decision scans' }));
    if (failed) process.exitCode = 1;
    else if (!process.argv.includes('--fixtures-only')) {
      for (const matchSeed of ['1101', '20261010']) {
        const run = mode => JSON.parse(execFileSync(process.execPath, [fileURLToPath(import.meta.url),
          `--worker=${mode}`, `--seed=${matchSeed}`], { encoding: 'utf8', maxBuffer: 1024 * 1024 }));
        const reference = run('reference'), current = run('current');
        assert.equal(reference.probe.overlays, 1); assert.equal(current.probe.overlays, 0);
        assert.equal(reference.inputDigest, current.inputDigest);
        assert.deepEqual(reference.evidence, current.evidence);
        assert.equal(reference.finalFrameDigest, current.finalFrameDigest);
        assert.equal(reference.logsDigest, current.logsDigest);
        assert.ok(current.probe.recipeReads < reference.probe.recipeReads);
        const { eventCount, frames, phases, ticks, eventDigest, frameDigest, ending, random } = current.evidence;
        console.log(JSON.stringify({ seed: matchSeed, exact: true, inputDigest: current.inputDigest,
          evidence: { eventCount, frames, phases, ticks, eventDigest, frameDigest,
            ending: { outcome: ending.outcome, cause: ending.cause, winnerTeamId: ending.winnerTeamId },
            random: { state: random.state, draws: random.draws, ids: random.ids } },
          finalFrameDigest: current.finalFrameDigest, logsDigest: current.logsDigest,
          recipeReads: { reference: reference.probe.recipeReads, current: current.probe.recipeReads },
          scope: 'one fresh reference/current match pair; only catalogue indexing differs; helpers shared' }));
      }
    }
  }
  assert.equal(sourceFingerprint(), sourcesBefore, 'Runtime and verification sources must not change during the run.');
  if (!worker) console.log(JSON.stringify({ sourcesUnchanged: true, sourceFingerprint: sourcesBefore }));
} finally {
  hook.deregister(); delete globalThis.__preparedLateCatalogProbe;
}
