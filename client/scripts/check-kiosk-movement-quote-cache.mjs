import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

const movementUrl = new URL('../src/app/simulation/_lib/kioskMovementRuntime.js', import.meta.url).href;
const policyUrl = new URL('../../shared/marketItemPolicy.cjs', import.meta.url).href;
const worker = process.argv.find(value => value.startsWith('--worker='))?.slice(9);
const seed = process.argv.find(value => value.startsWith('--seed='))?.slice(7) || '1101';
const asText = source => typeof source === 'string' ? source : new TextDecoder().decode(source);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const quoteImport = "import { createKioskRecipeOfferValidator, quoteDefaultKioskGoalAction } from './kioskGoalQuoteRuntime.js';";
const quoteGate = 'if (defaultOfferAvailable === undefined) {';
const defaultPolicyExpression = 'if (defaultKioskNames.has(compact(itemName(item))) || defaultKioskAliases.includes(compact(itemName(item)))) return true;';
const legacyAliases = "['meteor', 'treeoflife', 'lifetree', '생나', 'mythril', 'mithril',\n    'tacticalskillmodule', 'tacskillmodule', '혈액팩', '혈팩', 'bloodpack', 'bloodsample', 'vfbloodsample', 'forcecore']";

const probe = { quoteCalls: 0, overlays: new Set() };
globalThis.__kioskMovementQuoteCacheProbe = probe;

function referencePolicySource(source) {
  assert.equal(source.split(defaultPolicyExpression).length, 2, 'Restore exactly the hoisted policy expression.');
  const local = `const defaultKioskNames = new Set(DEFAULT_KIOSK_ITEM_NAMES.map(compact));\n  const defaultKioskAliases = ${legacyAliases};\n  ${defaultPolicyExpression}`;
  return source.replace(defaultPolicyExpression, local);
}

const hook = registerHooks({
  load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);
    if ((worker && url === movementUrl) || url.startsWith(`${movementUrl}?kiosk-quote=`)) {
      const mode = new URL(url).searchParams.get('kiosk-quote') || worker;
      assert.ok(['reference', 'production'].includes(mode));
      let source = asText(loaded.source);
      assert.equal(source.split(quoteImport).length, 2, 'Instrument the single quote import.');
      source = source.replace(quoteImport,
        "import { createKioskRecipeOfferValidator, quoteDefaultKioskGoalAction as originalDefaultKioskQuote } from './kioskGoalQuoteRuntime.js';")
        + '\nconst quoteDefaultKioskGoalAction = (...args) => { globalThis.__kioskMovementQuoteCacheProbe.quoteCalls++; return originalDefaultKioskQuote(...args); };\n';
      if (worker === 'reference' || mode === 'reference') {
        assert.equal(source.split(quoteGate).length, 2, 'Restore the original per-zone quote condition.');
        source = source.replace(quoteGate, 'if (true) {');
        probe.overlays.add('movement');
      }
      return { ...loaded, source };
    }
    if (url === policyUrl && worker === 'reference') {
      const source = referencePolicySource(asText(loaded.source));
      probe.overlays.add('policy');
      return { ...loaded, source };
    }
    return loaded;
  },
});

try {
  if (worker) {
    assert.ok(['reference', 'production'].includes(worker));
    const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
    assert.deepEqual([...probe.overlays].sort(), worker === 'reference' ? ['movement', 'policy'] : [],
      'Both reference overlays must be active before a whole match starts.');
    const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');
    const input = await createRandomIsolationInput(seed), inputDigest = digest(input);
    const result = await runRandomIsolationMatch(input);
    assert.equal(digest(input), inputDigest, 'A complete match cannot rewrite its fresh input.');
    assert.deepEqual([...probe.overlays].sort(), worker === 'reference' ? ['movement', 'policy'] : [],
      'The expected overlays must remain the only worker source substitutions.');
    console.log(JSON.stringify({ worker, engine: SIMULATION_ENGINE_VERSION,
      overlays: [...probe.overlays].sort(), quoteCalls: probe.quoteCalls,
      outcome: { inputDigest, evidence: result.evidence,
        finalFrameDigest: digest(result.finalFrame), logsDigest: digest(result.logs) } }));
  } else {
    const { fixture, tree, rare } = await import('./lib/team-purchase-fixture.mjs');
    const { getActorGrowthCraftGoal } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
    const policy = await import('../src/utils/marketItemPolicy.js');
    const { DEFAULT_KIOSK_ITEM_NAMES, isMarketItemAllowed, normalizeMarketItemId } = await import('../../shared/marketItemPolicy.cjs');
    const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
    const movement = {};
    for (const mode of ['production', 'reference']) {
      movement[mode] = await import(`${movementUrl}?kiosk-quote=${mode}`);
    }
    const noRandom = () => { throw new Error('A kiosk movement quote cannot draw simulation RNG.'); };
    const compact = value => String(value || '').toLowerCase().replace(/[\s._-]+/g, '');
    const itemName = item => {
      const fallback = normalizeMarketItemId(item?._id || item?.itemId).split(':').at(-1);
      return String(item?.name || item?.text || fallback || '').trim();
    };
    const legacyIsDefaultKioskItem = item => {
      if (!isMarketItemAllowed(item, 'kiosk') || item?.equipSlot
        || ['무기', '방어구', 'weapon', 'armor', 'equipment'].includes(item?.type)) return false;
      const names = new Set(DEFAULT_KIOSK_ITEM_NAMES.map(compact));
      const aliases = ['meteor', 'treeoflife', 'lifetree', '생나', 'mythril', 'mithril',
        'tacticalskillmodule', 'tacskillmodule', '혈액팩', '혈팩', 'bloodpack', 'bloodsample', 'vfbloodsample', 'forcecore'];
      if (names.has(compact(itemName(item))) || aliases.includes(compact(itemName(item)))) return true;
      return (Array.isArray(item.tags) ? item.tags : []).some(tag =>
        ['meteor', 'life_tree', 'mithril', 'force_core', 'vf', 'tac_skill_module'].includes(String(tag).toLowerCase()));
    };
    let checks = 0, failures = 0;
    const check = (name, run) => {
      try { run(); checks++; console.log(`PASS ${name}`); }
      catch (error) { failures++; console.error(`FAIL ${name}: ${error.message}`); }
    };
    const makeInput = () => {
      const input = fixture();
      const actor = input.roster.find(row => row._id === 'crafter');
      const craftGoal = getActorGrowthCraftGoal(actor, input.state.publicItems);
      return { input, actor, craftGoal };
    };
    const evaluate = (mode, context, zoneIds, kiosks = zoneIds.map(zoneId => ({ mapId: 'purchase-map', zoneId }))) => {
      probe.quoteCalls = 0;
      const { input, actor, craftGoal } = context;
      const before = digest({ input, actor, craftGoal, kiosks, zoneIds });
      const result = withSimulationRandom(noRandom, () => movement[mode].getKioskMovementTargets({
        zoneIds, mapObj: input.state.mapObj, kiosks, actor, craftGoal,
        publicItems: input.state.publicItems, ruleset: input.state.ruleset,
        day: input.state.nextDay, phase: input.state.nextPhase,
        upgradeNeed: { wantLegend: true, wantTrans: true, goalTier: 6 },
        desiredKeys: ['meteor', 'life_tree', 'mithril', 'force_core', 'vf'],
        desiredItemIds: [tree._id, rare._id],
      }));
      assert.equal(digest({ input, actor, craftGoal, kiosks, zoneIds }), before,
        'A movement quote cannot mutate actor, goals, stock, or input collections.');
      return { result, quoteCalls: probe.quoteCalls };
    };

    check('default quote is shared once per synchronous call and stays fresh between calls', () => {
      const context = makeInput(), zones = ['a', 'b', 'c', 'a'];
      const shops = zones.map(zoneId => ({ mapId: context.input.state.mapObj._id, zoneId }));
      const current = evaluate('production', context, zones, shops), old = evaluate('reference', context, zones, shops);
      assert.deepEqual(current.result, old.result);
      assert.deepEqual(current.result, zones, 'The real recipe quote must admit every default zone, including a duplicate.');
      assert.equal(current.quoteCalls, 1); assert.equal(old.quoteCalls, zones.length);
      context.actor.simCredits = 0;
      context.input.state.nextDay = 1; context.input.state.nextPhase = 'night';
      const next = evaluate('production', context, zones, shops), nextOld = evaluate('reference', context, zones, shops);
      assert.deepEqual(next.result, nextOld.result);
      assert.deepEqual(next.result, [], 'Zero credits and an unavailable world time must reject every default zone.');
      assert.equal(next.quoteCalls, 1); assert.equal(nextOld.quoteCalls, zones.length);
    });

    check('false default quote is cached, while custom-only and foreign-map shops never quote defaults', () => {
      const context = makeInput(), zones = ['a', 'b', 'c'];
      context.input.state.nextDay = 1; context.input.state.nextPhase = 'night';
      const defaultShops = zones.map(zoneId => ({ mapId: context.input.state.mapObj._id, zoneId }));
      const current = evaluate('production', context, zones, defaultShops), old = evaluate('reference', context, zones, defaultShops);
      assert.deepEqual(current.result, old.result); assert.deepEqual(current.result, []);
      assert.equal(current.quoteCalls, 1); assert.equal(old.quoteCalls, zones.length);
      const custom = zones.map(zoneId => ({ mapId: context.input.state.mapObj._id, zoneId,
        catalog: [], hasCustomCatalog: true }));
      assert.deepEqual(evaluate('production', context, zones, custom), { result: [], quoteCalls: 0 });
      assert.deepEqual(evaluate('reference', context, zones, custom), { result: [], quoteCalls: 0 });
      const foreign = zones.map(zoneId => ({ mapId: 'other-map', zoneId }));
      const foreignCurrent = evaluate('production', context, zones, foreign);
      const foreignOld = evaluate('reference', context, zones, foreign);
      assert.deepEqual(foreignCurrent.result, foreignOld.result);
      assert.equal(foreignCurrent.quoteCalls, 1, 'An unmatched kiosk uses the legacy default quote branch.');
      assert.equal(foreignOld.quoteCalls, zones.length);
    });

    check('mixed default/custom shops preserve order and per-zone custom quote decisions', () => {
      const context = makeInput(), zones = ['a', 'b', 'c', 'a'];
      const shops = [
        { mapId: context.input.state.mapObj._id, zoneId: 'a' },
        { mapId: context.input.state.mapObj._id, zoneId: 'b', catalog: [], hasCustomCatalog: true },
        { mapId: 'other-map', zoneId: 'c' },
        { mapId: context.input.state.mapObj._id, zoneId: 'c' },
      ];
      const current = evaluate('production', context, zones, shops), old = evaluate('reference', context, zones, shops);
      assert.deepEqual(current.result, old.result);
      assert.equal(current.quoteCalls, 1); assert.equal(old.quoteCalls, 3,
        'The duplicate default zone and the other default zone each quote independently in the reference.');
    });

    check('custom stock, exchange input, credits and cost are reread per call without default quotes', () => {
      const context = makeInput(), { input, actor } = context;
      const target = input.state.publicItems.find(item => item._id === rare._id);
      const material = input.state.publicItems.find(item => item._id === tree._id);
      context.craftGoal = { target, missing: [{ itemId: material._id, name: material.name,
        special: 'life_tree', need: 1, have: 0 }] };
      const kiosk = { mapId: input.state.mapObj._id, zoneId: 'a', catalog: [
        { itemId: material._id, mode: 'sell', priceCredits: 200 },
      ] };
      const run = () => {
        const current = evaluate('production', context, ['a'], [kiosk]);
        const old = evaluate('reference', context, ['a'], [kiosk]);
        assert.deepEqual(current.result, old.result);
        assert.equal(current.quoteCalls, 0); assert.equal(old.quoteCalls, 0,
          'A non-empty custom catalog never borrows a default quote.');
        return current.result;
      };
      assert.deepEqual(run(), ['a'], 'Affordable custom purchase should satisfy the real recipe preview.');
      actor.simCredits = 3;
      actor.inventory.push({ _id: 'purchase-cloth', itemId: 'purchase-cloth', name: '천', type: '재료', qty: 1 });
      kiosk.catalog[0] = { itemId: material._id, mode: 'exchange',
        exchange: { giveItemId: 'purchase-cloth', giveQty: 1 } };
      assert.deepEqual(run(), ['a'], 'An owned exchange input remains usable without credits.');
      actor.inventory = actor.inventory.filter(row => row.itemId !== 'purchase-cloth');
      assert.deepEqual(run(), [], 'Removing exchange stock invalidates the next call.');
      actor.simCredits = 250;
      kiosk.catalog[0] = { itemId: material._id, mode: 'sell', priceCredits: 300 };
      assert.deepEqual(run(), [], 'A changed price is re-evaluated against fresh credits.');
      actor.simCredits = 400;
      assert.deepEqual(run(), ['a']);
      kiosk.catalog[0] = { itemId: material._id, mode: 'sell', priceCredits: 200 };
      input.state.ruleset.market.kiosk.categories.legendary = false;
      assert.deepEqual(run(), ['a'], 'Custom offers do not inherit default-stock category filtering.');
      input.state.nextDay = 1; input.state.nextPhase = 'night';
      input.state.ruleset.market.kiosk.categories.legendary = true;
      assert.deepEqual(run(), ['a'], 'Custom catalog decisions retain their current phase/cost validation path.');
    });

    check('default policy categories invalidate a previously cached true result next decision', () => {
      const context = makeInput(), zones = ['a', 'b', 'c'];
      const shops = zones.map(zoneId => ({ mapId: context.input.state.mapObj._id, zoneId }));
      const first = evaluate('production', context, zones, shops);
      const firstOld = evaluate('reference', context, zones, shops);
      assert.deepEqual(first.result, firstOld.result);
      assert.deepEqual(first.result, zones, 'The configured recipe target is a real available default offer.');
      assert.equal(first.quoteCalls, 1); assert.equal(firstOld.quoteCalls, zones.length);
      context.input.state.ruleset.market.kiosk.categories.legendary = false;
      const next = evaluate('production', context, zones, shops);
      const nextOld = evaluate('reference', context, zones, shops);
      assert.deepEqual(next.result, nextOld.result);
      assert.deepEqual(next.result, [], 'Disabling the special category removes the default offer.');
      assert.equal(next.quoteCalls, 1); assert.equal(nextOld.quoteCalls, zones.length);
      context.input.state.ruleset.market.kiosk.categories.legendary = true;
      const restored = evaluate('production', context, zones, shops);
      const restoredOld = evaluate('reference', context, zones, shops);
      assert.deepEqual(restored.result, restoredOld.result);
      assert.deepEqual(restored.result, zones, 'Re-enabling the category restores the fresh default offer.');
      assert.equal(restored.quoteCalls, 1); assert.equal(restoredOld.quoteCalls, zones.length);
    });

    check('default movement quotes re-read mutable item names and tags from the same catalog array', () => {
      const context = makeInput(), zones = ['a', 'b', 'c'];
      const shops = zones.map(zoneId => ({ mapId: context.input.state.mapObj._id, zoneId }));
      const material = context.input.state.publicItems.find(item => item._id === tree._id);
      const both = () => {
        const current = evaluate('production', context, zones, shops);
        const old = evaluate('reference', context, zones, shops);
        assert.deepEqual(current.result, old.result);
        assert.equal(current.quoteCalls, 1); assert.equal(old.quoteCalls, zones.length);
        return current.result;
      };
      assert.deepEqual(both(), zones);
      material.name = 'ordinary wood';
      material.tags = [];
      assert.deepEqual(both(), [], 'Removing canonical name metadata removes the current stock item.');
      material.tags = ['life_tree'];
      assert.deepEqual(both(), zones, 'A freshly added policy tag restores default eligibility.');
      delete material.tags;
      material.name = '생명의 나무';
      assert.deepEqual(both(), zones, 'Restored canonical metadata is observed on the next call.');
    });

    check('canonical, alias, tagged, water, food and equipment policy matches the original expression', () => {
      const cases = [
        ...DEFAULT_KIOSK_ITEM_NAMES.map(name => ({ name, type: '재료' })),
        ...['meteor', 'tree-of-life', 'life_tree', '생나', 'mythril', 'tac_skill_module', '혈팩', 'blood-sample', 'vf-blood-sample', 'force-core']
          .map(name => ({ name, type: '재료' })),
        { name: 'water', type: '재료' }, { name: '물', type: '재료' },
        { name: '운석 빵', type: '재료', tags: ['food'] }, { name: 'apple', category: 'food' },
        { name: '빵 검', type: '무기', equipSlot: 'weapon', tags: ['meteor'] },
        { name: 'Plain material', type: '재료', tags: ['life_tree'] },
        { _id: '운석', type: '재료' }, { _id: 'meteor', type: '재료' },
        { _id: 'water', type: '재료' }, { _id: 'apple' }, { _id: 'bread-sword', type: '무기', equipSlot: 'weapon' },
        null, undefined, 'meteor', 7,
      ];
      for (const item of cases) assert.equal(policy.isDefaultKioskItem(item), legacyIsDefaultKioskItem(item),
        String(item?.name ?? item?._id ?? item ?? 'null'));
      const mutable = { name: 'ordinary item', type: '재료' };
      assert.equal(policy.isDefaultKioskItem(mutable), legacyIsDefaultKioskItem(mutable));
      mutable.name = '운석';
      assert.equal(policy.isDefaultKioskItem(mutable), true); assert.equal(legacyIsDefaultKioskItem(mutable), true);
      mutable.tags = ['food'];
      assert.equal(policy.isDefaultKioskItem(mutable), false); assert.equal(legacyIsDefaultKioskItem(mutable), false);
      delete mutable.tags; mutable.equipSlot = 'weapon'; mutable.type = '무기';
      assert.equal(policy.isDefaultKioskItem(mutable), false); assert.equal(legacyIsDefaultKioskItem(mutable), false);
    });

    assert.equal(failures, 0, `${failures} kiosk movement quote regressions failed.`);
    console.log(JSON.stringify({ checks, pass: true,
      scope: 'synchronous default quote reuse, mutable call boundaries and shared policy expression; not live shop settlement or browser speed' }));
    if (!process.argv.includes('--fixtures-only')) {
      for (const matchSeed of [seed]) {
        const rows = ['reference', 'production'].map(mode => {
          const output = execFileSync(process.execPath, [fileURLToPath(import.meta.url), `--worker=${mode}`, `--seed=${matchSeed}`], {
            cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', maxBuffer: 1024 * 1024,
            stdio: ['ignore', 'pipe', 'inherit'],
          });
          const row = JSON.parse(output.trim()), evidence = row.outcome.evidence;
          console.log(JSON.stringify({ completed: mode, engine: row.engine, overlays: row.overlays,
            quoteCalls: row.quoteCalls, seed: evidence.seed, phases: evidence.phases, frames: evidence.frames,
            ticks: evidence.ticks, events: evidence.eventCount, ending: evidence.ending.outcome,
            randomState: evidence.random.state, randomDraws: evidence.random.draws,
            inputDigest: row.outcome.inputDigest, eventDigest: evidence.eventDigest,
            frameDigest: evidence.frameDigest, endingDigest: digest(evidence.ending),
            finalFrameDigest: row.outcome.finalFrameDigest, logsDigest: row.outcome.logsDigest }));
          return row;
        });
        assert.equal(rows[0].engine, rows[1].engine);
        assert.deepEqual(rows[0].outcome, rows[1].outcome,
          'Movement quote and policy reuse must preserve all frames/events/logs/RNG/final state/ending.');
        console.log(JSON.stringify({ pass: true, seed: matchSeed, completeMatches: 2,
          scope: 'fresh same-seed complete matches, exact original expressions restored in reference; not historical outputs or all inputs' }));
      }
    }
  }
} finally {
  hook.deregister();
  delete globalThis.__kioskMovementQuoteCacheProbe;
}
