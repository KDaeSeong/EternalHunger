import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');

const failures = [];
let checks = 0;
function check(name, run) {
  checks += 1;
  try {
    run();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({ name, message: error.message.split('\n')[0] });
    console.error(`FAIL ${name}: ${error.message.split('\n')[0]}`);
  }
}

function fixture(runId) {
  const state = engine.createNewState({ runId, now: '2026-10-24T00:00:00.000Z', rng: () => 0.5 });
  state.camp = { ...state.camp, fireLevel: 1, shelterLevel: 1, workbenchLevel: 1 };
  state.inventory = { ...state.inventory, wood: 30, stone: 30, fiber: 30, hide: 30, berry: 20 };
  Object.assign(state.research.completed, { GATHERING: true, HUNTING: true, FIREMAKING: true, SETTLEMENT: true });
  return engine.normalizeState(state);
}

function withoutLog(state) {
  const gameplay = structuredClone(state);
  delete gameplay.log;
  delete gameplay.updatedAt;
  return gameplay;
}

check('ended runs cannot recruit or change their score and record classification', () => {
  for (const victory of [false, true]) {
    const state = fixture(`ended-recruit-${victory}`);
    state.ended = true;
    state.victory = victory;
    if (!victory) state.party = state.party.map((member) => ({ ...member, hp: 0 }));
    assert.ok(state.party.length < engine.getPartyCap(state), 'Fixture needs an unused party slot.');
    const before = structuredClone(state);
    const candidate = engine.recruitablePartyRows(state)[0];
    assert.ok(candidate, 'A candidate must exist even when recruitment is unavailable.');
    assert.equal(candidate.canRecruit, false, 'Ended-run candidate must not be recruitable.');
    const next = engine.recruitPartyMemberAction(state, candidate.id);
    assert.deepEqual(withoutLog(next), withoutLog(before));
    assert.equal(engine.scoreState(next), engine.scoreState(before));
    assert.deepEqual(engine.runRecordStatus(next), engine.runRecordStatus(before));
    assert.deepEqual(state, before, 'Denied recruitment must not mutate its input.');
  }
});

check('live runs can still recruit once and still enforce the party cap', () => {
  const state = fixture('live-recruit');
  const candidate = engine.recruitablePartyRows(state).find((row) => row.canRecruit);
  assert.ok(candidate);
  const joined = engine.recruitPartyMemberAction(state, candidate.id);
  assert.equal(joined.party.length, state.party.length + 1);
  assert.equal(joined.ap, state.ap, 'Recruitment must retain its existing free-action rule.');
  assert.equal(joined.party.at(-1).hp, 100);
  const duplicate = engine.recruitPartyMemberAction(joined, candidate.id);
  assert.equal(duplicate.party.length, joined.party.length);
  assert.ok(engine.recruitablePartyRows(joined).every((row) => !row.canRecruit));
});

check('dead and missing actors cannot spend AP or progress research, civics or projects', () => {
  const base = fixture('manual-development-dead-actor');
  base.party[0].hp = 0;
  const research = engine.techRows(base).find((row) => row.available && !row.completed);
  const civic = engine.civicRows(base).find((row) => row.available && !row.completed);
  const project = engine.projectRows(base).find((row) => row.canWork);
  assert.ok(research && civic && project, 'Fixture must open all three paid development actions.');
  const state = engine.selectCivicAction(engine.selectTechAction(base, research.id), civic.id);
  for (const actorId of [state.party[0].id, 'missing-actor']) {
    for (const [name, action] of [
      ['research', (rng) => engine.runResearchAction(state, actorId, { rng })],
      ['civics', (rng) => engine.runCivicAction(state, actorId, { rng })],
      ['project', (rng) => engine.runProjectAction(state, actorId, project.id, { rng })],
    ]) {
      const before = structuredClone(state);
      let draws = 0;
      const next = action(() => { draws += 1; return 0.5; });
      assert.equal(draws, 0, `${name}: a rejected actor must not draw action RNG.`);
      assert.deepEqual(withoutLog(next), withoutLog(before), `${name}: rejected actor changed gameplay.`);
      assert.deepEqual(state, before, `${name}: rejected actor mutated the input.`);
    }
  }
});

check('living actors can still perform each paid development action', () => {
  const state = fixture('manual-development-living-actor');
  const actorId = state.party[0].id;
  const research = engine.techRows(state).find((row) => row.available && !row.completed);
  const civic = engine.civicRows(state).find((row) => row.available && !row.completed);
  const project = engine.projectRows(state).find((row) => row.canWork);
  assert.ok(research && civic && project);
  const prepared = engine.selectCivicAction(engine.selectTechAction(state, research.id), civic.id);
  for (const next of [
    engine.runResearchAction(prepared, actorId, { rng: () => 0.5 }),
    engine.runCivicAction(prepared, actorId, { rng: () => 0.5 }),
    engine.runProjectAction(prepared, actorId, project.id, { rng: () => 0.5 }),
  ]) assert.equal(next.ap, prepared.ap - 1);
});

check('automatic operation still uses living companions when the first companion has died', () => {
  const state = fixture('auto-with-dead-first-companion');
  state.party[0].hp = 0;
  const next = engine.runAutoDayAction(state, { rng: () => 0.5 });
  assert.equal(next.day, state.day + 1);
  assert.equal(next.party[0].hp, 0, 'Automatic operation must not revive a dead companion.');
  assert.ok(next.party.slice(1).some((member) => member.hp > 0));
});

check('a living one-HP companion is not defeated by rounded party averages', () => {
  const state = fixture('last-survivor-one-hp');
  state.party = state.party.map((member, index) => ({ ...member, hp: index === 0 ? 1 : 0 }));
  assert.equal(engine.averageParty(state, 'hp'), 0, 'The fixture must reproduce the misleading rounded average.');
  assert.equal(engine.hasLivingPartyMember(state), true);
  const rested = engine.runRestAction(state, state.party[0].id, { rng: () => 0.5 });
  assert.ok(rested.party[0].hp > 1);
  assert.equal(rested.ap, state.ap - 1);
  assert.equal(engine.hasLivingPartyMember({ ...state, party: state.party.map((member) => ({ ...member, hp: 0 })) }), false);
});

check('ended equipment changes preserve score, settled rewards and item ownership', () => {
  const base = fixture('ended-equipment-guards');
  base.inventory.hide_coat = 1;
  const equipped = engine.setEquipmentSlotAction(base, base.party[0].id, 'top', 'hide_coat');
  for (const source of [base, equipped]) {
    for (const outcome of ['settled', 'failed', 'clear']) {
      const state = engine.settleRunAction(source);
      state.victory = outcome === 'clear';
      if (outcome === 'failed') state.party = state.party.map((member) => ({ ...member, hp: 0 }));
      const before = structuredClone(state);
      for (const next of [
        engine.setEquipmentSlotAction(state, state.party[0].id, 'top', source === base ? 'hide_coat' : ''),
        engine.autoEquipAction(state, 'role'),
        engine.autoEquipAction(state, 'weather'),
        engine.clearAllEquipmentAction(state),
      ]) {
        assert.deepEqual(withoutLog(next), withoutLog(before));
        assert.equal(engine.scoreState(next), engine.scoreState(before));
        assert.deepEqual(engine.runRecordStatus(next), engine.runRecordStatus(before));
      }
      assert.deepEqual(state, before);
    }
  }
});

check('ended workforce changes preserve the complete terminal snapshot and classification', () => {
  for (const outcome of ['settled', 'failed', 'clear']) {
    let state = fixture(`ended-workforce-${outcome}`);
    state.tribe.population = 4;
    state.tribe.assignments.forager = 1;
    state.tribe.assignments.hunter = 1;
    state.tribe.autoAssignments.forager = 1;
    if (outcome === 'failed') {
      state = { ...state, ended: true, party: state.party.map((member) => ({ ...member, hp: 0 })) };
    } else if (outcome === 'clear') {
      state.day = engine.ARCHIVE_VICTORY_DAY;
      state.camp = { ...state.camp, archiveRoomLevel: 1, scribeDeskLevel: 1, libraryShelfLevel: 1 };
      state.inventory = { ...state.inventory, book_craft_guide: 1, book_camp_manual: 1 };
      state.research.completed = Object.fromEntries(engine.TECH_TREE.map((row) => [row.id, true]));
      state.civics.completed = Object.fromEntries(engine.CIVIC_TREE.map((row) => [row.id, true]));
      assert.equal(engine.archiveVictorySummary(state).canComplete, true);
      state = engine.completeArchiveAction(state);
      assert.equal(state.victory, true, 'The completed fixture must use the real archive-ending path.');
    } else {
      state = engine.settleRunAction(state);
    }
    state = engine.normalizeState(state);
    const before = structuredClone(state);
    for (const jobId of ['forager', 'hunter', 'logger']) {
      for (const delta of [-1, 1]) {
        const next = engine.adjustTribeJobAction(state, jobId, delta);
        assert.deepEqual(next, before, `${outcome}: ${jobId} ${delta} changed an ended run.`);
        assert.equal(engine.scoreState(next), engine.scoreState(before));
        assert.deepEqual(engine.runRecordStatus(next), engine.runRecordStatus(before));
      }
    }
    assert.ok(engine.tribeSummary(state).jobs.every((job) => !job.canAdd && !job.canRemove));
    assert.deepEqual(state, before, 'Denied workforce edits must not mutate their input.');
  }
});

check('active workforce editing stays free and transfers only the edited job to manual control', () => {
  const state = fixture('active-workforce-control');
  state.ap = 0;
  state.tribe.population = 4;
  state.tribe.assignments.forager = 1;
  state.tribe.assignments.hunter = 1;
  state.tribe.autoAssignments.forager = 1;
  state.tribe.autoAssignments.hunter = 1;
  const before = structuredClone(state);
  const added = engine.adjustTribeJobAction(state, 'forager', 1);
  assert.equal(added.tribe.assignments.forager, 2);
  assert.equal(added.tribe.autoAssignments.forager, 0);
  assert.equal(added.tribe.autoAssignments.hunter, 1);
  assert.equal(added.ap, state.ap);
  assert.equal(added.day, state.day);
  assert.deepEqual(added.inventory, state.inventory);
  const removed = engine.adjustTribeJobAction(added, 'forager', -1);
  assert.equal(removed.tribe.assignments.forager, 1);
  assert.equal(removed.ap, state.ap);
  assert.deepEqual(state, before, 'Active workforce edits must not mutate their input.');
});

check('equipment can still be redistributed freely during an active low-HP run', () => {
  const state = fixture('live-equipment-control');
  state.inventory.hide_coat = 1;
  state.party[0].hp = 1;
  const equipped = engine.setEquipmentSlotAction(state, state.party[0].id, 'top', 'hide_coat');
  assert.equal(equipped.equipment[state.party[0].id].top, 'hide_coat');
  assert.equal(equipped.ap, state.ap);
  assert.equal(engine.totalCarryWeight(equipped), engine.totalCarryWeight(state));
  const cleared = engine.clearAllEquipmentAction(equipped);
  assert.equal(cleared.inventory.hide_coat, 1);
  assert.equal(cleared.ap, state.ap);
  const automatic = engine.autoEquipAction(cleared, 'weather');
  assert.ok(Object.values(automatic.equipment).some((slots) => slots.top === 'hide_coat'));
  assert.equal(automatic.ap, state.ap);
});

console.log(JSON.stringify({ pass: failures.length === 0, checks, failures }));
if (failures.length) process.exitCode = 1;
