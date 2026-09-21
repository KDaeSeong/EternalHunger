// Canonical authored-equipment contract. No item-name inference or ER preset.
// One entry per effect kind; kind is also the stable, shared cooldown identity.
const EQUIPMENT_EFFECT_VERSION = 1;
const EQUIPMENT_EFFECT_KINDS = Object.freeze(['rupture']);
const EFFECT_KEYS = new Set(['version', 'kind', 'delaySec', 'cooldownSec', 'radius', 'damage']);
const DAMAGE_KEYS = Object.freeze(['base', 'perLevel', 'attackPowerRatio', 'skillAmpRatio']);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const numeric = value => typeof value === 'number' || typeof value === 'string' && value.trim() ? Number(value) : NaN;
const invalid = (reason, field = '') => ({ ok: false, effects: [], reason, field });

function normalizeEquipmentEffects(value) {
  if (value === undefined || value === null) return { ok: true, effects: [] };
  if (!Array.isArray(value) || value.length > EQUIPMENT_EFFECT_KINDS.length) return invalid('invalid_effects');
  const effects = [], kinds = new Set();
  for (const raw of value) {
    if (!plain(raw)) return invalid('invalid_effect');
    if (Object.keys(raw).some(key => !EFFECT_KEYS.has(key))) return invalid('unsupported_field');
    if (raw.version !== undefined && numeric(raw.version) !== EQUIPMENT_EFFECT_VERSION) return invalid('unsupported_version');
    if (!EQUIPMENT_EFFECT_KINDS.includes(raw.kind)) return invalid('unsupported_kind');
    if (kinds.has(raw.kind)) return invalid('duplicate_kind');
    kinds.add(raw.kind);
    const effect = { version: EQUIPMENT_EFFECT_VERSION, kind: raw.kind };
    for (const key of ['delaySec', 'cooldownSec', 'radius']) {
      const amount = numeric(raw[key]);
      const maximum = key === 'radius' ? 1000 : 86400;
      if (!Number.isFinite(amount) || amount < 0.000001 || amount > maximum) return invalid('invalid_amount', key);
      effect[key] = amount;
    }
    if (!plain(raw.damage) || Object.keys(raw.damage).some(key => !DAMAGE_KEYS.includes(key))) return invalid('invalid_damage');
    effect.damage = {};
    for (const key of DAMAGE_KEYS) {
      const amount = Object.hasOwn(raw.damage, key) ? numeric(raw.damage[key]) : 0;
      // Authoring bounds prevent overflow when levels/stats are multiplied.
      if (!Number.isFinite(amount) || amount < 0 || amount > 1000000) return invalid('invalid_damage', key);
      effect.damage[key] = amount;
    }
    if (!Object.values(effect.damage).some(amount => amount > 0)) return invalid('empty_damage');
    effects.push(effect);
  }
  return { ok: true, effects };
}

function equipmentEffectErrorText(result) {
  if (result?.ok) return '';
  const messages = {
    invalid_effects: '현재 장비 하나에는 파열 효과를 한 개까지 지정할 수 있습니다.',
    invalid_effect: '장비 효과 형식을 확인해 주세요.',
    unsupported_field: '지원하지 않는 장비 효과 항목이 있습니다.',
    unsupported_version: '이 장비 효과 형식은 현재 버전에서 지원하지 않습니다.',
    unsupported_kind: '현재 직접 지정할 수 있는 장비 효과는 파열입니다.',
    duplicate_kind: '같은 장비에 같은 종류의 효과를 중복 지정할 수 없습니다.',
    invalid_amount: '지연·재사용 시간은 0.000001~86,400초, 반경은 0.000001~1,000m로 입력해 주세요.',
    invalid_damage: '피해 수치와 계수는 0~1,000,000 범위의 숫자로 입력해 주세요.',
    empty_damage: '피해 기본값 또는 계수를 하나 이상 입력해 주세요.',
  };
  return messages[result?.reason] || '장비 효과를 확인해 주세요.';
}

module.exports = { EQUIPMENT_EFFECT_VERSION, EQUIPMENT_EFFECT_KINDS, normalizeEquipmentEffects, equipmentEffectErrorText };
