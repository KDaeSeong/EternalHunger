import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import contract from '../../server/utils/characterSetupContract.js';
import fixtures from '../../server/tests/fixtures/character-setup-fixture.js';
const { createBlankCharacter, normalizeCharacterEditorList } = await import('../src/app/characters/_lib/characterEditorRuntime.js');
const { createCharacterSetupPatch, normalizeCharacterSetupDraft } = await import('../src/utils/characterSetupDraft.js');
const { compactCharactersForSave } = await import('../src/utils/characterPayload.js');
const { ER_STAT_KEYS, DEFAULT_ER_STATS } = await import('../src/utils/erStats.js');
const { WEAPON_TYPES_KO } = await import('../src/utils/equipmentCatalog.js');
const { getCharacterSkillDef } = await import('../src/app/simulation/_lib/characterSkillDefinitionRuntime.js');
const { previewCharacterSkill } = await import('../src/app/simulation/_lib/characterSkillRuntime.js');
const { resolveCombatWinnerOutcome } = await import('../src/app/simulation/_lib/phaseCombatDamageRuntime.js');

const draft = () => contract.sanitizeCharacterSetup(fixtures.makeSetup());
let passed = 0;
function check(name, run) { run(); passed++; console.log(`PASS ${name}`); }
check('the API contract uses the actual stat and weapon vocabulary', () => {
  assert.deepEqual(Object.keys(contract.STAT_RANGES).sort(), [...ER_STAT_KEYS].sort());
  assert.deepEqual([...contract.WEAPONS].sort(), [...WEAPON_TYPES_KO].sort());
});
check('a blank account character gains all five executable slots without source mutation', () => {
  const blank = createBlankCharacter('setup-fixture'), before = structuredClone(blank);
  const { patch, applied, preserved } = createCharacterSetupPatch(blank, draft());
  assert.deepEqual(blank, before); assert.equal(patch.stats.maxHp, 110);
  assert.equal(preserved.length, 0);
  for (const slot of contract.SLOTS) { assert.equal(patch.characterSkills[slot].enabled, true); assert.ok(applied.includes(slot.toUpperCase())); }
  assert.deepEqual(patch.erWeapons, ['글러브']); assert.equal(patch.weaponType, '글러브');
});
check('authored names, stats, weapons and enabled or unfinished skills are kept by default', () => {
  const character = createBlankCharacter('setup-fixture');
  character.name = '내 캐릭터'; character.stats = { ...DEFAULT_ER_STATS, maxHp: 123 };
  character.erWeapons = ['카메라']; character.weaponType = '카메라'; character.summary = '내 설정';
  character.characterSkills.q = { ...character.characterSkills.q, enabled: false, name: '작성 중인 Q',
    firstFlat: [17, 18, 19, 20, 21], statusEffects: [{ name: '미완성 상태' }] };
  const before = structuredClone(character), result = createCharacterSetupPatch(character, draft());
  for (const key of ['name', 'stats', 'erWeapons', 'weaponType', 'summary']) assert.equal(Object.hasOwn(result.patch, key), false);
  assert.deepEqual(result.patch.characterSkills.q, character.characterSkills.q);
  assert.equal(result.patch.characterSkills.w.enabled, true); assert.deepEqual(character, before);
  assert.ok(result.preserved.includes('Q'));
});
check('explicit replacement switches authored content while keeping IDs/images/results/loadouts', () => {
  const character = { ...createBlankCharacter('setup-fixture'), name: '내 캐릭터', _id: '507f1f77bcf86cd799439011',
    previewImage: 'my-image', records: [{ wins: 2 }], inventory: [{ id: 'my-item' }],
    goalLoadouts: { hero: { weaponKey: 'my-key' } }, hp: 27, characterSkillLevels: { q: 3 }, tacticalSkill: '블링크' };
  const before = structuredClone(character), { patch } = createCharacterSetupPatch(character, draft(), { replaceExisting: true });
  const merged = { ...character, ...patch };
  assert.equal(merged.name, '검사 캐릭터');
  for (const field of ['id', '_id', 'previewImage', 'records', 'inventory', 'goalLoadouts', 'hp', 'characterSkillLevels', 'tacticalSkill']) {
    assert.equal(Object.hasOwn(patch, field), false); assert.deepEqual(merged[field], before[field]);
  }
});
check('numeric unfinished slot edits are not mistaken for blank shells', () => {
  const character = createBlankCharacter('setup-fixture'); character.characterSkills.e.firstFlat = [3, 0, 0, 0, 0];
  const result = createCharacterSetupPatch(character, draft());
  assert.deepEqual(result.patch.characterSkills.e, character.characterSkills.e); assert.ok(result.preserved.includes('E'));
});
check('resource mismatch rejects the patch before mutating the character', () => {
  const character = createBlankCharacter('setup-fixture');
  character.uniqueResource = { enabled: true, name: '작은 자원', maxValue: 5, startValue: 0, regenPerSec: 0 };
  const raw = fixtures.makeSetup(); raw.uniqueResource = { enabled: true, name: '큰 자원', maxValue: 50, startValue: 50, regenPerSec: 0 };
  raw.characterSkills.e.resourceCost = 10; const response = contract.sanitizeCharacterSetup(raw), before = structuredClone(character);
  assert.throws(() => createCharacterSetupPatch(character, response), /고유 자원/); assert.deepEqual(character, before);
  assert.equal(createCharacterSetupPatch(character, response, { replaceExisting: true }).patch.uniqueResource.maxValue, 50);
});
check('invalid drafts and forged origins fail with the original character untouched', () => {
  const character = createBlankCharacter('setup-fixture'), before = structuredClone(character);
  for (const raw of [{ ...draft(), origin: 'saved-official' }, { ...draft(), schema: 'unknown' },
    { ...draft(), characterSkills: {} }]) assert.throws(() => createCharacterSetupPatch(character, raw));
  assert.deepEqual(character, before);
});
check('small percentage values survive editor normalization and the real save payload', () => {
  const character = { ...createBlankCharacter('setup-fixture'), ...createCharacterSetupPatch(createBlankCharacter('setup-fixture'), draft()).patch };
  const payload = compactCharactersForSave([character]);
  assert.equal(payload[0].characterSkills.q.hpDamagePercentUnit, 'percent');
  assert.equal(payload[0].characterSkills.q.maxHpPct[0], 0.2);
  assert.equal(Object.hasOwn(payload[0], 'records'), false);
  const edited = normalizeCharacterEditorList(payload)[0];
  assert.equal(edited.characterSkills.q.maxHpPct[0], 0.2);
  for (const slot of contract.SLOTS) assert.equal(edited.characterSkills[slot].enabled, true);
});
check('an applied auto-draft is read by actual combat, not merely displayed in the editor', () => {
  const character = { ...createBlankCharacter('setup-fixture'), ...createCharacterSetupPatch(createBlankCharacter('setup-fixture'), draft()).patch };
  const caster = { ...character, _id: 'caster', teamId: 'one', hp: 110, maxHp: 110, zoneId: 'school',
    _spatial: { zoneId: 'school', x: 4, y: 4 }, characterSkillLevels: { q: 1 } };
  const target = { _id: 'target', name: '대상', teamId: 'two', hp: 5000, maxHp: 5000, zoneId: 'school',
    _spatial: { zoneId: 'school', x: 4, y: 4 }, stats: { maxHp: 5000, defense: 0, attackPower: 0, skillAmp: 0,
      attackSpeed: 1, attackRange: 2, sightRange: 10 } };
  const def = getCharacterSkillDef(caster, 'q'), prepared = previewCharacterSkill(caster, target, def, 1, { nowSec: 100 });
  assert.ok(prepared); const events = [];
  const result = resolveCombatWinnerOutcome({ state: { actor: caster, target, preparedSkill: prepared,
    currentActionSec: () => 100, pvpCfg: { criticalFleeHpBelow: 0 } }, actions: { emitRunEvent: (kind, data) => events.push({ kind, ...data }) } });
  assert.equal(result.performed, true); assert.equal(5000 - target.hp, 10); assert.ok(events.some(event => event.kind === 'skill'));
});
check('unsupported passive warning stays visible without fabricating a permanent bonus', () => {
  const raw = fixtures.makeSetup(); raw.characterSkills.passive = { enabled: false, type: 'passive_stat', name: '중첩 미지원' };
  const normalized = normalizeCharacterSetupDraft(contract.sanitizeCharacterSetup(raw));
  assert.equal(normalized.characterSkills.passive.enabled, false); assert.deepEqual(normalized.characterSkills.passive.statModifiers, {});
  assert.ok(normalized.warnings.some(text => text.includes('PASSIVE')));
});
check('disabled generated effects fail atomically, without altering authored character skills', () => {
  const character = createBlankCharacter('setup-fixture'), before = structuredClone(character);
  for (const slot of ['q', 'passive']) {
    const raw = draft(); raw.characterSkills[slot].enabled = false;
    assert.throws(() => createCharacterSetupPatch(character, raw), /비활성/);
    assert.deepEqual(character, before);
  }
});
console.log(`Character automatic setup checks passed: ${passed}`);
