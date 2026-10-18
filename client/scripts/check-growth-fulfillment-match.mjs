import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { registerHooks } from 'node:module';
import { compileFunction } from 'node:vm';
import { fileURLToPath } from 'node:url';

// Generate both matches now. The reference uses the independent fulfillment
// scan and evaluates late views/recipe terms separately, without call-local
// sharing. It never reads an old result, copies a project or changes the
// fixture, clock, transactions or random source.
const worker = process.argv.find(arg => arg.startsWith('--worker='))?.slice(9);
const seed = process.argv.find(arg => arg.startsWith('--seed='))?.slice(7) || '1101';
const digest = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');

if (worker) {
  assert.ok(['reference', 'production'].includes(worker));
  const growthUrl = new URL('../src/app/simulation/_lib/growthPlanRuntime.js', import.meta.url).href;
  let referenceOverrides = 0;
  const hook = worker === 'reference' ? registerHooks({
    load(url, context, nextLoad) {
      const loaded = nextLoad(url, context);
      if (url !== growthUrl) return loaded;
      const source = typeof loaded.source === 'string' ? loaded.source : new TextDecoder().decode(loaded.source);
      const start = source.indexOf('  const fulfilled = (target) =>');
      const end = source.indexOf('\n  const remaining = targets.filter', start);
      assert.ok(start >= 0 && end > start, 'Reference must replace only the real fulfillment expression.');
      assert.equal(source.indexOf('  const fulfilled = (target) =>', start + 1), -1);
      const reference = `  const isAuthoredTarget = (target) => {
    const slot = inferEquipSlot(target);
    if (!slot) return false;
    const key = String(actor.goalLoadouts?.hero?.[slot + 'Key'] || '').trim();
    if (!key) return false;
    const resolved = items.find((item) => [item.itemKey, item.externalId, item._id]
      .some((alias) => String(alias ?? '').trim() === key));
    return !!resolved && String(resolved._id) === String(target._id);
  };
  const hasAuthoredSlot = (target) => {
    const slot = inferEquipSlot(target);
    return !!slot && !!String(actor.goalLoadouts?.hero?.[slot + 'Key'] || '').trim();
  };
  const fulfilled = (target) => {
    const slot = inferEquipSlot(target);
    const id = String(target._id);
    if (!usableWeapon(target)) return false;
    const authored = isAuthoredTarget(target);
    if (authored && actor._openingAcquiredItemIds?.[slot] === id) return true;
    return inventory.some((entry) => {
      const entryId = getInvItemId(entry);
      if (!(inventoryQuantities.get(entryId) > 0)
        || !usableWeapon({ ...byId.get(entryId), ...entry })) return false;
      if (entryId === id) return true;
      if (hasAuthoredSlot(target)) return false;
      return fallbackFulfills(entry, target) || (!entry.craftComponent
        && inferEquipSlot(entry) === slot && Number(entry.tier || 0) > Number(target.tier));
    });
  };`;
      assert.doesNotThrow(() => compileFunction(reference), 'The independent replacement must parse before a match starts.');
      let referenceSource = source.slice(0, start) + reference + source.slice(end);
      const separateLateViews = `  const late = openingComplete ? getLateGrowthDecision(actor, items, {},
    { quantities: inventoryQuantities, tiers: tierBySlot }) : { targets: [], issues: [], authoredTargets: [] };`;
      assert.equal(referenceSource.split(separateLateViews).length, 2,
        'Reference must disable exactly the production late inventory/candidate sharing.');
      referenceSource = referenceSource.replace(separateLateViews,
        `  const late = openingComplete ? {
    ...getLateGrowthTargets(actor, items),
    authoredTargets: getLateGrowthTargets(actor, items, { authoredOnly: true }).targets,
  } : { targets: [], issues: [], authoredTargets: [] };`);
      const sharedTerms = '  const recipeTermsById = providedRecipeTerms || new Map();';
      assert.equal(referenceSource.split(sharedTerms).length, 2,
        'Reference must disable exactly the production cross-candidate recipe-term sharing.');
      referenceSource = referenceSource.replace(sharedTerms, '  const recipeTermsById = new Map();');
      referenceOverrides += 1;
      return { ...loaded, source: referenceSource };
    },
  }) : null;
  try {
    const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
    const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');
    const input = await createRandomIsolationInput(seed);
    const before = digest(input);
    const result = await runRandomIsolationMatch(input);
    assert.equal(digest(input), before, 'The fresh match cannot rewrite its input.');
    assert.equal(referenceOverrides, worker === 'reference' ? 1 : 0,
      'Reference must exercise exactly one source overlay; production must exercise none.');
    console.log(JSON.stringify({ worker, referenceOverrides, engine: SIMULATION_ENGINE_VERSION,
      outcome: { inputDigest: before, evidence: result.evidence,
        finalFrameDigest: digest(result.finalFrame), logDigest: digest(result.logs) } }));
  } finally { hook?.deregister(); }
} else {
  const rows = [];
  for (const mode of ['reference', 'production']) {
    const output = execFileSync(process.execPath, [fileURLToPath(import.meta.url), `--worker=${mode}`, `--seed=${seed}`], {
      cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8',
      maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'],
    });
    const row = JSON.parse(output.trim()); rows.push(row);
    console.log(JSON.stringify({ completed: mode, ...row }));
  }
  assert.equal(rows[0].engine, rows[1].engine);
  assert.deepEqual(rows[1].outcome, rows[0].outcome,
    'Call-local entry, inventory, late-view and recipe facts must preserve every emitted frame, event, ending, log and RNG result.');
  console.log(JSON.stringify({ pass: true, seed, matches: 2,
    scope: 'fresh complete production match against independent fulfillment scan and separate late views/recipe terms; not real browser speed, all custom inputs or an old-engine replay' }));
}
