import './register-simulation-modules.mjs';
import assert from 'node:assert/strict';
export const engine = await import('../../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
export const lineage = await import('../../src/app/games/primitive-archive/_lib/primitiveArchiveLineage.js');
export const cloneIdentityState = value => structuredClone(value);
export function identityFixture(options = {}) {
  const state = engine.createNewState({ runId: 'identity-current-controlled', now: '2026-11-14T00:00:00.000Z', rng: () => 0.5, ...options });
  state.research.completed = { ...state.research.completed, SETTLEMENT: true, FOOD_STORAGE: true };
  state.camp = { ...state.camp, shelterLevel: 3, fireLevel: 1, workbenchLevel: 1, fuel: 100 };
  state.inventory = { ...state.inventory, berry: 1000, wood: 100, stone: 100, fiber: 100 };
  state.tribe.population = 8;
  return state;
}
export function preparedIdentityFixture() {
  const source = identityFixture(), rootId = source.party[0].id;
  const state = engine.prepareSuccessorAction(source, rootId, { rng: () => 0.5 });
  assert.equal(lineage.isValidLineage(state.lineage, state), true);
  const candidate = state.lineage.prepared.find(row => row.mentorId === rootId); assert.ok(candidate);
  return { state, rootId, successorId: candidate.actor.id };
}
export function chainIdentityFixture(generations = 3) {
  let state = identityFixture(); const rootId = state.party[0].id, ids = [rootId];
  for (let generation = 1; generation <= generations; generation++) {
    const mentorId = ids.at(-1);
    state = engine.prepareSuccessorAction(state, mentorId, { rng: () => 0.5 });
    const candidate = state.lineage.prepared.find(row => row.mentorId === mentorId); assert.ok(candidate);
    ids.push(candidate.actor.id);
    state = engine.retireFounderAction(state, mentorId);
    assert.equal(lineage.isValidLineage(state.lineage, state), true);
  }
  return { state, rootId, ids };
}
export function naturalDeathIdentityFixture() {
  let { state, ids, rootId } = chainIdentityFixture(1);
  // Only the existing bounded lifecycle clock runs here, with no whole-game
  // simulation, historical outcomes or searched random seeds.
  for (let cycle = 0; cycle < lineage.LINEAGE_RULES.naturalEndCycle; cycle++) {
    state = lineage.tickLineageDay({ ...state, day: state.day + 1 });
    assert.equal(lineage.isValidLineage(state.lineage, state), true);
  }
  assert.equal(state.lineage.members.find(row => row.actorId === ids[1]).stage, 'deceased');
  return { state, ids, rootId };
}
export function annualIdentityFixture(state) {
  const stamp = { runId: state.runId, day: state.day, ap: state.ap, updatedAt: state.updatedAt, completedYears: null };
  const result = engine.startAnnualSettlementAction(state, stamp, { observedLifetimeYears: 60 });
  assert.equal(result.calendar.mode, 'annual'); return result;
}
