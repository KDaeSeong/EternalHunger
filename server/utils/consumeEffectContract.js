// Canonical custom-consumable data contract. The client ES module is generated
// from this source; keep parsing independent of Mongoose, React and live actors.
// These are explicit simulator rules, not claims about original ER item values.
const CONSUMABLE_EFFECT_VERSION = 1;
const CONSUMABLE_STAT_KEYS = Object.freeze([
  'attackPower', 'defense', 'skillAmp', 'attackSpeed', 'critChance',
  'moveSpeed', 'attackRange', 'sightRange',
]);
const EFFECT_KEYS = new Set(['version', 'heal', 'satiety', 'shield', 'regen', 'durationSec', 'stats']);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const numeric = value => typeof value === 'number' || typeof value === 'string' && value.trim() ? Number(value) : NaN;
const invalid = (reason, field = '') => ({ ok: false, explicit: true, effect: null, reason, field });

function normalizeConsumeEffect(value) {
  if (value === undefined || value === null) return { ok: true, explicit: false, effect: null };
  if (!plain(value)) return invalid('invalid_effect');
  if (Object.keys(value).some(key => !EFFECT_KEYS.has(key))) return invalid('unsupported_field');
  if (value.version !== undefined && numeric(value.version) !== CONSUMABLE_EFFECT_VERSION) return invalid('unsupported_version');
  const effect = { version: CONSUMABLE_EFFECT_VERSION };
  for (const key of ['heal', 'satiety', 'shield', 'regen']) {
    if (!Object.hasOwn(value, key)) continue;
    const amount = numeric(value[key]);
    if (!Number.isSafeInteger(amount) || amount < 0 || (key === 'satiety' && amount > 100)) return invalid('invalid_amount', key);
    effect[key] = amount;
  }
  if (Object.hasOwn(value, 'stats')) {
    if (!plain(value.stats)) return invalid('invalid_stats', 'stats');
    effect.stats = {};
    for (const [key, raw] of Object.entries(value.stats)) {
      if (!CONSUMABLE_STAT_KEYS.includes(key)) return invalid('unsupported_stat', key);
      const amount = numeric(raw);
      if (!Number.isFinite(amount) || amount < 0 || amount > Number.MAX_SAFE_INTEGER) return invalid('invalid_amount', key);
      if (key === 'critChance' && amount > 1) return invalid('invalid_probability', key);
      effect.stats[key] = amount;
    }
  }
  const hasStats = Object.values(effect.stats || {}).some(amount => amount > 0);
  const timed = effect.shield > 0 || effect.regen > 0 || hasStats;
  if (Object.hasOwn(value, 'durationSec')) {
    const duration = numeric(value.durationSec);
    if (!Number.isFinite(duration) || duration < 0 || duration > 86400) return invalid('invalid_duration', 'durationSec');
    effect.durationSec = duration;
  }
  if (timed && !(effect.durationSec > 0)) return invalid('duration_required', 'durationSec');
  if (!timed && effect.durationSec > 0) return invalid('unused_duration', 'durationSec');
  if (!(effect.heal > 0 || effect.satiety > 0 || timed)) return invalid('empty_effect');
  return { ok: true, explicit: true, effect };
}

function consumeEffectErrorText(result) {
  if (result?.ok) return '';
  const messages = {
    invalid_effect: '소모품 효과 형식을 확인해 주세요.',
    unsupported_field: '지원하지 않는 소모품 효과 항목이 있습니다.',
    unsupported_version: '이 소모품 효과 형식은 현재 버전에서 지원하지 않습니다.',
    invalid_amount: '효과 수치를 확인해 주세요. 회복·보호막·재생은 0 이상의 정수, 포만감은 0~100입니다.',
    invalid_stats: '일시 능력치 효과 형식을 확인해 주세요.',
    invalid_probability: '치명타 확률 증가는 0~1 범위로 입력해 주세요. 예: 25%는 0.25입니다.',
    unsupported_stat: '지원하지 않는 일시 능력치가 있습니다.',
    invalid_duration: '효과 지속 시간은 0~86,400초 범위여야 합니다.',
    duration_required: '보호막·재생·일시 능력치에는 0초보다 긴 지속 시간이 필요합니다.',
    unused_duration: '지속 시간을 적용할 보호막·재생·일시 능력치를 입력해 주세요.',
    empty_effect: '사용할 효과를 하나 이상 입력해 주세요.',
  };
  return messages[result?.reason] || '소모품 효과를 확인해 주세요.';
}

module.exports = { CONSUMABLE_EFFECT_VERSION, CONSUMABLE_STAT_KEYS, normalizeConsumeEffect, consumeEffectErrorText };
