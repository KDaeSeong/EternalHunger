import { compileNaturalSkillDescription } from '../src/utils/characterSkillCompiler.js';
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

console.log('character skill compiler checks passed');
