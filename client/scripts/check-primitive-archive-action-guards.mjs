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

console.log(JSON.stringify({ pass: failures.length === 0, checks, failures }));
if (failures.length) process.exitCode = 1;
