import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const lifecycle = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveLineage.js');
const founders = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveFounders.js');
const clone = value => JSON.parse(JSON.stringify(value));
const fresh = () => engine.createNewState({ runId: 'lineage-focused', now: '2026-10-30T00:00:00.000Z', rng: () => 0.5 });
function settled() {
  const state = fresh();
  state.research.completed = { ...state.research.completed, SETTLEMENT: true, FOOD_STORAGE: true };
  state.camp = { ...state.camp, fireLevel: 1, shelterLevel: 3, fuel: 100 };
  state.inventory = { ...state.inventory, berry: 100, meat: 100, wood: 100 };
  state.lineage.lastEra = lifecycle.lineageEra(state);
  state.lineage.communityStartedDay = 1;
  return state;
}
const observable = state => {
  const result = clone(state);
  delete result.log;
  delete result.updatedAt;
  return result;
};
let groups = 0;
function check(name, callback) { callback(); groups++; console.log(`PASS ${name}`); }

check('new runs are hybrid, old saves and explicit legacy never retroactively age', () => {
  const state = fresh();
  assert.equal(state.lineage.mode, 'hybrid');
  const later = engine.normalizeState({ ...state, day: 30 });
  assert.equal(later.lineage.members[0].cycle, 0);
  assert.equal(later.lineage.lastTickDay, 1);
  const legacy = clone(state);
  delete legacy.lineage;
  delete legacy.ancestralFaith;
  delete legacy.projectTradition;
  legacy.day = 30;
  const restored = engine.normalizeState(legacy);
  assert.equal(restored.lineage.mode, 'legacy');
  assert.deepEqual(restored.lineage.members, []);
  assert.equal(restored.ancestralFaith.origin, 'legacy_disabled');
  const explicit = engine.createNewState({ lineageMode: 'legacy', rng: () => 0.5 });
  assert.equal(explicit.lineage.mode, 'legacy');
  assert.equal(explicit.ancestralFaith.origin, 'legacy_disabled');
});

check('only real day boundaries tick once; normalization does not tick', () => {
  const state = settled();
  const before = clone(state);
  const next = engine.advanceDay(state, { rng: () => 0.5 });
  assert.deepEqual(state, before);
  assert.equal(next.lineage.members[0].cycle, 1);
  assert.equal(lifecycle.tickLineageDay(next), next);
  assert.equal(engine.normalizeState(clone(next)).lineage.members[0].cycle, 1);
});

check('settlement activities start only after a legal preparation opportunity at a real boundary', () => {
  const state = settled();
  state.lineage.communityStartedDay = 0;
  assert.equal(engine.normalizeState(clone(state)).lineage.communityStartedDay, 0);
  assert.equal(engine.lineageSummary(state).clockStarted, false);
  const next = engine.advanceDay(state, { rng: () => 0.5 });
  assert.equal(next.lineage.communityStartedDay, 2);
  assert.equal(next.lineage.members[0].cycle, 1);
  assert.equal(engine.lineageSummary(next).clockStarted, true);
  assert.match(engine.lineageSummary(next).ruleText, /정착 활동기/);
});

check('missing technology, housing, a spare real worker or actual food cannot start the clock', () => {
  for (const remove of [state => { state.research.completed.FOOD_STORAGE = false; },
    state => { state.camp.shelterLevel = 0; }, state => { state.tribe.population = 1; },
    state => { state.inventory = {}; }]) {
    const state = settled();
    state.lineage.communityStartedDay = 0;
    remove(state);
    const next = engine.advanceDay(state, { rng: () => 0.5 });
    assert.equal(next.lineage.communityStartedDay, 0);
    assert.ok(next.lineage.members.every(member => member.cycle === 0));
    assert.equal(next.ended, false);
  }
});

check('a started clock survives restoration and cannot be paused by destroying its original conditions', () => {
  const state = settled();
  state.lineage.communityStartedDay = 0;
  const started = engine.advanceDay(state, { rng: () => 0.5 });
  const restored = engine.normalizeState(clone(started));
  assert.deepEqual(restored.lineage, started.lineage);
  restored.inventory = {};
  restored.camp.shelterLevel = 0;
  restored.tribe.population = 1;
  restored.research.completed.FOOD_STORAGE = false;
  const next = engine.advanceDay(restored, { rng: () => 0.5 });
  assert.equal(next.lineage.communityStartedDay, started.lineage.communityStartedDay);
  assert.equal(next.lineage.members[0].cycle, started.lineage.members[0].cycle + 1);
  const later = engine.normalizeState({ ...next, day: next.day + 50 });
  assert.deepEqual(later.lineage, next.lineage);
});

check('failed preparations, retirement and rites change only existing log metadata and use no RNG', () => {
  const state = fresh();
  const random = Math.random;
  Math.random = () => { throw new Error('Failed action used RNG'); };
  try {
    for (const result of [engine.prepareSuccessorAction(state, state.party[0].id),
      engine.prepareSuccessorAction(state, 'missing'), engine.retireFounderAction(state, state.party[0].id),
      engine.ancestralRiteAction(state, state.party[0].id, state.party[0].id)]) {
      assert.deepEqual(observable(result), observable(state));
    }
  } finally { Math.random = random; }
});

check('preparation converts one real worker and pays one action without resetting progress', () => {
  const state = settled();
  const before = clone(state);
  const next = engine.prepareSuccessorAction(state, state.party[0].id, { rng: () => 0.5 });
  assert.deepEqual(state, before);
  assert.equal(next.tribe.population, state.tribe.population - 1);
  assert.equal(Object.values(next.tribe.assignments).reduce((a, b) => a + b, 0),
    Object.values(state.tribe.assignments).reduce((a, b) => a + b, 0) - 1);
  assert.equal(next.lineage.prepared.length, 1);
  assert.equal(next.party.length, state.party.length);
  assert.equal(next.ap, state.ap - 1);
  assert.deepEqual(next.inventory, state.inventory);
  assert.deepEqual(next.meta, state.meta);
  assert.deepEqual(next.projects, state.projects);
  const heir = next.lineage.prepared[0].actor;
  assert.ok(!engine.STUDENTS.some(student => student.id === heir.id));
  assert.equal(heir.portrait, '/games/primitive-archive/portraits/placeholder.svg');
  const duplicate = engine.prepareSuccessorAction(next, state.party[0].id, { rng: () => { throw new Error('duplicate'); } });
  assert.deepEqual(observable(duplicate), observable(next));
});

check('safe retirement preserves the living original and transfers actual equipment once', () => {
  const state = settled();
  const id = state.party[0].id;
  const tool = Object.entries(engine.ITEMS).find(([, item]) => item.type === 'equip' && item.slot === 'tool')[0];
  state.equipment[id].tool = tool;
  const prepared = engine.prepareSuccessorAction(state, id, { rng: () => 0.5 });
  const before = clone(prepared);
  const next = engine.retireFounderAction(prepared, id);
  assert.deepEqual(prepared, before);
  const old = next.lineage.members.find(member => member.actorId === id);
  assert.equal(old.stage, 'retired');
  assert.ok(old.retiredSnapshot.hp > 0);
  assert.deepEqual(old.retiredSnapshot, { ...prepared.party[0], equipment: prepared.equipment[id] });
  assert.equal(next.party[0].id, old.successorId);
  assert.equal(next.equipment[old.successorId].tool, tool);
  assert.equal(next.equipment[id], undefined);
  assert.deepEqual(next.inventory, prepared.inventory);
  assert.deepEqual(next.meta, prepared.meta);
  assert.equal(next.ap, prepared.ap);
  assert.equal(next.day, prepared.day);
  assert.equal(founders.founderHistoryRows(next)[0].living, true);
  assert.equal(founders.founderHistoryRows(next)[0].deathRecord, null);
  assert.ok(!engine.recruitablePartyRows(next).some(candidate => candidate.id === id));
  assert.equal(lifecycle.isValidLineage(next.lineage, next), true);
  const observedHeir = next.founderHistory.members.find(member => member.actorId === old.successorId);
  assert.ok(observedHeir);
  assert.equal(observedHeir.isFounder, false);
  assert.equal(observedHeir.firstObservedDay, next.day);
  assert.deepEqual(engine.normalizeState(clone(next)).founderHistory, next.founderHistory);
});

check('prepared people and retirees retain food demand without producing as tribe workers', () => {
  let state = settled();
  const id = state.party[0].id;
  const population = state.tribe.population;
  state = engine.prepareSuccessorAction(state, id, { rng: () => 0.5 });
  assert.equal(state.tribe.population + lifecycle.lineageHousehold(state).count, population);
  state = engine.retireFounderAction(state, id);
  assert.equal(state.tribe.population + lifecycle.lineageHousehold(state).count, population);
  const next = engine.advanceDay(state, { rng: () => 0.5 });
  assert.equal(next.tribe.lastProduction.foodNeed, Math.ceil(population / 4));
  // A later real population increase crosses the ration-group boundary.
  state.tribe.population += 1;
  assert.equal(engine.survivalSupplySummary(state).rationNeed, 2);
  assert.equal(engine.tribeSummary(state).foodNeed, 2);
  assert.equal(engine.advanceDay(state, { rng: () => 0.5 }).tribe.lastProduction.foodNeed, 2);
});

check('age and era triggers require prepared successors and preserve actual continuity', () => {
  let state = settled();
  const id = state.party[0].id;
  state = engine.prepareSuccessorAction(state, id, { rng: () => 0.5 });
  const heirId = state.lineage.prepared[0].actor.id;
  state.lineage.members[0].cycle = 17;
  const next = engine.advanceDay(state, { rng: () => 0.5 });
  assert.equal(next.party[0].id, heirId);
  assert.equal(next.lineage.members[0].stage, 'retired');
  let era = settled();
  era = engine.prepareSuccessorAction(era, era.party[0].id, { rng: () => 0.5 });
  era.lineage.members[0].cycle = 11;
  era.lineage.lastEra = 'PRIMITIVE';
  const transitioned = engine.advanceDay(era, { rng: () => 0.5 });
  assert.equal(transitioned.lineage.members[0].stage, 'retired');
  const unprepared = settled();
  unprepared.lineage.members[0].cycle = 17;
  assert.equal(engine.advanceDay(unprepared, { rng: () => 0.5 }).party[0].id, unprepared.party[0].id);
});

check('natural mortality is an individual game lifecycle event, not starvation or a reward', () => {
  let state = settled();
  const id = state.party[0].id;
  state = engine.prepareSuccessorAction(state, id, { rng: () => 0.5 });
  state = engine.retireFounderAction(state, id);
  state.lineage.members[0].cycle = 23;
  const beforeMeta = clone(state.meta);
  const next = engine.advanceDay(state, { rng: () => 0.5 });
  const old = next.lineage.members.find(member => member.actorId === id);
  assert.equal(old.stage, 'deceased');
  assert.equal(old.retiredSnapshot.hp, 0);
  assert.equal(old.deathRecord.source, 'natural');
  assert.equal(founders.founderHistoryRows(next).find(member => member.actorId === id).deathRecord.source, 'natural');
  assert.deepEqual(next.meta, beforeMeta);
  assert.equal(next.ended, false);
  assert.equal(lifecycle.isValidLineage(next.lineage, next), true);
});

check('unprepared extinction remains failure; prepared inheritance requires a viable community', () => {
  const state = settled();
  state.lineage.members.forEach(member => { member.cycle = 23; });
  const extinct = engine.advanceDay(state, { rng: () => 0.5 });
  assert.equal(extinct.ended, true);
  assert.ok(extinct.party.every(actor => actor.hp === 0));
  let prepared = settled();
  prepared = engine.prepareSuccessorAction(prepared, prepared.party[0].id, { rng: () => 0.5 });
  prepared.lineage.members.forEach(member => { member.cycle = 23; });
  prepared.inventory = {};
  const failed = engine.advanceDay(prepared, { rng: () => 0.5 });
  assert.equal(failed.ended, true);
  assert.equal(failed.lineage.prepared.length, 1);
  assert.ok(failed.party.every(actor => actor.hp === 0));
});

check('actual action deaths synchronize immediately and cannot be recruited or rested back to life', () => {
  const state = fresh();
  state.party[0].hp = 1;
  const dead = engine.runHuntAction(state, state.party[0].id, 'plains', { rng: () => 0.999999 });
  assert.equal(dead.lineage.members[0].stage, 'deceased');
  assert.equal(dead.lineage.members[0].deathRecord.source, 'action');
  assert.equal(engine.runRestAction(dead, dead.party[0].id).party[0].hp, 0);
  assert.equal(engine.runEatAction(dead, dead.party[0].id).party[0].hp, 0);
  assert.equal(engine.recruitPartyMemberAction(dead, dead.party[0].id).party[0].hp, 0);
});

check('utility treatment rejects dead or missing actors without costs while living injuries still recover', () => {
  const state = fresh();
  state.party[0].hp = 1;
  const dead = engine.runHuntAction(state, state.party[0].id, 'plains', { rng: () => 0.999999 });
  dead.research.completed.MEDICAL_CORPUS = true;
  dead.inventory.herb = 2;
  dead.founderHistory.members[0].tallies.recovery = 3;
  dead.ancestralFaith = { ...dead.ancestralFaith, lastRiteDay: dead.day,
    lastRiteFounderId: dead.party[0].id,
    active: { founderId: dead.party[0].id, domain: 'care', day: dead.day, remaining: 2 } };
  const before = clone(dead);
  const rejectedStates = [];
  const random = Math.random;
  Math.random = () => { throw new Error('Invalid treatment used global RNG'); };
  try {
    for (const actorId of [dead.party[0].id, 'missing']) {
      const rejected = engine.runUtilityAction(dead, actorId, 'treatment', {
        rng: () => { throw new Error('Invalid treatment used RNG'); },
      });
      assert.deepEqual(observable(rejected), observable(before));
      assert.equal(lifecycle.isValidLineage(rejected.lineage, rejected), true);
      rejectedStates.push(rejected);
    }
  } finally { Math.random = random; }
  for (const rejected of rejectedStates) assert.doesNotThrow(() => engine.normalizeState(rejected));
  assert.deepEqual(dead, before);
  const livingId = dead.party[1].id;
  dead.party[1].hp = 50;
  const treated = engine.runUtilityAction(dead, livingId, 'treatment', { rng: () => 0.5 });
  assert.equal(treated.party[1].hp, 74);
  assert.equal(treated.inventory.herb, dead.inventory.herb - 1);
  assert.equal(treated.ap, dead.ap - 1);
  assert.deepEqual(treated.ancestralFaith, dead.ancestralFaith);
  assert.equal(lifecycle.isValidLineage(treated.lineage, treated), true);
});

check('automatic operation uses paid preparation and actual day-boundary inheritance', () => {
  const state = settled();
  state.lineage.members[0].cycle = 12;
  const prepared = engine.runAutoDayAction(state, { rng: () => 0.5 });
  assert.ok(prepared.lineage.prepared.some(item => item.mentorId === state.party[0].id));
  assert.ok(prepared.tribe.population < state.tribe.population);
  prepared.lineage.members[0].cycle = 17;
  const next = engine.runAutoDayAction(prepared, { rng: () => 0.5 });
  assert.equal(next.lineage.members[0].stage, 'retired');
  assert.ok(!next.party.some(actor => actor.id === state.party[0].id));
});

check('automatic succession cannot spend the last emergency survival action first', () => {
  for (const emergency of ['hunger', 'injury', 'cold']) {
    const state = settled();
    state.ap = 1;
    state.lineage.members[0].cycle = 12;
    if (emergency === 'hunger') state.party[0].hunger = 100;
    if (emergency === 'injury') { state.party[0].hp = 10; state.inventory.herb_tonic = 1; }
    if (emergency === 'cold') {
      state.party[0].bodyTemp = 30;
      state.camp.fuel = 0;
      state.weather = { id: 'snow', name: '검사 한파', temp: -30, actionMod: 0, cold: 18 };
    }
    const next = engine.runAutoDayAction(state, { rng: () => 0.5 });
    assert.equal(next.lineage.prepared.length, 0, emergency);
    assert.equal(next.lineage.serial, 0, emergency);
  }
});

check('saved lineage round-trips and rejects broken actor/snapshot/successor references', () => {
  let state = settled();
  state = engine.prepareSuccessorAction(state, state.party[0].id, { rng: () => 0.5 });
  state = engine.retireFounderAction(state, state.party[0].id);
  assert.deepEqual(engine.normalizeState(clone(state)).lineage, state.lineage);
  assert.deepEqual(engine.normalizeState(clone(state)).founderHistory, state.founderHistory);
  for (const mutate of [raw => { raw.members[0].retiredSnapshot = null; },
    raw => { raw.members[0].successorId = 'missing'; },
    raw => { raw.members[1].stage = 'deceased'; },
    raw => { raw.members[1].actorId = 'missing'; }]) {
    const raw = clone(state.lineage);
    mutate(raw);
    assert.equal(lifecycle.isValidLineage(raw, state), false);
    assert.throws(() => engine.normalizeState({ ...state, lineage: raw }), RangeError);
  }
});

check('serial provenance cannot issue a duplicate successor or lose integer precision', () => {
  let state = settled();
  state = engine.prepareSuccessorAction(state, state.party[0].id, { rng: () => 0.5 });
  const stale = clone(state.lineage);
  stale.serial = 0;
  assert.equal(lifecycle.isValidLineage(stale, state), false);
  const unsafe = clone(state.lineage);
  unsafe.serial = Number.MAX_SAFE_INTEGER + 1;
  assert.equal(lifecycle.isValidLineage(unsafe, state), false);
});

check('the shared record cap rejects new preparation and recruitment before changing party', () => {
  let state = settled();
  state = engine.prepareSuccessorAction(state, state.party[0].id, { rng: () => 0.5 });
  state = engine.retireFounderAction(state, state.party[0].id);
  while (state.lineage.members.length < lifecycle.LINEAGE_RULES.memberLimit) {
    const id = `capacity-fixture-${state.lineage.members.length}`;
    const death = { day: 1, source: 'natural', reason: '검사 입력의 생애 종료', hpBefore: 100,
      damage: 0, hungerDamage: 0, coldDamage: 0, hypothermiaDamage: 0 };
    state.lineage.members.push({ actorId: id, founderId: id, generation: 0, enteredDay: 1,
      cycle: 24, stage: 'deceased', successorId: '', deathRecord: death,
      retiredSnapshot: { id, name: '정원 검사 인물', hp: 0, deathRecord: death } });
  }
  assert.equal(lifecycle.isValidLineage(state.lineage, state), true);
  assert.ok(engine.recruitablePartyRows(state).every(candidate => !candidate.canRecruit));
  const recruit = engine.recruitablePartyRows(state)[0];
  assert.ok(recruit);
  const rejected = engine.recruitPartyMemberAction(state, recruit.id);
  assert.equal(rejected.party.length, state.party.length);
  assert.equal(rejected.lineage.members.length, lifecycle.LINEAGE_RULES.memberLimit);
  assert.equal(engine.prepareSuccessorAction(state, state.party[0].id).lineage.prepared.length, 0);
});

console.log(`Lineage: ${groups} focused groups passed.`);
