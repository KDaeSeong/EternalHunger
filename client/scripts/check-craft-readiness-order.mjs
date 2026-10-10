import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

const craftUrl = new URL('../src/app/simulation/_lib/gearInventoryCraftRuntime.js', import.meta.url).href;
const originalFilters = `    .filter((item) => canCraftAlongsideGrowth(actor, item))
    .filter((item) => getCraftRecipeTerms(item))
    .filter((item) => {
      const ingredients = compactIO(item?.recipe?.ingredients || []);
      if (!ingredients.length) return false;
      return ingredients.every((ingredient) => invQty(inv0, ingredient.itemId) >= Number(ingredient.qty || 1));
    })`;
const readyFilters = `    .filter((item) => {
      // Preserve the legacy null-candidate error boundary before terms reject it.
      if (item == null) return canCraftAlongsideGrowth(actor, item) && getCraftRecipeTerms(item);
      const rows = item?.recipe?.ingredients;
      // An absent positive input cannot craft. Aggregate duplicate amounts and
      // validate malformed recipes below; presence alone is not readiness.
      if (Array.isArray(rows) && rows.some(row => typeof row?.itemId === 'string' && !(ownedQty(row.itemId) > 0))) return false;
      const terms = getCraftRecipeTerms(item);
      return terms && terms.ingredients.every((ingredient) => ownedQty(ingredient.itemId) >= ingredient.qty);
    })
    .filter((item) => canCraftAlongsideGrowth(actor, item))`;
const gateImport = "import { canCraftAlongsideGrowth, getActorEquipmentTier } from './growthEquipmentRuntime.js';";
const worker = process.argv.find(arg => arg.startsWith('--worker='))?.slice(9);
const seed = process.argv.find(arg => arg.startsWith('--seed='))?.slice(7) || '1101';
const asText = source => (typeof source === 'string' ? source : new TextDecoder().decode(source)).replaceAll('\r\n', '\n');
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const probe = { gates: 0, quantityReads: 0, overlays: 0 };
globalThis.__craftReadinessProbe = probe;
const hook = registerHooks({
  load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);
    if (url !== craftUrl && !url.startsWith(`${craftUrl}?readiness=`)) return loaded;
    let source = asText(loaded.source);
    const reference = worker === 'reference' || new URL(url).searchParams.get('readiness') === 'reference';
    if (reference) {
      if (source.includes(readyFilters)) {
        assert.equal(source.split(readyFilters).length, 2, 'Restore exactly one candidate boundary.');
        source = source.replace(readyFilters, originalFilters);
        probe.overlays++;
      } else {
        assert.ok(process.argv.includes('--allow-unoptimized'), 'Independent original candidate boundary missing.');
        assert.ok(source.includes(originalFilters));
      }
    }
    assert.equal(source.split(gateImport).length, 2);
    source = source.replace(gateImport,
      "import { canCraftAlongsideGrowth as readGrowthGate, getActorEquipmentTier } from './growthEquipmentRuntime.js';\n"
      + 'const canCraftAlongsideGrowth = (...args) => { globalThis.__craftReadinessProbe.gates++; return readGrowthGate(...args); };');
    assert.equal(source.split('  invQty,').length, 2);
    source = source.replace('  invQty,', '  invQty as readInventoryQuantity,')
      + '\nconst invQty = (...args) => { globalThis.__craftReadinessProbe.quantityReads++; return readInventoryQuantity(...args); };';
    return { ...loaded, source };
  },
});

try {
  if (worker) {
    assert.ok(['production', 'reference'].includes(worker));
    const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
    const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');
    const input = await createRandomIsolationInput(seed), inputDigest = digest(input);
    const result = await runRandomIsolationMatch(input);
    assert.equal(digest(input), inputDigest);
    assert.equal(probe.overlays, worker === 'reference' ? 1 : 0);
    console.log(JSON.stringify({ worker, ...probe, engine: SIMULATION_ENGINE_VERSION,
      outcome: { inputDigest, evidence: result.evidence,
        finalFrameDigest: digest(result.finalFrame), logDigest: digest(result.logs) } }));
  } else {
    const production = await import(`${craftUrl}?readiness=production`);
    const reference = await import(`${craftUrl}?readiness=reference`);
    const { buildItemMetaById, buildItemNameById } = await import('../src/app/simulation/_lib/itemOptionsRuntime.js');
    const { getRuleset } = await import('../src/utils/rulesets.js');
    const rules = getRuleset('ER_S11');
    const material = id => ({ _id: id, name: id, type: '재료', category: 'material', tier: 1 });
    const gear = (id, ingredients, extra = {}) => ({ _id: id, name: id, type: '장비', category: 'equipment',
      equipSlot: 'head', tier: 2, recipe: { ingredients, resultQty: 1, creditsCost: 0 }, ...extra });
    const subject = extra => ({ _id: 'actor', name: 'Actor', hp: 100, maxHp: 100, weaponType: '권총',
      inventory: [{ itemId: 'raw', qty: 2 }], simCredits: 100, _actionCycleKey: 'one',
      _growthPlan: { targetId: 'goal', targetIds: ['goal'], craftIds: [], componentIds: [],
        targetSlot: 'head', targetTier: 4, reservedQtyById: {}, plannedCredits: 0, blocked: 'no_material_source' }, ...extra });
    const call = (runtime, input, items, customRules = rules) => {
      const actor = structuredClone(input), meta = buildItemMetaById(items.filter(Boolean)), names = buildItemNameById(items.filter(Boolean));
      probe.gates = 0; probe.quantityReads = 0;
      let result, error;
      try { result = runtime.tryAutoCraftFromInventory(actor, items, names, meta, 2, 3, customRules); }
      catch (caught) { error = { name: caught.name, message: caught.message }; }
      return { result, error, actor, gates: probe.gates, quantityReads: probe.quantityReads };
    };
    const compare = (input, items, customRules) => {
      const before = structuredClone({ input, items });
      const current = call(production, input, items, customRules), old = call(reference, input, items, customRules);
      assert.deepEqual({ result: current.result, error: current.error, actor: current.actor },
        { result: old.result, error: old.error, actor: old.actor });
      assert.deepEqual({ input, items }, before, 'Candidates and caller input are not mutated.');
      return { current, old };
    };
    let checks = 0, failures = 0;
    const check = (name, run) => {
      try { run(); checks++; console.log(`PASS ${name}`); }
      catch (error) { failures++; console.error(`FAIL ${name}: ${error.message}`); }
    };
    check('unready recipes never perform the expensive growth gate', () => {
      const items = [material('raw'), material('absent'), ...Array.from({ length: 240 }, (_, i) =>
        gear(`missing-${i}`, [{ itemId: 'absent', qty: 1 }])), gear('ready', [{ itemId: 'raw', qty: 1 }])];
      const { current, old } = compare(subject({ _growthPlan: null }), items);
      assert.equal(current.result.craftedId, 'ready');
      assert.equal(current.gates, 1); assert.equal(old.gates, items.length);
      assert.equal(current.quantityReads, 2); assert.equal(old.quantityReads, 241);
      console.log(JSON.stringify({ fixtureGrowthGateCalls: { reference: old.gates, production: current.gates },
        fixtureQuantityReads: { reference: old.quantityReads, production: current.quantityReads } }));
    });
    check('duplicate stacks and ingredient rows retain valid and invalid quantity rules', () => {
      for (const qty of [1, '2', 0, -1, 1.5, '', 'bad', Number.MAX_SAFE_INTEGER]) {
        const items = [material('raw'), gear('candidate', [{ itemId: 'raw', qty }, { itemId: 'raw', qty: 1 }])];
        compare(subject({ inventory: [{ itemId: 'raw', qty: '1' }, { itemId: 'raw', qty: 2 }] }), items);
      }
      for (const row of [null, {}, { itemId: '' }, { itemId: 'candidate', qty: 1 }, { itemId: 4, qty: 1 }]) {
        compare(subject(), [gear('candidate', [row])]);
      }
      const duplicated = [gear('same-id', [{ itemId: 'raw', qty: 3 }]), gear('same-id', [{ itemId: 'raw', qty: 1 }])];
      compare(subject(), duplicated);
      const sparseIngredients = []; sparseIngredients[1] = { itemId: 'raw', qty: 1 };
      compare(subject(), [gear('candidate', sparseIngredients)]);
    });
    check('growth components, reserved food inputs, and remaining fees keep their priority', () => {
      const items = [material('raw'), gear('component', [{ itemId: 'raw', qty: 1 }]),
        gear('food', [{ itemId: 'raw', qty: 1 }], { type: '소모품', category: 'consumable', equipSlot: '',
          consumeEffect: { kind: 'heal', heal: 15 }, recipe: { ingredients: [{ itemId: 'raw', qty: 1 }], creditsCost: 8 } })];
      for (const blocked of ['', 'inventory_full']) for (const reserve of [0, 2]) {
        const actor = subject(); Object.assign(actor._growthPlan, { craftIds: ['component'], componentIds: ['component'],
          reservedQtyById: { raw: reserve }, plannedCredits: 95, blocked }); compare(actor, items);
      }
    });
    check('failed expensive or oversized receipts keep fallback order and exact debug output', () => {
      const items = [material('raw'), gear('expensive', [{ itemId: 'raw', qty: 1 }], { tier: 4,
        recipe: { ingredients: [{ itemId: 'raw', qty: 1 }], creditsCost: 200 } }),
      gear('oversized', [{ itemId: 'raw', qty: 1 }], { tier: 3,
        recipe: { ingredients: [{ itemId: 'raw', qty: 1 }], resultQty: 999 } }),
      gear('fallback', [{ itemId: 'raw', qty: 1 }])];
      const { current } = compare(subject(), items, { ...rules, inventory: { ...rules.inventory, maxSlots: 2 } });
      assert.equal(current.result.craftedId, 'fallback');
      compare(subject({ simCredits: 0 }), items.slice(0, 2));
    });
    check('weapon compatibility, authored same-tier gear, and worn components keep selections', () => {
      const items = [material('raw'), gear('bow', [{ itemId: 'raw', qty: 1 }], { equipSlot: 'weapon', weaponType: '활', tier: 6 }),
        gear('gun', [{ itemId: 'raw', qty: 1 }], { equipSlot: 'weapon', weaponType: '권총', tier: 2 }),
        gear('authored', [{ itemId: 'raw', qty: 1 }])];
      const actor = subject({ goalLoadouts: { legend: { headKey: 'authored' } }, equipped: { head: 'worn' },
        inventory: [{ itemId: 'raw', qty: 2 }, { itemId: 'worn', qty: 1, equipSlot: 'head', tier: 2, craftComponent: true }] });
      for (const focus of ['authored', 'gun']) { actor._growthPlan.targetId = focus; actor._growthPlan.craftIds = [focus]; compare(actor, items); }
    });
    check('later inventory and in-place recipe edits are re-read without action or catalogue caches', () => {
      const items = [material('raw'), gear('candidate', [{ itemId: 'raw', qty: 3 }])], actor = subject();
      assert.equal(compare(actor, items).current.result, null);
      items[1].recipe.ingredients[0].qty = 1; actor._actionCycleKey = 'two';
      assert.equal(compare(actor, items).current.result.craftedId, 'candidate');
      actor.inventory[0].qty = 0; actor._actionCycleKey = 'three';
      assert.equal(compare(actor, items).current.result, null);
    });
    check('null errors, sparse catalogues, inactivity, and consumed action guards remain unchanged', () => {
      for (const empty of [null, undefined]) assert.equal(compare(subject(), [empty]).current.error?.name, 'TypeError');
      compare(subject({ _growthPlan: null }), [null, undefined]);
      const sparse = []; sparse[2] = gear('candidate', [{ itemId: 'raw', qty: 1 }]); compare(subject(), sparse);
      compare(subject({ hp: 0 }), [null]);
      compare(subject({ _invCraftActionKey: 'one' }), [null]);
    });
    console.log(JSON.stringify({ checks, failures, scope: 'read-only candidate order and full mutation/error parity; no browser speed or human acceptance' }));
    assert.equal(failures, 0, `${failures} readiness groups failed.`);
    if (!process.argv.includes('--fixtures-only')) {
      const seeds = process.argv.find(arg => arg.startsWith('--seeds='))?.slice(8).split(',') || [seed];
      for (const matchSeed of seeds) {
        const matches = ['reference', 'production'].map(mode => {
          console.log(`START fresh ${mode} match seed ${matchSeed}`);
          const output = execFileSync(process.execPath, [fileURLToPath(import.meta.url), `--worker=${mode}`, `--seed=${matchSeed}`],
            { cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] });
          const row = JSON.parse(output.trim()); console.log(JSON.stringify(row)); return row;
        });
        assert.equal(matches[0].engine, matches[1].engine); assert.deepEqual(matches[0].outcome, matches[1].outcome);
        assert.ok(matches[1].gates < matches[0].gates);
        console.log(JSON.stringify({ pass: true, seed: matchSeed, completeMatches: 2,
          growthGateCalls: { reference: matches[0].gates, production: matches[1].gates },
          scope: 'fresh full matches with original candidate order and shared surrounding helpers; not past engine or all inputs' }));
      }
    }
  }
} finally { hook.deregister(); delete globalThis.__craftReadinessProbe; }
