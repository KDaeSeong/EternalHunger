import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import crypto from 'node:crypto';
import './lib/register-simulation-modules.mjs';

const engineUrl = new URL('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js', import.meta.url);
const oracleUrl = `${engineUrl.href}?worker-allocation-economy-oracle`;
registerHooks({ load(url, context, nextLoad) {
  if (url !== oracleUrl) return nextLoad(url, context);
  return { format: 'module', shortCircuit: true, source: readFileSync(engineUrl, 'utf8')
    + '\nexport { settleTribeDay, autoAssignTribeWorkers, settlementEveningPlan, tribeFoodStock };\n' };
} });
const engine = await import(engineUrl.href);
const actual = await import(oracleUrl);
const calendar = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCalendar.js');
const checkpoint = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCheckpoint.js');
const clone = value => structuredClone(value);
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const jobs = values => Object.fromEntries(engine.TRIBE_JOBS.map(row => [row.id, values[row.id] || 0]));
function fixture(assignments = { forager: 2, builder: 1, scholar: 2, artisan: 1 }) {
  const state = engine.createNewState({ runId: 'worker-allocation-current-fixture', now: '2026-11-14T00:00:00.000Z', rng: () => 0.5 });
  state.day = 10;
  state.camp = { ...state.camp, fireLevel: 1, shelterLevel: 3, workbenchLevel: 1, fuel: 20 };
  state.weather = { id: 'clear', name: '검사 맑음', cold: 0, temp: 20, actionMod: 0 };
  state.party = state.party.map(row => ({ ...row, hp: 100, hunger: 0, stamina: 100, bodyTemp: 37 }));
  state.inventory = { berry: 1000, wood: 30, fiber: 30, stone: 20, paper: 8, clay: 10, grain: 30, meat: 20, resin: 20, herb: 20 };
  for (const row of engine.TECHNOLOGY_TREE) state.research.completed[row.id] = true;
  for (const row of engine.CIVIC_TREE) state.civics.completed[row.id] = true;
  const tech = engine.TECHNOLOGY_TREE.at(-1), civic = engine.CIVIC_TREE.find(row => row.id === 'LIBERALISM');
  delete state.research.completed[tech.id]; state.research.selectedTechId = tech.id; state.research.progress[tech.id] = 0;
  delete state.civics.completed[civic.id]; delete state.research.completed[civic.id];
  state.civics.selectedCivicId = civic.id; state.civics.progress[civic.id] = 0;
  state.tribe.population = 6; state.tribe.assignments = jobs(assignments); state.tribe.autoAssignments = jobs({});
  return engine.normalizeState(state);
}
function annual(source) {
  const stamp = { runId: source.runId, day: source.day, ap: source.ap, updatedAt: source.updatedAt, completedYears: null };
  const result = engine.startAnnualSettlementAction(source, stamp, { observedLifetimeYears: 60 });
  assert.equal(result.calendar.mode, 'annual'); return result;
}
function withoutRandomOrStorage(callback) {
  const changes = [];
  const replace = (owner, key, value) => {
    const descriptor = Object.getOwnPropertyDescriptor(owner, key);
    changes.push(() => descriptor ? Object.defineProperty(owner, key, descriptor) : Reflect.deleteProperty(owner, key));
    Object.defineProperty(owner, key, { configurable: true, writable: true, value });
  };
  const forbidden = () => { throw Error('Read-only worker projection consumed randomness or device storage'); };
  replace(Math, 'random', forbidden); replace(crypto, 'randomUUID', forbidden);
  replace(crypto.webcrypto, 'getRandomValues', forbidden);
  replace(crypto.webcrypto, 'randomUUID', forbidden);
  if (globalThis.crypto && globalThis.crypto !== crypto.webcrypto) replace(globalThis.crypto, 'getRandomValues', forbidden);
  if (globalThis.crypto && globalThis.crypto !== crypto.webcrypto) replace(globalThis.crypto, 'randomUUID', forbidden);
  replace(globalThis, 'localStorage', new Proxy({}, { get: forbidden }));
  try { return callback(); } finally { changes.reverse().forEach(restore => restore()); }
}
function preview(state, fromJobId, toJobId) {
  const before = clone(state);
  const result = withoutRandomOrStorage(() => engine.workerAllocationComparison(freeze(state), { fromJobId, toJobId }));
  assert.deepEqual(state, before, 'Query preserves every source field including AP ST day timestamps and log');
  return result;
}
function boundary(input) {
  let prepared;
  if (input.calendar?.mode === 'annual') {
    const advanced = { ...input, day: input.day + 1, calendar: calendar.advanceAnnualCalendar(input) };
    prepared = actual.autoAssignTribeWorkers(advanced, 'settlement', 0);
  } else {
    const assigned = actual.autoAssignTribeWorkers(input, 'settlement', 1);
    prepared = { ...actual.settlementEveningPlan(assigned).state, day: input.day + 1 };
  }
  // Execute the real current settlement without its preview normalization bypass.
  const next = actual.settleTribeDay(prepared);
  const selected = engine.TRIBE_PROJECTS.find(row => row.id === prepared.projects.selectedProjectId);
  return { assignments: prepared.tribe.assignments, inventory: next.inventory,
    population: next.tribe.population, morale: next.tribe.morale, growthProgress: next.tribe.growthProgress,
    projectProgress: next.projects.progress, researchProgress: next.research.progress, civicsProgress: next.civics.progress,
    projectSpent: next.tribe.lastProduction.projectStarted ? { ...selected?.cost } : {},
    projectReward: selected && !prepared.projects.completed[selected.id] && next.projects.completed[selected.id] ? { ...selected.reward } : {},
    receipt: next.tribe.lastProduction, foodStock: actual.tribeFoodStock(next.inventory) };
}
function compare(source, fromJobId, toJobId) {
  const result = preview(source, fromJobId, toJobId);
  assert.equal(result.available, true, result.reason);
  const moved = engine.transferTribeWorkerAction(source, fromJobId, toJobId);
  assert.deepEqual(result.before, boundary(source), 'Before is the exact real narrow economy boundary');
  assert.deepEqual(result.after, boundary(moved), 'After is the exact real narrow economy boundary');
  for (const row of result.rows) {
    assert.ok(['production', 'resources', 'operations'].includes(row.group));
    assert.equal(row.delta, row.after - row.before); assert.ok(Number.isFinite(row.delta));
  }
  for (const key of new Set([...Object.keys(result.before.inventory), ...Object.keys(result.after.inventory)])) {
    const before = Number(result.before.inventory[key] || 0), after = Number(result.after.inventory[key] || 0);
    if (before || after) assert.deepEqual(result.rows.find(row => row.id === `resource:${key}`)?.delta, after - before);
  }
  assert.ok(result.assumptions.length); assert.ok(result.periodLabel); assert.equal(checkpoint.isValidRunState(moved), true);
  return result;
}
let checks = 0;
function check(name, callback) { callback(); checks++; console.log(`PASS ${name}`); }
check('current worker comparison and atomic transfer APIs exist', () => {
  assert.equal(typeof engine.workerAllocationComparison, 'function');
  assert.equal(typeof engine.transferTribeWorkerAction, 'function');
});
check('atomic transfers preserve AP time resources and policy and make both edited jobs manual', () => {
  const source = fixture(); source.ap = 0; source.tribe.autoAssignments.forager = 2;
  source.tribe.autoAssignments.scholar = 1; source.tribe.workPolicy = 'research';
  const before = clone(source), next = engine.transferTribeWorkerAction(freeze(source), 'forager', 'scholar');
  assert.deepEqual(source, before);
  for (const key of ['ap', 'day', 'inventory', 'party', 'camp', 'research', 'civics', 'calendar']) assert.deepEqual(next[key], source[key], key);
  assert.equal(next.log.length, source.log.length + 1);
  assert.ok(Number.isFinite(Date.parse(next.updatedAt)), 'A real edit records its normal update timestamp');
  assert.equal(next.tribe.assignments.forager, 1); assert.equal(next.tribe.assignments.scholar, 3);
  assert.equal(next.tribe.autoAssignments.forager, 0); assert.equal(next.tribe.autoAssignments.scholar, 0);
  assert.equal(next.tribe.workPolicy, 'research'); assert.equal(next.tribe.assignmentSerial, source.tribe.assignmentSerial + 1);
  const unchanged = clone(next); unchanged.log = clone(source.log); unchanged.updatedAt = source.updatedAt;
  unchanged.tribe.assignments = clone(source.tribe.assignments); unchanged.tribe.autoAssignments = clone(source.tribe.autoAssignments);
  unchanged.tribe.assignmentSerial = source.tribe.assignmentSerial;
  assert.deepEqual(unchanged, source, 'Only the two job allocations, their manual ownership, serial and edit metadata may change');
});
check('invalid locked ended and malformed moves are atomic no-ops without partial source removal', () => {
  const cases = [[fixture(), 'missing', 'forager'], [fixture(), 'forager', 'missing'],
    [fixture(), 'forager', 'forager'], [fixture(), 'unassigned', 'forager'], [fixture(), 'miner', 'forager']];
  const locked = fixture(); const job = engine.TRIBE_JOBS.find(row => row.id === 'miner'); delete locked.research.completed[job.techId];
  cases.push([locked, 'forager', 'miner'], [{ ...fixture(), ended: true }, 'forager', 'scholar']);
  for (const value of [-1, 0.5, NaN, Infinity]) { const source = fixture(); source.tribe.assignments.forager = value; cases.push([source, 'forager', 'scholar']); }
  for (const [source, from, to] of cases) {
    const before = clone(source); assert.equal(engine.transferTribeWorkerAction(source, from, to), source);
    const result = preview(source, from, to); assert.equal(result.available, false); assert.ok(result.reason); assert.deepEqual(source, before);
  }
});
check('nonfinite economy invalid calendar no living party and malformed options fail closed without writes or randomness', () => {
  const invalid = [];
  for (const day of [Infinity, NaN, -1, 0.5, Number.MAX_SAFE_INTEGER]) invalid.push({ ...fixture(), day });
  invalid.push({ ...fixture(), ap: NaN });
  for (const quantity of [NaN, Infinity, -1]) { const state = fixture(); state.inventory.berry = quantity; invalid.push(state); }
  invalid.push({ ...fixture(), party: [] });
  const dead = fixture(); dead.party = dead.party.map(row => ({ ...row, hp: 0 })); invalid.push(dead);
  for (const calendarValue of [{ mode: 'annual' }, { mode: 'daily' }, { ...annual(fixture()).calendar, completedYears: -1 }]) invalid.push({ ...fixture(), calendar: calendarValue });
  for (const source of invalid) {
    const original = clone(source), result = preview(source, 'forager', 'scholar');
    assert.equal(result.available, false); assert.ok(result.reason);
    assert.equal(withoutRandomOrStorage(() => engine.transferTribeWorkerAction(source, 'forager', 'scholar')), source);
    assert.deepEqual(source, original);
  }
  for (const options of [null, 'scholar', [], 1]) {
    const source = freeze(fixture()), before = clone(source);
    const result = withoutRandomOrStorage(() => engine.workerAllocationComparison(source, options));
    assert.equal(result.available, false); assert.ok(result.reason); assert.deepEqual(source, before);
  }
});
check('unassigned and source-job transfers match real economy under every automatic policy and day parity', () => {
  for (const day of [10, 11, 12]) for (const workPolicy of ['balanced', 'construction', 'research']) {
    const source = fixture({ forager: 2, scholar: 2, artisan: 1 }); source.day = day; source.tribe.workPolicy = workPolicy;
    source.tribe.autoAssignments.forager = 1;
    compare(source, 'unassigned', 'miner'); compare(fixture({ forager: 3, miner: 3 }), 'forager', 'miner');
  }
});
check('project start materials completion rewards and remaining work caps match actual settlement', () => {
  for (const availableMaterials of [false, true]) {
    const source = fixture({ forager: 2, builder: 1, scholar: 2, artisan: 1 });
    const project = engine.projectRows(source).find(row => row.canWork); assert.ok(project);
    source.projects.selectedProjectId = project.id; source.projects.progress[project.id] = project.work - 1;
    if (!availableMaterials) source.inventory = { berry: 1000 };
    const result = compare(source, 'scholar', 'builder');
    assert.ok(result.after.receipt.projectWork <= 1);
    if (availableMaterials) { assert.equal(result.after.receipt.projectWork, 1); assert.deepEqual(result.after.projectSpent, project.cost); }
  }
});
check('completed locked or unstaffed work yields no free project progress', () => {
  for (const kind of ['completed', 'locked', 'unstaffed']) {
    const source = fixture({ forager: 3, scholar: 3 });
    const project = engine.projectRows(source).find(row => row.canWork); assert.ok(project);
    source.projects.selectedProjectId = project.id;
    if (kind === 'completed') { source.projects.completed[project.id] = true; source.projects.progress[project.id] = project.work; }
    if (kind === 'locked') {
      const gated = engine.TRIBE_PROJECTS.find(row => row.prereqs?.length); assert.ok(gated);
      source.projects.selectedProjectId = gated.id; delete source.research.completed[gated.prereqs[0]];
    }
    const result = compare(source, 'forager', 'scholar');
    assert.equal(result.before.receipt.projectWork, 0); assert.equal(result.after.receipt.projectWork, 0);
  }
});
check('teachers consume only existing paper and CP RP are separately capped by actual remaining progress', () => {
  for (const paper of [0, 1, 8]) {
    let source = fixture({ forager: 2, scholar: 3, artisan: 1 }); source.inventory.paper = paper;
    const civic = engine.CIVIC_TREE.find(row => row.id === source.civics.selectedCivicId);
    const tech = engine.TECHNOLOGY_TREE.find(row => row.id === source.research.selectedTechId);
    source.civics.progress[civic.id] = civic.cost - 0.5; source.research.progress[tech.id] = tech.cost - 0.5;
    source = engine.configureTribeEducationAction(source, { teachers: 2 });
    const result = compare(source, 'scholar', 'artisan');
    for (const snapshot of [result.before, result.after]) {
      assert.ok(snapshot.receipt.education.appliedPoints <= 0.5); assert.ok(snapshot.receipt.researchPoints <= 0.5);
      assert.equal(snapshot.receipt.education.teachers + snapshot.receipt.education.generalScholars, snapshot.receipt.education.scholarsAvailable);
    }
    assert.equal(result.rows.find(row => row.id === 'educationPoints')?.before, result.before.receipt.education.appliedPoints);
    assert.equal(result.rows.find(row => row.id === 'researchPoints')?.after, result.after.receipt.researchPoints);
  }
});
check('processing respects workers materials target caps and paper manufactured after school starts next period', () => {
  for (const stock of [0, 8]) for (const fiber of [0, 2, 30]) {
    let source = fixture({ forager: 2, scholar: 2, artisan: 2 }); source.inventory.paper = stock; source.inventory.fiber = fiber;
    source = engine.configureTribeEducationAction(source, { teachers: 2 });
    source = engine.configureTribeProcessAction(source, { actionId: 'paper', targetStock: 8 });
    const result = compare(source, 'forager', 'artisan');
    if (!stock) { assert.equal(result.before.receipt.education.teachers, 0); assert.equal(result.after.receipt.education.teachers, 0); }
    assert.ok(result.after.receipt.processing.batches <= result.after.assignments.artisan);
    assert.equal(result.after.receipt.processing.stockBefore, stock - Number(result.after.receipt.education.spent.paper || 0));
    if (result.after.receipt.processing.stockBefore >= 8) assert.equal(result.after.receipt.processing.batches, 0);
  }
  const capped = engine.configureTribeProcessAction(fixture({ forager: 2, scholar: 2, artisan: 2 }), { actionId: 'paper', targetStock: 8 });
  assert.equal(compare(capped, 'forager', 'artisan').after.receipt.processing.batches, 0, 'A reached target with school disabled performs no batch');
});
check('whole communal and prepared household rations precede processing in daily and annual economies', () => {
  let source = fixture({ forager: 2, scholar: 2, artisan: 2 });
  source = engine.prepareSuccessorAction(source, source.party[0].id, { rng: () => 0.5 });
  source.inventory = { berry: 1, grain: 2, wood: 2, fiber: 4 };
  source = engine.configureTribeProcessAction(source, { actionId: 'mill', targetStock: 4 });
  const daily = compare(source, 'scholar', 'forager');
  const yearlySource = annual(fixture({ forager: 2, miner: 2, scholar: 2 }));
  const yearly = compare(yearlySource, 'scholar', 'miner');
  assert.equal(daily.mode, 'daily'); assert.equal(yearly.mode, 'annual');
  assert.equal(yearly.before.receipt.foodNeed, calendar.annualCensus(yearlySource).foodNeed);
  assert.equal(yearly.after.receipt.gains.metal_ore, yearly.after.assignments.miner);
});
check('finite legacy fractional stocks remain exact visible resource rows without rounding', () => {
  const source = fixture(); source.inventory.resin = 0.3;
  const result = compare(source, 'forager', 'scholar');
  const row = result.rows.find(entry => entry.id === 'resource:resin');
  assert.equal(row.before, result.before.inventory.resin); assert.equal(row.after, result.after.inventory.resin);
  assert.equal(row.before, 0.3); assert.equal(row.after, 0.3); assert.equal(row.delta, 0);
});
check('projection is independent of the wall clock and forbids both Node and Web Crypto randomness', () => {
  const source = fixture(), originalNow = Date.now;
  try {
    Date.now = () => 1; const first = preview(source, 'forager', 'scholar');
    Date.now = () => 9999999999999; assert.deepEqual(preview(source, 'forager', 'scholar'), first);
  } finally { Date.now = originalNow; }
});
check('one logger can supply the exact missing project start material in the same economy boundary', () => {
  const source = fixture({ forager: 2, builder: 1, scholar: 3 });
  source.projects.selectedProjectId = 'drying-rack'; source.inventory.wood = 1; source.inventory.fiber = 2;
  const result = compare(source, 'scholar', 'logger');
  assert.equal(result.before.receipt.projectStarted, false); assert.equal(result.before.receipt.projectWork, 0);
  assert.equal(result.after.receipt.projectStarted, true); assert.equal(result.after.receipt.projectWork, 1);
  assert.deepEqual(result.after.projectSpent, { wood: 3, fiber: 2 });
});
check('adding a scholar can increase only actual teachers and CP with zero general RP gain', () => {
  const source = engine.configureTribeEducationAction(fixture({ forager: 3, scholar: 1, artisan: 2 }), { teachers: 2 });
  const result = compare(source, 'forager', 'scholar');
  assert.equal(result.before.receipt.education.teachers, 1); assert.equal(result.after.receipt.education.teachers, 2);
  assert.equal(result.before.receipt.researchPoints, 0); assert.equal(result.after.receipt.researchPoints, 0);
  assert.equal(result.after.receipt.education.appliedPoints - result.before.receipt.education.appliedPoints, 2);
});
check('processing rounds a sub-batch target upward but never exceeds safe integer inventory capacity', () => {
  for (const stock of [7, Number.MAX_SAFE_INTEGER - 1]) {
    let source = fixture({ forager: 2, scholar: 2, artisan: 2 }); source.inventory.paper = stock;
    const targetStock = stock === 7 ? 8 : Number.MAX_SAFE_INTEGER;
    source = engine.configureTribeProcessAction(source, { actionId: 'paper', targetStock });
    const result = compare(source, 'forager', 'artisan');
    assert.equal(result.after.receipt.processing.batches, stock === 7 ? 1 : 0);
    assert.equal(result.after.inventory.paper, stock === 7 ? 9 : stock);
  }
});
check('annual ration census includes actual prepared and retired people without treating them as assigned workers', () => {
  let source = fixture({ forager: 2, scholar: 4 });
  source = engine.prepareSuccessorAction(source, source.party[0].id, { rng: () => 0.5 });
  source = engine.retireFounderAction(source, source.party[0].id);
  source = engine.prepareSuccessorAction(source, source.party[1].id, { rng: () => 0.5 });
  source = annual(source);
  const census = calendar.annualCensus(source);
  assert.ok(census.retired > 0); assert.ok(census.prepared > 0);
  const result = compare(source, 'scholar', 'forager');
  assert.equal(result.before.receipt.foodNeed, census.foodNeed); assert.equal(result.after.receipt.foodNeed, census.foodNeed);
});
console.log(JSON.stringify({ pass: true, checks, mode: 'tracked-current-source-and-fresh-fixed-fixtures',
  scope: 'Exact narrow communal economy boundary with actual settlement, automatic allocation and existing-stock evening care. No future night/weather/deaths/succession or facility RP/CP, no browser, persisted save or historical result inputs.', resultFiles: 0 }));
