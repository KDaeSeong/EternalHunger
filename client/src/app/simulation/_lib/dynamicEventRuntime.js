import { generateDynamicEvent } from '../../../utils/eventLogic';

function fallbackDynamicEvent(actor) {
  return {
    log: `🧭 [${actor?.name || '생존자'}] 로테이션을 유지하며 다음 행동을 준비했습니다.`,
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
