export const BA_VANGUARD_BGM_SCENES = Object.freeze({
  ready: 'vanguard-ready',
  ride: 'vanguard-ride',
  battle: 'vanguard-battle',
  guard: 'vanguard-guard',
  trigger: 'vanguard-trigger',
  victory: 'vanguard-victory',
  defeat: 'vanguard-defeat',
});

export const BA_VANGUARD_SOUNDTRACK = Object.freeze([
  Object.freeze({ scene: 'ready', theme: BA_VANGUARD_BGM_SCENES.ready, title: '셔플 전의 정적', icon: 'deck' }),
  Object.freeze({ scene: 'ride', theme: BA_VANGUARD_BGM_SCENES.ride, title: '라이드 더 뱅가드', icon: 'vanguard-ride' }),
  Object.freeze({ scene: 'battle', theme: BA_VANGUARD_BGM_SCENES.battle, title: '트윈 드라이브', icon: 'vanguard-attack' }),
  Object.freeze({ scene: 'guard', theme: BA_VANGUARD_BGM_SCENES.guard, title: '실드 인터셉트', icon: 'vanguard-perfect-guard' }),
  Object.freeze({ scene: 'trigger', theme: BA_VANGUARD_BGM_SCENES.trigger, title: '체크 더 트리거', icon: 'vanguard-trigger' }),
  Object.freeze({ scene: 'victory', theme: BA_VANGUARD_BGM_SCENES.victory, title: '스탠드 업, 빅토리', icon: 'vanguard-victory' }),
  Object.freeze({ scene: 'defeat', theme: BA_VANGUARD_BGM_SCENES.defeat, title: '엔드 페이즈', icon: 'vanguard-defeat' }),
]);

function damageCount(duel, side) {
  return Array.isArray(duel?.players?.[side]?.damage) ? duel.players[side].damage.length : 0;
}

export function resolveBaVanguardBgmScene({ activeTabId = 'duel', duel } = {}) {
  const winner = String(duel?.winner || '');
  if (winner) return winner === 'me' ? BA_VANGUARD_BGM_SCENES.victory : BA_VANGUARD_BGM_SCENES.defeat;

  const battle = duel?.battle;
  const turn = Math.max(1, Number(duel?.turn || 1));
  const phase = String(duel?.phase || 'STAND');
  const meDamage = damageCount(duel, 'me');
  const oppDamage = damageCount(duel, 'opp');
  const highPressure = Math.max(meDamage, oppDamage) >= 4
    || turn >= 5
    || Boolean(duel?.players?.me?.isStrided)
    || Boolean(duel?.players?.opp?.isStrided);

  if (battle?.defenderSide === 'me') return BA_VANGUARD_BGM_SCENES.guard;
  if (battle || phase === 'BATTLE') {
    return highPressure ? BA_VANGUARD_BGM_SCENES.trigger : BA_VANGUARD_BGM_SCENES.battle;
  }
  if (highPressure) return BA_VANGUARD_BGM_SCENES.trigger;
  if (activeTabId === 'deck' || activeTabId === 'tactics') return BA_VANGUARD_BGM_SCENES.ready;
  if (turn <= 1 && (phase === 'STAND' || phase === 'DRAW')) return BA_VANGUARD_BGM_SCENES.ready;
  return BA_VANGUARD_BGM_SCENES.ride;
}

export function baVanguardResultMusic(presentation) {
  const key = String(presentation?.key || '');
  const detail = String(presentation?.detail || '');
  if (key === 'newDuel' || key === 'replay') {
    return { theme: BA_VANGUARD_BGM_SCENES.ready, durationMs: 8_000 };
  }
  if (key === 'phase' && /배틀/.test(detail)) {
    return { theme: BA_VANGUARD_BGM_SCENES.battle, durationMs: 9_000 };
  }
  if (key === 'turn' || key === 'phase') return null;
  if (['draw', 'ride', 'rideAssist', 'call'].includes(key)) {
    return { theme: BA_VANGUARD_BGM_SCENES.ride, durationMs: 7_000 };
  }
  if (['attackDeclared', 'attackHit', 'damageTaken', 'retired'].includes(key)) {
    return { theme: BA_VANGUARD_BGM_SCENES.battle, durationMs: 9_000 };
  }
  if (['guardWindow', 'guardAdded', 'perfectGuard', 'attackBlocked'].includes(key)) {
    return { theme: BA_VANGUARD_BGM_SCENES.guard, durationMs: 9_000 };
  }
  if (['trigger', 'triggerCritical', 'triggerDraw', 'triggerStand', 'triggerHeal', 'stride', 'skill'].includes(key)) {
    return { theme: BA_VANGUARD_BGM_SCENES.trigger, durationMs: 11_000 };
  }
  if (key === 'victory' || key === 'deckOutVictory') {
    return { theme: BA_VANGUARD_BGM_SCENES.victory, durationMs: 18_000 };
  }
  if (key === 'defeat' || key === 'deckOutDefeat') {
    return { theme: BA_VANGUARD_BGM_SCENES.defeat, durationMs: 16_000 };
  }
  return null;
}
