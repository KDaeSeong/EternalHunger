export const ETERNAL_HUNGER_BGM_SCENES = Object.freeze({
  ready: 'eternal-ready',
  day: 'eternal-day',
  night: 'eternal-night',
  combat: 'eternal-combat',
  final: 'eternal-final',
  result: 'eternal-result',
});

export const ETERNAL_HUNGER_SOUNDTRACK = Object.freeze([
  Object.freeze({ scene: 'ready', theme: ETERNAL_HUNGER_BGM_SCENES.ready, title: '출전 대기' }),
  Object.freeze({ scene: 'day', theme: ETERNAL_HUNGER_BGM_SCENES.day, title: '루미아의 낮' }),
  Object.freeze({ scene: 'night', theme: ETERNAL_HUNGER_BGM_SCENES.night, title: '금지구역 경보' }),
  Object.freeze({ scene: 'combat', theme: ETERNAL_HUNGER_BGM_SCENES.combat, title: '교전 개시' }),
  Object.freeze({ scene: 'final', theme: ETERNAL_HUNGER_BGM_SCENES.final, title: '마지막 안전지대' }),
  Object.freeze({ scene: 'result', theme: ETERNAL_HUNGER_BGM_SCENES.result, title: '생존 기록' }),
]);

export function resolveEternalHungerBgmScene({
  day = 0,
  phase = '',
  isGameOver = false,
  survivorCount = 24,
} = {}) {
  const currentDay = Math.max(0, Number(day || 0));
  const alive = Math.max(0, Number(survivorCount ?? 24));
  if (isGameOver) return ETERNAL_HUNGER_BGM_SCENES.result;
  if (currentDay <= 0) return ETERNAL_HUNGER_BGM_SCENES.ready;
  if (currentDay >= 6 || (currentDay >= 3 && alive > 0 && alive <= 4)) {
    return ETERNAL_HUNGER_BGM_SCENES.final;
  }
  return phase === 'night'
    ? ETERNAL_HUNGER_BGM_SCENES.night
    : ETERNAL_HUNGER_BGM_SCENES.day;
}

export function eternalHungerCombatMusicDuration(presentation) {
  const action = String(presentation?.action || '');
  if (action === 'rift-battle') return 14_000;
  if (action === 'boss-spawn') return 10_000;
  return 0;
}
