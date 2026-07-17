export const DUAL_ACADEMY_BGM_SCENES = Object.freeze({
  ready: 'academy-ready',
  main: 'academy-main',
  battle: 'academy-battle',
  chain: 'academy-chain',
  danger: 'academy-danger',
  mika: 'academy-mika',
  hina: 'academy-hina',
  yuuka: 'academy-yuuka',
  victory: 'academy-victory',
  defeat: 'academy-defeat',
});

export const DUAL_ACADEMY_SOUNDTRACK = Object.freeze([
  Object.freeze({ scene: 'ready', theme: DUAL_ACADEMY_BGM_SCENES.ready, title: '첫 패의 청춘', icon: 'academy-ready' }),
  Object.freeze({ scene: 'main', theme: DUAL_ACADEMY_BGM_SCENES.main, title: '필드 전개', icon: 'academy-main' }),
  Object.freeze({ scene: 'battle', theme: DUAL_ACADEMY_BGM_SCENES.battle, title: '전투 페이즈', icon: 'academy-battle' }),
  Object.freeze({ scene: 'chain', theme: DUAL_ACADEMY_BGM_SCENES.chain, title: '체인 리액션', icon: 'academy-chain' }),
  Object.freeze({ scene: 'danger', theme: DUAL_ACADEMY_BGM_SCENES.danger, title: '라이프 브레이크', icon: 'academy-danger' }),
  Object.freeze({ scene: 'mika', theme: DUAL_ACADEMY_BGM_SCENES.mika, title: '별빛의 심판', icon: 'academy-mika' }),
  Object.freeze({ scene: 'hina', theme: DUAL_ACADEMY_BGM_SCENES.hina, title: '규율의 포화', icon: 'academy-hina' }),
  Object.freeze({ scene: 'yuuka', theme: DUAL_ACADEMY_BGM_SCENES.yuuka, title: '계산된 방벽', icon: 'academy-yuuka' }),
  Object.freeze({ scene: 'victory', theme: DUAL_ACADEMY_BGM_SCENES.victory, title: '듀얼의 종례', icon: 'academy-victory' }),
  Object.freeze({ scene: 'defeat', theme: DUAL_ACADEMY_BGM_SCENES.defeat, title: '남겨진 카드', icon: 'academy-defeat' }),
]);

function lifePoint(state, side) {
  const value = Number(state?.players?.[side]?.lp);
  return Number.isFinite(value) ? Math.max(0, value) : 8000;
}

export function resolveDualAcademyBgmScene({ activeTabId = 'board', state } = {}) {
  const winner = String(state?.winner || '');
  if (winner) return winner === 'player'
    ? DUAL_ACADEMY_BGM_SCENES.victory
    : DUAL_ACADEMY_BGM_SCENES.defeat;

  const playerLp = lifePoint(state, 'player');
  const enemyLp = lifePoint(state, 'enemy');
  const lowLife = Math.min(playerLp, enemyLp) <= 2400;
  const lateDuel = Number(state?.turn || 1) >= 7;
  if (lowLife || lateDuel) return DUAL_ACADEMY_BGM_SCENES.danger;

  if (Number(state?.chain?.length || 0) > 0 || String(state?.prompt?.kind || 'NONE') !== 'NONE') {
    return DUAL_ACADEMY_BGM_SCENES.chain;
  }
  if (String(state?.phase || '') === 'BATTLE') return DUAL_ACADEMY_BGM_SCENES.battle;
  if (activeTabId === 'logs' || activeTabId === 'inspect') return DUAL_ACADEMY_BGM_SCENES.ready;
  if (Number(state?.turn || 1) <= 1) return DUAL_ACADEMY_BGM_SCENES.ready;
  return DUAL_ACADEMY_BGM_SCENES.main;
}

export function dualAcademyResultMusic(cue = '') {
  const signal = String(cue || '');
  if (signal === 'tcgVictory') {
    return { theme: DUAL_ACADEMY_BGM_SCENES.victory, durationMs: 18_000 };
  }
  if (signal === 'tcgDefeat') {
    return { theme: DUAL_ACADEMY_BGM_SCENES.defeat, durationMs: 16_000 };
  }
  if (signal.startsWith('tcgMika')) {
    return { theme: DUAL_ACADEMY_BGM_SCENES.mika, durationMs: 12_000 };
  }
  if (signal.startsWith('tcgHina')) {
    return { theme: DUAL_ACADEMY_BGM_SCENES.hina, durationMs: 12_000 };
  }
  if (signal.startsWith('tcgYuuka')) {
    return { theme: DUAL_ACADEMY_BGM_SCENES.yuuka, durationMs: 12_000 };
  }
  if (signal === 'tcgStart') {
    return { theme: DUAL_ACADEMY_BGM_SCENES.ready, durationMs: 8_000 };
  }
  if (['tcgChain', 'tcgNegate', 'tcgPrompt'].includes(signal)) {
    return { theme: DUAL_ACADEMY_BGM_SCENES.chain, durationMs: 10_000 };
  }
  if (['tcgAttack', 'tcgHit', 'tcgDestroy'].includes(signal)) {
    return { theme: DUAL_ACADEMY_BGM_SCENES.battle, durationMs: 9_000 };
  }
  if (signal === 'tcgDamage') {
    return { theme: DUAL_ACADEMY_BGM_SCENES.danger, durationMs: 10_000 };
  }
  if (['tcgDraw', 'tcgSummon', 'tcgSet', 'tcgEffect', 'tcgPosition', 'tcgPhase', 'tcgTurn'].includes(signal)) {
    return { theme: DUAL_ACADEMY_BGM_SCENES.main, durationMs: 7_000 };
  }
  return null;
}
