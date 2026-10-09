import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const editor = await import('../src/app/characters/_lib/characterEditorRuntime.js');
const { applyErSubjectPreset, getErSubjectPreset, ER_SUBJECT_PRESETS } = await import('../src/utils/erMeta.js');
const { ER_STAT_KEYS, DEFAULT_ER_STATS, normalizeErStats } = await import('../src/utils/erStats.js');
const { compactCharactersForSave } = await import('../src/utils/characterPayload.js');
const { buildInitialSimulationRoster } = await import('../src/app/simulation/_lib/simulationInitialRosterRuntime.js');
const { getRuleset } = await import('../src/utils/rulesets.js');

// Exercise the real page callback without React/browser, API, or account writes.
// Do not replace this with a copy of its expected implementation.
const page = readFileSync(new URL('../src/app/characters/page.js', import.meta.url), 'utf8');
const body = page.match(/const applyErPresetToCharacter = \(targetId\) => \{([\s\S]*?)\n  \};/);
assert.ok(body, 'The production ER-preset callback must exist');
const makeCallback = new Function('characters', 'setDirty', 'setCharacters', 'alert',
  'characterId', 'getErSubjectPreset', 'applyErSubjectPreset', 'applyErPresetForEditing',
  'return (targetId) => {' + body[1] + '};');

function character(name = '헤이즈', extra = {}) {
  return { ...editor.createBlankCharacter('er-editor-fixture'),
    _id: '507f1f77bcf86cd799439011', name, ...extra };
}
function pageState(initial) {
  const other = character('다른 대원', { _id: '507f1f77bcf86cd799439099' });
  let characters = [initial, other], dirty = 0;
  const messages = [];
  return {
    apply(targetId = editor.characterId(initial)) {
      const callback = makeCallback(characters, value => { if (value) dirty++; },
        update => { characters = update(characters); }, message => messages.push(message),
        editor.characterId, getErSubjectPreset, applyErSubjectPreset, editor.applyErPresetForEditing);
      callback(targetId);
    },
    current: () => characters[0], other: () => characters[1],
    dirty: () => dirty, messages,
  };
}
function actorFor(source, rulesetId = 'ER_S11', simulationRuleset) {
  const before = structuredClone(source);
  const roster = buildInitialSimulationRoster({
    charList: [source], initialZoneIds: ['school'],
    loadedSettings: { rulesetId, simulationRuleset },
  });
  assert.deepEqual(source, before, 'Roster setup must not rewrite the saved base');
  assert.ok(roster.candidateChars[0], 'Use an account-shaped ID accepted by the real roster');
  return roster.candidateChars[0];
}

let passed = 0, failed = 0, presetComparisons = 0;
function check(name, run) {
  try { run(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name, error); }
}
check('actual editor callback preserves the base and the real roster applies one Haze bias', () => {
  const source = character(), before = structuredClone(source), state = pageState(source);
  state.apply();
  const edited = state.current();
  assert.deepEqual(source, before);
  assert.equal(edited.erSubject, 'haze');
  assert.equal(edited.weaponType, '돌격소총');
  assert.equal(edited.tacticalSkill, '리펄서 미사일');
  assert.deepEqual(edited.stats, before.stats);
  assert.equal(edited.stats.attackPower, 24);
  assert.equal(actorFor(edited).stats.attackPower, 29.7);
  assert.equal(state.dirty(), 1);
  assert.equal(state.messages.length, 1);
});
check('repeated actual editor applications and new matches do not accumulate bias', () => {
  const source = character(), state = pageState(source), other = state.other();
  state.apply();
  const first = structuredClone(state.current()), firstActor = actorFor(state.current());
  state.apply(); state.apply();
  assert.deepEqual(state.current(), first);
  assert.strictEqual(state.other(), other);
  assert.deepEqual(state.current().stats, source.stats);
  assert.deepEqual(actorFor(state.current()).stats, firstActor.stats);
  assert.equal(state.dirty(), 3);
});
check('editor helper preserves authored precision and object identity without consuming randomness', () => {
  assert.equal(typeof editor.applyErPresetForEditing, 'function');
  const source = character('헤이즈', { stats: { ...DEFAULT_ER_STATS, maxHp: 151.55, attackPower: 24.12345 } });
  const before = structuredClone(source), originalRandom = Math.random;
  let configured;
  try {
    Math.random = () => { throw Error('Editing must not consume match randomness'); };
    configured = editor.applyErPresetForEditing(source);
  } finally { Math.random = originalRandom; }
  assert.strictEqual(configured.stats, source.stats);
  assert.deepEqual(configured.stats, before.stats);
  assert.deepEqual(source, before);
});
check('all current named presets use the actual selected ruleset scale exactly once', () => {
  const fullRules = getRuleset('ER_S11');
  const zeroScaleRules = { ...fullRules, ai: { ...fullRules.ai, erPresetStatScale: 0 } };
  assert.ok(ER_SUBJECT_PRESETS.length > 0);
  for (const preset of ER_SUBJECT_PRESETS) {
    const source = character(preset.names[0]), state = pageState(source);
    state.apply(); state.apply();
    assert.deepEqual(state.current().stats, source.stats);
    for (const [rulesetId, scale, override] of [['ER_S11', 0, zeroScaleRules], ['LEGACY', 0.45], ['ER_S11', 1]]) {
      assert.equal(getRuleset(rulesetId, override).ai.erPresetStatScale, scale);
      const expected = normalizeErStats(Object.fromEntries(ER_STAT_KEYS.map(key => [
        key, Number(source.stats[key]) + Number(preset.statBias?.[key] || 0) * scale,
      ])));
      assert.deepEqual(actorFor(state.current(), rulesetId, override).stats, expected, preset.code + ':' + scale);
      presetComparisons++;
    }
  }
  assert.equal(presetComparisons, ER_SUBJECT_PRESETS.length * 3);
});
check('actual save payload and editor reload keep base stats before new roster initialization', () => {
  const state = pageState(character()); state.apply();
  const payload = compactCharactersForSave([state.current()]);
  assert.equal(payload[0].stats.attackPower, 24);
  assert.equal(payload[0].erSubject, 'haze');
  const loaded = editor.normalizeCharacterEditorList(JSON.parse(JSON.stringify(payload)))[0];
  const restored = pageState(loaded); restored.apply();
  assert.equal(restored.current().stats.attackPower, 24);
  assert.equal(actorFor(restored.current()).stats.attackPower, 29.7);
});
check('authored tactical/weapon/skills/resources/loadouts/results and explicit zero biases remain intact', () => {
  const source = character('헤이즈', {
    tacticalSkill: '초월', weaponType: '권총', erWeapons: ['권총'],
    erTrait: 'fortress', erRole: 'tank', erAggressionBias: 0, erEscapeBias: -0.03,
    previewImage: 'authored-image', records: [{ wins: 2 }],
    uniqueResource: { enabled: true, name: '수동 자원', maxValue: 50, startValue: 13, regenPerSec: 0 },
    goalLoadouts: { hero: { weaponKey: 'authored-key' } },
  });
  source.characterSkills.q = { ...source.characterSkills.q, enabled: true, name: '수동 Q', firstFlat: [9, 10, 11, 12, 13] };
  const before = structuredClone(source), state = pageState(source); state.apply(); state.apply();
  for (const key of ['_id', 'id', 'stats', 'tacticalSkill', 'weaponType', 'erWeapons', 'erTrait', 'erRole',
    'erAggressionBias', 'erEscapeBias', 'characterSkills', 'uniqueResource', 'goalLoadouts', 'previewImage', 'records']) {
    assert.deepEqual(state.current()[key], before[key], key);
  }
  assert.deepEqual(source, before);
  assert.equal(Object.hasOwn(compactCharactersForSave([state.current()])[0], 'records'), false);
});
check('unknown custom character and missing target do not become a guessed ER preset', () => {
  const source = character('프리셋에 없는 수동 캐릭터'), state = pageState(source);
  state.apply(); state.apply('missing-id');
  assert.strictEqual(state.current(), source);
  assert.strictEqual(editor.applyErPresetForEditing(source), source);
  assert.equal(state.dirty(), 0);
  assert.equal(state.messages.length, 2);
});
check('explicit subject wins a conflicting known name and local profiles opt out of named ER presets', () => {
  assert.equal(getErSubjectPreset('재키').code, 'jackie');
  const explicit = character('재키', { erSubject: 'haze' }), state = pageState(explicit);
  assert.equal(getErSubjectPreset(explicit).code, 'haze');
  state.apply();
  assert.equal(state.current().erSubject, 'haze');
  assert.equal(state.current().weaponType, '돌격소총');
  assert.equal(state.current().tacticalSkill, '리펄서 미사일');
  assert.deepEqual(state.current().stats, explicit.stats);
  assert.equal(actorFor(state.current()).stats.attackPower, 29.7);
  const guest = character('헤이즈', { localProfile: true });
  assert.strictEqual(getErSubjectPreset(guest), null);
  assert.strictEqual(editor.applyErPresetForEditing(guest), guest);
  const guestState = pageState(guest); guestState.apply();
  assert.strictEqual(guestState.current(), guest);
  assert.equal(guestState.dirty(), 0);
  // Existing generic runtime fallback remains allowed. Only the named ER
  // identity/stat bonus is opted out; do not claim all runtime metadata is absent.
  const guestActor = actorFor(guest);
  assert.strictEqual(getErSubjectPreset(guestActor), null);
  assert.notEqual(guestActor.erSubject, 'haze');
  assert.deepEqual(guestActor.stats, guest.stats);
});
check('old unmarked or deliberate stat values are not guessed and reverse-subtracted', () => {
  const source = character('헤이즈', { erSubject: 'haze', stats: { ...DEFAULT_ER_STATS, attackPower: 29.7 } });
  const state = pageState(source); state.apply(); state.apply();
  assert.equal(state.current().stats.attackPower, 29.7);
  assert.equal(actorFor(state.current()).stats.attackPower, 35.4);
});
console.log('ER_PRESET_EDITOR_CHECKS ' + passed + '/' + (passed + failed) + ' presetComparisons=' + presetComparisons);
if (failed) process.exitCode = 1;
