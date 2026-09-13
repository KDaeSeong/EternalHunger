import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';

const { buildSkillCodePreview, compileNaturalSkillDescription, createDefaultCompiledSkill } =
  await import('../src/utils/characterSkillCompiler.js');
const { CHARACTER_STATUS_EFFECT_OPTIONS, getCharacterStatusSkillError } =
  await import('../src/utils/characterStatusSkillDefinition.js');
const { normalizeCharacterSkillForEditor } =
  await import('../src/app/characters/_lib/characterEditorRuntime.js');
const { getCharacterSkillDef } =
  await import('../src/app/simulation/_lib/characterSkillDefinitionRuntime.js');

let passed = 0;
let failed = 0;
function check(name, run) {
  try { run(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { failed += 1; console.error(`FAIL ${name}: ${error.message}`); }
}

function previewDefinition(skill) {
  const code = buildSkillCodePreview(skill);
  assert.match(code, /^const (q|w|e|r|passive)Skill = /);
  return JSON.parse(code.slice(code.indexOf('=') + 1, -1));
}

const sleep = { name: '수면', target: 'target', durationSec: 2.5, wakeDamagePct: 0 };
const cleanse = { name: '해로운 효과 제거', target: 'target', durationSec: 0 };
const attack = (extra = {}) => createDefaultCompiledSkill({
  enabled: true, slot: 'q', type: 'attack_skill', name: '직접 작성',
  statusEffects: [sleep], ...extra,
}, extra.slot || 'q');
const support = (extra = {}) => attack({
  slot: 'w', type: 'support_skill', supportTargetScope: 'team', statusEffects: [cleanse], ...extra,
});

check('preview includes every canonical field except description text', () => {
  const original = attack({ sourceText: '원문', damageType: 'true', includesMovement: true,
    movementMode: 'toward_target', movementDistance: 3,
    attackPowerScale: 1.25, secondAttackPowerScale: 0.5 });
  const expected = { ...original };
  delete expected.sourceText;
  assert.deepEqual(previewDefinition(original), expected);
});

check('preview strips live state without losing explicit zero status values', () => {
  const result = previewDefinition({ ...attack(), pendingCast: { id: 'forged' },
    statusEffects: [{ ...sleep, sourceActorId: 'forged', remainingDuration: 999, tags: ['immune'] }] });
  assert.equal(Object.hasOwn(result, 'pendingCast'), false);
  assert.deepEqual(result.statusEffects, [sleep]);
});

check('all 21 supported states survive preview, editor normalization and runtime definition', () => {
  assert.equal(CHARACTER_STATUS_EFFECT_OPTIONS.length, 21);
  for (const option of CHARACTER_STATUS_EFFECT_OPTIONS) {
    const effect = { name: option.value, target: 'target',
      durationSec: option.value === '해로운 효과 제거' ? 0 : 2 };
    const authored = option.harmful ? attack({ statusEffects: [effect] }) : support({ statusEffects: [effect] });
    const preview = previewDefinition(authored);
    const edited = normalizeCharacterSkillForEditor({ [authored.slot]: preview }, authored.slot);
    const runtime = getCharacterSkillDef({ _id: 'authoring', characterSkills: { [authored.slot]: edited } }, authored.slot);
    assert.deepEqual(edited.statusEffects, [effect], option.value);
    assert.deepEqual(runtime?.statusEffects, [effect], option.value);
  }
});

check('existing enemy control stays an attack when its definition also heals', () => {
  const original = attack({ heal: [25, 25, 25, 25, 25] });
  const result = compileNaturalSkillDescription('쿨타임 9초', original, 'q');
  assert.equal(result.ok, true);
  assert.equal(result.skill.type, 'attack_skill');
  assert.equal(result.skill.cooldownSec, 9);
  assert.deepEqual(result.skill.statusEffects, [sleep]);
  assert.deepEqual(result.skill.heal, original.heal);
  assert.deepEqual(normalizeCharacterSkillForEditor({ q: result.skill }, 'q').statusEffects, [sleep]);
});

check('cleanse remains a support skill when text adds healing', () => {
  const result = compileNaturalSkillDescription('아군을 10/20/30/40/50 회복, 쿨타임 12초', support(), 'w');
  assert.equal(result.ok, true);
  assert.equal(result.skill.type, 'support_skill');
  assert.equal(result.skill.supportTargetScope, 'ally');
  assert.deepEqual(result.skill.heal, [10, 20, 30, 40, 50]);
  assert.deepEqual(result.skill.statusEffects, [cleanse]);
  assert.equal(getCharacterStatusSkillError(result.skill), '');
});

check('invalid existing duration is rejected before a normalizer can erase it', () => {
  const original = { ...attack(), statusEffects: [{ ...sleep, durationSec: 0 }] };
  const before = JSON.stringify(original);
  const result = compileNaturalSkillDescription('쿨타임 12초', original, 'q');
  assert.equal(result.ok, false);
  assert.deepEqual(result.skill, original);
  assert.equal(JSON.stringify(original), before);
  assert.ok(result.warnings.length > 0);
});

check('a text conflict cannot replace an ally cleanse with an enemy attack', () => {
  const original = support();
  const result = compileNaturalSkillDescription('20 피해, 쿨타임 8초', original, 'w');
  assert.equal(result.ok, false);
  assert.deepEqual(result.skill, original);
  assert.equal(result.skill.cooldownSec, original.cooldownSec);
  assert.deepEqual(result.skill.statusEffects, [cleanse]);
});

check('text without target or health conditions preserves manual settings', () => {
  const original = support({ targetPriority: 'lowest_hp', useCondition: 'defensive',
    minCasterHpPct: 0.1, maxCasterHpPct: 0.8, minTargetHpPct: 0.2, maxTargetHpPct: 0.7 });
  const result = compileNaturalSkillDescription('쿨타임 9초', original, 'w');
  assert.equal(result.ok, true);
  for (const key of ['targetPriority', 'useCondition', 'supportTargetScope',
    'minCasterHpPct', 'maxCasterHpPct', 'minTargetHpPct', 'maxTargetHpPct']) {
    assert.equal(result.skill[key], original[key], key);
  }
});

check('an explicit zero HP condition is distinguished from an absent condition', () => {
  const result = compileNaturalSkillDescription('자신 체력 0% 이하', support({ maxCasterHpPct: 0.8 }), 'w');
  assert.equal(result.ok, true);
  assert.equal(result.skill.maxCasterHpPct, 0);
  assert.equal(result.skill.supportTargetScope, 'self');
});

check('a status-only skill is not warned to have no effects', () => {
  const result = compileNaturalSkillDescription('쿨타임 9초', attack(), 'q');
  assert.equal(result.ok, true);
  assert.equal(result.warnings.some((line) => line.includes('효과가 없습니다')), false);
});

check('attack coefficients count as damage without requiring a flat term', () => {
  const original = attack({ statusEffects: [], attackPowerScale: 1 });
  const result = compileNaturalSkillDescription('쿨타임 9초', original, 'q');
  assert.equal(result.ok, true);
  assert.equal(result.skill.type, 'attack_skill');
  assert.equal(result.warnings.some((line) => line.includes('효과가 없습니다')), false);
});

check('a healing amplification coefficient does not turn a legacy heal into damage', () => {
  const result = compileNaturalSkillDescription('아군을 20 회복, 스킬 증폭 50%', {}, 'w');
  assert.equal(result.ok, true);
  assert.equal(result.skill.type, 'heal_skill');
  assert.deepEqual(result.skill.heal, [20, 20, 20, 20, 20]);
  assert.equal(result.skill.firstSkillAmpScale, 0.5);
});

check('a coefficient-only second stage retains its recast window', () => {
  const original = attack({ type: 'basic_attack_enhance', secondAttackPowerScale: 1, recastWindowSec: 3 });
  const result = compileNaturalSkillDescription('쿨타임 9초', original, 'q');
  assert.equal(result.ok, true);
  assert.equal(result.skill.recastWindowSec, 3);
  assert.equal(result.warnings.some((line) => line.includes('2타 피해')), false);
});

check('empty descriptions do not enable a disabled skill or overwrite its draft', () => {
  const original = attack({ enabled: false });
  const result = compileNaturalSkillDescription('  ', original, 'q');
  assert.equal(result.ok, false);
  assert.deepEqual(result.skill, original);
});

check('plain text cannot invent a status that was not explicitly authored', () => {
  const result = compileNaturalSkillDescription('적을 3초 동안 기절시킨다', attack({ statusEffects: [] }), 'q');
  assert.equal(result.ok, true);
  assert.deepEqual(result.skill.statusEffects, []);
});

check('invalid previews show an explanation instead of a silently incomplete definition', () => {
  const original = { ...attack(), statusEffects: [{ ...sleep, durationSec: 0 }] };
  const before = JSON.stringify(original);
  assert.match(buildSkillCodePreview(original), /^\/\/ 코드 미리보기를 생성하지 않았습니다\./);
  assert.equal(JSON.stringify(original), before);
});

console.log(`CHARACTER_SKILL_AUTHORING_CHECKS ${passed}/${passed + failed}`);
if (failed) process.exitCode = 1;
