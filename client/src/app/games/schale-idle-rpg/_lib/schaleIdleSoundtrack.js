export const SCHALE_IDLE_BGM_SCENES = Object.freeze({
  briefing: 'idle-briefing',
  patrol: 'idle-patrol',
  workshop: 'idle-workshop',
  tower: 'idle-tower',
  breakthrough: 'idle-breakthrough',
  reward: 'idle-reward',
  setback: 'idle-setback',
});

export const SCHALE_IDLE_SOUNDTRACK = Object.freeze([
  Object.freeze({ scene: 'briefing', theme: SCHALE_IDLE_BGM_SCENES.briefing, title: '샬레 브리핑', icon: 'settings' }),
  Object.freeze({ scene: 'patrol', theme: SCHALE_IDLE_BGM_SCENES.patrol, title: '오늘의 당직', icon: 'training' }),
  Object.freeze({ scene: 'workshop', theme: SCHALE_IDLE_BGM_SCENES.workshop, title: '장비 공방', icon: 'craft' }),
  Object.freeze({ scene: 'tower', theme: SCHALE_IDLE_BGM_SCENES.tower, title: '시련의 탑', icon: 'tower' }),
  Object.freeze({ scene: 'breakthrough', theme: SCHALE_IDLE_BGM_SCENES.breakthrough, title: '전력 돌파', icon: 'research' }),
  Object.freeze({ scene: 'reward', theme: SCHALE_IDLE_BGM_SCENES.reward, title: '빛나는 전리품', icon: 'reward' }),
  Object.freeze({ scene: 'setback', theme: SCHALE_IDLE_BGM_SCENES.setback, title: '당직 위기', icon: 'warning' }),
]);

const TAB_SCENES = Object.freeze({
  duty: SCHALE_IDLE_BGM_SCENES.patrol,
  gear: SCHALE_IDLE_BGM_SCENES.workshop,
  plan: SCHALE_IDLE_BGM_SCENES.briefing,
  season: SCHALE_IDLE_BGM_SCENES.breakthrough,
  records: SCHALE_IDLE_BGM_SCENES.reward,
  sync: SCHALE_IDLE_BGM_SCENES.briefing,
});

const WORKSHOP_ACTIONS = new Set([
  'craft',
  'enhance-pity',
  'enhance-protected',
  'favorite',
  'lock',
  'preset',
  'refresh',
  'reroll',
  'salvage',
  'shop',
  'title',
  'equip',
  'upgrade',
]);

const PATROL_ACTIONS = new Set(['duty-partial', 'settle', 'wait']);
const SETBACK_ACTIONS = new Set([
  'duty-defeat',
  'enhance-destroyed',
  'enhance-downgrade',
  'warning',
]);

export function resolveSchaleIdleBgmScene({
  activeTabId = 'duty',
  stamina = 100,
  riskLabel = '',
  readinessPct = 100,
} = {}) {
  const critical = Number(stamina || 0) <= 10
    || Number(readinessPct || 0) <= 25
    || /위험|경고|위기|부족/.test(String(riskLabel || ''));
  if (critical) return SCHALE_IDLE_BGM_SCENES.setback;
  return TAB_SCENES[activeTabId] || SCHALE_IDLE_BGM_SCENES.patrol;
}

export function schaleIdleResultMusic(presentation = {}) {
  const action = String(presentation?.action || '');
  const tone = String(presentation?.tone || '');

  if (action === 'tower' || action === 'tower-partial') {
    return {
      theme: tone === 'danger' ? SCHALE_IDLE_BGM_SCENES.setback : SCHALE_IDLE_BGM_SCENES.tower,
      durationMs: tone === 'success' ? 14_000 : 11_000,
    };
  }
  if (tone === 'danger' || SETBACK_ACTIONS.has(action)) {
    return { theme: SCHALE_IDLE_BGM_SCENES.setback, durationMs: 12_000 };
  }
  if (action === 'claim') return { theme: SCHALE_IDLE_BGM_SCENES.reward, durationMs: 12_000 };
  if (action === 'research') return { theme: SCHALE_IDLE_BGM_SCENES.breakthrough, durationMs: 10_000 };
  if (WORKSHOP_ACTIONS.has(action)) return { theme: SCHALE_IDLE_BGM_SCENES.workshop, durationMs: 9_000 };
  if (PATROL_ACTIONS.has(action)) return { theme: SCHALE_IDLE_BGM_SCENES.patrol, durationMs: 9_000 };
  if (action === 'rest' || action === 'growth') {
    return { theme: SCHALE_IDLE_BGM_SCENES.briefing, durationMs: 8_000 };
  }
  return null;
}
