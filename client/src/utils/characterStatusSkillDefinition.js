import { canonicalizeEffectName, EFFECT_META } from './statusEffectDefinitions.js';

// Only implemented states are authorable; runtime tags, source IDs and live
// durations are never copied from a user's skill definition.
export const CHARACTER_STATUS_EFFECT_OPTIONS = [
  '기절', '속박', '침묵', '실명', '이동 속도 감소', '에어본', '공포', '매혹', '도발', '수면', '변이', '제압',
  '무적', '대상 지정 불가', '회피', '이동 방해 면역', '저지 불가', '모든 방해 면역', '해로운 효과 면역', '해로운 효과 제거', '경직',
].map((value) => ({ value, label: value, harmful: EFFECT_META[value].tags.includes('negative') }));
export const MAX_CHARACTER_STATUS_EFFECTS = 4;
export const isStatusSupportSkill = (def) => ['support_skill', 'heal_skill', 'shield_skill'].includes(def?.type);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const allowed = new Map(CHARACTER_STATUS_EFFECT_OPTIONS.map((row) => [row.value, row]));

export function getCharacterStatusSkillError(skill, slot = skill?.slot) {
  if (skill?.type === 'support_skill' && [skill.firstFlat, skill.flatDamage, skill.secondFlat, skill.maxHpPct,
    skill.currentHpPct, skill.secondMaxHpPct, skill.secondCurrentHpPct, skill.attackPowerScale,
    skill.secondAttackPowerScale, skill.firstSkillAmpScale, skill.skillAmpScale, skill.secondSkillAmpScale]
    .flat().some((value) => Number(value) > 0)) return '보호·정화 타입의 피해와 공격 계수는 0으로 입력해 주세요. 회복·보호막 수치는 함께 사용할 수 있습니다.';
  const list = skill?.statusEffects;
  if (list == null) return '';
  if (!Array.isArray(list) || list.length > MAX_CHARACTER_STATUS_EFFECTS) return '상태 효과는 최대 4개까지 입력할 수 있습니다.';
  if (slot === 'passive' && list.length) return '상태 부여는 Q/W/E/R에 작성해 주세요. 패시브 상태 발동은 지원하지 않습니다.';
  const seen = new Set();
  for (const raw of list) {
    const name = canonicalizeEffectName(raw?.name);
    const option = allowed.get(name);
    if (!raw || typeof raw !== 'object' || !option) return '실제 지원하는 상태 효과를 선택해 주세요.';
    const target = raw.target ?? 'target';
    if (!['self', 'target'].includes(target)) return '상태 적용 대상은 자신 또는 스킬 대상으로 선택해 주세요.';
    if (option.harmful ? target === 'self' || isStatusSupportSkill(skill) : target === 'target' && !isStatusSupportSkill(skill)) {
      return '해로운 상태는 공격 대상에게, 보호·정화는 자신 또는 지원 스킬의 아군에게 적용할 수 있습니다.';
    }
    const duration = Number(raw.durationSec ?? (name === '해로운 효과 제거' ? 0 : 2));
    if (hasOwn(raw, 'durationSec') && (raw.durationSec === null || raw.durationSec === '') || !Number.isFinite(duration)
      || (name === '해로운 효과 제거' ? duration !== 0 : duration < 0.001 || duration > 60)) {
      return '상태 지속 시간은 0.001~60초, 즉시 정화는 0초로 입력해 주세요.';
    }
    if (hasOwn(raw, 'wakeDamagePct') && (name !== '수면' || !Number.isFinite(Number(raw.wakeDamagePct)) || Number(raw.wakeDamagePct) < 0 || Number(raw.wakeDamagePct) > 1)) {
      return '수면 추가 피해 비율은 0~100%로 입력해 주세요.';
    }
    if (hasOwn(raw, 'moveSpeedBonus') && (!['변이', '이동 속도 감소'].includes(name) || !Number.isFinite(Number(raw.moveSpeedBonus)) || Number(raw.moveSpeedBonus) < -0.75 || Number(raw.moveSpeedBonus) > 0)) {
      return '변이·둔화의 이동 속도 감소는 0~75%로 입력해 주세요.';
    }
    const key = `${target}:${name}`;
    if (seen.has(key)) return '같은 대상의 같은 상태는 한 번만 입력해 주세요.';
    seen.add(key);
  }
  return '';
}

export function normalizeCharacterStatusEffects(skill, slot = skill?.slot) {
  if (getCharacterStatusSkillError(skill, slot)) return [];
  return (skill?.statusEffects || []).map((raw) => {
    const name = canonicalizeEffectName(raw.name);
    return { name, target: raw.target ?? 'target', durationSec: Number(raw.durationSec ?? (name === '해로운 효과 제거' ? 0 : 2)),
      ...(hasOwn(raw, 'wakeDamagePct') ? { wakeDamagePct: Number(raw.wakeDamagePct) } : {}),
      ...(hasOwn(raw, 'moveSpeedBonus') ? { moveSpeedBonus: Number(raw.moveSpeedBonus) } : {}) };
  });
}
