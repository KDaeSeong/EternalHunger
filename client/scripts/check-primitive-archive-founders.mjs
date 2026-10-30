import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';
import { createFounderHistory, normalizeFounderHistory, recordFounderDeed,
  recordFounderDeath, founderHistoryRows, isValidFounderHistory } from '../src/app/games/primitive-archive/_lib/primitiveArchiveFounders.js';
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');

const fresh = () => engine.createNewState({ runId: 'founder-check', now: '2026-10-30T00:00:00.000Z', rng: () => 0.5 });
const clone = value => JSON.parse(JSON.stringify(value));
const row = (state, id = state.party[0].id) => founderHistoryRows(state).find(member => member.actorId === id);
let groups = 0;
function check(name, action) {
  action();
  groups += 1;
  console.log(`PASS ${name}`);
}

check('new-run identities and legacy observation never reconstruct old deeds', () => {
  const state = fresh();
  assert.equal(state.founderHistory.origin, 'new_run');
  assert.ok(founderHistoryRows(state).every(member => member.isFounder && member.portrait && member.role));
  const legacy = clone(state);
  delete legacy.founderHistory;
  legacy.day = 27;
  legacy.counters.gather = 999;
  legacy.party[0].hp = 0;
  legacy.party[0].deathRecord = { day: 5, source: 'night', reason: '허기', hungerDamage: 10 };
  const restored = engine.normalizeState(legacy);
  assert.equal(restored.founderHistory.origin, 'observed_legacy');
  assert.equal(restored.founderHistory.observedFromDay, 27);
  assert.ok(founderHistoryRows(restored).every(member => !member.isFounder && !member.foundersKnown));
  assert.deepEqual(row(restored).tallies, {});
  assert.equal(row(restored).deathRecord, null);
  assert.equal(restored.party[0].deathRecord.day, 5);
  const observed = engine.runSafeGatherAction(restored, restored.party[1].id, 'berry');
  assert.equal(row(observed, restored.party[1].id).tallies.gather, 1);
  assert.equal(observed.founderHistory.observedFromDay, 27);
  assert.equal(engine.advanceDay(legacy, { rng: () => 0.5 }).founderHistory.observedFromDay, 27);
});

check('recruits are observed, founder identity persists without a live party row', () => {
  const state = fresh();
  const id = state.party[0].id;
  const prior = row(state);
  const recruit = { id: 'later', name: '후발 대원', hp: 100 };
  const history = normalizeFounderHistory(state.founderHistory, { ...state, party: [...state.party.slice(1), recruit], day: 4 });
  assert.equal(history.members.find(member => member.actorId === 'later').isFounder, false);
  assert.equal(history.members.find(member => member.actorId === id).portrait, prior.portrait);
  assert.equal(history.members.find(member => member.actorId === id).name, prior.name);
});

check('successful paid safe gather preserves inputs, adds exact gains and consumes no RNG', () => {
  const state = fresh();
  const before = clone(state);
  let draws = 0;
  const next = engine.runSafeGatherAction(state, state.party[0].id, 'berry', { rng: () => { draws++; return 0.5; } });
  assert.deepEqual(state, before);
  assert.equal(next.inventory.berry, before.inventory.berry + 2);
  assert.equal(next.ap, before.ap - 1);
  assert.equal(draws, 0);
  assert.equal(row(next).tallies.gather, 1);
  assert.deepEqual(row(next).recentDeeds[0].gains, [['berry', 2]]);
  assert.deepEqual(next.meta, state.meta);
});

check('failed and invalid actions earn no deed', () => {
  const state = fresh();
  const failed = engine.runGatherAction(state, state.party[0].id, 'forest', { rng: () => 0.999999 });
  assert.deepEqual(row(failed).tallies, {});
  for (const invalid of [
    engine.runSafeGatherAction(state, 'missing', 'berry'),
    engine.runSafeGatherAction(state, state.party[0].id, 'invalid'),
    engine.runSafeGatherAction({ ...state, ap: 0 }, state.party[0].id, 'berry'),
    engine.runSafeGatherAction({ ...state, ended: true }, state.party[0].id, 'berry'),
    engine.runCampAction({ ...state, inventory: {} }, state.party[0].id, 'fire'),
  ]) assert.deepEqual(row(invalid).tallies, {});
  assert.equal(recordFounderDeed(state, { actorId: state.party[0].id, kind: 'gather', success: false }), state);
  assert.equal(recordFounderDeed(state, { actorId: 'missing', kind: 'gather', success: true }), state);
});

check('hunt success records real rewards while lethal failed hunt records only its death', () => {
  const state = fresh();
  const success = engine.runHuntAction(state, state.party[0].id, 'plains', { rng: () => 0 });
  assert.equal(row(success).tallies.hunt, 1);
  assert.ok(row(success).recentDeeds[0].gains.length > 0);
  const fragile = { ...state, party: state.party.map((member, index) => ({ ...member, hp: index ? 100 : 1 })) };
  const failed = engine.runHuntAction(fragile, fragile.party[0].id, 'plains', { rng: () => 0.999999 });
  assert.equal(failed.party[0].hp, 0);
  assert.equal(row(failed).deathRecord.source, 'action');
  assert.equal(row(failed).deathRecord.reason, '사냥 반격');
  assert.deepEqual(row(failed).tallies, {});
  assert.equal(recordFounderDeath(failed, failed.party[0].id, failed.party[0].deathRecord), failed);
  assert.deepEqual(failed.meta, state.meta);
});

check('night starvation is retained separately from successful action, without a reward', () => {
  const state = fresh();
  state.party = state.party.map(member => ({ ...member, hp: 1, hunger: 100, bodyTemp: 37 }));
  const before = clone(state);
  const next = engine.advanceDay(state, { rng: () => 0.5 });
  assert.deepEqual(state, before);
  assert.equal(next.ended, true);
  assert.ok(founderHistoryRows(next).every(member => member.deathRecord?.source === 'night'
    && member.deathRecord.hungerDamage > 0 && !member.living));
  assert.deepEqual(next.meta, state.meta);
});

check('craft and camp record actual successful results and no passive completion attribution', () => {
  const state = fresh();
  state.inventory = Object.fromEntries(Object.keys(engine.ITEMS).map(id => [id, 50]));
  state.research.completed = { ...state.research.completed, GATHERING: true, CORDAGE: true };
  const recipe = engine.RECIPES[0];
  const crafted = engine.runCraftAction(state, state.party[0].id, recipe.id, { rng: () => 0 });
  assert.equal(row(crafted).tallies.craft, 1);
  assert.deepEqual(row(crafted).recentDeeds[0].gains, Object.entries(recipe.reward));
  const failed = engine.runCraftAction(state, state.party[0].id, recipe.id, { rng: () => 0.999999 });
  assert.equal(row(failed).tallies.craft, undefined);
  const camp = engine.runCampAction(state, state.party[0].id, 'fire', { rng: () => 0.5 });
  assert.equal(camp.camp.fireLevel, 1);
  assert.equal(row(camp).tallies.camp, 1);
  assert.equal(row(camp).tallies.research_contribution, undefined);
});

check('bounded observation is immutable and JSON/save normalization preserves it', () => {
  let state = fresh();
  for (let index = 0; index < 30; index++) state = recordFounderDeed(state,
    { actorId: state.party[0].id, kind: 'gather', success: true, target: 'berry', gains: [['berry', 2]] });
  assert.equal(row(state).tallies.gather, 30);
  assert.equal(row(state).recentDeeds.length, 8);
  const before = clone(state);
  const normalized = engine.normalizeState(clone(state));
  assert.deepEqual(normalized.founderHistory, state.founderHistory);
  const rows = founderHistoryRows(state);
  rows[0].tallies.gather = 0;
  rows[0].recentDeeds[0].gains[0][1] = 999;
  assert.deepEqual(state, before);
  const malformed = createFounderHistory({ party: state.party, runId: state.runId });
  malformed.members[0].tallies = { gather: Infinity, unknown: 300 };
  assert.equal(isValidFounderHistory(malformed, state), false);
  assert.throws(() => normalizeFounderHistory(malformed, state), RangeError);
  assert.throws(() => normalizeFounderHistory(state.founderHistory, { ...state, runId: 'other' }), RangeError);
});

check('present malformed history is rejected, not silently erased on restore', () => {
  const state = fresh();
  assert.equal(isValidFounderHistory(undefined, state), true);
  assert.equal(isValidFounderHistory(state.founderHistory, state), true);
  const mutate = change => {
    const history = clone(state.founderHistory);
    change(history);
    assert.equal(isValidFounderHistory(history, state), false);
    assert.throws(() => engine.normalizeState({ ...state, founderHistory: history }), RangeError);
  };
  mutate(history => { history.version = 2; });
  mutate(history => { history.runId = 'another-run'; });
  mutate(history => { history.members.push(clone(history.members[0])); });
  mutate(history => { history.observedFromDay = 0; });
  mutate(history => { history.extra = true; });
  mutate(history => { history.members[0].tallies.gather = NaN; });
  mutate(history => { history.members[0].tallies.gather = -1; });
  mutate(history => { history.origin = 'observed_legacy'; history.foundersKnown = false; });
  mutate(history => { history.members[0].recentDeeds = Array(9).fill({ day: 1, kind: 'gather', target: '', gains: [] }); });
  mutate(history => { history.members[0].recentDeeds = [{ day: 1, kind: 'gather', target: '', gains: [['berry', -1]] }]; });
  assert.equal(isValidFounderHistory(null, state), false);
  assert.deepEqual(state.founderHistory, createFounderHistory({ party: state.party, runId: state.runId }));
});

check('long existing identities survive observation and keep living/deed ownership', () => {
  const legacy = fresh();
  delete legacy.founderHistory;
  legacy.runId = `legacy-${'문명'.repeat(90)}`;
  legacy.party[0].id = `actor-${'창건자'.repeat(90)}`;
  const actorId = legacy.party[0].id;
  const restored = engine.normalizeState(legacy);
  assert.equal(restored.founderHistory.runId, legacy.runId);
  assert.equal(row(restored, actorId).actorId, actorId);
  assert.equal(row(restored, actorId).living, true);
  const next = engine.runSafeGatherAction(restored, actorId, 'berry');
  assert.equal(row(next, actorId).tallies.gather, 1);
  assert.equal(isValidFounderHistory(next.founderHistory, next), true);
  assert.deepEqual(engine.normalizeState(clone(next)).founderHistory, next.founderHistory);
});

check('deaths outside the observation window leave legacy history unchanged', () => {
  const legacy = fresh();
  delete legacy.founderHistory;
  legacy.day = 27;
  legacy.party[0].hp = 0;
  const state = engine.normalizeState(legacy);
  const before = clone(state);
  const death = { day: 5, source: 'night', hpBefore: 5, damage: 10, hungerDamage: 10,
    coldDamage: 0, hypothermiaDamage: 0, reason: '허기' };
  assert.equal(recordFounderDeath(state, state.party[0].id, death), state);
  assert.equal(recordFounderDeath(state, state.party[0].id, { ...death, day: 28 }), state);
  assert.deepEqual(state, before);
  assert.equal(row(state).deathRecord, null);
  const current = recordFounderDeath(state, state.party[0].id, { ...death, day: 27 });
  assert.equal(row(current).deathRecord.day, 27);
  assert.equal(isValidFounderHistory(current.founderHistory, current), true);
});

check('manual research is a contribution, passive research is not attributed to an actor', () => {
  const state = fresh();
  state.camp = { ...state.camp, fireLevel: 1, shelterLevel: 1, workbenchLevel: 1 };
  const trained = clone(state);
  for (const gate of engine.researchSystemStatus(trained).actionGateRows) trained.research.completed[gate.id] = true;
  const direct = engine.runResearchAction(trained, state.party[0].id, { rng: () => 0.5 });
  assert.equal(row(direct).tallies.research_contribution, 1);
  assert.equal(row(direct).recentDeeds[0].kind, 'research_contribution');
  const tech = engine.TECHNOLOGY_TREE.find(item => item.id === state.research.selectedTechId);
  state.research.progress[tech.id] = tech.cost - 1;
  const passive = engine.runSafeGatherAction(state, state.party[0].id, 'wood');
  assert.equal(passive.research.completed[tech.id], true);
  assert.equal(row(passive).tallies.research_contribution, undefined);
  assert.equal(row(passive).tallies.gather, 1);
});

check('automatic engine actions record deeds without changing decisions or random draws', () => {
  const state = fresh();
  const empty = clone(state);
  let rich = clone(state);
  for (let index = 0; index < 10; index++) rich = recordFounderDeed(rich,
    { actorId: rich.party[0].id, kind: 'gather', success: true });
  function run(input) {
    let seed = 12345;
    let draws = 0;
    const result = engine.runAutoDayAction(input, { rng: () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      draws++;
      return seed / 4294967296;
    } });
    const game = { ...result };
    delete game.founderHistory;
    // Existing addLog uses the wall clock; it is not simulation state or RNG.
    delete game.updatedAt;
    return { game, founderHistory: result.founderHistory, draws };
  }
  const first = run(empty);
  const second = run(rich);
  assert.deepEqual(first.game, second.game);
  assert.equal(first.draws, second.draws);
  assert.ok(first.founderHistory.members.some(member => Object.values(member.tallies).some(value => value > 0)));
  assert.equal(second.founderHistory.members[0].tallies.gather, (first.founderHistory.members[0].tallies.gather || 0) + 10);
});

check('settlement is unchanged and a new run does not inherit deeds or deceased founders', () => {
  let state = engine.runSafeGatherAction(fresh(), fresh().party[0].id, 'berry');
  const history = clone(state.founderHistory);
  state = engine.settleRunAction(state);
  assert.deepEqual(state.founderHistory, history);
  const next = engine.startNewRunFromMeta(state, { runId: 'next-founder-check', rng: () => 0.5 });
  assert.deepEqual(next.meta, state.meta);
  assert.equal(next.founderHistory.runId, 'next-founder-check');
  assert.ok(founderHistoryRows(next).every(member => member.isFounder && !member.deathRecord
    && !Object.keys(member.tallies).length));
});

console.log(`Founder history: ${groups} focused groups passed.`);
