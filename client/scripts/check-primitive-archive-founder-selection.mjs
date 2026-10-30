import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';

const { STUDENTS, makeParty, emptyEquipmentSlots } = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveData.js');
const { createNewState, normalizeState, startNewRunFromMeta } = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const { isValidRunState } = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCheckpoint.js');
const { initialArchiveShopPerks, prepareArchiveShopRun } = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveShopPerks.js');
const { GAMEPLAY_PERK_CODES: CODES } = await import('../src/utils/gameplayPerks.js');

const defaults = STUDENTS.slice(0, 3).map((student) => student.id);
const selected = ['yuuka', 'fuuka', 'hoshino'];
const ids = (party) => party.map((member) => member.id);
const options = { now: '2026-10-30T00:00:00.000Z', runId: 'founder-selection-fixture', rng: () => 0.5 };
const catalogBefore = JSON.stringify(STUDENTS);
const expectedParty = (selection) => selection.map((id) => ({
  ...STUDENTS.find((student) => student.id === id), hp: 100, hunger: 12, stamina: 100, bodyTemp: 37,
}));
let checks = 0;
async function check(name, body) {
  await body();
  checks += 1;
  console.log(`PASS ${name}`);
}

await check('omitted selection preserves the exact original first-three party and initial values', () => {
  assert.deepEqual(makeParty(), expectedParty(defaults));
  assert.deepEqual(makeParty(undefined), makeParty());
  assert.deepEqual(createNewState(options).party, makeParty());
});

await check('every catalog member can be selected in input order with unchanged role, stats, vitals and equipment', () => {
  for (let index = 0; index < STUDENTS.length; index += 1) {
    const selection = [STUDENTS[index].id, STUDENTS[(index + 3) % STUDENTS.length].id, STUDENTS[(index + 5) % STUDENTS.length].id];
    const before = selection.slice();
    const state = createNewState({ ...options, founderIds: selection });
    assert.deepEqual(state.party, expectedParty(selection));
    assert.deepEqual(Object.keys(state.equipment), selection);
    for (const id of selection) assert.deepEqual(state.equipment[id], emptyEquipmentSlots());
    assert.deepEqual(selection, before);
    assert.equal(isValidRunState(state), true);
    assert.deepEqual(state.founderHistory.members.map((member) => member.actorId), selection);
    assert.ok(state.founderHistory.members.every((member) => member.isFounder));
  }
  assert.equal(JSON.stringify(STUDENTS), catalogBefore);
});

await check('invalid explicit choices reject without fallback, coercion or sparse-array holes', () => {
  const invalid = [null, false, 'shiroko,hina,noa', {}, [], ['shiroko'], ['shiroko', 'hina'],
    [...defaults, 'ako'], ['shiroko', 'shiroko', 'noa'], ['shiroko', 'hina', 'unknown'],
    [' shiroko', 'hina', 'noa'], ['SHIROKO', 'hina', 'noa'], ['shiroko', 'hina', 1],
    ['shiroko', , 'noa'], new Array(3)];
  for (const founderIds of invalid) {
    for (const invoke of [() => makeParty(founderIds), () => createNewState({ ...options, founderIds })]) {
      assert.throws(invoke, (error) => error instanceof RangeError && error.code === 'ARCHIVE_FOUNDER_SELECTION');
    }
  }
});

await check('selection consumes no extra randomness and does not change world, inventory, AP, facilities or progression', () => {
  let defaultDraws = 0;
  let selectedDraws = 0;
  const original = createNewState({ ...options, rng: () => { defaultDraws += 1; return 0.5; } });
  const chosen = createNewState({ ...options, founderIds: selected, rng: () => { selectedDraws += 1; return 0.5; } });
  assert.equal(defaultDraws, selectedDraws);
  const omitIdentity = ({ party, equipment, founderHistory, ...world }) => world;
  assert.deepEqual(omitIdentity(chosen), omitIdentity(original));
});

await check('meta new-run and captured LP perk preparation forward selection while preserving prior-run data', async () => {
  const source = createNewState({ ...options, runId: 'prior-run' });
  source.meta.perkPoints = 11;
  source.meta.ownedPerks = { perk_supply_pack: 1, perk_extra_ap: 1 };
  const before = JSON.stringify(source);
  const next = startNewRunFromMeta(source, { ...options, founderIds: selected });
  const reference = createNewState({ ...options, founderIds: selected, meta: source.meta });
  assert.deepEqual(next.party, expectedParty(selected));
  assert.deepEqual(next.meta, source.meta);
  assert.deepEqual(next.inventory, reference.inventory);
  assert.equal(next.ap, reference.ap);
  let captures = 0;
  const prepared = await prepareArchiveShopRun({ source, getCurrent: () => source,
    captureCodes: async () => { captures += 1; return [CODES.CAREFUL_GATHER, CODES.RESEARCH_NOTES]; },
    sessionIsCurrent: () => true, options: { ...options, founderIds: selected } });
  assert.equal(captures, 1);
  assert.deepEqual(ids(prepared.party), selected);
  assert.deepEqual(prepared.shopPerks.codes, [CODES.CAREFUL_GATHER, CODES.RESEARCH_NOTES]);
  assert.deepEqual(initialArchiveShopPerks(prepared, []).party, prepared.party);
  assert.deepEqual(prepared.inventory, reference.inventory);
  assert.equal(JSON.stringify(source), before);
});

await check('save round trips preserve the chosen party and legacy restoration never reselects founders', () => {
  const chosen = createNewState({ ...options, founderIds: selected });
  chosen.party[0].hp = 63;
  chosen.party[0].stamina = 41;
  const raw = JSON.parse(JSON.stringify(chosen));
  assert.equal(isValidRunState(raw), true);
  const restored = normalizeState(raw);
  assert.deepEqual(restored.party, raw.party);
  assert.deepEqual(restored.founderHistory, raw.founderHistory);
  const legacy = createNewState(options);
  delete legacy.founderHistory;
  legacy.founderIds = selected;
  legacy.party[0].hp = 54;
  const before = JSON.stringify(legacy);
  const oldRestored = normalizeState(JSON.parse(before));
  assert.deepEqual(oldRestored.party, legacy.party);
  assert.deepEqual(ids(oldRestored.party), defaults);
  assert.equal(oldRestored.founderHistory.origin, 'observed_legacy');
  assert.equal(oldRestored.founderHistory.foundersKnown, false);
  assert.equal(JSON.stringify(legacy), before);
});

console.log(`PRIMITIVE_ARCHIVE_FOUNDER_SELECTION ${checks}/${checks}; real engine/meta/perk/save functions; no browser, network or succession proof`);
