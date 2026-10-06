// Pure draft contract, shared by the API and editor. No database, credentials,
// live match state, rewards or author IDs may enter an automatic setup draft.
const SETUP_SCHEMA = 'eternal-hunger.character-setup.v1';
const SLOTS = ['q', 'w', 'e', 'r', 'passive'];
const CORE_STAT_RANGES = {
  maxHp: [1, 999], hpGrowth: [0, 20], attackPower: [0, 200], attackPowerGrowth: [0, 20],
  skillAmp: [0, 200], skillAmpGrowth: [0, 20], defense: [0, 200], defenseGrowth: [0, 20],
  attackSpeed: [0.1, 3], attackSpeedGrowth: [0, 1], attackRange: [0.5, 10], sightRange: [1, 20],
  moveSpeed: [0.1, 10],
};
const STAT_RANGES = { ...CORE_STAT_RANGES,
  ...Object.fromEntries(['critChance', 'damageReduction', 'basicDamageReduction', 'skillDamageReduction',
    'criticalDamageReduction', 'cooldownReduction', 'ultimateCooldownReduction', 'tacticalCooldownReduction',
    'armorPen', 'lifesteal', 'omnisyphon', 'ccDurationReduction', 'slowDurationReduction'].map(key => [key, [0, 1]])),
  ...Object.fromEntries(['critDamageIncrease', 'basicAttackAmp', 'damageIncrease', 'finalDamageIncrease'].map(key => [key, [0, 5]])),
  armorPenFlat: [0, 200], adaptiveForce: [0, 200], finalDamageFlat: [0, 999],
};
const WEAPONS = ['권총', '돌격소총', '저격총', '산탄총', '기관단총', '기관총', '유탄발사기', '로켓발사기',
  '박격포', '글러브', '톤파', '쌍절곤', '아르카나', '양손검', '한손검', '쌍검', '망치', '철퇴', '방망이',
  '채찍', '투척', '암기', '활', '석궁', '도끼', '단검', '창', '레이피어', '기타', '카메라'];
const ACTIVE_TYPES = ['attack_skill', 'basic_attack_enhance', 'heal_skill', 'shield_skill', 'support_skill'];
const CONDITIONS = ['auto', 'harass', 'finish', 'defensive'];
const PRIORITIES = ['auto', 'damage', 'killable', 'lowest_hp', 'highest_max_hp', 'cluster'];
const SKILL_NUMBERS = { cooldownSec: [1, 180], recastWindowSec: [0, 30], range: [0, 20], radius: [0, 5],
  durationSec: [0, 60], castDelaySec: [0, 10], recoveryDelaySec: [0, 10], movementDistance: [0, 10],
  resourceCost: [0, 10000], resourceGain: [0, 10000], attackPowerScale: [0, 5], secondAttackPowerScale: [0, 5],
  firstSkillAmpScale: [0, 5], secondSkillAmpScale: [0, 5], minExpectedDamage: [0, 999], minSplashTargets: [0, 24],
  minCasterHpPct: [0, 1], maxCasterHpPct: [0, 1], minTargetHpPct: [0, 1], maxTargetHpPct: [0, 1] };
const DAMAGE_ARRAYS = ['firstFlat', 'secondFlat', 'heal', 'shield'];
const PERCENT_ARRAYS = ['maxHpPct', 'currentHpPct', 'secondMaxHpPct', 'secondCurrentHpPct'];
const HARMFUL = ['기절', '속박', '침묵', '실명', '이동 속도 감소', '에어본', '공포', '매혹', '도발', '수면', '변이', '제압'];
const PROTECTIVE = ['무적', '대상 지정 불가', '회피', '이동 방해 면역', '저지 불가', '모든 방해 면역', '해로운 효과 면역', '해로운 효과 제거', '경직'];
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
function invalid(message) { throw new Error(`자동 설정 초안을 적용하지 않았습니다. ${message}`); }
function text(value, max, required = false) {
  if (value != null && typeof value !== 'string') invalid('텍스트 형식이 올바르지 않습니다.');
  const clean = (value || '').trim();
  if (clean.length > max || required && !clean) invalid('이름이나 설명의 길이를 확인해 주세요.');
  return clean;
}
function number(value, min, max, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) invalid(`${label} 값이 지원 범위를 벗어났습니다.`);
  return value;
}
function levelArray(value, max, label) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 5) invalid(`${label}은 1~5개 레벨 수치여야 합니다.`);
  const values = value.map(n => number(n, 0, max, label));
  return Array.from({ length: 5 }, (_, index) => values[index] ?? values.at(-1));
}
function sanitizeSkill(raw, slot) {
  if (!object(raw) || typeof raw.enabled !== 'boolean') invalid(`${slot.toUpperCase()} 사용 여부가 없습니다.`);
  const passive = slot === 'passive';
  const type = passive ? 'passive_stat' : raw.type;
  if (passive ? raw.type != null && raw.type !== type : !ACTIVE_TYPES.includes(type)) invalid(`${slot.toUpperCase()} 스킬 종류가 지원되지 않습니다.`);
  const result = { enabled: raw.enabled, slot, type, name: text(raw.name, 100, raw.enabled),
    sourceText: text(raw.sourceText, 4000), hpDamagePercentUnit: 'percent',
    damageType: raw.damageType || 'skill', trigger: passive ? 'always' : 'basic_attack' };
  if (!['basic', 'skill', 'true'].includes(result.damageType)) invalid('피해 종류를 확인해 주세요.');
  for (const [key, [min, max]] of Object.entries(SKILL_NUMBERS)) {
    const fallback = key === 'cooldownSec' ? passive ? 0 : slot === 'r' ? 60 : 12 : key === 'minExpectedDamage' ? 1 : 0;
    result[key] = own(raw, key) ? number(raw[key], passive && key === 'cooldownSec' ? 0 : min, max, key) : fallback;
  }
  result.cooldownFixed = raw.cooldownFixed === true;
  result.includesMovement = raw.includesMovement === true;
  result.movementMode = raw.movementMode || 'toward_target';
  if (!['toward_target', 'away_from_target'].includes(result.movementMode)
    || result.includesMovement && (passive || result.movementDistance <= 0)
    || !result.includesMovement && result.movementDistance > 0) invalid('이동 방향·거리·사용 여부를 확인해 주세요.');
  result.useCondition = raw.useCondition || 'auto';
  result.targetPriority = raw.targetPriority || 'auto';
  result.supportTargetScope = raw.supportTargetScope || 'auto';
  if (!CONDITIONS.includes(result.useCondition) || !PRIORITIES.includes(result.targetPriority)
    || !['auto', 'self', 'ally', 'team'].includes(result.supportTargetScope)) invalid('스킬 판단 조건이 지원되지 않습니다.');
  for (const key of [...DAMAGE_ARRAYS, ...PERCENT_ARRAYS]) result[key] = own(raw, key)
    ? levelArray(raw[key], PERCENT_ARRAYS.includes(key) ? 100 : 999, key) : [0, 0, 0, 0, 0];
  result.flatDamage = [...result.firstFlat];
  result.skillAmpScale = result.firstSkillAmpScale;
  if (passive && result.cooldownSec !== 0) invalid('패시브의 재사용 대기시간은 0초여야 합니다.');
  result.statModifiers = {};
  if (raw.statModifiers != null && !object(raw.statModifiers)) invalid('패시브 능력치 형식이 올바르지 않습니다.');
  for (const [key, [, max]] of Object.entries(STAT_RANGES)) {
    if (own(raw.statModifiers || {}, key)) result.statModifiers[key] = number(raw.statModifiers[key], -max, max, `패시브 ${key}`);
  }
  if (!passive && Object.values(result.statModifiers).some(n => n !== 0)) invalid('상시 능력치 보정은 패시브에만 설정할 수 있습니다.');
  const effects = raw.statusEffects ?? [];
  if (!Array.isArray(effects) || effects.length > 4 || passive && effects.length) invalid('상태 효과 개수·슬롯을 확인해 주세요.');
  result.statusEffects = effects.map(effect => {
    if (!object(effect) || ![...HARMFUL, ...PROTECTIVE].includes(effect.name)) invalid('지원하지 않는 상태 효과입니다.');
    const target = effect.target || 'target';
    const support = ['support_skill', 'heal_skill', 'shield_skill'].includes(type);
    if (!['target', 'self'].includes(target) || (HARMFUL.includes(effect.name) ? target === 'self' || support
      : target === 'target' && !support)) invalid('상태 효과의 적용 대상·스킬 종류를 확인해 주세요.');
    return { name: effect.name, target, durationSec: number(effect.durationSec,
      effect.name === '해로운 효과 제거' ? 0 : 0.001, effect.name === '해로운 효과 제거' ? 0 : 60, '상태 지속 시간'),
      ...(own(effect, 'wakeDamagePct') ? { wakeDamagePct: number(effect.wakeDamagePct, 0, 1, '수면 추가 피해') } : {}),
      ...(own(effect, 'moveSpeedBonus') ? { moveSpeedBonus: number(effect.moveSpeedBonus, -0.75, 0, '둔화 비율') } : {}) };
  });
  if (new Set(result.statusEffects.map(effect => `${effect.target}:${effect.name}`)).size !== effects.length) invalid('상태 효과가 중복됐습니다.');
  if (result.statusEffects.some(effect => own(effect, 'wakeDamagePct') && effect.name !== '수면'
    || own(effect, 'moveSpeedBonus') && !['변이', '이동 속도 감소'].includes(effect.name))) invalid('상태 효과에 맞지 않는 추가 수치입니다.');
  const damage = [...result.firstFlat, ...result.secondFlat, ...PERCENT_ARRAYS.flatMap(key => result[key]),
    result.attackPowerScale, result.secondAttackPowerScale, result.firstSkillAmpScale, result.secondSkillAmpScale];
  if (type === 'support_skill' && damage.some(n => n > 0)) invalid('보호·정화 스킬에 공격 피해를 넣을 수 없습니다.');
  if (passive && [...damage, ...result.heal, ...result.shield, result.resourceCost, result.resourceGain].some(n => n > 0)) invalid('이 엔진의 패시브는 상시 능력치 보정만 지원합니다.');
  const useful = [...damage, ...result.heal, ...result.shield, ...Object.values(result.statModifiers), result.movementDistance, result.resourceGain];
  if (!raw.enabled && ([...useful, result.resourceCost].some(n => n !== 0) || effects.length)) {
    invalid(`${slot.toUpperCase()} 비활성 초안에 실행 효과가 남아 있습니다.`);
  }
  if (raw.enabled && !useful.some(n => n !== 0) && !effects.length) invalid(`${slot.toUpperCase()}에 실제로 실행할 효과가 없습니다.`);
  return result;
}
function sanitizeCharacterSetup(raw, { mode = 'custom', sources = [] } = {}) {
  if (!['er', 'custom'].includes(mode) || !Array.isArray(sources)) invalid('초안의 종류·출처 형식을 확인해 주세요.');
  if (!object(raw) || !object(raw.stats) || !object(raw.characterSkills)) invalid('능력치와 다섯 스킬 슬롯이 필요합니다.');
  const stats = Object.fromEntries(Object.entries(STAT_RANGES).map(([key, [min, max]]) => [key,
    number(own(raw.stats, key) ? raw.stats[key] : own(CORE_STAT_RANGES, key) ? undefined : 0, min, max, key)]));
  const weapons = raw.erWeapons;
  if (!Array.isArray(weapons) || !weapons.length || weapons.length > 4 || weapons.some(weapon => !WEAPONS.includes(weapon))) invalid('사용할 무기를 1~4종 선택해야 합니다.');
  const characterSkills = Object.fromEntries(SLOTS.map(slot => [slot, sanitizeSkill(raw.characterSkills[slot], slot)]));
  const resource = raw.uniqueResource || { enabled: false };
  if (!object(resource) || typeof resource.enabled !== 'boolean') invalid('고유 자원 사용 여부를 확인해 주세요.');
  const uniqueResource = resource.enabled ? { enabled: true, name: text(resource.name, 30, true),
    maxValue: number(resource.maxValue, 1, 10000, '고유 자원 최대치'),
    startValue: number(resource.startValue, 0, resource.maxValue, '고유 자원 시작치'),
    regenPerSec: number(resource.regenPerSec, 0, 100, '고유 자원 회복') }
    : { enabled: false, name: '고유 자원', maxValue: 100, startValue: 0, regenPerSec: 0 };
  if (!uniqueResource.enabled && SLOTS.some(slot => characterSkills[slot].resourceCost > 0 || characterSkills[slot].resourceGain > 0)) invalid('스킬이 사용하는 고유 자원이 꺼져 있습니다.');
  if (uniqueResource.enabled && SLOTS.some(slot => characterSkills[slot].enabled && characterSkills[slot].resourceCost > uniqueResource.maxValue)) invalid('고유 자원의 최대치보다 스킬 비용이 큽니다.');
  const warnings = Array.isArray(raw.warnings) ? raw.warnings.slice(0, 12).map(value => text(value, 500)) : [];
  for (const slot of SLOTS) if (!characterSkills[slot].enabled) warnings.push(`${slot.toUpperCase()}은 적용할 효과가 없어 비활성 초안입니다.`);
  return { schema: SETUP_SCHEMA, origin: 'ai-draft', mode, name: text(raw.name, 40, true),
    gender: ['남', '여', '무성'].includes(raw.gender) ? raw.gender : '', summary: text(raw.summary, 1500),
    stats, erWeapons: [...new Set(weapons)], characterSkills, uniqueResource, warnings,
    sources: sources.slice(0, 8).map(source => {
      if (!object(source)) invalid('출처 형식을 확인해 주세요.');
      const url = new URL(text(source.url, 4096, true));
      if (url.protocol !== 'https:' || url.username || url.password || url.port
        || !(url.hostname === 'playeternalreturn.com' || url.hostname.endsWith('.playeternalreturn.com')
          || url.hostname === 'developer.eternalreturn.io'
          || url.hostname === 'game.naver.com' && /^\/lounge\/Eternal_Return\/db\/character\/CH_(?:[A-Z]+_)?670_\d{1,8}$/.test(url.pathname)
            && !url.search && !url.hash)) invalid('공식 안내 자료의 출처 주소를 확인해 주세요.');
      return { title: text(source.title, 300), url: url.href };
    }) };
}
module.exports = { SETUP_SCHEMA, SLOTS, CORE_STAT_RANGES, STAT_RANGES, WEAPONS, ACTIVE_TYPES, CONDITIONS, PRIORITIES,
  SKILL_NUMBERS, HARMFUL, PROTECTIVE, sanitizeCharacterSetup };
