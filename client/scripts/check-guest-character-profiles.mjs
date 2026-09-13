import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { GUEST_CHARACTER_PROFILE_KEY: key, normalizeGuestCharacterProfile, readGuestCharacterProfiles,
  saveGuestCharacterProfile, applyGuestCharacterProfiles, saveGuestCharacterBeforeMatch } = await import('../src/app/simulation/_lib/guestCharacterProfileRuntime.js');
const { buildGuestSimulationRoster, resolveSimulationBootstrapData } = await import('../src/app/simulation/_lib/guestSimulationBootstrap.js');
const { getCharacterSkillDef, getCharacterSkillLevel } = await import('../src/app/simulation/_lib/characterSkillDefinitionRuntime.js');
const { normalizeCharacterSkillForEditor } = await import('../src/app/characters/_lib/characterEditorRuntime.js');
const { createDefaultCompiledSkill } = await import('../src/utils/characterSkillCompilerCore.js');
const { getErSubjectPreset, applyErSubjectPreset } = await import('../src/utils/erMeta.js');
const { createParticipantPresetActionRuntime } = await import('../src/app/simulation/_lib/participantPresetActionRuntime.js');
const { readLocalParticipantPresets, CUSTOM_PARTICIPANT_PRESET_ID } = await import('../src/app/simulation/_lib/participantPresetRuntime.js');
const { pickParticipantsForRun } = await import('../src/app/simulation/_lib/matchRosterRuntime.js');
const { createSimulationRunInput, prepareSimulationRunInput, compareSimulationReplay } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { actor, skill, runCombatScenario } = await import('./lib/run-combat-scenario.mjs');
const { getEffectiveStats } = await import('../src/utils/statusEffectiveStats.js');
const { applyPerkBundleToActor } = await import('../src/app/simulation/_lib/perkRuntime.js');
const memoryStorage = () => { const values = new Map(); return { getItem: (name) => values.get(name) ?? null,
  setItem: (name, value) => values.set(name, String(value)), values }; };
const base = buildGuestSimulationRoster();
const definition = () => ({ id: base[0]._id, name: '내가 만든 비형', tacticalSkill: base[0].tacticalSkill,
  characterSkills: { q: skill({ name: '시간차 일격', firstFlat: [40, 50, 60, 70, 80], includesMovement: true,
    movementMode: 'toward_target', movementDistance: 3,
    damageType: 'true', attackPowerScale: 0.2, secondAttackPowerScale: 0.1 }) } });
let checks = 0;
const check = async (name, run) => { await run(); checks++; console.log(`PASS ${name}`); };

await check('definition round trips five levels, timing, damage categories, movement and coefficients without live state', () => {
  const store = memoryStorage(); const result = saveGuestCharacterProfile({ ...definition(), hp: 1, inventory: [{ name: 'free' }],
    teamId: 'cheat', skillState: { q: { cooldownUntil: 100 } }, _pendingCharacterCast: {} }, store);
  assert.equal(result.ok, true); const saved = readGuestCharacterProfiles(store).profiles[0];
  const q = saved.characterSkills.q;
  assert.deepEqual(q.firstFlat, [40, 50, 60, 70, 80]); assert.equal(q.castDelaySec, 1.25);
  assert.equal(q.damageType, 'true'); assert.equal(q.includesMovement, true); assert.equal(q.movementMode, 'toward_target');
  assert.equal(q.movementDistance, 3); assert.equal(q.attackPowerScale, 0.2);
  assert.equal(q.secondAttackPowerScale, 0.1); assert.equal(q.recoveryDelaySec, 0.25);
  for (const field of ['hp', 'inventory', 'teamId', 'skillState', '_pendingCharacterCast']) assert.equal(Object.hasOwn(saved, field), false);
  assert.deepEqual(normalizeGuestCharacterProfile(saved), saved);
});
await check('both shared authoring normalizers retain the fields consumed by independent casting', () => {
  const q = definition().characterSkills.q;
  for (const next of [createDefaultCompiledSkill(q), normalizeCharacterSkillForEditor({ q }, 'q')]) {
    assert.equal(next.includesMovement, true); assert.equal(next.movementMode, 'toward_target'); assert.equal(next.movementDistance, 3);
    assert.equal(next.damageType, 'true');
    assert.equal(next.attackPowerScale, 0.2); assert.equal(next.secondAttackPowerScale, 0.1);
  }
});
await check('missing storage is honest and empty, while saving failure cannot update the current roster', () => {
  assert.equal(readGuestCharacterProfiles(null).ok, false);
  let updates = 0;
  const result = saveGuestCharacterBeforeMatch({ actorId: base[0]._id, draft: definition(),
    state: { day: 0, matchSec: 0, candidateSurvivors: base }, storage: { getItem: () => null, setItem: () => { throw Error('quota'); } },
    actions: { setSurvivors: () => updates++, setCandidateSurvivors: () => updates++ } });
  assert.equal(result.ok, false); assert.equal(updates, 0);
});
await check('corrupted, incompatible, duplicate and oversized saved definitions remain untouched', () => {
  for (const text of ['{broken', JSON.stringify({ schemaVersion: 2, profiles: [] }),
    JSON.stringify({ schemaVersion: 1, profiles: [definition(), definition()] }), ' '.repeat(1000001)]) {
    const store = memoryStorage(); store.setItem(key, text);
    assert.equal(readGuestCharacterProfiles(store).ok, false);
    assert.equal(saveGuestCharacterProfile(definition(), store).ok, false); assert.equal(store.getItem(key), text);
  }
});
await check('invalid names, foreign IDs, empty enabled skills and unsupported timing cannot claim a save', () => {
  const store = memoryStorage();
  for (const draft of [{ ...definition(), name: ' ' }, { ...definition(), id: 'server-character' },
    { ...definition(), characterSkills: { q: { enabled: true, name: 'no effect' } } },
    { ...definition(), characterSkills: { q: skill({ castDelaySec: 11 }) } }]) assert.equal(saveGuestCharacterProfile(draft, store).ok, false);
  assert.equal(store.getItem(key), null);
});
await check('saving a second profile or updating one retains the other local definitions', () => {
  const store = memoryStorage(); saveGuestCharacterProfile(definition(), store);
  saveGuestCharacterProfile({ ...definition(), id: base[1]._id, name: '둘째' }, store);
  saveGuestCharacterProfile({ ...definition(), name: '수정 이름' }, store);
  const rows = readGuestCharacterProfiles(store).profiles;
  assert.equal(rows.length, 2); assert.equal(rows.find((row) => row.id === base[1]._id).name, '둘째');
});
await check('profile overlay keeps ID, equipment, stats, route and team and cannot mutate account characters or source definitions', () => {
  const source = [{ ...base[0], hp: 83, zoneId: 'alley', inventory: [{ name: 'material' }], teamId: 'team:4' },
    { ...base[0], guestDefault: false }];
  const before = structuredClone(source); const raw = definition(); const profileBefore = structuredClone(raw);
  const applied = applyGuestCharacterProfiles(source, [raw]);
  assert.deepEqual(source, before); assert.deepEqual(raw, profileBefore); assert.equal(applied[1], source[1]);
  for (const field of ['_id', 'hp', 'zoneId', 'inventory', 'stats', 'weaponType', 'teamId']) assert.deepEqual(applied[0][field], source[0][field]);
});
await check('successful pregame save immediately updates both candidates and selected actors without changing team assignments', () => {
  const store = memoryStorage(); let candidates = base; let selected = [{ ...base[0], teamId: 'team:8' }];
  const result = saveGuestCharacterBeforeMatch({ actorId: base[0]._id, draft: definition(), storage: store,
    state: { day: 0, matchSec: 0, candidateSurvivors: candidates },
    actions: { setCandidateSurvivors: (update) => { candidates = update(candidates); }, setSurvivors: (update) => { selected = update(selected); } } });
  assert.equal(result.ok, true); assert.equal(candidates[0].name, definition().name); assert.equal(selected[0].name, definition().name);
  assert.equal(selected[0].teamId, 'team:8'); assert.deepEqual(candidates[0].characterSkills, readGuestCharacterProfiles(store).profiles[0].characterSkills);
});
await check('running, started, finished, replay and synchronously locked matches reject writes even before React state catches up', () => {
  const store = memoryStorage(); const common = { day: 0, matchSec: 0, candidateSurvivors: base };
  for (const changed of [{ day: 1 }, { matchSec: 1 }, { isAdvancing: true }, { isGameOver: true }, { replayMode: true }, { isRunLocked: () => true }]) {
    assert.equal(saveGuestCharacterBeforeMatch({ actorId: base[0]._id, draft: definition(), storage: store, state: { ...common, ...changed } }).ok, false);
  }
  assert.equal(store.getItem(key), null);
});
await check('fresh guest bootstrap reloads explicit profiles while authenticated bootstrap ignores them', () => {
  const store = memoryStorage(); saveGuestCharacterProfile(definition(), store);
  const profiles = readGuestCharacterProfiles(store).profiles;
  const guest = resolveSimulationBootstrapData({ guestMode: true, guestProfiles: profiles }).charList;
  assert.equal(guest.length, 24); assert.equal(guest[0].name, definition().name);
  assert.equal(getCharacterSkillDef(guest[0], 'q').name, '시간차 일격');
  assert.deepEqual(resolveSimulationBootstrapData({ guestMode: false, charList: base, guestProfiles: profiles }).charList, base);
});
await check('renaming to an original subject does not grant fallback skills, stat bias or another weapon', () => {
  const renamed = applyGuestCharacterProfiles(base, [{ ...definition(), name: '비형', characterSkills: {} }])[0];
  assert.equal(getCharacterSkillDef(renamed, 'q'), null); assert.equal(getErSubjectPreset(renamed), null);
  const previous = applyErSubjectPreset(base[0]); const next = applyErSubjectPreset(renamed);
  assert.deepEqual(next.stats, previous.stats); assert.deepEqual(next.erWeapons, previous.erWeapons);
  assert.equal(getCharacterSkillDef({ name: '비형', characterSkills: { q: { enabled: false } } }, 'q'), null);
});
await check('automatic growth levels remain automatic and an explicit per-slot level stays fixed', () => {
  const profile = normalizeGuestCharacterProfile({ ...definition(), characterSkillLevels: { w: 3 } });
  const [row] = applyGuestCharacterProfiles(base, [profile]); row.erLevel = 13;
  assert.equal(getCharacterSkillLevel(row, 'q'), 4); assert.equal(getCharacterSkillLevel(row, 'w'), 3);
});
await check('passive health changes the real HP cap once and removing or disabling it restores the original cap', () => {
  const raw = { ...base[0], hp: 118, maxHp: 118, _perkBaseMaxHp: 118 };
  const profile = { ...definition(), characterSkills: { passive: { enabled: true, name: '건강', statModifiers: { maxHp: 30, attackPower: 2 } } } };
  const [once] = applyGuestCharacterProfiles([raw], [profile]);
  assert.equal(once.hp, 148); assert.equal(once.maxHp, 148); assert.equal(getEffectiveStats(once).maxHp, 148);
  const [twice] = applyGuestCharacterProfiles([once], [profile]); assert.deepEqual(twice, once);
  assert.equal(applyPerkBundleToActor(structuredClone(once), {}, {}).maxHp, 148);
  profile.characterSkills.passive.enabled = false;
  const [removed] = applyGuestCharacterProfiles([once], [profile]); assert.equal(removed.hp, 118); assert.equal(removed.maxHp, 118);
  assert.equal(getEffectiveStats(removed).attackPower, raw.stats.attackPower);
});
await check('negative passive health clamps without accumulating drift or reviving a dead actor', () => {
  const profile = { ...definition(), characterSkills: { passive: { enabled: true, name: '취약', statModifiers: { maxHp: -200 } } } };
  const [reduced] = applyGuestCharacterProfiles([{ ...base[0], hp: 118, maxHp: 118 }], [profile]);
  assert.equal(reduced.maxHp, 1); assert.equal(reduced.hp, 1);
  profile.characterSkills = {};
  const [restored] = applyGuestCharacterProfiles([reduced], [profile]); assert.equal(restored.maxHp, 118); assert.equal(restored.hp, 118);
  assert.equal(applyGuestCharacterProfiles([{ ...reduced, hp: 0 }], [profile])[0].hp, 0);
});
await check('fresh initialization uses the same passive health as pregame editing without double application', async () => {
  const store = memoryStorage(); const profile = { ...definition(), characterSkills: { passive: { enabled: true, name: '건강', statModifiers: { maxHp: 30 } } } };
  assert.equal(saveGuestCharacterProfile(profile, store).ok, true);
  const fresh = JSON.parse(await createRandomIsolationInput('passive-initial', { guestProfiles: readGuestCharacterProfiles(store).profiles }));
  const row = fresh.survivors.find((entry) => entry._id === base[0]._id);
  assert.equal(row.hp, 148); assert.equal(row.maxHp, 148); assert.equal(getEffectiveStats(row).maxHp, 148);
  assert.equal(applyGuestCharacterProfiles([row], [profile])[0].maxHp, 148);
});
await check('saved local 24-person team order reloads using stable IDs and the edited skill definitions', () => {
  const store = memoryStorage(); const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: store });
  try {
    saveGuestCharacterProfile(definition(), store);
    const roster = applyGuestCharacterProfiles(base, readGuestCharacterProfiles(store).profiles);
    let selected; const ordered = [...roster].reverse().map((row) => row._id);
    const actions = createParticipantPresetActionRuntime({ state: { day: 0, matchSec: 0, candidateSurvivors: roster, settings: { matchMode: 'squad' } },
      actions: { setSurvivors: (value) => { selected = value; } } });
    assert.equal(actions.applyCustomParticipantRoster({ characterIds: ordered,
      teamAssignments: Object.fromEntries(ordered.map((id, index) => [id, Math.floor(index / 3) + 1])) }).ok, true);
    const fresh = resolveSimulationBootstrapData({ guestMode: true, guestProfiles: readGuestCharacterProfiles(store).profiles }).charList;
    const picked = pickParticipantsForRun(fresh, readLocalParticipantPresets(), CUSTOM_PARTICIPANT_PRESET_ID, { matchMode: 'squad' });
    assert.deepEqual(picked.map((row) => row._id), selected.map((row) => row._id));
    assert.equal(getCharacterSkillDef(picked.find((row) => row._id === base[0]._id), 'q').name, '시간차 일격');
  } finally { if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else delete globalThis.localStorage; }
});
await check('edited then reloaded definitions produce actual delayed damage with the chosen category', async () => {
  const store = memoryStorage(); saveGuestCharacterProfile(definition(), store);
  const [profiled] = applyGuestCharacterProfiles([actor(base[0]._id, { guestDefault: true })], readGuestCharacterProfiles(store).profiles);
  const result = await runCombatScenario([profiled, actor('enemy', { _basicAttackReadyAtSec: 200 })]);
  const cast = result.events.find((event) => event.kind === 'skill_cast');
  const hit = result.events.find((event) => event.kind === 'damage' && event.castId);
  assert.equal(cast.skill, '시간차 일격'); assert.equal(hit.at.sec, 101.25); assert.equal(hit.type, 'true'); assert.ok(hit.hpDamage >= 40);
});
await check('changing local definitions after input capture cannot rewrite a saved replay', async () => {
  const fixture = JSON.parse(await createRandomIsolationInput());
  const store = memoryStorage(); saveGuestCharacterProfile(definition(), store);
  fixture.survivors = applyGuestCharacterProfiles(fixture.survivors, readGuestCharacterProfiles(store).profiles);
  const input = createSimulationRunInput({ ...fixture, activeMap: fixture.map, publicItems: fixture.items }, store);
  saveGuestCharacterProfile({ ...definition(), name: '나중 이름', characterSkills: {} }, store);
  const restored = prepareSimulationRunInput(input).state.survivors.find((row) => row._id === base[0]._id);
  assert.equal(restored.name, definition().name); assert.equal(getCharacterSkillDef(restored, 'q').name, '시간차 일격');
});
await check('24 saved local character definitions survive full initialization, a complete match and replay after later profile edits', async () => {
  const store = memoryStorage(); let apiCalls = 0; const fetchBefore = globalThis.fetch;
  globalThis.fetch = () => { apiCalls++; throw Error('Guest profile match must not use account APIs.'); };
  try {
    base.forEach((row, index) => assert.equal(saveGuestCharacterProfile({ id: row._id, name: `로컬 참가자 ${index + 1}`, tacticalSkill: row.tacticalSkill,
      characterSkills: {
        q: skill({ name: '직접 작성 Q', type: index % 3 ? 'attack_skill' : 'basic_attack_enhance', firstFlat: [15], flatDamage: [15], cooldownSec: 8.5 }),
        w: skill({ name: '직접 작성 W', type: index % 2 ? 'shield_skill' : 'heal_skill', flatDamage: [0],
          heal: index % 2 ? [0] : [30], shield: index % 2 ? [20] : [0], cooldownSec: 12, castDelaySec: 0.5, durationSec: 2.5 }),
        passive: { enabled: index % 4 === 0, name: '직접 작성 패시브', statModifiers: { maxHp: 20, attackPower: 2 } },
      } }, store).ok, true));
    const fixture = JSON.parse(await createRandomIsolationInput('local-profiles-1', { guestProfiles: readGuestCharacterProfiles(store).profiles }));
    assert.ok(fixture.survivors.every((row) => row.localProfile && getCharacterSkillDef(row, 'q') && getCharacterSkillDef(row, 'w')));
    const input = createSimulationRunInput({ ...fixture, activeMap: fixture.map, publicItems: fixture.items }, store);
    const first = await runRandomIsolationMatch(null, { savedInput: input });
    const casts = first.events.filter((event) => event.kind === 'skill_cast');
    const impacts = first.events.filter((event) => event.kind === 'skill' && event.castId);
    assert.ok(casts.length > 0); assert.ok(impacts.some((event) => event.heal > 0)); assert.ok(impacts.some((event) => event.shield > 0));
    const byId = new Map(casts.map((cast) => [cast.castId, cast]));
    assert.ok(impacts.every((event) => event.at.sec >= byId.get(event.castId).releaseAtSec));
    assert.equal(saveGuestCharacterProfile({ ...definition(), name: '과거를 바꾸지 않는 새 이름', characterSkills: {} }, store).ok, true);
    const second = await runRandomIsolationMatch(null, { savedInput: input, noisy: true });
    const comparison = compareSimulationReplay({ events: first.events, finalFrame: first.finalFrame, random: first.evidence.random },
      { events: second.events, finalFrame: second.finalFrame, random: second.evidence.random });
    assert.equal(comparison.matched, true); assert.equal(first.evidence.frameDigest, second.evidence.frameDigest); assert.equal(apiCalls, 0);
    console.log(`GUEST_CHARACTER_PROFILE_MATCH ${JSON.stringify({ ...first.evidence, casts: casts.length, impacts: impacts.length, comparison, apiCalls })}`);
  } finally { globalThis.fetch = fetchBefore; }
});
console.log(`GUEST_CHARACTER_PROFILE_CHECKS ${checks}/${checks}`);
