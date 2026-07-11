function damageCount(duel, side) {
  return Array.isArray(duel?.players?.[side]?.damage)
    ? duel.players[side].damage.length
    : 0;
}

function handCount(duel, side) {
  return Array.isArray(duel?.players?.[side]?.hand)
    ? duel.players[side].hand.length
    : 0;
}

function battleSnapshot(battle) {
  if (!battle) return null;
  return {
    attackerSide: String(battle.attackerSide || ''),
    attackerCircle: String(battle.attackerCircle || ''),
    defenderSide: String(battle.defenderSide || ''),
    defenderCircle: String(battle.defenderCircle || ''),
    guardShield: Number(battle.guardShield || 0),
    guardCards: Array.isArray(battle.guardCards) ? battle.guardCards.length : 0,
    perfectGuard: Boolean(battle.perfectGuard),
    step: String(battle.step || ''),
  };
}

export function baVanguardFeedbackSnapshot(duel) {
  return {
    active: String(duel?.active || ''),
    phase: String(duel?.phase || ''),
    turn: Number(duel?.turn || 0),
    winner: String(duel?.winner || ''),
    latestLog: String(duel?.log?.[0] || ''),
    logCount: Array.isArray(duel?.log) ? duel.log.length : 0,
    meDamage: damageCount(duel, 'me'),
    oppDamage: damageCount(duel, 'opp'),
    meHand: handCount(duel, 'me'),
    oppHand: handCount(duel, 'opp'),
    meStrided: Boolean(duel?.players?.me?.isStrided),
    oppStrided: Boolean(duel?.players?.opp?.isStrided),
    battle: battleSnapshot(duel?.battle),
  };
}

function logCue(latestLog) {
  const text = String(latestLog || '');
  if (/실패|조건을 만족하지 못|없습니다|할 수 없습니다|이미 .*사용/.test(text)) return 'vanguardInvalid';
  if (/트리거/.test(text)) return 'vanguardTrigger';
  if (/공격이 막혔/.test(text)) return 'vanguardBlocked';
  if (/공격이 히트/.test(text)) return 'vanguardHit';
  if (/공격했습니다/.test(text)) return 'vanguardAttack';
  if (/완전 가드/.test(text)) return 'vanguardPerfectGuard';
  if (/G 가디언|가드에 사용/.test(text)) return 'vanguardGuard';
  if (/스트라이드/.test(text)) return 'vanguardStride';
  if (/라이드/.test(text)) return 'vanguardRide';
  if (/콜했습니다/.test(text)) return 'vanguardCall';
  if (/VC 스킬/.test(text)) return 'vanguardSkill';
  if (/멀리건|드로우/.test(text)) return 'vanguardDraw';
  if (/턴 \d+을 시작/.test(text)) return 'vanguardTurn';
  if (/페이즈/.test(text)) return 'vanguardPhase';
  return '';
}

export function baVanguardFeedbackCue(previous, current) {
  if (!previous || !current) return '';

  if (current.winner && current.winner !== previous.winner) {
    return current.winner === 'me' ? 'vanguardVictory' : 'vanguardDefeat';
  }
  if (current.meDamage > previous.meDamage) return 'vanguardDamage';
  if (current.oppDamage > previous.oppDamage) return 'vanguardHit';

  if (current.battle && !previous.battle) {
    return current.battle.defenderSide === 'me'
      ? 'vanguardGuardWindow'
      : 'vanguardAttack';
  }
  if (current.battle && previous.battle) {
    if (current.battle.perfectGuard && !previous.battle.perfectGuard) return 'vanguardPerfectGuard';
    if (
      current.battle.guardShield > previous.battle.guardShield
      || current.battle.guardCards > previous.battle.guardCards
    ) return 'vanguardGuard';
  }

  if (
    current.latestLog
    && (current.latestLog !== previous.latestLog || current.logCount > previous.logCount)
  ) {
    const cue = logCue(current.latestLog);
    if (cue) return cue;
  }
  if (current.turn !== previous.turn || current.active !== previous.active) return 'vanguardTurn';
  if (current.phase !== previous.phase) return 'vanguardPhase';
  return '';
}
