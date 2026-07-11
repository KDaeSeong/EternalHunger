const PLAYER_LABELS = {
  player: '나',
  enemy: 'AI',
};

const PROMPT_LABELS = {
  NONE: '자유 행동',
  RESPOND: '체인 응답',
  SELECT_TARGET: '대상 선택',
  SELECT_FROM_DECK: '덱 선택',
  TRIGGER_CONFIRM: '효과 확인',
};

function zoneCount(state, side, zone) {
  const rows = state?.players?.[side]?.[zone];
  return Array.isArray(rows) ? rows.length : 0;
}

function latestEvent(state) {
  return Array.isArray(state?.events) ? state.events[0] || null : null;
}

export function dualAcademyTcgFeedbackSnapshot(state) {
  const event = latestEvent(state);
  return {
    matchId: String(state?.matchId || ''),
    winner: String(state?.winner || ''),
    turn: Number(state?.turn || 0),
    turnPlayer: String(state?.turnPlayer || ''),
    phase: String(state?.phase || ''),
    chainCount: Array.isArray(state?.chain) ? state.chain.length : 0,
    promptKind: String(state?.prompt?.kind || 'NONE'),
    promptPlayer: String(state?.prompt?.player || ''),
    latestEventId: String(event?.id || ''),
    latestEventType: String(event?.type || ''),
    latestEventActor: String(event?.actor || ''),
    latestEventText: String(event?.text || ''),
    playerLp: Number(state?.players?.player?.lp || 0),
    enemyLp: Number(state?.players?.enemy?.lp || 0),
    playerGrave: zoneCount(state, 'player', 'grave'),
    enemyGrave: zoneCount(state, 'enemy', 'grave'),
    playerBanished: zoneCount(state, 'player', 'banished'),
    enemyBanished: zoneCount(state, 'enemy', 'banished'),
  };
}

function eventCue(snapshot) {
  const type = snapshot.latestEventType;
  const text = snapshot.latestEventText;

  if (type === 'DRAW') return 'tcgDraw';
  if (type === 'SUMMON') return 'tcgSummon';
  if (type === 'SET') return 'tcgSet';
  if (type === 'POSITION_CHANGE') return 'tcgPosition';
  if (type === 'ATTACK_DECLARE') return /파괴/.test(text) ? 'tcgDestroy' : 'tcgAttack';
  if (type === 'DAMAGE_TAKEN') return snapshot.latestEventActor === 'player' ? 'tcgDamage' : 'tcgHit';
  if (type === 'TURN_START') return 'tcgTurn';
  if (type === 'PHASE') return 'tcgPhase';
  if (type === 'GREET') return 'tcgStart';
  if (type === 'PROMPT') {
    if (/넘겼|응답 없이/.test(text)) return 'pass';
    if (/없습니다|할 수 없습니다|먼저|이미|필요합니다|사용할 수/.test(text)) return 'tcgInvalid';
    return 'tcgPrompt';
  }
  if (type === 'EFFECT_ACTIVATE') {
    if (/무효/.test(text)) return 'tcgNegate';
    if (/파괴|제외/.test(text)) return 'tcgDestroy';
    return 'tcgEffect';
  }
  return '';
}

export function dualAcademyTcgFeedbackCue(previous, current) {
  if (!previous || !current) return '';
  if (previous.matchId !== current.matchId) return 'tcgStart';
  if (current.winner && current.winner !== previous.winner) {
    return current.winner === 'player' ? 'tcgVictory' : 'tcgDefeat';
  }
  if (current.playerLp < previous.playerLp) return 'tcgDamage';
  if (current.enemyLp < previous.enemyLp) return 'tcgHit';
  if (
    current.playerGrave > previous.playerGrave
    || current.enemyGrave > previous.enemyGrave
    || current.playerBanished > previous.playerBanished
    || current.enemyBanished > previous.enemyBanished
  ) return 'tcgDestroy';
  if (current.chainCount > previous.chainCount) return 'tcgChain';
  if (current.promptKind !== previous.promptKind && current.promptKind !== 'NONE') {
    return current.promptKind === 'RESPOND' ? 'tcgChain' : 'tcgPrompt';
  }
  if (current.latestEventId && current.latestEventId !== previous.latestEventId) {
    const cue = eventCue(current);
    if (cue) return cue;
  }
  if (current.turn !== previous.turn || current.turnPlayer !== previous.turnPlayer) return 'tcgTurn';
  if (current.phase !== previous.phase) return 'tcgPhase';
  return '';
}

function eventPresentation(event) {
  const type = String(event?.type || 'GREET');
  const text = String(event?.text || '듀얼 이벤트를 기다리고 있습니다.');
  if (type === 'DRAW') return { action: 'draw', label: '드로우' };
  if (type === 'SUMMON') return { action: 'summon', label: '소환' };
  if (type === 'SET') return { action: 'set', label: '카드 세트' };
  if (type === 'POSITION_CHANGE') return { action: 'position', label: '표시 변경' };
  if (type === 'ATTACK_DECLARE') return { action: 'attack', label: /파괴/.test(text) ? '전투 파괴' : '공격' };
  if (type === 'DAMAGE_TAKEN') return { action: 'attack', label: 'LP 피해' };
  if (type === 'EFFECT_ACTIVATE') {
    if (/무효/.test(text)) return { action: 'trap', label: '효과 무효' };
    if (/파괴|제외/.test(text)) return { action: 'attack', label: '카드 제거' };
    return { action: 'effect', label: '효과 처리' };
  }
  if (type === 'TURN_START') return { action: 'turn', label: '턴 시작' };
  if (type === 'PHASE') return { action: 'phase', label: '페이즈 전환' };
  if (type === 'PROMPT') return { action: 'target', label: '처리 안내' };
  if (type === 'WIN') return { action: 'victory', label: '승리' };
  if (type === 'LOSE') return { action: 'defeat', label: '패배' };
  return { action: 'duel', label: '듀얼 시작' };
}

export function dualAcademyTcgPulse(state) {
  const event = latestEvent(state);
  const winner = String(state?.winner || '');
  const actor = String(event?.actor || state?.turnPlayer || 'player');
  const presentation = winner
    ? winner === 'player'
      ? { action: 'victory', label: '매치 승리' }
      : { action: 'defeat', label: '매치 패배' }
    : eventPresentation(event);
  const promptKind = String(state?.prompt?.kind || 'NONE');
  const promptLabel = PROMPT_LABELS[promptKind] || promptKind;
  const chainCount = Array.isArray(state?.chain) ? state.chain.length : 0;

  return {
    ...presentation,
    detail: winner
      ? `${PLAYER_LABELS[winner] || winner}이(가) 듀얼에서 승리했습니다.`
      : String(event?.text || '듀얼 이벤트를 기다리고 있습니다.'),
    meta: `T${Number(event?.turn || state?.turn || 1)} · ${String(event?.phase || state?.phase || 'MAIN1')} · ${PLAYER_LABELS[actor] || actor}`,
    promptLabel,
    chainLabel: `체인 ${chainCount}`,
    tone: winner === 'player'
      ? 'green'
      : winner === 'enemy' || actor === 'enemy'
        ? 'red'
        : promptKind !== 'NONE'
          ? 'gold'
          : chainCount > 0
            ? 'violet'
            : 'blue',
  };
}
