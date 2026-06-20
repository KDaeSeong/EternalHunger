import { generateDynamicEvent } from '../../../utils/eventLogic';

function safeGenerateDynamicEvent(actor, day, ruleset, phase, publicItems) {
  try {
    // ✅ 기존 구현(2인자) / 신규 구현(3~4인자) 모두 호환
    const res = generateDynamicEvent(actor, day, ruleset, phase, publicItems);
    if (res && typeof res === 'object') return res;
    return {
      log: `🍞 [${actor?.name || '???'}]은(는) 주변을 살폈지만 별일이 없었다.`,
      damage: 0,
      recovery: 0,
      newItem: null,
    };
  } catch (err) {
    // ruleset 미정의 등 런타임 ReferenceError 방어
    console.error('[safeGenerateDynamicEvent] fallback:', err);
    return {
      log: `🍞 [${actor?.name || '???'}]은(는) 주변을 살폈지만 별일이 없었다.`,
      damage: 0,
      recovery: 0,
      newItem: null,
    };
  }
}

export {
  safeGenerateDynamicEvent,
};
