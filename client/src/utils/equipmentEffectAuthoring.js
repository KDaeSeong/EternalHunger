import { normalizeEquipmentEffects, equipmentEffectErrorText } from './equipmentEffectContract.js';

export const EQUIPMENT_TIMING_FIELDS = [['delaySec', '파열 지연(초)'], ['cooldownSec', '파열 재사용(초)'], ['radius', '파열 반경(m)']];
export const EQUIPMENT_DAMAGE_FIELDS = [['base', '파열 기본 피해'], ['perLevel', '레벨당 피해'],
  ['attackPowerRatio', '공격력 계수'], ['skillAmpRatio', '스킬 증폭 계수']];
export function createEquipmentEffectDraft(value) {
  const configured = value != null && (!Array.isArray(value) || value.length > 0);
  return { enabled: configured, value: configured ? structuredClone(value) : [{ version: 1, kind: 'rupture',
    delaySec: '0.8', cooldownSec: '8', radius: '', damage: { base: '', perLevel: '0', attackPowerRatio: '0', skillAmpRatio: '0' } }] };
}
export function prepareEquipmentEffectDraft(draft) {
  if (!draft?.enabled) return { ok: true, effects: [] };
  const result = normalizeEquipmentEffects(draft.value);
  return result.ok && result.effects.length ? result : { ok: false,
    error: result.ok ? '사용할 장비 효과를 입력해 주세요.' : equipmentEffectErrorText(result) };
}
export function describeEquipmentEffects(value) {
  const result = normalizeEquipmentEffects(value);
  if (!result.ok) return equipmentEffectErrorText(result);
  if (!result.effects.length) return '장비 발동 효과 없음';
  return result.effects.map(effect => {
    const terms = EQUIPMENT_DAMAGE_FIELDS.filter(([key]) => effect.damage[key] > 0)
      .map(([key, label]) => `${label.replace('파열 ', '')} ${effect.damage[key]}`);
    return `파열 · 스킬 적중 ${effect.delaySec}초 뒤 반경 ${effect.radius}m · ${terms.join(' + ')} · 재사용 ${effect.cooldownSec}초`;
  }).join(' / ');
}
