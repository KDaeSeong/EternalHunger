import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const calendar = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCalendar.js');
const lineage = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveLineage.js');
const checkpoint = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCheckpoint.js');
const data = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveData.js');
const feedback = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveFeedback.js');
const clone = value => structuredClone(value);
const originalRandom = Math.random;
let passed = 0;
const failures = [];
function check(name, run) {
  try { run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`FAIL ${name}: ${error.message}`); }
}
function fixture(id = 'annual-operation', { advanced = false, food = 2 } = {}) {
  const state = engine.createNewState({ runId: id, now: '2026-11-12T00:00:00.000Z', rng: () => 0.99 });
  const completed = advanced ? data.TECH_TREE.map(row => row.id)
    : ['GATHERING', 'FIREMAKING', 'SHELTER', 'SETTLEMENT', 'POTTERY', 'HEARTH', 'FOOD_STORAGE'];
  state.research.completed = Object.fromEntries(completed.map(key => [key, true]));
  state.camp = { ...state.camp, fireLevel: 3, shelterLevel: 1, workbenchLevel: 1, fuel: 0 };
  state.tribe.population = 8;
  state.tribe.morale = 50;
  state.tribe.growthProgress = 0;
  state.tribe.assignments = Object.fromEntries(engine.TRIBE_JOBS.map(row => [row.id, row.id === 'forager' ? 8 : 0]));
  state.tribe.autoAssignments = Object.fromEntries(engine.TRIBE_JOBS.map(row => [row.id, 0]));
  state.inventory = { berry: food, wood: 1 };
  assert.equal(checkpoint.isValidRunState(state), true, 'fresh controlled fixture is a valid current save');
  return state;
}
const stamp = state => ({ runId: state.runId, day: state.day, ap: state.ap, updatedAt: state.updatedAt,
  completedYears: state.calendar?.completedYears ?? null });
function start(state, observedLifetimeYears = 60) {
  return engine.startAnnualSettlementAction(state, stamp(state), { observedLifetimeYears });
}
function year(state) {
  const before = clone(state);
  let injected = 0, ambient = 0;
  Math.random = () => { ambient++; throw new Error('Annual management must not roll daily weather'); };
  try {
    const next = engine.runSettlementYearAction(state, stamp(state), { rng: () => { injected++; return 0.99; } });
    assert.deepEqual(state, before, 'annual operation preserves its source state');
    assert.equal(injected, 0, 'annual operation never requests daily weather or personal action randomness');
    assert.equal(ambient, 0);
    assert.equal(checkpoint.isValidRunState(next), true, 'completed annual state is checkpoint-valid');
    return next;
  } finally { Math.random = originalRandom; }
}
function gameplay(value) { const next = clone(value); delete next.log; delete next.updatedAt; return next; }
function bodies(state) {
  return state.party.map(row => ({ id: row.id, hp: row.hp, hunger: row.hunger, stamina: row.stamina, bodyTemp: row.bodyTemp }));
}

check('explicit transition adds only observed annual time and preserves original history, stock and bodies', () => {
  const source = fixture();
  const before = clone(source);
  const next = start(source);
  assert.deepEqual(source, before);
  assert.equal(next.day, source.day); assert.equal(next.ap, source.ap);
  assert.deepEqual(next.inventory, source.inventory); assert.deepEqual(bodies(next), bodies(source));
  assert.deepEqual(next.founderHistory, source.founderHistory); assert.deepEqual(next.lineage, source.lineage);
  assert.equal(next.calendar.completedYears, 0); assert.equal(next.calendar.startedDay, source.day);
  assert.equal(next.calendar.lastSettledDay, source.day); assert.equal(next.calendar.runId, source.runId);
  assert.equal(next.calendar.observedLifetimeYears, 60);
  assert.equal(calendar.isValidAnnualCalendar(next.calendar, next), true);
});
check('transition requires real settlement readiness and rejects stale or repeated commands', () => {
  const source = fixture();
  for (const patch of [{ runId: 'other' }, { day: source.day + 1 }, { ap: 0 },
    { updatedAt: 'older' }, { completedYears: 1 }]) {
    assert.equal(engine.startAnnualSettlementAction(source, { ...stamp(source), ...patch }, { observedLifetimeYears: 60 }), source);
  }
  const locked = fixture('annual-locked'); delete locked.research.completed.FOOD_STORAGE;
  assert.equal(engine.startAnnualSettlementAction(locked, stamp(locked), { observedLifetimeYears: 60 }), locked);
  const active = start(source);
  assert.equal(engine.startAnnualSettlementAction(active, stamp(active), { observedLifetimeYears: 80 }), active);
  for (const value of [-1, 24, '60', false, NaN, Infinity]) {
    assert.equal(engine.startAnnualSettlementAction(source, stamp(source), { observedLifetimeYears: value }), source);
  }
});
check('per-run observed lifespan choices are persisted without inventing an age', () => {
  for (const value of [60, 80, null]) {
    const next = start(fixture(`annual-life-${value}`), value);
    assert.equal(next.calendar.observedLifetimeYears, value);
    assert.equal(calendar.isValidAnnualCalendar(next.calendar, next), true);
    assert.ok(next.calendar.people.every(person => person.observedFromYear === 0));
    assert.ok(!next.party.some(person => Object.hasOwn(person, 'birthYear') || Object.hasOwn(person, 'age')));
  }
});
check('annual census and actual production feed workers plus all active people exactly once', () => {
  const active = start(fixture());
  const census = calendar.annualCensus(active);
  assert.deepEqual(census, { workers: 8, prepared: 0, retired: 0, active: 3, total: 11, foodNeed: 3 });
  const next = year(active);
  assert.equal(next.day, active.day + 1); assert.equal(next.calendar.completedYears, 1);
  assert.equal(next.calendar.lastSettledDay, next.day); assert.equal(next.ap, next.apMax);
  assert.deepEqual(next.calendar.lastCensus, census);
  assert.equal(next.tribe.lastProduction.foodNeed, 3); assert.equal(next.tribe.lastProduction.shortage, 0);
  assert.deepEqual(next.tribe.lastProduction.gains, { wood: 4, berry: 4 });
  assert.equal(next.inventory.berry, 3); assert.equal(next.inventory.wood, 5);
  assert.deepEqual(bodies(next), bodies(active)); assert.deepEqual(next.weather, active.weather);
  assert.equal(next.camp.fuel, 0);
});
check('a depleted communal supply changes morale and growth while annual recovery remains available at AP zero', () => {
  const source = fixture('annual-shortage', { advanced: true, food: 0 });
  source.tribe.assignments = Object.fromEntries(engine.TRIBE_JOBS.map(row => [row.id, row.id === 'scholar' ? 8 : 0]));
  source.inventory = {}; source.ap = 0; source.tribe.growthProgress = 4;
  let active = start(source);
  const body = bodies(active);
  for (let i = 0; i < 6; i++) active = year(active);
  assert.equal(active.calendar.completedYears, 6); assert.equal(active.tribe.morale, 0);
  assert.equal(active.tribe.growthProgress, 0); assert.equal(active.tribe.lastProduction.shortage, 3);
  assert.equal(active.ended, false); assert.deepEqual(bodies(active), body);
  assert.equal(active.party.some(row => row.deathRecord), false);
});
check('daily and auto entry points dispatch exactly one annual boundary instead of personal action loops', () => {
  const active = start(fixture());
  const expected = year(active);
  for (const run of [state => engine.advanceDay(state, { rng: () => { throw Error('daily weather'); } }),
    state => engine.runAutoDayAction(state, { rng: () => { throw Error('personal auto action'); } }),
    state => engine.runSettlementDayAction(state, stamp(state), { rng: () => { throw Error('daily settlement'); } })]) {
    const next = run(clone(active));
    assert.equal(next.calendar.completedYears, 1); assert.equal(next.day, expected.day);
    assert.deepEqual(next.inventory, expected.inventory); assert.deepEqual(bodies(next), bodies(active));
    assert.deepEqual(next.counters, active.counters);
  }
});
check('an exhausted management action never advances time or spends personal survival fields', () => {
  const active = start(fixture()); active.ap = 1;
  const actor = active.party[0]; actor.stamina = 0; actor.hunger = 95; actor.bodyTemp = 25;
  const before = clone(active);
  const next = engine.afterAction(active, actor.id, 99, 90, { warmthAdd: -20 });
  assert.equal(next.ap, 0); assert.equal(next.day, before.day); assert.equal(next.calendar.completedYears, 0);
  assert.deepEqual(bodies(next), bodies(before)); assert.deepEqual(next.research, before.research);
  assert.deepEqual(next.civics, before.civics);
});
check('obsolete annual stamps cannot settle a second year or overwrite a newer period', () => {
  const active = start(fixture()); const oldStamp = stamp(active); const next = year(active);
  assert.equal(engine.runSettlementYearAction(next, oldStamp), next);
  for (const patch of [{ runId: 'other' }, { day: next.day - 1 }, { updatedAt: 'old' },
    { ap: -1 }, { completedYears: 0 }]) assert.equal(engine.runSettlementYearAction(next, { ...stamp(next), ...patch }), next);
  const ended = { ...next, ended: true };
  assert.equal(engine.runSettlementYearAction(ended, stamp(ended)), ended);
});
check('annual personal subsistence actions produce no items, healing, costs or hidden time', () => {
  const active = start(fixture()); active.inventory = { ...active.inventory, berry: 5, meat: 3, wood: 20, stone: 20, fiber: 20 };
  const actorId = active.party[0].id;
  const calls = [s => engine.runGatherAction(s, actorId), s => engine.runSafeGatherAction(s, actorId, 'berry'),
    s => engine.runHuntAction(s, actorId), s => engine.runSpecializedAction(s, actorId, 'farm'),
    s => engine.runEatAction(s, actorId), s => engine.runRestAction(s, actorId),
    s => engine.runCraftAction(s, actorId, data.RECIPES[0].id)];
  for (const run of calls) {
    const source = clone(active); const before = clone(source);
    const next = run(source);
    assert.deepEqual(gameplay(next), gameplay(before)); assert.deepEqual(source, before);
  }
});
check('real facility investment remains usable with spent stamina and consumes its actual materials and one management AP', () => {
  const active = start(fixture()); active.inventory = { wood: 100, stone: 100, fiber: 100, hide: 100, clay: 100, resin: 100 };
  active.ap = 1; active.party[0].stamina = 0; active.party[0].hunger = 95;
  const row = engine.campActionRows(active).find(row => row.enabled && row.levelKey && row.id !== 'fire');
  assert.ok(row, 'an actual eligible facility investment is exposed');
  assert.ok(Object.values(row.cost).some(qty => qty > 0));
  const before = clone(active);
  const next = engine.runCampAction(active, active.party[0].id, row.id, { rng: () => 0.5 });
  assert.equal(next.camp[row.levelKey], before.camp[row.levelKey] + 1);
  assert.equal(next.ap, 0); assert.equal(next.calendar.completedYears, 0);
  for (const [id, qty] of Object.entries(row.cost)) assert.equal(next.inventory[id], before.inventory[id] - qty);
  assert.deepEqual(bodies(next), bodies(before));
});
check('annual preparation and 25-year handover conserve people and transfer each equipment slot once', () => {
  let active = start(fixture('annual-succession', { food: 2000 }));
  const originals = active.party.map(row => row.id);
  const originalEquipment = clone(active.equipment);
  const initialCensus = calendar.annualCensus(active).total;
  for (const id of originals) active = engine.prepareSuccessorAction(active, id);
  assert.equal(active.lineage.prepared.length, originals.length);
  assert.equal(calendar.annualCensus(active).total, initialCensus);
  assert.equal(active.calendar.completedYears, 0);
  for (let i = 0; i < 20; i++) active = year(active);
  const warning = lineage.lineageSummary(active);
  assert.ok(warning.rows.filter(row => originals.includes(row.actorId)).every(row => row.warning));
  for (let i = 20; i < 25; i++) active = year(active);
  for (const id of originals) {
    const prior = active.lineage.members.find(row => row.actorId === id);
    assert.equal(prior.stage, 'retired'); assert.ok(prior.retiredSnapshot.hp > 0);
    assert.equal(prior.deathRecord, null); assert.ok(prior.successorId);
    assert.deepEqual(active.equipment[prior.successorId], originalEquipment[id]);
    assert.equal(Object.hasOwn(active.equipment, id), false);
    const person = active.calendar.people.find(row => row.actorId === id);
    assert.equal(person.serviceUntilYear, 25);
    assert.equal(active.calendar.people.find(row => row.actorId === prior.successorId).serviceFromYear, 25);
  }
  assert.equal(active.party.some(row => originals.includes(row.id)), false);
  assert.equal(checkpoint.isValidRunState(active), true);
});
check('transition does not reinterpret old 23-cycle activity or kill existing retirees on the next year', () => {
  const source = fixture('annual-old-cycles', { food: 100 });
  source.lineage.communityStartedDay = 1;
  source.lineage.members.forEach(row => { row.cycle = 23; row.stage = 'elder'; });
  assert.equal(checkpoint.isValidRunState(source), true);
  const active = start(source); const next = year(active);
  assert.ok(next.lineage.members.every(row => row.cycle === 23 && !row.deathRecord));
  assert.deepEqual(bodies(next), bodies(active)); assert.deepEqual(next.founderHistory, active.founderHistory);
  assert.ok(next.calendar.people.every(row => row.observedFromYear === 0 && row.serviceFromYear === 0));
});
check('save/restore and query repetition preserve annual counters, original logs and source input', () => {
  const active = year(start(fixture())); const before = clone(active);
  let restored = JSON.parse(JSON.stringify(active));
  for (let i = 0; i < 3; i++) {
    restored = engine.normalizeState(restored);
    engine.annualSettlementSummary(restored); calendar.annualCalendarSummary(restored);
  }
  assert.equal(checkpoint.isValidRunState(restored), true);
  assert.deepEqual(restored.calendar, before.calendar); assert.deepEqual(restored.log, before.log);
  assert.deepEqual(active, before);
  const next = year(restored); assert.equal(next.calendar.completedYears, 2);
});
check('defined calendar corruption is rejected while calendar-free daily saves remain daily', () => {
  const active = year(start(fixture()));
  for (const mutate of [s => { s.calendar.runId = 'other'; }, s => { s.calendar.completedYears++; },
    s => { s.calendar.lastSettledDay++; }, s => { s.calendar.startedDay = 0; },
    s => { s.calendar.people.push(clone(s.calendar.people[0])); },
    s => { s.calendar.people[0].actorId = 'unregistered-person'; },
    s => { s.calendar.people[0].observedFromYear = s.calendar.completedYears + 1; },
    s => { s.calendar.people[0].serviceUntilYear = s.calendar.completedYears + 1; },
    s => { s.calendar.observedLifetimeYears = 24; }, s => { s.calendar = null; }, s => { s.calendar = undefined; }]) {
    const bad = clone(active); mutate(bad);
    assert.equal(checkpoint.isValidRunState(bad), false);
    assert.throws(() => engine.normalizeState(bad), RangeError);
  }
  const daily = fixture('still-daily'); const before = clone(daily);
  const normalized = engine.normalizeState(daily);
  assert.equal(calendar.isAnnualMode(normalized), false); assert.equal(normalized.calendar, undefined);
  assert.deepEqual(daily, before);
  const next = engine.advanceDay(daily, { rng: () => 0.99 });
  assert.equal(next.day, daily.day + 1); assert.equal(next.calendar, undefined);
});

check('annual transition and yearly feedback suppress personal season changes while keeping era advancement', () => {
  const daily = fixture('annual-feedback');
  const active = start(daily), next = year(active);
  const seasonOptions = (before, after) => ({
    previousSeasonId: engine.civilizationMilestoneRows(before).season.id,
    currentSeasonId: engine.civilizationMilestoneRows(after).season.id,
  });
  assert.notEqual(feedback.primitiveActionFeedback(daily, active, '공동체 연간 운영 전환', seasonOptions(daily, active)).key, 'season');
  assert.notEqual(feedback.primitiveActionFeedback(active, next, '공동체 1년 운영', seasonOptions(active, next)).key, 'season');
  assert.equal(feedback.primitiveActionFeedback(active, next, '공동체 1년 운영', {
    ...seasonOptions(active, next), previousEraId: 'PRIMITIVE', currentEraId: 'NEOLITHIC',
  }).key, 'eraAdvance');
  assert.equal(feedback.primitiveActionFeedback(daily, { ...daily }, '기존 일일 행동', {
    previousSeasonId: 'spring', currentSeasonId: 'summer',
  }).key, 'season');
});

check('annual school spends each teacher and paper once without duplicating scholar research', () => {
  const source = fixture('annual-school', { food: 100 });
  const byId = new Map(engine.TECH_TREE.map(row => [row.id, row]));
  const civicIds = new Set(engine.CIVIC_TREE.map(row => row.id));
  function complete(id) {
    const row = byId.get(id); assert.ok(row, id);
    for (const prior of row.prereqs || []) complete(prior);
    (civicIds.has(id) ? source.civics : source.research).completed[id] = true;
  }
  for (const id of ['PUBLIC_EDUCATION', 'PAPERMAKING']) complete(id);
  for (const id of byId.get('LIBERALISM').prereqs || []) complete(id);
  delete source.civics.completed.LIBERALISM;
  source.civics.selectedCivicId = 'LIBERALISM'; source.civics.progress.LIBERALISM = 0;
  source.inventory = { ...source.inventory, paper: 8, wood: 30, fiber: 30, stone: 20 };
  source.tribe.assignments = Object.fromEntries(engine.TRIBE_JOBS.map(row => [row.id,
    row.id === 'forager' || row.id === 'scholar' ? 4 : 0]));
  const active = start(engine.normalizeState(source));
  const baseline = year(engine.configureTribeEducationAction(active, { teachers: 0 }));
  const next = year(engine.configureTribeEducationAction(active, { teachers: 2 }));
  const receipt = next.tribe.lastProduction.education;
  assert.equal(receipt.teachers, 2); assert.equal(receipt.scholarsAvailable, 4);
  assert.equal(receipt.generalScholars, 2); assert.equal(receipt.appliedPoints, 4);
  assert.equal(receipt.paperBefore - receipt.paperAfter, 2);
  assert.equal(next.inventory.paper, baseline.inventory.paper - 2);
  assert.equal(next.tribe.lastProduction.researchRequested, baseline.tribe.lastProduction.researchRequested - 2);
  assert.deepEqual(bodies(next), bodies(active));
});
check('annual processing spends actual inputs once and stops at the selected stock target', () => {
  const source = fixture('annual-processing', { advanced: true, food: 100 });
  source.inventory = { ...source.inventory, clay: 20, wood: 20 };
  source.tribe.assignments = Object.fromEntries(engine.TRIBE_JOBS.map(row => [row.id,
    row.id === 'forager' || row.id === 'artisan' ? 4 : 0]));
  const active = start(source);
  const baseline = year(active);
  const plan = engine.configureTribeProcessAction(active, { actionId: 'kiln', targetStock: 2 });
  assert.equal(plan.tribe.processingPlan.actionId, 'kiln');
  const next = year(plan), receipt = next.tribe.lastProduction.processing;
  assert.equal(receipt.batches, 1); assert.equal(next.inventory.pottery, 2);
  assert.deepEqual(receipt.gains, { pottery: 2 });
  for (const [id, amount] of Object.entries(receipt.spent)) {
    assert.equal(next.inventory[id], Number(baseline.inventory[id] || 0) - amount);
  }
  assert.deepEqual(bodies(next), bodies(active));
  const second = year(next);
  assert.equal(second.tribe.lastProduction.processing.batches, 0);
  assert.deepEqual(second.tribe.lastProduction.processing.spent, {});
  assert.equal(second.inventory.pottery, 2);
});
check('annual builders commit real project materials and advance construction at most once per year', () => {
  const source = fixture('annual-construction', { advanced: true, food: 100 });
  source.inventory = Object.fromEntries(Object.keys(data.ITEMS).map(id => [id, 100]));
  source.tribe.assignments = Object.fromEntries(engine.TRIBE_JOBS.map(row => [row.id,
    row.id === 'forager' ? 6 : row.id === 'builder' ? 2 : 0]));
  const active = start(source);
  const project = engine.projectRows(active).find(row => row.available && !row.completed && row.work > 2);
  assert.ok(project, 'controlled unlocked inputs offer an actual construction project');
  const selected = engine.selectProjectAction(active, project.id);
  const next = year(selected);
  assert.equal(next.projects.resourceCommitted[project.id], true);
  assert.equal(next.projects.progress[project.id], 2);
  assert.equal(next.tribe.lastProduction.projectWork, 2);
  const gains = next.tribe.lastProduction.gains;
  for (const [id, amount] of Object.entries(project.cost)) {
    assert.equal(next.inventory[id], active.inventory[id] + Number(gains[id] || 0) - amount
      - (id === 'berry' ? next.tribe.lastProduction.foodProvided : 0));
  }
  const second = year(next);
  assert.equal(second.projects.progress[project.id], Math.min(project.work, 4));
  assert.equal(second.tribe.lastProduction.projectStarted, false);
});

check('annual miners supply the metal chain from zero ore while locked and daily production stay unchanged', () => {
  const source = fixture('annual-mining-supply', { advanced: true, food: 100 });
  source.inventory = { berry: 100, wood: 10, metal_ore: 0 };
  source.tribe.assignments = Object.fromEntries(engine.TRIBE_JOBS.map(row => [row.id,
    row.id === 'forager' ? 4 : row.id === 'miner' || row.id === 'artisan' ? 2 : 0]));
  assert.equal(Number(engine.tribeSummary(source).nextProduction.metal_ore || 0), 0);
  const active = start(source);
  const before = clone(active), plan = engine.annualSettlementSummary(active).plan;
  assert.equal(plan.production.metal_ore, 2); assert.deepEqual(active, before);
  const selected = engine.configureTribeProcessAction(active, { actionId: 'smelt', targetStock: 1 });
  const next = year(selected);
  assert.equal(next.tribe.lastProduction.gains.metal_ore, 2);
  assert.equal(next.tribe.lastProduction.processing.spent.metal_ore, 2);
  assert.equal(next.inventory.metal_ore, 0); assert.equal(next.inventory.metal_ingot, 1);
  assert.deepEqual(bodies(next), bodies(active));
  const locked = clone(source); delete locked.research.completed.MINING;
  const noMine = year(start(locked));
  assert.equal(Number(noMine.tribe.lastProduction.gains.metal_ore || 0), 0);
  assert.equal(Number(noMine.inventory.metal_ore || 0), 0);
});

check('seventy real annual operations carry two prepared generations and preserve the founders actual sixty-year deaths', () => {
  let active = start(fixture('annual-multiple-generations', { food: 2000 }));
  const founders = active.party.map(actor => actor.id);
  const initialCycle = Object.fromEntries(active.lineage.members.map(member => [member.actorId, member.cycle]));
  for (let i = 0; i < 20; i++) active = year(active);
  for (const id of founders) active = engine.prepareSuccessorAction(active, id);
  for (let i = 20; i < 45; i++) active = year(active);
  const firstSuccessors = active.party.map(actor => actor.id);
  assert.ok(firstSuccessors.every(id => !founders.includes(id)));
  for (const id of firstSuccessors) active = engine.prepareSuccessorAction(active, id);
  for (let i = 45; i < 60; i++) active = year(active);
  const deaths = Object.fromEntries(founders.map(id => [id,
    clone(active.founderHistory.members.find(member => member.actorId === id).deathRecord)]));
  for (const id of founders) {
    assert.equal(deaths[id].source, 'natural');
    assert.equal(deaths[id].day, active.calendar.startedDay + 60);
    assert.equal(active.lineage.members.find(member => member.actorId === id).cycle, initialCycle[id]);
    assert.equal(calendar.annualPersonSummary(active, id).observedYears, 60);
  }
  for (let i = 60; i < 70; i++) active = year(active);
  assert.equal(active.calendar.completedYears, 70); assert.equal(active.ended, false);
  assert.equal(active.party.filter(actor => actor.hp > 0).length, founders.length);
  assert.ok(active.party.every(actor => !founders.includes(actor.id) && !firstSuccessors.includes(actor.id)));
  for (const id of founders) {
    assert.deepEqual(active.founderHistory.members.find(member => member.actorId === id).deathRecord, deaths[id]);
    assert.equal(calendar.annualPersonSummary(active, id).observedYears, 60);
    assert.equal(active.lineage.transitions.filter(event => event.actorId === id && event.kind === 'death').length, 1);
  }
});

Math.random = originalRandom;
console.log(`ANNUAL_OPERATION_CHECKS ${passed}/${passed + failures.length} passed; fresh controlled public API inputs only; no browser or human acceptance`);
if (failures.length) process.exitCode = 1;
