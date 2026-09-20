const { normalizeConsumeEffect, consumeEffectErrorText } = require('./consumeEffectContract');

// Both item write routes use plain field patches. Reject database operators and
// dotted paths so a partial Mixed-field update cannot bypass effect validation.
function prepareItemEffectWritePayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some(key => key.startsWith('$') || key.includes('.'))) {
    return { ok: false, error: '아이템 저장 형식을 확인해 주세요.' };
  }
  const result = normalizeConsumeEffect(body.consumeEffect);
  if (!result.ok) return { ok: false, error: consumeEffectErrorText(result) };
  return { ok: true, payload: { ...body,
    ...(Object.hasOwn(body, 'consumeEffect') ? { consumeEffect: result.explicit ? result.effect : null } : {}),
  } };
}

module.exports = { prepareItemEffectWritePayload };
