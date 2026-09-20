import { normalizeConsumeEffect, consumeEffectErrorText } from './consumeEffectContract.js';

export const CONSUME_AMOUNT_FIELDS = [
  ['heal', '즉시 체력 회복'], ['satiety', '포만감 회복'],
  ['shield', '보호막'], ['regen', '초당 체력 회복'], ['durationSec', '지속 시간(초)'],
];
export const CONSUME_STAT_FIELDS = [
  ['attackPower', '공격력'], ['defense', '방어력'], ['skillAmp', '스킬 증폭'],
  ['attackSpeed', '초당 공격 횟수'], ['critChance', '치명타 확률(0~1)'],
  ['moveSpeed', '이동 속도'], ['attackRange', '공격 사거리'], ['sightRange', '시야'],
];

export function createConsumeEffectDraft(value) {
  return { enabled: value != null, value: value == null ? { version: 1 } : structuredClone(value) };
}

export function prepareConsumeEffectDraft(draft) {
  if (!draft?.enabled) return { ok: true, effect: null };
  const result = normalizeConsumeEffect(draft.value);
  if (!result.ok || !result.explicit) return { ok: false,
    error: result.ok ? '사용할 효과를 입력해 주세요.' : consumeEffectErrorText(result) };
  return { ok: true, effect: result.effect };
}

export function describeConsumeEffect(value) {
  const parsed = normalizeConsumeEffect(value);
  if (!parsed.ok) return consumeEffectErrorText(parsed);
  if (!parsed.explicit) return '기존 아이템 효과 사용';
  const effect = parsed.effect;
  const parts = CONSUME_AMOUNT_FIELDS.filter(([key]) => key !== 'durationSec' && effect[key] > 0)
    .map(([key, label]) => `${label} +${effect[key]}`);
  for (const [key, label] of CONSUME_STAT_FIELDS) {
    if (effect.stats?.[key] > 0) parts.push(`${label} +${effect.stats[key]}`);
  }
  if (effect.durationSec > 0) parts.push(`지속 ${effect.durationSec}초`);
  return parts.join(' · ');
}
