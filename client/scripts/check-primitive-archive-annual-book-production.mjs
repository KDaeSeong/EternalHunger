import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const data = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveData.js');
const contract = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveProcessing.js');
const checkpoint = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCheckpoint.js');
const { productionRequirementGuide } = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveProductionRequirementGuide.js');

const clone = value => structuredClone(value);
const jobs = values => Object.fromEntries(engine.TRIBE_JOBS.map(row => [row.id, values[row.id] || 0]));
const stamp = state => ({ runId: state.runId, day: state.day, ap: state.ap, updatedAt: state.updatedAt,
  completedYears: state.calendar?.completedYears ?? null });
const processes = [
  { id: 'annual_twine', recipeId: 'twine', techId: 'CORDAGE' },
  { id: 'annual_book_craft_guide', recipeId: 'book_craft_guide', techId: 'BOOKCRAFT' },
  { id: 'annual_book_camp_manual', recipeId: 'book_camp_manual', techId: 'BOOKCRAFT' },
];
function fixture(id = 'annual-books', artisans = 2, annual = true) {
  let state = engine.createNewState({ runId: id, now: '2026-11-13T00:00:00.000Z', rng: () => 0.5 });
  state.research.completed = Object.fromEntries(data.TECH_TREE.map(row => [row.id, true]));
  state.camp = { ...state.camp, fireLevel: 3, shelterLevel: 3, workbenchLevel: 3, fuel: 20 };
  state.tribe.population = 8;
  state.tribe.assignments = jobs({ forager: 8 - artisans, artisan: artisans });
  state.tribe.autoAssignments = jobs({});
  state.inventory = { ...state.inventory, berry: 200, wood: 30, stone: 30, fiber: 30,
    clay: 30, resin: 30, herb: 30, twine: 0, book_craft_guide: 0, book_camp_manual: 0 };
  state.projects.completed = Object.fromEntries(engine.TRIBE_PROJECTS.map(row => [row.id, true]));
  state = engine.normalizeState(state);
  if (annual) state = engine.startAnnualSettlementAction(state, stamp(state), { observedLifetimeYears: 60 });
  assert.equal(checkpoint.isValidRunState(state), true);
  return state;
}
function configure(state, id, targetStock) {
  const before = clone(state);
  const next = engine.configureTribeProcessAction(state, { actionId: id, targetStock });
  assert.equal(next.tribe.processingPlan.actionId, id, `Actual processing plan accepts ${id}`);
  assert.deepEqual(state, before);
  for (const key of ['inventory', 'party', 'equipment', 'lineage']) assert.deepEqual(next[key], before[key]);
  assert.equal(next.ap, before.ap); assert.equal(next.day, before.day);
  return next;
}
function year(state) {
  const before = clone(state);
  const next = engine.runSettlementYearAction(state, stamp(state), { rng: () => { throw Error('Annual book production must not roll personal crafting RNG'); } });
  assert.deepEqual(state, before);
  assert.equal(next.calendar.completedYears, state.calendar.completedYears + 1);
  const receipt = next.tribe.lastProduction.processing;
  if (receipt) assert.equal(contract.isValidTribeProcessingReceipt(receipt), true);
  return next;
}
const bookGate = state => engine.archiveVictorySummary(state).rows.find(row => row.id === 'books');
const originalRandom = Math.random;
let passed = 0;
const failures = [];
function check(name, run) {
  try { run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failures.push({ name, message: error.message }); console.error(`FAIL ${name}: ${error.stack}`); }
}
const timeout = setTimeout(() => { console.error('FAIL annual book production exceeded 45 seconds'); process.exitCode = 1; }, 45000);
try {
  check('annual-only processing options reuse actual personal recipe materials rewards and technology gates', () => {
    const state = fixture();
    for (const process of processes) {
      const recipe = engine.RECIPES.find(row => row.id === process.recipeId);
      const option = engine.tribeProcessingSummary(state).options.find(row => row.id === process.id);
      assert.ok(option, `${process.id} must be an actual annual processing option`);
      assert.equal(option.unlocked, true);
      assert.deepEqual(Object.fromEntries(option.materialRows.map(row => [row.id || row.resourceId, row.required])), recipe.requires);
      assert.equal(option.outputItemId, process.recipeId);
      assert.equal(option.outputQuantity, recipe.reward[process.recipeId]);
      const locked = clone(state); locked.research.completed[process.techId] = false;
      assert.equal(engine.tribeProcessingSummary(locked).options.find(row => row.id === process.id).unlocked, false);
      assert.equal(engine.utilityActionRows(state, state.party[0].id).some(row => row.id === process.id), false,
        'Annual processes are not free immediate utility actions.');
    }
    const daily = fixture('daily-options', 2, false);
    assert.ok(processes.every(process => !engine.tribeProcessingSummary(daily).options.some(row => row.id === process.id)));
  });
  check('real annual twine then both books are manufactured with physical receipts and exact victory gate', () => {
    let state = fixture('book-chain');
    const equipment = clone(state.equipment);
    assert.equal(bookGate(state).done, false);
    for (const process of processes) {
      const recipe = engine.RECIPES.find(row => row.id === process.recipeId);
      const selected = configure(state, process.id, 1);
      const before = clone(selected);
      Math.random = () => { throw Error('Annual processing requested ambient RNG'); };
      try { state = year(selected); } finally { Math.random = originalRandom; }
      const receipt = state.tribe.lastProduction.processing;
      assert.equal(receipt.actionId, process.id); assert.equal(receipt.batches, 1);
      assert.deepEqual(receipt.spent, recipe.requires); assert.deepEqual(receipt.gains, recipe.reward);
      for (const [id, amount] of Object.entries(recipe.requires)) {
        assert.equal(state.inventory[id], Number(before.inventory[id] || 0) + Number(state.tribe.lastProduction.gains[id] || 0)
          - amount - Number(state.tribe.lastProduction.foodSpent?.[id] || 0) + Number(recipe.reward[id] || 0));
      }
      assert.equal(state.inventory[process.recipeId], Number(before.inventory[process.recipeId] || 0) + recipe.reward[process.recipeId]);
      assert.deepEqual(state.equipment, equipment);
      assert.equal(bookGate(state).done, process.recipeId === 'book_camp_manual');
      const loaded = engine.normalizeState(JSON.parse(JSON.stringify(state)));
      for (const key of ['inventory', 'tribe', 'calendar', 'party', 'lineage', 'equipment']) assert.deepEqual(loaded[key], state[key]);
      state = loaded;
    }
    assert.equal(state.calendar.completedYears, 3);
    assert.equal(state.inventory.twine, 0, 'The guide book consumes the produced twine.');
    const duplicateOneBook = clone(state); duplicateOneBook.inventory.book_craft_guide = 2; duplicateOneBook.inventory.book_camp_manual = 0;
    assert.equal(bookGate(duplicateOneBook).done, false, 'Two copies of one title do not satisfy two distinct required books.');
  });
  check('artisan zero locked technology and insufficient materials produce no invented books or twine', () => {
    for (const process of processes) for (const cause of ['no-artisan', 'locked', 'no-material']) {
      let state = fixture(`blocked-${process.id}-${cause}`, cause === 'no-artisan' ? 0 : 2);
      state.inventory.twine = 2;
      if (cause === 'locked') state.research.completed[process.techId] = false;
      const recipe = engine.RECIPES.find(row => row.id === process.recipeId);
      if (cause === 'no-material') state.inventory[Object.keys(recipe.requires)[0]] = 0;
      state = configure(state, process.id, Number(state.inventory[process.recipeId] || 0) + 1);
      const before = clone(state), next = year(state), receipt = next.tribe.lastProduction.processing;
      assert.equal(receipt.batches, 0, `${process.id}/${cause}`);
      assert.deepEqual(receipt.spent, {}); assert.deepEqual(receipt.gains, {});
      assert.equal(next.inventory[process.recipeId], before.inventory[process.recipeId]);
    }
  });
  check('actual worker target and material caps limit annual batches and stale year cannot pay twice', () => {
    let state = fixture('book-worker-cap'); state.inventory.twine = 20;
    state = configure(state, 'annual_book_craft_guide', 10);
    const oldStamp = stamp(state), next = year(state);
    assert.equal(next.tribe.lastProduction.processing.batches, 2);
    assert.equal(next.inventory.book_craft_guide, 2);
    assert.equal(engine.runSettlementYearAction(next, oldStamp), next);
    let short = fixture('twine-material-cap'); short.inventory.fiber = 3;
    short = configure(short, 'annual_twine', 10);
    const limited = year(short); assert.equal(limited.tribe.lastProduction.processing.batches, 1);
    assert.equal(limited.inventory.fiber, 1);
    let target = fixture('book-target-cap'); target.inventory.twine = 20;
    target = configure(target, 'annual_book_craft_guide', 1);
    const satisfied = year(target); assert.equal(satisfied.inventory.book_craft_guide, 1);
    assert.equal(year(satisfied).tribe.lastProduction.processing.batches, 0);
  });
  check('unselected book processes leave existing annual pottery and processing-off behavior intact', () => {
    const state = fixture('existing-processing');
    const off = year(state); assert.equal(off.tribe.lastProduction.processing, undefined);
    const selected = configure(state, 'kiln', Number(state.inventory.pottery || 0) + 2);
    const next = year(selected), receipt = next.tribe.lastProduction.processing;
    assert.equal(receipt.actionId, 'kiln'); assert.equal(receipt.batches, 1);
    assert.deepEqual(receipt.spent, { clay: 2, wood: 1 }); assert.deepEqual(receipt.gains, { pottery: 2 });
    assert.equal(next.inventory.book_craft_guide, 0); assert.equal(next.inventory.book_camp_manual, 0);
  });
  check('actual annual production requirement guide exposes exact recipe gates and real community plus twine supply without mutation', () => {
    for (const process of processes) {
      let state = fixture(`requirements-${process.id}`);
      const recipe = engine.RECIPES.find(row => row.id === process.recipeId);
      for (const id of Object.keys(recipe.requires)) state.inventory[id] = 0;
      state.research.completed[process.techId] = false;
      state = configure(state, process.id, 1);
      const processing = engine.tribeProcessingSummary(state);
      const education = engine.tribeEducationSummary(state);
      const regions = engine.regionRows(state);
      const input = { processing, education, regions }, before = clone({ state, ...input });
      let guide;
      Math.random = () => { throw Error('Requirement guidance must not draw randomness'); };
      try { guide = productionRequirementGuide(input); } finally { Math.random = originalRandom; }
      assert.deepEqual({ state, ...input }, before);
      assert.equal(guide.processing.annualMode, true);
      assert.deepEqual(Object.fromEntries(guide.processing.materials.map(row => [row.resourceId, row.required])), recipe.requires);
      for (const material of guide.processing.materials) {
        assert.equal(material.current, 0); assert.equal(material.missing, recipe.requires[material.resourceId]);
        const actualCommunities = processing.communitySources.filter(row => row.resourceIds.includes(material.resourceId));
        assert.deepEqual(material.sources.filter(row => row.kind === 'community').map(row => row.actionId), actualCommunities.map(row => row.id));
        for (const source of material.sources) {
          assert.ok(['community', 'production'].includes(source.kind), 'Annual supply never promises a personal field action.');
          assert.equal(Object.hasOwn(source, 'regionId'), false);
          assert.equal(Object.hasOwn(source, 'probability'), false); assert.equal(Object.hasOwn(source, 'chance'), false);
        }
      }
      assert.ok(guide.processing.research.some(row => row.technologyId === process.techId && row.completed === false));
      if (process.recipeId === 'book_craft_guide') {
        const material = guide.processing.materials.find(row => row.resourceId === 'twine');
        const supply = material.sources.find(row => row.kind === 'production' && row.actionId === 'annual_twine');
        assert.ok(supply, 'The guide book exposes its real preceding annual twine process.');
        const twineRecipe = engine.RECIPES.find(row => row.id === 'twine');
        assert.equal(supply.outputQuantity, twineRecipe.reward.twine);
        assert.deepEqual(Object.fromEntries(supply.materialRows.map(row => [row.resourceId, row.required])), twineRecipe.requires);
        assert.ok(supply.materialRows.every(row => row.sources.some(source => source.kind === 'community')));
      }
    }
  });
} finally { Math.random = originalRandom; clearTimeout(timeout); }
console.log(JSON.stringify({ passed, failed: failures.length,
  scope: 'Actual annual engine and recipe/processing/checkpoint contracts on fresh capability fixtures; no historical outputs, personal craft replacement, natural-unlock or browser acceptance' }));
if (failures.length) process.exitCode = 1;
