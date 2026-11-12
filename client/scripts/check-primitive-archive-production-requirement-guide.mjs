import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const fresh = () => engine.createNewState({ runId: 'production-requirement-guide-fresh',
  now: '2026-11-12T00:00:00.000Z', rng: () => 0.5 });
const state = fresh();
const processing = engine.tribeProcessingSummary(state);
assert.equal(processing.options.length, 7, 'Inspect all seven actual production recipes');
for (const option of processing.options) {
  assert.ok(Array.isArray(option.materialRows) && option.materialRows.length > 0,
    `${option.id}: actual processing summary must expose structured one-batch material rows`);
  assert.ok(Array.isArray(option.researchRequirements), `${option.id}: structured technology gates missing`);
}
const { productionRequirementGuide } = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveProductionRequirementGuide.js');
assert.equal(typeof productionRequirementGuide, 'function');

// Read the current executable recipe declarations, not copied expected recipes or old reports.
const source = readFileSync(new URL('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js', import.meta.url), 'utf8');
const ast = ts.createSourceFile('engine.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const declarations = new Map();
for (const statement of ast.statements) if (ts.isVariableStatement(statement)) {
  for (const declaration of statement.declarationList.declarations) declarations.set(declaration.name.getText(ast), declaration.initializer?.getText(ast));
}
const constants = ['FOOD_PRESERVATION_COST', 'FOOD_PRESERVATION_REWARD', 'PRODUCTION_ACTION_RECIPES', 'SPECIALIZED_ACTION_DEFS', 'CIVILIZATION_ACTION_DEFS'];
const actual = new Function(constants.map(name => `const ${name} = ${declarations.get(name)};`).join('\n')
  + '\nreturn { PRODUCTION_ACTION_RECIPES, SPECIALIZED_ACTION_DEFS, CIVILIZATION_ACTION_DEFS };')();
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
};
const reveal = state => { state.exploration.revealed = Object.fromEntries(engine.WORLD_REGIONS.map(row => [row.id, true])); return state; };
const selected = (state, actionId = 'kiln', targetStock = 99) => {
  state.tribe.processingPlan = { actionId, targetStock }; state.tribe.educationPlan = { teachers: 1 }; return state;
};
const guideFor = state => productionRequirementGuide({ processing: engine.tribeProcessingSummary(state),
  education: engine.tribeEducationSummary(state), regions: engine.regionRows(state) });
let checks = 0;
const check = (name, run) => { run(); checks++; console.log('PASS ' + name); };
const expectedInputs = recipe => Object.entries(recipe.cost).sort(([a], [b]) => a.localeCompare(b));
const materialInputs = rows => rows.map(row => [row.id, row.required]).sort(([a], [b]) => a.localeCompare(b));
const nestedMaterials = guide => [...guide.processing.materials, ...guide.education.materials].flatMap(row =>
  [row, ...row.sources.flatMap(route => route.materialRows || [])]);

check('every actual recipe exposes exact one-batch inputs, outputs and real settlement plus recipe technology gates', () => {
  assert.deepEqual(processing.options.map(row => row.id).sort(), Object.keys(actual.PRODUCTION_ACTION_RECIPES).sort());
  for (const option of processing.options) {
    const recipe = actual.PRODUCTION_ACTION_RECIPES[option.id];
    assert.deepEqual(materialInputs(option.materialRows), expectedInputs(recipe));
    assert.deepEqual([option.outputItemId, option.outputQuantity], recipe.reward[0]);
    const profile = actual.CIVILIZATION_ACTION_DEFS.find(row => row.id === option.id);
    assert.deepEqual(option.researchRequirements.map(row => row.technologyId).sort(), [...new Set(['SETTLEMENT', profile.techId])].sort());
    assert.ok(option.researchRequirements.every(row => row.completed === false));
    const unlocked = fresh();
    for (const id of ['SETTLEMENT', profile.techId]) unlocked.research.completed[id] = true;
    const unlockedOption = engine.tribeProcessingSummary(unlocked).options.find(row => row.id === option.id);
    assert.ok(unlockedOption.unlocked && unlockedOption.researchRequirements.every(row => row.completed === true));
  }
});

check('saved selected recipe means one batch, independently of stock target, staffing or a form draft', () => {
  const state = selected(fresh(), 'forge', 999), before = structuredClone(state);
  const summary = engine.tribeProcessingSummary(state);
  assert.deepEqual(materialInputs(summary.materialRows), expectedInputs(actual.PRODUCTION_ACTION_RECIPES.forge));
  const guide = guideFor(state);
  assert.ok(guide.processing.materials.some(row => row.resourceId === 'metal_ingot' && row.required === 1));
  const unsavedDraft = { actionId: 'paper', targetStock: 2 };
  assert.notEqual(unsavedDraft.actionId, summary.plan.actionId);
  assert.deepEqual(guideFor(state), guide);
  assert.deepEqual(state, before);
});

check('missing stock is zero, malformed or unsafe stock stays unknown, valid fractions are preserved', () => {
  for (const value of [null, '2', true, false, -1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 0.25]) {
    const state = selected(fresh()); state.inventory.clay = value;
    const row = engine.tribeProcessingSummary(state).materialRows.find(row => row.id === 'clay');
    assert.equal(row.current, value === 0.25 ? value : null, String(value));
    const material = guideFor(state).processing.materials.find(row => row.resourceId === 'clay');
    assert.ok(material);
    assert.equal(material.current, row.current);
    assert.equal(material.unknown, value !== 0.25);
    assert.equal(material.missing, value === 0.25 ? 1.75 : null);
  }
  const state = selected(fresh()); delete state.inventory.clay;
  assert.equal(engine.tribeProcessingSummary(state).materialRows.find(row => row.id === 'clay').current, 0);
});

check('revealed real gather/hunt and specialized sources match their actual yields, zones and technology', () => {
  for (const actionId of Object.keys(actual.PRODUCTION_ACTION_RECIPES)) {
    const state = selected(reveal(fresh()), actionId), regions = engine.regionRows(state);
    const guide = guideFor(state);
    for (const material of nestedMaterials(guide)) for (const route of material.sources) {
      if (route.kind === 'production') continue;
      const specialized = actual.SPECIALIZED_ACTION_DEFS.find(row => row.id === route.actionId);
      if (route.kind === 'specialized' && specialized?.zoneIds.length === 0) {
        assert.equal(route.regionId, undefined);
        assert.ok(specialized.gains.some(gain => gain[0] === material.resourceId && gain[1] > 0));
        continue;
      }
      const region = regions.find(row => row.id === route.regionId);
      assert.ok(region?.revealed && !region.safe, `${material.resourceId}/${route.regionId}`);
      if (route.kind === 'gather' || route.kind === 'hunt') {
        assert.ok(region.zone[route.kind]?.some(gain => gain[0] === material.resourceId && gain[1] > 0));
      } else {
        assert.equal(route.kind, 'specialized');
        const profile = actual.SPECIALIZED_ACTION_DEFS.find(row => row.id === route.actionId);
        assert.ok(profile && profile.gains.some(gain => gain[0] === material.resourceId && gain[1] > 0));
        assert.ok(profile.zoneIds.includes(region.zoneId));
        assert.ok(route.research.some(row => row.technologyId === profile.techId && row.completed === false));
      }
      assert.equal(route.regionName, region.name); assert.equal(route.dangerLabel, region.dangerLabel);
      assert.ok(!('chance' in route) && !('probability' in route));
    }
  }
});

check('hidden region names and invented region identities or yields never become acquisition sources', () => {
  const state = selected(fresh(), 'smelt'), regions = engine.regionRows(state);
  const guide = guideFor(state), serialized = JSON.stringify(guide);
  for (const row of regions.filter(row => !row.revealed)) {
    assert.ok(!serialized.includes(row.id)); assert.ok(!serialized.includes(row.name));
  }
  const fakeRegions = regions.map(row => ({ ...row, id: 'fabricated-' + row.id, revealed: true,
    zone: { ...row.zone, gather: [['metal_ingot', 99], ['paper', 99]], hunt: [['metal_ingot', 99]] } }));
  const forged = productionRequirementGuide({ processing: engine.tribeProcessingSummary(state),
    education: engine.tribeEducationSummary(state), regions: fakeRegions });
  assert.ok(nestedMaterials(forged).every(row => row.sources.every(route => !route.regionId)));
  const falsified = regions.map(row => ({ ...row, revealed: true,
    zone: { ...row.zone, gather: [['metal_ingot', 99], ['paper', 99]], hunt: [['metal_ingot', 99]] } }));
  const forgeState = selected(fresh(), 'forge');
  const forgedYields = productionRequirementGuide({ processing: engine.tribeProcessingSummary(forgeState),
    education: engine.tribeEducationSummary(forgeState), regions: falsified });
  for (const [scope, resourceId] of [['processing', 'metal_ingot'], ['education', 'paper']]) {
    assert.ok(forgedYields[scope].materials.find(row => row.resourceId === resourceId).sources.every(route => route.kind === 'production'));
  }
});

check('ingots and education paper use exact actual processing routes without fake field yields or recursive cycles', () => {
  const state = selected(reveal(fresh()), 'forge'), guide = guideFor(state);
  for (const [scope, resourceId, actionId] of [['processing', 'metal_ingot', 'smelt'], ['education', 'paper', 'paper']]) {
    const material = guide[scope].materials.find(row => row.resourceId === resourceId);
    assert.ok(material);
    assert.ok(material.sources.length > 0 && material.sources.every(route => route.kind === 'production'));
    const route = material.sources.find(route => route.actionId === actionId); assert.ok(route);
    assert.deepEqual(route.materialRows.map(row => [row.resourceId, row.required]).sort(), expectedInputs(actual.PRODUCTION_ACTION_RECIPES[actionId]).sort());
    assert.equal(route.outputQuantity, actual.PRODUCTION_ACTION_RECIPES[actionId].reward[0][1]);
    for (const input of route.materialRows) assert.ok(input.sources.every(route => route.kind !== 'production'));
  }
  const paper = guide.education.materials.find(row => row.resourceId === 'paper');
  assert.equal(paper.required, null); assert.equal(paper.supplyOnly, true); assert.equal(paper.missing, null);
  assert.ok(guide.education.research.some(row => row.technologyId === 'PAPERMAKING'));
  assert.ok(!JSON.stringify(guide.education.research).includes('PUBLIC_EDUCATION'));
});

check('inactive saved plans have no fabricated help and education never predicts demand from a stock target', () => {
  const state = fresh(), guide = guideFor(state);
  assert.equal(guide.hasHelp, false);
  state.tribe.educationPlan = { teachers: 24 }; state.inventory.paper = 100;
  const paper = guideFor(state).education.materials.find(row => row.resourceId === 'paper');
  assert.equal(paper.current, 100); assert.equal(paper.required, null); assert.equal(paper.missing, null);
  assert.equal(paper.supplyOnly, true);
});

check('guides and summaries preserve frozen state, plans, AP, inventory, selections, source arrays and random stream', () => {
  const state = selected(reveal(fresh()), 'forge'), before = structuredClone(state);
  const input = { processing: engine.tribeProcessingSummary(state), education: engine.tribeEducationSummary(state), regions: engine.regionRows(state) };
  const inputBefore = structuredClone(input); freeze(state); freeze(input);
  const original = Math.random;
  Math.random = () => { throw new Error('Requirement preview consumed randomness'); };
  try { engine.tribeProcessingSummary(state); engine.tribeEducationSummary(state); productionRequirementGuide(input); }
  finally { Math.random = original; }
  assert.deepEqual(state, before); assert.deepEqual(input, inputBefore);
});

console.log(JSON.stringify({ pass: true, checks, scope: 'Current engine recipes and pure guide only; no browser, build, gameplay execution or historical report input.' }));
