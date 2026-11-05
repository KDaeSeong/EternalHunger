import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';

const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const checkpoint = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCheckpoint.js');
const clone = value => structuredClone(value);
const jobs = values => Object.fromEntries(engine.TRIBE_JOBS.map(job => [job.id, values[job.id] || 0]));
const stamp = state => ({ runId: state.runId, day: state.day, ap: state.ap, updatedAt: state.updatedAt });
const seeds = [0x12345678, 0x80000000, 0xcafef00d];

function randomStream(seed) {
  let value = seed >>> 0;
  const draws = [];
  const rng = () => {
    value = (Math.imul(1664525, value) + 1013904223) >>> 0;
    const result = value / 0x100000000;
    draws.push(result);
    return result;
  };
  return { rng, draws };
}

// Track implicit normalization draws separately from the supplied simulation RNG.
function reproducible(run, seed = seeds[0]) {
  const supplied = randomStream(seed);
  const ambient = randomStream(seed ^ 0xa5a5a5a5);
  const originalRandom = Math.random;
  Math.random = ambient.rng;
  try { return { state: run(supplied.rng), supplied: supplied.draws, ambient: ambient.draws }; }
  finally { Math.random = originalRandom; }
}

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}

function fresh(runId = 'settlement-day-check') {
  const state = reproducible(rng => engine.createNewState({
    runId, now: '2026-11-05T00:00:00.000Z', rng,
  })).state;
  state.research.completed = { ...state.research.completed, GATHERING: true, HUNTING: true,
    SETTLEMENT: true, FOOD_STORAGE: true };
  state.camp = { ...state.camp, shelterLevel: 3, workbenchLevel: 1, fireLevel: 1, fuel: 20 };
  state.inventory = { ...state.inventory, berry: 100, wood: 30, fiber: 20, stone: 20 };
  state.weather = { id: 'clear', name: '검사 맑음', cold: 0, temp: 20, actionMod: 0 };
  return state;
}

function semantic(state) {
  const result = clone(state);
  // Wall-clock log metadata is the only non-semantic field excluded.
  delete result.updatedAt;
  return result;
}

function boundaryMatches(state, seed = seeds[0]) {
  const before = clone(state);
  freeze(state);
  const actual = reproducible(rng => engine.runSettlementDayAction(state, stamp(state), { rng }), seed);
  const expected = reproducible(rng => engine.advanceDay({ ...clone(before), ap: 0 }, { rng }), seed);
  assert.deepEqual(state, before, 'The input, including its old receipt, must remain immutable.');
  assert.equal(actual.state.day, before.day + 1, 'Exactly one day boundary must settle.');
  assert.deepEqual(actual.supplied, expected.supplied, 'Simulation draw values and count must match the real boundary.');
  assert.deepEqual(actual.ambient, expected.ambient, 'Implicit normalization draw values and count must also match.');
  assert.ok(actual.supplied.length > 0, 'The real boundary must consume the weather RNG.');
  const actualSemantic = semantic(actual.state);
  const notice = `Day ${before.day}: 정착 운영으로 하루 진행: 남은 개인 AP ${before.ap} 포기. 개인 행동 없이 실제 비축으로 밤을 정산합니다.`;
  assert.equal(actualSemantic.log.filter(line => line === notice).length, 1);
  actualSemantic.log = actualSemantic.log.filter(line => line !== notice);
  assert.deepEqual(actualSemantic, semantic(expected.state), 'Compare every persisted gameplay field and all existing boundary logs.');
  assert.equal(actual.state.tribe.productionSerial, Number(before.tribe.productionSerial || 0) + 1);
  assert.equal(actual.state.tribe.lastProduction.day, actual.state.day);
  return actual.state;
}

const results = [];
function check(name, run) {
  try { run(); results.push({ name, pass: true }); console.log(`PASS ${name}`); }
  catch (error) {
    results.push({ name, pass: false, error: String(error.message).slice(0, 1000) });
    console.error(`FAIL ${name}: ${String(error.message).slice(0, 1000)}`);
  }
}

check('stocked settlement matches every real boundary field, log and RNG draw across fresh seeds', () => {
  const stream = randomStream(seeds[0]);
  assert.notEqual(stream.rng(), stream.rng(), 'The seeded generator must not be constant.');
  const weather = new Set(seeds.map(seed => boundaryMatches(fresh(), seed).weather.id));
  assert.ok(weather.size > 1, 'The seed matrix must exercise distinct real weather outcomes.');
});

check('empty evening stock cannot borrow morning food or fuel and retains real night deaths', () => {
  const state = fresh();
  state.inventory = {};
  state.camp.fuel = 0;
  state.weather = { id: 'snow', name: '눈', temp: -8, cold: 12, actionMod: 0 };
  state.party = state.party.map(member => ({ ...member, hunger: 98, hp: 2, bodyTemp: 30 }));
  state.tribe.assignments = jobs({ forager: state.tribe.population });
  state.tribe.autoAssignments = jobs({});
  const next = boundaryMatches(state);
  assert.ok(next.party.every(member => member.hp === 0 && member.deathRecord?.source === 'night'));
  assert.equal(next.ended, true);
  assert.ok(next.tribe.lastProduction.gains.berry > 0, 'Morning food must actually exist after the fatal night.');
  assert.ok(next.inventory.wood > 0, 'Morning wood cannot retroactively heat the night.');
  assert.equal(next.camp.fuel, 0);
  assert.equal(next.counters.meals, state.counters.meals, 'No unstocked evening meals may be invented.');
});

check('scholar receipt records requested RP separately from the one-RP capped application', () => {
  const state = fresh();
  const tech = engine.TECHNOLOGY_TREE.find(row => row.id === 'CORDAGE');
  state.research.selectedTechId = tech.id;
  state.research.progress[tech.id] = tech.cost - 1;
  state.tribe.assignments = jobs({ scholar: 2, forager: state.tribe.population - 2 });
  state.tribe.autoAssignments = jobs({});
  const next = boundaryMatches(state);
  assert.equal(next.tribe.lastProduction.researchRequested, 2);
  assert.equal(next.tribe.lastProduction.researchPoints, 1);
  assert.equal(next.research.progress[tech.id], tech.cost);
  assert.equal(next.research.completed[tech.id], true);
});

check('prepared succession ticks once at the actual cycle boundary', () => {
  let state = fresh();
  state = reproducible(rng => engine.prepareSuccessorAction(state, state.party[0].id, { rng })).state;
  assert.equal(state.lineage.prepared.length, 1);
  const actorId = state.party[0].id;
  state.lineage.communityStartedDay = 1;
  state.lineage.members[0].cycle = 17;
  const next = boundaryMatches(state);
  const predecessor = next.lineage.members.find(member => member.actorId === actorId);
  assert.ok(predecessor.successorId);
  assert.equal(next.party[0].id, predecessor.successorId);
  assert.equal(next.lineage.lastTickDay, next.day);
});

check('legacy saves normalize missing optional records without retroactive lineage', () => {
  const raw = fresh();
  delete raw.lineage; delete raw.ancestralFaith; delete raw.projectTradition;
  delete raw.tribe.autoAssignments; delete raw.tribe.workPolicy;
  const state = reproducible(() => engine.normalizeState(raw)).state;
  const next = boundaryMatches(state);
  assert.equal(next.lineage.mode, 'legacy');
  assert.deepEqual(next.lineage.members, []);
  assert.equal(next.ancestralFaith.origin, 'legacy_disabled');
  const restored = reproducible(() => engine.normalizeState(clone(next))).state;
  assert.deepEqual(semantic(restored), semantic(next));
});

check('a real failed hunt may kill the selected actor while surviving community operation remains legal', () => {
  let state = fresh();
  const actorId = state.party[0].id;
  state.party[0].hp = 1;
  state = reproducible(rng => engine.runHuntAction(state, actorId, 'plains', {
    rng: () => 0.98 + rng() * 0.019,
  })).state;
  assert.equal(state.party.find(member => member.id === actorId).hp, 0);
  assert.equal(state.party.find(member => member.id === actorId).deathRecord?.source, 'action');
  assert.match(state.party.find(member => member.id === actorId).deathRecord?.reason, /사냥 반격/);
  assert.ok(state.party.some(member => member.hp > 0));
  assert.equal(engine.settlementDayStatus(state).enabled, true);
  const next = boundaryMatches(state);
  assert.equal(next.party.find(member => member.id === actorId).hp, 0);
});

check('all settlement gates reject without mutation, either RNG stream or receipt replacement', () => {
  for (const change of [
    state => { state.research.completed.SETTLEMENT = false; },
    state => { state.research.completed.FOOD_STORAGE = false; },
    state => { state.camp.shelterLevel = 0; },
    state => { state.tribe.population = 0; },
    state => { state.tribe.morale = 0; },
    state => { state.ended = true; },
    state => { state.ap = 0; }, state => { state.ap = -1; }, state => { state.ap = NaN; },
    state => { state.party = state.party.map(member => ({ ...member, hp: 0 })); },
  ]) {
    const state = fresh(); change(state); const before = clone(state); freeze(state);
    const status = engine.settlementDayStatus(state);
    assert.equal(status.enabled, false); assert.ok(status.reason);
    const result = reproducible(rng => engine.runSettlementDayAction(state, stamp(state), { rng }));
    assert.equal(result.state, state); assert.deepEqual(state, before);
    assert.deepEqual(result.supplied, []); assert.deepEqual(result.ambient, []);
  }
});

check('missing or stale run/day/AP/update stamps and double invocation reject without draws', () => {
  const state = fresh(); const token = stamp(state);
  const next = boundaryMatches(state);
  const inputs = [[next, token], [state, undefined], [state, null], [state, {}],
    ...Object.keys(token).map(key => [state, { ...token,
      [key]: key === 'day' || key === 'ap' ? token[key] + 1 : 'stale',
    }])];
  for (const [current, stale] of inputs) {
    const before = clone(current); freeze(current);
    const result = reproducible(rng => engine.runSettlementDayAction(current, stale, { rng }));
    assert.equal(result.state, current); assert.deepEqual(current, before);
    assert.deepEqual(result.supplied, []); assert.deepEqual(result.ambient, []);
  }
});

check('one remaining AP and full AP both forfeit personal turns with the same one-day settlement', () => {
  const outputs = [1, fresh().apMax].map(ap => {
    const state = fresh(); state.ap = ap;
    const next = boundaryMatches(state);
    assert.equal(next.ap, state.apMax);
    assert.deepEqual(next.founderHistory, state.founderHistory, 'No personal deed is awarded.');
    return semantic(next);
  });
  for (const result of outputs) result.log = result.log.filter(line => !line.includes('정착 운영으로 하루 진행:'));
  assert.deepEqual(outputs[0], outputs[1], 'Discarded personal AP must not turn into RP, CP, work or actions.');
});

function policyFixture(policyId) {
  const state = fresh();
  state.tribe.population = 6;
  state.tribe.assignments = jobs({}); state.tribe.autoAssignments = jobs({});
  state.research.completed.WRITING = true;
  state.research.completed.STATE_WORKFORCE = true;
  state.civics.completed.STATE_WORKFORCE = true;
  state.research.selectedTechId = 'STONE_TOOLS';
  return engine.changeTribeWorkPolicyAction(state, policyId);
}

check('balanced, construction and research policies perform real distinct work and preserve production receipts', () => {
  const resultsByPolicy = {};
  for (const policyId of ['balanced', 'construction', 'research']) {
    const state = policyFixture(policyId);
    const oldReceipt = state.tribe.lastProduction;
    const oldReceiptCopy = clone(oldReceipt);
    const selectedTech = state.research.selectedTechId;
    const selectedCivic = engine.civicRows(state).find(row => row.available && !row.completed);
    assert.ok(selectedCivic, 'The fixture must include an active civic.');
    state.civics.selectedCivicId = selectedCivic.id;
    const next = boundaryMatches(state);
    const receipt = next.tribe.lastProduction;
    resultsByPolicy[policyId] = next;
    assert.notEqual(receipt, oldReceipt);
    assert.deepEqual(oldReceipt, oldReceiptCopy, 'Previous-day receipt must never be rewritten.');
    assert.equal(receipt.workPolicy, policyId);
    assert.deepEqual(receipt.assignments, next.tribe.assignments);
    assert.notEqual(receipt.assignments, next.tribe.assignments, 'Receipt assignments must be a historical snapshot.');
    assert.equal(Object.values(receipt.assignments).reduce((sum, count) => sum + count, 0), 6);
    assert.equal(receipt.shortage, 0);
    assert.ok(Number(next.research.progress[selectedTech]) > Number(state.research.progress[selectedTech] || 0));
    assert.ok(Number(next.civics.progress[selectedCivic.id]) > Number(state.civics.progress[selectedCivic.id] || 0));
    assert.deepEqual(next.founderHistory, state.founderHistory, 'Daily jobs do not fabricate personal contributions.');
  }
  assert.equal(resultsByPolicy.balanced.tribe.lastProduction.projectWork, 2);
  assert.equal(resultsByPolicy.balanced.tribe.lastProduction.researchPoints, 1);
  assert.equal(resultsByPolicy.construction.tribe.lastProduction.projectWork, 5);
  assert.equal(resultsByPolicy.construction.projects.completed['drying-rack'], true);
  assert.equal(resultsByPolicy.construction.inventory.jerky, 1);
  assert.equal(resultsByPolicy.research.tribe.lastProduction.projectWork, 0);
  assert.equal(resultsByPolicy.research.tribe.lastProduction.researchPoints, 6);
});

check('manual jobs stay fixed under every policy while a new receipt records their paid work', () => {
  for (const policyId of ['balanced', 'construction', 'research']) {
    const state = policyFixture(policyId);
    state.tribe.assignments = jobs({ forager: 2, builder: 2, scholar: 2 });
    state.tribe.autoAssignments = jobs({});
    const next = boundaryMatches(state);
    assert.deepEqual(next.tribe.assignments, state.tribe.assignments);
    assert.deepEqual(next.tribe.autoAssignments, jobs({}));
    assert.equal(next.tribe.lastProduction.projectWork, 2);
    assert.equal(next.tribe.lastProduction.researchRequested, 2);
    assert.equal(next.tribe.lastProduction.researchPoints, 2);
    assert.equal(next.tribe.lastProduction.projectStarted, true);
    assert.equal(next.projects.resourceCommitted['drying-rack'], true);
    assert.equal(next.inventory.wood, state.inventory.wood + next.tribe.lastProduction.gains.wood - 3);
    assert.equal(next.inventory.fiber, state.inventory.fiber + next.tribe.lastProduction.gains.fiber - 2);
  }
});

check('a retained prior morning receipt stays immutable across the following real settlement', () => {
  const first = boundaryMatches(policyFixture('research'));
  const receipt = first.tribe.lastProduction; const before = clone(receipt);
  const second = boundaryMatches(first, seeds[1]);
  assert.deepEqual(receipt, before);
  assert.equal(receipt.day, first.day);
  assert.equal(second.tribe.lastProduction.day, first.day + 1);
  assert.equal(second.tribe.productionSerial, first.tribe.productionSerial + 1);
  assert.notEqual(second.tribe.lastProduction, receipt);
});

check('actual settlement checkpoint restores current semantics, protects the prior run and rejects stale clicks and writes', () => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
  const owner = 'guest';
  const savedAt = '2026-11-05T00:00:00.000Z';
  const previous = reproducible(() => engine.normalizeState(fresh('settlement-day-previous-run'))).state;
  const previousCopy = clone(previous);
  assert.equal(checkpoint.writeCheckpoint(storage, owner, previous, { expectedRevision: 0, savedAt }).status, 'ready');
  const state = reproducible(() => engine.normalizeState(policyFixture('construction'))).state;
  const capturedBeforeBoundary = stamp(state);
  const next = boundaryMatches(state);
  assert.equal(checkpoint.writeCheckpoint(storage, owner, next, { expectedRevision: 1, savedAt }).status, 'ready');
  const loaded = checkpoint.readCheckpoint(storage, owner);
  assert.equal(loaded.status, 'ready');
  const restored = reproducible(() => engine.normalizeState(loaded.checkpoint.current)).state;
  assert.deepEqual(semantic(restored), semantic(next), 'All current day/AP, inventory, receipt, research, projects and lineage must survive.');
  assert.deepEqual(loaded.checkpoint.previous, previousCopy, 'Writing the new run must retain the prior run.');
  const stale = reproducible(rng => engine.runSettlementDayAction(restored, capturedBeforeBoundary, { rng }));
  assert.equal(stale.state, restored);
  assert.deepEqual(stale.supplied, []); assert.deepEqual(stale.ambient, []);
  const key = checkpoint.checkpointStorageKey(owner);
  const protectedBytes = storage.getItem(key);
  assert.equal(checkpoint.writeCheckpoint(storage, owner, state, { expectedRevision: 1, savedAt }).status, 'conflict');
  assert.equal(storage.getItem(key), protectedBytes, 'A stale writer cannot replace the completed settlement.');
  assert.deepEqual(previous, previousCopy);
});

console.log(JSON.stringify({ groups: results.length, passed: results.filter(result => result.pass).length,
  failures: results.filter(result => !result.pass),
  scope: 'Fresh actual-engine boundary checks; no candidate overlays, frozen baselines, output files, browser or full build.' }));
if (results.some(result => !result.pass)) process.exitCode = 1;
