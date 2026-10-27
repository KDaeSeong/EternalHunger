import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';

const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const now = '2026-10-27T00:00:00.000Z';
const passiveBonuses = new Map([
  ['MYSTIC_RECOVERY_UP', 4],
  ['HERBAL_MEDICINE_UP', 4],
  ['MEDIEVAL_MEDICINE_UP', 6],
  ['ANATOMY_RECOVERY_UP', 3],
  ['PHARMACOPOEIA_RECOVERY_UP', 6],
  ['PUBLIC_HEALTH_RECOVERY_UP', 5],
]);
let passed = 0;

function stateWith(passives = [], { tonic = 1, hp = 40, dead = false } = {}) {
  const base = engine.createNewState({ runId: `medical-recovery-${passed}`, now, rng: () => 0.5 });
  const completed = {};
  for (const passive of passives) {
    const source = engine.TECH_TREE.find((tech) => tech.unlocks?.passives?.includes(passive));
    assert.ok(source, `A source technology exists for ${passive}`);
    completed[source.id] = true;
  }
  const party = base.party.map((member, index) => ({
    ...member,
    hp: dead && index === 1 ? 0 : hp,
    hunger: 10,
    stamina: 50,
    bodyTemp: 37,
  }));
  return engine.normalizeState({
    ...base,
    day: 4,
    ap: 3,
    party,
    inventory: {
      ...base.inventory,
      packed_ration: 0,
      milled_grain: 0,
      cooked_meat: 0,
      jerky: 0,
      fish: 0,
      meat: 0,
      grain: 0,
      milk: 0,
      berry: 1,
      herb_tonic: tonic,
      herb: 2,
    },
    research: { ...base.research, completed },
  });
}

function run(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}: ${error.message}`);
    process.exitCode = 1;
  }
}

function assertClose(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `expected ${actual} to be within 1e-9 of ${expected}`);
}

for (const [passive, bonus] of passiveBonuses) {
  run(`${passive} adds ${bonus} HP to prepared-tonic field treatment`, () => {
    const before = stateWith([passive]);
    const after = engine.runRecoveryChoiceAction(before, before.party[0].id, 'field_tonic', { rng: () => 0.5 });
    assert.ok(after.party.every((member) => member.hp === 40 + 14 + bonus));
    assert.equal(after.inventory.herb_tonic, 0);
  });
}

run('all medicine research advertises and logs group maxima 42 HP, 5 ST, and 0.3 temperature; individual tonic heals 40', () => {
  const before = stateWith([...passiveBonuses.keys()]);
  const after = engine.runRecoveryChoiceAction(before, before.party[0].id, 'field_tonic', { rng: () => 0.5 });
  assert.ok(after.party.every((member) => member.hp === 82));
  const row = engine.recoveryChoiceRows(before).find((choice) => choice.id === 'field_tonic');
  assert.match(row.detail, /HP 최대 \+42, ST 최대 \+5, 체온 최대 \+0\.3/);
  assert.match(after.log[0], /HP 최대 \+42, ST 최대 \+5, 체온 최대 \+0\.3/);
  const individual = engine.runEatAction(engine.normalizeState({
    ...before,
    inventory: { ...before.inventory, berry: 0 },
  }), before.party[0].id, { rng: () => 0.5 });
  assert.equal(individual.party[0].hp, 80);
});

run('prepared tonic applies actual HP, stamina, and temperature deltas to other living party members', () => {
  const before = stateWith([...passiveBonuses.keys()]);
  const after = engine.runRecoveryChoiceAction(before, before.party[0].id, 'field_tonic', { rng: () => 0.5 });
  assert.equal(after.party[1].hp - before.party[1].hp, 42);
  assert.equal(after.party[1].stamina - before.party[1].stamina, 5);
  assertClose(after.party[1].bodyTemp - before.party[1].bodyTemp, 0.3);
});

run('prepared tonic respects HP cap, leaves deceased members untouched, and preserves action costs', () => {
  const before = stateWith([...passiveBonuses.keys()], { hp: 95, dead: true });
  let rngCalls = 0;
  const after = engine.runRecoveryChoiceAction(before, before.party[0].id, 'field_tonic', { rng: () => { rngCalls += 1; return 0.5; } });
  assert.equal(rngCalls, 0);
  assert.equal(after.party[0].hp, 100);
  assert.equal(after.party[1].hp, 0);
  assert.equal(after.inventory.herb_tonic, 0);
  assert.equal(after.inventory.herb, before.inventory.herb);
  assert.equal(after.inventory.berry, before.inventory.berry);
  assert.equal(after.ap, before.ap - 1);
  assert.equal(after.party[0].stamina, before.party[0].stamina + 1);
  assert.equal(after.party[0].hunger, before.party[0].hunger + 1);
});

run('raw field herbs advertise, log, and apply base HP 8, ST 3, and temperature 0.18 without tonic research', () => {
  const researched = stateWith([...passiveBonuses.keys()], { tonic: 0 });
  const before = engine.normalizeState({
    ...researched,
    research: { ...researched.research, completed: { ...researched.research.completed, HERBALISM: true } },
  });
  const after = engine.runRecoveryChoiceAction(before, before.party[0].id, 'field_tonic', { rng: () => 0.5 });
  assert.ok(after.party.every((member) => member.hp === 48));
  const row = engine.recoveryChoiceRows(before).find((choice) => choice.id === 'field_tonic');
  assert.match(row.detail, /HP 최대 \+8, ST 최대 \+3, 체온 최대 \+0\.18/);
  assert.match(after.log[0], /HP 최대 \+8, ST 최대 \+3, 체온 최대 \+0\.18/);
  assert.equal(after.party[1].hp - before.party[1].hp, 8);
  assert.equal(after.party[1].stamina - before.party[1].stamina, 3);
  assertClose(after.party[1].bodyTemp - before.party[1].bodyTemp, 0.18);
  assert.equal(after.inventory.herb, 0);
  assert.equal(after.inventory.berry, 0);
});

if (process.exitCode) process.exit(process.exitCode);
console.log(`Verified ${passed} medical recovery checks.`);
