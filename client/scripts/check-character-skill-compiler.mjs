import { compileNaturalSkillDescription } from '../src/utils/characterSkillCompiler.js';
import { applyCharacterSkillOnBasicAttack } from '../src/app/simulation/_lib/characterSkillRuntime.js';
import { getCharacterSkillDef } from '../src/app/simulation/_lib/characterSkillDefinitionRuntime.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function allZero(list) {
  return Array.isArray(list) && list.every((value) => Number(value || 0) === 0);
}

function sameList(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((value, index) => Number(value) === Number(expected[index]));
}

const singleStage = compileNaturalSkillDescription(
  '적 1인에게 10/10/20/20/30 피해 + 최대 체력의 5/5/5/5/5% 피해',
  {},
  'q'
).skill;
assert(singleStage.type === 'attack_skill', 'single-stage damage should compile as attack_skill');
assert(sameList(singleStage.firstFlat, [10, 10, 20, 20, 30]), 'single-stage flat damage parse failed');
assert(sameList(singleStage.maxHpPct, [5, 5, 5, 5, 5]), 'single-stage max HP percent parse failed');
assert(allZero(singleStage.secondFlat), 'single-stage text must not create second flat damage');
assert(allZero(singleStage.secondMaxHpPct), 'single-stage text must not create second max HP percent damage');
assert(allZero(singleStage.secondCurrentHpPct), 'single-stage text must not create second current HP percent damage');
assert(Number(singleStage.recastWindowSec || 0) === 0, 'single-stage text must not create recast window');

const recast = compileNaturalSkillDescription(
  'Q: 적 1인에게 10/20/30/40/50 피해, 쿨타임 7초, 5초 안에 다시 발동하면 20/30/40/50/60 피해, 범위 1, 대상 현재 체력의 1/1/2/2/3% 추가 피해',
  {},
  'q'
).skill;
assert(recast.type === 'basic_attack_enhance', 'recast text should compile as basic_attack_enhance');
assert(Number(recast.recastWindowSec || 0) === 5, 'recast window parse failed');
assert(sameList(recast.secondFlat, [20, 30, 40, 50, 60]), 'recast second flat damage parse failed');
assert(sameList(recast.secondCurrentHpPct, [1, 1, 2, 2, 3]), 'recast second current HP percent parse failed');

const passive = compileNaturalSkillDescription('패시브: 공격력 +10, 스킬증폭 +15, 시야 +1', {}, 'passive').skill;
assert(passive.type === 'passive_stat', 'passive should compile as passive_stat');
assert(Number(passive.statModifiers.attackPower || 0) === 10, 'passive attackPower parse failed');
assert(Number(passive.statModifiers.skillAmp || 0) === 15, 'passive skillAmp parse failed');
assert(Number(passive.statModifiers.sightRange || 0) === 1, 'passive sightRange parse failed');

const heal = compileNaturalSkillDescription('회복 스킬: 아군을 10/20/30/40/50 회복, 쿨타임 12초', {}, 'w').skill;
assert(heal.type === 'heal_skill', 'heal text should compile as heal_skill');
assert(sameList(heal.heal, [10, 20, 30, 40, 50]), 'heal amount parse failed');

const shield = compileNaturalSkillDescription('보호막 스킬: 자신에게 보호막 20/30/40/50/60, 3초 지속', {}, 'e').skill;
assert(shield.type === 'shield_skill', 'shield text should compile as shield_skill');
assert(sameList(shield.shield, [20, 30, 40, 50, 60]), 'shield amount parse failed');

const bihyungQ = getCharacterSkillDef({ name: '비형' }, 'q');
assert(bihyungQ?.name === '비형 Q', 'builtin Bihyung Q should resolve with Korean name');
assert(Number(bihyungQ?.recastWindowSec || 0) === 5, 'builtin Bihyung Q recast window changed');

function makeActor(extra = {}) {
  return {
    _id: extra._id || `actor-${Math.random()}`,
    name: extra.name || 'actor',
    hp: extra.hp ?? 100,
    maxHp: extra.maxHp ?? 100,
    zoneId: extra.zoneId || 'school',
    stats: {
      maxHp: extra.maxHp ?? 100,
      attackPower: 30,
      skillAmp: 0,
      defense: 10,
      attackSpeed: 1,
      attackRange: 1.5,
      sightRange: 8,
      ...(extra.stats || {}),
    },
    ...(extra || {}),
  };
}

const healCaster = makeActor({
  _id: 'heal-caster',
  hp: 60,
  characterSkills: {
    q: {
      enabled: true,
      slot: 'q',
      type: 'heal_skill',
      name: '런타임 회복',
      cooldownSec: 10,
      castDelaySec: 0.2,
      recoveryDelaySec: 0.3,
      heal: [25, 25, 25, 25, 25],
      minExpectedDamage: 1,
    },
  },
});
const healTarget = makeActor({ _id: 'heal-target' });
const healResult = applyCharacterSkillOnBasicAttack(healCaster, healTarget, 0, {
  settings: { skills: { characterSkills: true } },
  nowSec: 100,
});
assert(healResult.applied === true, 'heal skill should apply even when base damage is 0');
assert(healCaster.hp === 85, 'heal skill should restore caster HP');
assert(Math.abs(Number(healResult.actionLockSec || 0) - 0.5) < 0.001, 'heal skill action lock should aggregate cast/recovery delay');
assert(Number(healCaster.skillState?.q?.cooldownUntil || 0) === 110, 'heal skill cooldown should be tracked');

const shieldCaster = makeActor({
  _id: 'shield-caster',
  characterSkills: {
    w: {
      enabled: true,
      slot: 'w',
      type: 'shield_skill',
      name: '런타임 보호막',
      cooldownSec: 12,
      shield: [30, 30, 30, 30, 30],
      durationSec: 3,
      minExpectedDamage: 1,
    },
  },
});
const shieldResult = applyCharacterSkillOnBasicAttack(shieldCaster, healTarget, 0, {
  settings: { skills: { characterSkills: true } },
  nowSec: 200,
});
assert(shieldResult.applied === true, 'shield skill should apply even when base damage is 0');
assert(Number(shieldResult.shield || 0) === 30, 'shield skill should report shield value');
assert(Array.isArray(shieldCaster.activeEffects) && shieldCaster.activeEffects.some((eff) => Number(eff?.shieldValue || 0) === 30), 'shield skill should add shield effect');

const disabledCaster = makeActor({
  _id: 'disabled-caster',
  characterSkills: {
    q: {
      enabled: true,
      slot: 'q',
      type: 'attack_skill',
      name: '꺼진 스킬',
      cooldownSec: 5,
      firstFlat: [50, 50, 50, 50, 50],
      flatDamage: [50, 50, 50, 50, 50],
    },
  },
});
const disabledResult = applyCharacterSkillOnBasicAttack(disabledCaster, healTarget, 10, {
  settings: { skills: { characterSkills: false } },
  nowSec: 300,
});
assert(disabledResult.applied === false && disabledResult.damage === 10, 'disabled character skill mode should preserve base damage only');

const basicZeroCaster = makeActor({
  _id: 'basic-zero-caster',
  characterSkills: {
    q: {
      enabled: true,
      slot: 'q',
      type: 'basic_attack_enhance',
      name: '기본 공격 강화',
      cooldownSec: 7,
      firstFlat: [10, 10, 10, 10, 10],
      flatDamage: [10, 10, 10, 10, 10],
      recastWindowSec: 5,
      secondFlat: [20, 20, 20, 20, 20],
    },
  },
});
const basicZeroResult = applyCharacterSkillOnBasicAttack(basicZeroCaster, healTarget, 0, {
  settings: { skills: { characterSkills: true } },
  nowSec: 400,
});
assert(basicZeroResult.applied === false, 'basic attack enhancement should not trigger without a base hit');

const bihyung = makeActor({ _id: 'bihyung', name: '비형', hp: 100 });
const enemy = makeActor({ _id: 'enemy', name: '상대', hp: 80, maxHp: 100 });
const splashEnemy = makeActor({ _id: 'splash', name: '광역 대상', hp: 50, maxHp: 100 });
const firstQ = applyCharacterSkillOnBasicAttack(bihyung, enemy, 10, {
  settings: { skills: { characterSkills: true } },
  nowSec: 500,
  splashTargets: [splashEnemy],
});
assert(firstQ.applied === true && firstQ.stage === 1, 'Bihyung Q first cast should apply as stage 1');
assert(firstQ.damage === 20, 'Bihyung Q first cast should add single-target flat damage');
assert(Array.isArray(firstQ.splashHits) && firstQ.splashHits.length === 0, 'Bihyung Q first cast must not splash');
assert(Number(bihyung.skillState?.q?.recastUntil || 0) === 505, 'Bihyung Q first cast should open recast window');

const secondQ = applyCharacterSkillOnBasicAttack(bihyung, enemy, 10, {
  settings: { skills: { characterSkills: true } },
  nowSec: 503,
  splashTargets: [splashEnemy],
});
assert(secondQ.applied === true && secondQ.stage === 2, 'Bihyung Q second cast should apply as stage 2 inside recast window');
assert(secondQ.currentHpDamage === 1, 'Bihyung Q second cast should add current HP percent damage');
assert(Array.isArray(secondQ.splashHits) && secondQ.splashHits.length === 1, 'Bihyung Q second cast should create splash hit');
assert(Number(secondQ.splashHits[0]?.damage || 0) === 21, 'Bihyung Q splash should use second-stage flat plus current HP percent damage');

console.log('character skill compiler/runtime checks passed');
