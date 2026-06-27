import { generateDynamicEvent } from '../../../utils/eventLogic';

function fallbackDynamicEvent(actor) {
  return {
    log: `🧭 [${actor?.name || '생존자'}] 다음 오브젝트와 교전 동선을 점검했습니다.`,
    damage: 0,
    recovery: 0,
    drop: null,
  };
}

function safeGenerateDynamicEvent(actor, day, ruleset, phase, publicItems, opts = {}) {
  try {
    const result = generateDynamicEvent(actor, day, ruleset, phase, publicItems, opts);
    if (result && typeof result === 'object') return result;
    return fallbackDynamicEvent(actor);
  } catch (err) {
    console.error('[safeGenerateDynamicEvent] fallback:', err);
    return fallbackDynamicEvent(actor);
  }
}

export {
  safeGenerateDynamicEvent,
};
