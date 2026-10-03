import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');

function fixture() {
  const base = engine.createNewState({ rng: () => 0.5, runId: 'archive-decisions', now: '2026-10-03T00:00:00.000Z' });
  return engine.normalizeState({
    ...base, day: 7, ap: 4, equipment: {},
    weather: { id: 'clear', cold: 0, actionMod: 0 },
    camp: { ...base.camp, fireLevel: 1, shelterLevel: 1, workbenchLevel: 1, fuel: 2 },
    inventory: { stone: 8, clay: 8, wood: 8, fiber: 8, resin: 8, berry: 20, meat: 8 },
    party: base.party.map((member) => ({
      ...member, hunger: 0, stamina: 100, hp: 100,
      stats: { ...member.stats, gather: member.id === 'noa' ? 10 : 1, hunt: member.id === 'hina' ? 9 : 1 },
    })),
    eventChains: [{ id: 'vein', kind: 'obsidian_vein', zoneId: 'cave', startedDay: 7, expiresDay: 10, resolved: false }],
    diplomacy: { ...base.diplomacy, contacts: Object.fromEntries(engine.RIVAL_TRIBES.map((rival) => [rival.id, {
      ...base.diplomacy.contacts[rival.id], known: true, relation: 40, trust: 20, lastActionDay: 0,
    }])) },
  });
}

const fields = ['day', 'ap', 'party', 'inventory', 'camp', 'research', 'civics', 'diplomacy', 'eventChains', 'counters', 'ended', 'victory'];
function expectUnspent(before, after) {
  for (const field of fields) assert.deepEqual(after[field], before[field], `Blocked action changed ${field}.`);
}
const noEvents = () => 0.999;
const results = [];
const failures = [];
function check(name, run) {
  try { run(); results.push(name); console.log(`PASS ${name}`); }
  catch (error) { failures.push({ name, message: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}

check('a dead or missing diplomat cannot spend resources, AP, knowledge or route charges', () => {
  for (const actorId of ['shiroko', 'missing']) {
    for (const action of ['trade', 'gift', 'exchange', 'raid']) {
      const state = fixture();
      state.party[0].hp = 0;
      state.diplomacy.tradeRouteCharges = 3;
      state.research.completed.HUNTING = true;
      const original = structuredClone(state);
      let draws = 0;
      const next = engine.runDiplomacyAction(state, actorId, 'ember-grove', action, { rng: () => { draws += 1; return 0; } });
      expectUnspent(state, next);
      assert.equal(draws, 0);
      const row = engine.rivalTribeRows(state, actorId).find((rival) => rival.id === 'ember-grove');
      for (const field of ['canAct', 'canTrade', 'canGift', 'canExchange', 'canRaid']) assert.equal(row[field], false);
      assert.deepEqual(state, original);
    }
  }
});

check('knowledge exchange is unavailable when every technology is complete', () => {
  const state = fixture();
  state.research.completed = Object.fromEntries(engine.TECH_TREE.map((tech) => [tech.id, true]));
  const current = engine.normalizeState(state);
  const row = engine.rivalTribeRows(current, 'shiroko').find((rival) => rival.id === 'ember-grove');
  assert.equal(row.canExchange, false);
  assert.match(row.exchangeBlockedReason, /진행할 연구가 없습니다/);
  expectUnspent(current, engine.runDiplomacyAction(current, 'shiroko', row.id, 'exchange', { rng: noEvents }));
});

check('an omitted diplomat delegates to a real living member and charges that member rather than a dead leader', () => {
  const state = fixture(); state.party[0].hp = 0;
  const row = engine.rivalTribeRows(state).find((rival) => rival.id === 'ember-grove');
  assert.equal(row.actorId, 'hina');
  assert.equal(row.canTrade, true);
  const next = engine.runDiplomacyAction(state, '', row.id, 'trade', { rng: noEvents });
  assert.equal(next.ap, 3);
  assert.deepEqual(next.party[0], state.party[0]);
  assert.equal(next.party[1].stamina, 93);
  assert.equal(next.party[1].hunger, 2);
  assert.deepEqual(next.party[2], state.party[2]);
});

check('no living party, no AP or an ended run disables decisions without rewards, fatigue or RNG', () => {
  for (const condition of ['dead', 'no-ap', 'ended']) {
    const state = fixture();
    if (condition === 'dead') state.party = state.party.map((member) => ({ ...member, hp: 0 }));
    if (condition === 'no-ap') state.ap = 0;
    if (condition === 'ended') state.ended = true;
    const options = { rng: () => { throw new Error('Unavailable decision drew RNG.'); } };
    const row = engine.rivalTribeRows(state).find((rival) => rival.id === 'ember-grove');
    assert.equal(row.canAct, false);
    if (condition === 'ended') assert.equal(row.statusText, '경기 종료');
    assert.equal(engine.eventChainRows(state)[0].enabled, false);
    expectUnspent(state, engine.runDiplomacyAction(state, '', row.id, 'trade', options));
    expectUnspent(state, engine.runEventChainAction(state, '', 'vein', options));
  }
});

check('ordinary trade and gifts retain exact costs, living actor fatigue and one negotiation per rival per day', () => {
  for (const action of ['trade', 'gift']) {
    const state = fixture();
    const original = structuredClone(state);
    const next = engine.runDiplomacyAction(state, 'shiroko', 'ember-grove', action, { rng: noEvents });
    assert.equal(next.ap, state.ap - 1);
    assert.equal(next.party[0].stamina, action === 'trade' ? 93 : 95);
    assert.equal(next.party[0].hunger, 2);
    assert.deepEqual(next.party.slice(1), state.party.slice(1));
    assert.equal(next.diplomacy.actionSerial, state.diplomacy.actionSerial + 1);
    assert.equal(next.diplomacy.contacts['ember-grove'].lastActionDay, 7);
    assert.equal(next.diplomacy.contacts['ember-grove'].relation, action === 'trade' ? 46 : 52);
    const expected = { ...state.inventory };
    if (action === 'trade') { expected.stone -= 2; expected.wood += 3; expected.resin += 1; }
    else { expected.berry -= 2; expected.meat -= 1; }
    assert.deepEqual(next.inventory, expected);
    for (const repeated of ['trade', 'gift', 'exchange', 'raid']) {
      expectUnspent(next, engine.runDiplomacyAction(next, 'shiroko', 'ember-grove', repeated, { rng: () => { throw new Error('Repeated negotiation drew RNG.'); } }));
    }
    assert.deepEqual(state, original);
  }
});

check('legitimate knowledge exchange pays its material and stamina costs and records the actual research target', () => {
  const state = fixture();
  const next = engine.runDiplomacyAction(state, 'noa', 'ember-grove', 'exchange', { rng: noEvents });
  assert.equal(next.ap, 3);
  assert.equal(next.inventory.clay, state.inventory.clay - 1);
  assert.equal(next.party[2].stamina, 94);
  assert.equal(next.party[2].hunger, 2);
  assert.equal(next.diplomacy.contacts['ember-grove'].relation, 45);
  assert.match(next.diplomacy.lastOutcome, /채집.*\+4RP/);
  assert.ok(next.research.progress.GATHERING >= 4);
  for (const key of Object.keys(state.inventory).filter((id) => id !== 'clay')) assert.equal(next.inventory[key], state.inventory[key]);
});

check('real raid success and failure keep their distinct material, HP, stamina and relationship consequences', () => {
  for (const success of [false, true]) {
    const state = fixture();
    state.research.completed.HUNTING = true;
    let draws = 0;
    const next = engine.runDiplomacyAction(state, 'hina', 'ember-grove', 'raid', { rng: () => { draws += 1; return success ? 0 : 0.999; } });
    assert.equal(draws, 1);
    assert.equal(next.ap, 3);
    assert.equal(next.party[1].hp, success ? 100 : 86);
    assert.equal(next.party[1].stamina, success ? 86 : 82);
    assert.equal(next.diplomacy.contacts['ember-grove'].relation, success ? 14 : 22);
    assert.equal(next.inventory.wood, state.inventory.wood + (success ? 4 : 0));
    assert.equal(next.inventory.resin, state.inventory.resin + (success ? 2 : 0));
  }
});

check('a successful final-AP gift closes one real day and allows negotiation again on the following day', () => {
  const state = fixture(); state.ap = 1;
  const next = engine.runDiplomacyAction(state, 'shiroko', 'ember-grove', 'gift', { rng: noEvents });
  assert.equal(next.day, 8);
  assert.equal(next.ap, state.apMax);
  assert.equal(next.diplomacy.contacts['ember-grove'].lastActionDay, 7);
  assert.equal(next.tribe.productionSerial, state.tribe.productionSerial + 1);
  assert.equal(next.tribe.lastProduction.shortage, 0);
  assert.equal(engine.rivalTribeRows(next, 'shiroko').find((rival) => rival.id === 'ember-grove').canGift, true);
});

check('rare-chain preview, report and execution use the selected living actor rather than borrowing the best companion probability', () => {
  const state = fixture();
  const original = structuredClone(state);
  const row = engine.eventChainRows(state, 'shiroko')[0];
  assert.equal(row.actorId, 'shiroko');
  assert.ok(Math.abs(row.chance - 0.525) < 1e-10, 'Summer gathering must be base 0.5 + skill 1 * 0.025.');
  assert.match(row.costText, /53%/);
  assert.deepEqual(engine.getRunProgressReport(state, 'shiroko').activeEventChains, [row]);
  const next = engine.runEventChainAction(state, 'shiroko', 'vein', { rng: () => 0.6 });
  assert.equal(next.eventChains[0].ok, false);
  assert.equal(next.party[0].hp, 96);
  assert.equal(next.party[0].stamina, 79);
  assert.equal(next.party[0].hunger, 3);
  assert.deepEqual(next.party.slice(1), state.party.slice(1));
  assert.deepEqual(next.inventory, state.inventory);
  assert.equal(next.ap, 3);
  assert.deepEqual(state, original);
});

check('the best companion succeeds at the same legitimate RNG draw and only that companion pays the cost', () => {
  const state = fixture();
  const next = engine.runEventChainAction(state, 'noa', 'vein', { rng: () => 0.6 });
  assert.equal(next.eventChains[0].ok, true);
  assert.equal(next.inventory.obsidian_shard, 2);
  assert.equal(next.inventory.flint, 1);
  assert.equal(next.party[2].stamina, 87);
  assert.equal(next.party[2].hunger, 3);
  assert.deepEqual(next.party.slice(0, 2), state.party.slice(0, 2));
  assert.equal(next.counters.events, state.counters.events + 1);
});

check('a living but exhausted selected explorer cannot act using an eligible companion preview', () => {
  const state = fixture(); state.party[0].stamina = 11;
  assert.equal(engine.eventChainRows(state, 'shiroko')[0].enabled, false);
  expectUnspent(state, engine.runEventChainAction(state, 'shiroko', 'vein', { rng: () => { throw new Error('Exhausted explorer drew RNG.'); } }));
});

check('hunt-chain skill and failure risk belong to the actual selected hunter too', () => {
  const state = fixture(); state.eventChains[0].kind = 'megafauna_tracks';
  const row = engine.eventChainRows(state, 'shiroko')[0];
  assert.ok(Math.abs(row.chance - 0.485) < 1e-10, 'Summer hunting must be base 0.43 + skill 1 * 0.025 + season 0.03.');
  const next = engine.runEventChainAction(state, 'shiroko', 'vein', { rng: () => 0.58 });
  assert.equal(next.eventChains[0].ok, false);
  assert.equal(next.party[0].hp, 89);
  assert.equal(next.party[0].stamina, 69);
  assert.deepEqual(next.inventory, state.inventory);
});

check('unavailable or omitted explorer selection consistently delegates preview and execution to one real living companion', () => {
  for (const actorId of ['', 'missing', 'shiroko']) {
    const state = fixture(); state.party[0].hp = 0;
    assert.equal(engine.eventChainRows(state, actorId)[0].actorId, 'noa');
    const next = engine.runEventChainAction(state, actorId, 'vein', { rng: () => 0.6 });
    assert.equal(next.eventChains[0].ok, true);
    assert.equal(next.party[0].hp, 0);
    assert.equal(next.party[2].stamina, 87);
  }
});

check('expired or resolved chains cannot pay twice or change a saved outcome', () => {
  for (const success of [false, true]) {
    const state = fixture();
    const completed = engine.runEventChainAction(state, 'noa', 'vein', { rng: () => success ? 0 : 0.999 });
    const restored = engine.normalizeState(JSON.parse(JSON.stringify(completed)));
    assert.equal(restored.eventChains[0].ok, success);
    assert.equal(restored.eventChains[0].resolved, true);
    expectUnspent(restored, engine.runEventChainAction(restored, 'noa', 'vein', { rng: () => { throw new Error('Resolved chain drew RNG.'); } }));
  }
  const expired = fixture(); expired.day = 11;
  expectUnspent(expired, engine.runEventChainAction(expired, 'noa', 'vein', { rng: () => { throw new Error('Expired chain drew RNG.'); } }));
  assert.equal(Object.hasOwn(engine.normalizeState(fixture()).eventChains[0], 'ok'), false, 'Pending chains cannot invent an outcome.');
  assert.equal(engine.SAVE_VERSION, 'primitive-archive-v1');
});

check('a final-AP rare-chain action keeps its real result after the ordinary night and subsequent JSON restoration', () => {
  const state = fixture(); state.ap = 1;
  const completed = engine.runEventChainAction(state, 'noa', 'vein', { rng: () => 0.6 });
  assert.equal(completed.day, 8);
  assert.equal(completed.ap, state.apMax);
  assert.equal(completed.tribe.productionSerial, state.tribe.productionSerial + 1);
  const restored = engine.normalizeState(JSON.parse(JSON.stringify(completed)));
  assert.equal(restored.eventChains.find((chain) => chain.id === 'vein').ok, true);
  expectUnspent(restored, engine.runEventChainAction(restored, 'noa', 'vein', { rng: () => { throw new Error('Completed overnight chain drew RNG.'); } }));
});

console.log(JSON.stringify({ checks: results.length, pass: !failures.length, failures, evidence: 'current engine only; real paid actions, independent fixtures, no historical result files or accounts' }));
if (failures.length) process.exitCode = 1;
