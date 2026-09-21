const { normalizeConsumeEffect, consumeEffectErrorText } = require('./consumeEffectContract');
const { normalizeEquipmentEffects, equipmentEffectErrorText } = require('./equipmentEffectContract');

// Both item write routes use plain field patches. Reject database operators and
// dotted paths so a partial Mixed-field update cannot bypass effect validation.
function prepareItemEffectWritePayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some(key => key.startsWith('$') || key.includes('.'))) {
    return { ok: false, error: '아이템 저장 형식을 확인해 주세요.' };
  }
  const result = normalizeConsumeEffect(body.consumeEffect);
  if (!result.ok) return { ok: false, error: consumeEffectErrorText(result) };
  const equipment = normalizeEquipmentEffects(body.equipmentEffects);
  if (!equipment.ok) return { ok: false, error: equipmentEffectErrorText(equipment) };
  if (equipment.effects.length && Object.hasOwn(body, 'type') && !['무기', '방어구'].includes(body.type))
    return { ok: false, error: '장비 발동 효과는 무기 또는 방어구에 지정해 주세요.' };
  return { ok: true, payload: { ...body,
    ...(Object.hasOwn(body, 'consumeEffect') ? { consumeEffect: result.explicit ? result.effect : null } : {}),
    ...(Object.hasOwn(body, 'equipmentEffects') ? { equipmentEffects: equipment.effects } : {}),
  } };
}

// Validate cross-field partial writes atomically, without trusting a stale read
// of the old type/effects. Plain name-only patches retain all existing effects.
function equipmentEffectWriteGuard(payload) {
  if (payload.equipmentEffects?.length && !Object.hasOwn(payload, 'type')) return { type: { $in: ['무기', '방어구'] } };
  if (Object.hasOwn(payload, 'type') && !['무기', '방어구'].includes(payload.type)
    && !Object.hasOwn(payload, 'equipmentEffects')) return { $or: [{ equipmentEffects: null }, { equipmentEffects: { $size: 0 } }] };
  return {};
}

module.exports = { prepareItemEffectWritePayload, equipmentEffectWriteGuard };
