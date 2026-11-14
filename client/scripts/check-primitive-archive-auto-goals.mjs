import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import './lib/register-simulation-modules.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const relative = 'client/src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js';
const engineUrl = pathToFileURL(path.join(root, relative)).href;
const useBaseline = process.env.PA_AUTO_GOALS_BASELINE === '1';
const compareOriginal = useBaseline || process.env.PA_AUTO_GOALS_COMPARE_ORIGINAL === '1';
const baseline = compareOriginal
  ? readFileSync(path.join(root, '.local/code-audit/archive-auto-goals-baseline-sources', relative), 'utf8') : null;
const current = readFileSync(path.join(root, relative), 'utf8');
const oldUrl = `${engineUrl}?auto-goals-baseline`;
const stepUrl = `${engineUrl}?auto-goals-single-step`;
registerHooks({ load(url, context, nextLoad) {
  if (url !== oldUrl && url !== stepUrl) return nextLoad(url, context);
  return { format: 'module', shortCircuit: true,
    source: (url === oldUrl || useBaseline ? baseline : current) + '\nexport { runNextAutoArchiveAction as testSingleStep };\n' };
} });
const engine = await import(useBaseline ? oldUrl : engineUrl);
const single = await import(stepUrl);
const old = compareOriginal ? await import(oldUrl) : single;
const lineage = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveLineage.js');
const goals = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveAutoDayGoals.js');
const clone = value => structuredClone(value);
function comparable(value) {
  const result = clone(value); delete result.updatedAt;
  // Timestamps are presentation metadata; every log message and its order remain checked.
  if (result.log) result.log = result.log.map(row => {
    if (typeof row !== 'object' || row === null) return row;
    const item = { ...row }; delete item.at; delete item.timestamp; return item;
  });
  return result;
}
function run(module, source, options = {}, step = false) {
  const draws = [];
  const tape = [0.01, 0.82, 0.31, 0.999, 0.5, 0.12, 0.73];
  const original = clone(source), opts = { ...options, rng: () => {
    const value = tape[draws.length % tape.length]; draws.push(value); return value;
  } };
  const ambient = Math.random;
  Math.random = () => { throw Error('Unexpected ambient randomness'); };
  try {
    const state = (step ? module.testSingleStep : module.runAutoDayAction)(source, opts);
    assert.deepEqual(source, original, 'automatic operation must preserve its input');
    assert.equal(opts.autoGoal, options.autoGoal, 'caller options must remain unchanged');
    return { state: comparable(state), draws };
  } finally { Math.random = ambient; }
}
const fresh = () => engine.createNewState({ runId: 'auto-goals-controlled', now: '2026-11-14T00:00:00.000Z', rng: () => 0.5 });
function progressed() {
  const state = fresh();
  return engine.normalizeState({ ...state, day: 40, ap: 4,
    party: state.party.map(row => ({ ...row, hp: 100, hunger: 0, stamina: 100, bodyTemp: 37 })),
    research: { ...state.research, completed: Object.fromEntries(engine.TECH_TREE.map(row => [row.id, true])) },
    inventory: { wood: 100, stone: 100, fiber: 100, resin: 100, clay: 100, herb: 100, hide: 100, twine: 20, berry: 100 },
    camp: { fireLevel: 3, shelterLevel: 3, workbenchLevel: 2, archiveRoomLevel: 1, scribeDeskLevel: 1, libraryShelfLevel: 1, fuel: 100 },
  });
}
function warmProgressed() {
  const state = progressed();
  // This controlled capability fixture starts with real catalog equipment
  // already worn. It does not claim natural acquisition or skip its costs.
  const equipment = Object.fromEntries(state.party.map(member => [member.id, {
    ...state.equipment[member.id], top: 'fur_coat', bottom: 'fur_pants',
    hat: 'fur_hat', shoes: 'fur_boots', earmuffs: 'fur_earmuffs',
    socks: 'fur_socks', gloves: 'fur_gloves', armWarmers: 'arm_warmers',
    leggings: 'leggings', pauldron: 'pauldron',
  }]));
  return engine.normalizeState({ ...state, equipment });
}
let checks = 0;
function check(name, callback) { callback(); checks++; console.log(`PASS ${name}`); }
check('shared goal contract and invalid inputs retain default semantics', () => {
  assert.deepEqual(goals.AUTO_DAY_GOALS.map(row => row.id), ['default', 'completion', 'development', 'exploration']);
  for (const row of goals.AUTO_DAY_GOALS) assert.ok(row.label && row.description);
  for (const value of [undefined, null, '', 'unknown', {}, [], false, 1]) assert.equal(goals.normalizeAutoDayGoal(value), 'default');
});
if (compareOriginal) check('baseline source receipt and unchanged shared dependencies match recorded hashes', () => {
  const receipt = JSON.parse(readFileSync(path.join(root, '.local/code-audit/archive-auto-goals-baseline.json'), 'utf8'));
  assert.equal(receipt.commit, '5fa914f9da8255655c9fdc90ee68bb90c42cf5b1');
  for (const row of receipt.files) {
    const bytes = readFileSync(path.join(root, row.path));
    assert.equal(bytes.length, row.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256);
  }
  for (const row of receipt.dependencies) assert.equal(createHash('sha256').update(readFileSync(path.join(root, row.path))).digest('hex'), row.sha256);
});
check(`default missing and invalid goals preserve ${compareOriginal ? 'original-source' : 'current no-option reference'} state logs and injected RNG order`, () => {
  for (const source of [fresh(), progressed(), warmProgressed(), { ...fresh(), ap: 0 }, { ...fresh(), ended: true }]) {
    const expected = run(old, source);
    for (const options of [{}, { autoGoal: 'default' }, { autoGoal: undefined }, { autoGoal: null }, { autoGoal: 'unknown' }, { autoGoal: {} }]) {
      assert.deepEqual(run(engine, source, options), expected);
    }
  }
});
check('original cold fixture preserves shared paid clothing and fitting before all goals', () => {
  const source = progressed();
  const project = engine.projectRows(source).find(row => row.canWork);
  source.projects.selectedProjectId = project.id;
  assert.equal(engine.autoArchiveDevelopmentPlan(source).id, 'book_craft_guide');
  const expected = run(old, source, {}, true);
  assert.equal(expected.state.ap, source.ap - 1);
  assert.equal(expected.state.counters.craft, source.counters.craft + 1);
  assert.equal(expected.state.inventory.hide, source.inventory.hide - 3);
  assert.equal(expected.state.inventory.fiber, source.inventory.fiber - 1);
  assert.ok(expected.state.party.some(row => expected.state.equipment[row.id].bottom === 'hide_pants'));
  assert.ok(expected.state.log.some(line => line.includes('개인 보온 대비: 가죽 하의 제작')));
  assert.equal(Number(expected.state.inventory.book_craft_guide || 0), 0);
  for (const autoGoal of ['completion', 'development', 'exploration']) assert.deepEqual(run(single, source, { autoGoal }, true), expected);
});
check('same fresh progressed state yields three distinct actual paid actions', () => {
  const source = warmProgressed();
  assert.equal(engine.autoWarmClothingPlan(source), null, 'prepared worn catalog equipment removes only the common cold-care prerequisite');
  const project = engine.projectRows(source).find(row => row.canWork);
  assert.ok(project, 'fixture exposes an unlocked project with real costs');
  source.projects.selectedProjectId = project.id;
  const results = ['completion', 'development', 'exploration'].map(autoGoal => run(single, source, { autoGoal }, true).state);
  for (const result of results) {
    assert.equal(result.ap, source.ap - 1, 'one selected action pays one real AP');
    assert.ok(result.party.some((row, i) => row.stamina < source.party[i].stamina), 'selected paid action consumes real stamina');
    for (const count of Object.values(result.inventory)) assert.ok(count >= 0);
  }
  assert.equal(results[0].inventory.book_craft_guide, 1, 'completion really crafts an archive book');
  assert.ok(results[1].projects.progress[project.id] > Number(source.projects.progress[project.id] || 0), 'development really works on the selected project');
  for (const [id, cost] of Object.entries(project.cost)) assert.equal(results[1].inventory[id], source.inventory[id] - cost);
  assert.ok(Number(results[2].counters.survey || 0) > Number(source.counters.survey || 0), 'exploration really surveys');
  assert.notDeepEqual(results[0], results[1]); assert.notDeepEqual(results[1], results[2]); assert.notDeepEqual(results[0], results[2]);
});
check('completion can use a paid late-day action beyond the default development window', () => {
  const source = warmProgressed(); source.ap = 2;
  const result = run(single, source, { autoGoal: 'completion' }, true).state;
  const recipe = engine.RECIPES.find(row => row.id === 'book_craft_guide');
  assert.equal(result.inventory.book_craft_guide, 1);
  assert.equal(result.ap, 1);
  for (const [id, cost] of Object.entries(recipe.requires)) assert.equal(result.inventory[id], source.inventory[id] - cost);
});
check('all goals retain emergency care before optional objective work', () => {
  for (const kind of ['hunger', 'injury', 'cold']) {
    const source = progressed();
    if (kind === 'hunger') source.party[0].hunger = 100;
    if (kind === 'injury') { source.party[0].hp = 10; source.inventory.herb_tonic = 1; }
    if (kind === 'cold') { source.party[0].bodyTemp = 30; source.camp.fuel = 0;
      source.weather = { id: 'snow', name: '검사 한파', temp: -30, actionMod: 0, cold: 18 }; }
    const expected = run(old, source, {}, true);
    for (const autoGoal of ['completion', 'development', 'exploration']) assert.deepEqual(run(single, source, { autoGoal }, true), expected, kind);
  }
});
check('affordable warned succession precedes each optional goal', () => {
  let source = warmProgressed();
  // Exercise only the bounded lifecycle clock, not a whole-game simulation.
  // Every history transition is produced by the actual lifecycle function.
  for (let cycle = 0; cycle < lineage.LINEAGE_RULES.warningCycle; cycle++) {
    source = lineage.tickLineageDay({ ...source, day: source.day + 1 });
    assert.equal(lineage.isValidLineage(source.lineage, source), true);
  }
  source = engine.normalizeState(source);
  assert.ok(engine.lineageSummary(source).rows.some(row => row.warning && row.canPrepare));
  const actualPreparation = engine.prepareSuccessorAction(source, source.party[0].id, { rng: () => 0.01 });
  assert.equal(lineage.isValidLineage(actualPreparation.lineage, actualPreparation), true);
  assert.ok(actualPreparation.lineage.prepared.some(row => row.mentorId === source.party[0].id));
  const expected = run(old, source, {}, true);
  assert.ok(expected.state.lineage.prepared.some(row => row.mentorId === source.party[0].id));
  for (const autoGoal of ['completion', 'development', 'exploration']) assert.deepEqual(run(single, source, { autoGoal }, true), expected);
});
check('locked and exhausted objective inputs cannot grant free progress or negative costs', () => {
  for (const source of [fresh(), { ...progressed(), inventory: { berry: 100 }, party: progressed().party.map(row => ({ ...row, stamina: 1 })) }]) {
    for (const autoGoal of ['completion', 'development', 'exploration']) {
      const result = run(single, source, { autoGoal }, true).state;
      for (const count of Object.values(result.inventory)) assert.ok(count >= 0);
      assert.ok(result.ap < source.ap || result.day > source.day || result.ended, 'fallback executes a real affordable action');
      if (!source.research.completed.WRITING) assert.equal(Number(result.inventory.book_craft_guide || 0), 0);
    }
  }
});
check('annual dispatch remains first including AP zero and consumes no daily RNG', () => {
  const source = progressed();
  const stamp = { runId: source.runId, day: source.day, ap: source.ap, updatedAt: source.updatedAt,
    completedYears: source.calendar?.completedYears ?? null };
  const annual = engine.startAnnualSettlementAction(source, stamp, { observedLifetimeYears: 60 });
  assert.equal(annual.calendar.mode, 'annual'); annual.ap = 0;
  const expected = run(old, annual);
  assert.equal(expected.draws.length, 0);
  for (const autoGoal of ['default', 'completion', 'development', 'exploration']) assert.deepEqual(run(engine, annual, { autoGoal }), expected);
});
console.log(JSON.stringify({ pass: true, checks,
  mode: useBaseline ? 'original-source-negative-control' : compareOriginal ? 'explicit-original-source-comparison' : 'current-source-reference',
  scope: compareOriginal ? 'Explicit private source comparison with verified original receipt and shared dependencies. This is not a complete historical product reproduction.'
    : 'Tracked current source and fresh controlled fixtures only. Default equivalence uses current no-option execution; historical source equivalence is outside this mode.',
  resultFiles: 0 }));
