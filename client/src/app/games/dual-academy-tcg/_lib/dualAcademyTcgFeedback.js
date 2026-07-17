const PLAYER_LABELS = {
  player: '나',
  enemy: 'AI',
};

const PROMPT_LABELS = {
  NONE: '자유 행동',
  RESPOND: '체인 응답',
  SELECT_TARGET: '대상 선택',
  SELECT_FROM_DECK: '덱 선택',
  SELECT_COST_MIKA_NEGATE: '미카 코스트',
  TRIGGER_CONFIRM: '효과 확인',
};

function zoneCount(state, side, zone) {
  const rows = state?.players?.[side]?.[zone];
  return Array.isArray(rows) ? rows.length : 0;
}

function shieldCount(state, side) {
  const player = state?.players?.[side] || {};
  return [
    ...(Array.isArray(player.monster) ? player.monster : []),
    ...(Array.isArray(player.spellTrap) ? player.spellTrap : []),
    player.field,
  ].filter((card) => card?.shield).length;
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
    latestEventEffect: String(event?.payload?.effect || ''),
    playerLp: Number(state?.players?.player?.lp || 0),
    enemyLp: Number(state?.players?.enemy?.lp || 0),
    playerGrave: zoneCount(state, 'player', 'grave'),
    enemyGrave: zoneCount(state, 'enemy', 'grave'),
    playerBanished: zoneCount(state, 'player', 'banished'),
    enemyBanished: zoneCount(state, 'enemy', 'banished'),
    playerShields: shieldCount(state, 'player'),
    enemyShields: shieldCount(state, 'enemy'),
  };
}

const PRIORITY_EVENT_CUES = new Set([
  'tcgMikaNegate',
  'tcgMikaBurst',
  'tcgHinaDiscipline',
  'tcgHinaRecover',
  'tcgYuukaGuard',
  'tcgYuukaSearch',
  'tcgDirectAttack',
  'tcgPierce',
  'tcgClash',
  'tcgShield',
  'tcgBanish',
  'tcgHeal',
  'tcgCounter',
  'tcgDeckOut',
]);

const SIGNATURE_EVENT_CUES = new Set([
  'tcgMikaNegate',
  'tcgMikaBurst',
  'tcgHinaDiscipline',
  'tcgHinaRecover',
  'tcgYuukaGuard',
  'tcgYuukaSearch',
]);

function eventCue(snapshot) {
  const type = snapshot.latestEventType;
  const text = snapshot.latestEventText;
  const effect = snapshot.latestEventEffect;

  if (effect === 'mika-negate') return 'tcgMikaNegate';
  if (effect === 'mika-battle-boost') return 'tcgMikaBurst';
  if (effect === 'hina-destroy-any') return 'tcgHinaDiscipline';
  if (effect === 'hina-battle-heal') return 'tcgHinaRecover';
  if (effect === 'yuuka-data-shield') return 'tcgYuukaGuard';
  if (effect === 'yuuka-search') return 'tcgYuukaSearch';
  if (effect === 'counter-negate' || effect === 'chain-negated') return 'tcgCounter';
  if (effect === 'shield') return 'tcgShield';
  if (effect === 'banish-enemy-card') return 'tcgBanish';
  if (effect === 'heal' || /LP 회복/.test(text)) return 'tcgHeal';

  if (type === 'DRAW') return 'tcgDraw';
  if (type === 'SUMMON') return 'tcgSummon';
  if (type === 'SET') return 'tcgSet';
  if (type === 'POSITION_CHANGE') return 'tcgPosition';
  if (type === 'ATTACK_DECLARE') {
    if (/직접 공격/.test(text)) return 'tcgDirectAttack';
    if (/파괴/.test(text)) return 'tcgDestroy';
    if (/전투 피해 없음|와 전투했습니다/.test(text)) return 'tcgClash';
    return 'tcgAttack';
  }
  if (type === 'DAMAGE_TAKEN') {
    if (/관통/.test(text)) return 'tcgPierce';
    return snapshot.latestEventActor === 'player' ? 'tcgDamage' : 'tcgHit';
  }
  if (type === 'TURN_START') return 'tcgTurn';
  if (type === 'PHASE') return 'tcgPhase';
  if (type === 'GREET') return 'tcgStart';
  if (type === 'LOSE' && /덱이 비어/.test(text)) return 'tcgDeckOut';
  if (type === 'PROMPT') {
    if (/넘겼|응답 없이/.test(text)) return 'pass';
    if (/없습니다|할 수 없습니다|먼저|이미|필요합니다|사용할 수/.test(text)) return 'tcgInvalid';
    return 'tcgPrompt';
  }
  if (type === 'EFFECT_ACTIVATE') {
    if (/무효/.test(text)) return 'tcgCounter';
    if (/제외/.test(text)) return 'tcgBanish';
    if (/보호막|대상 보호/.test(text)) return 'tcgShield';
    if (/회복/.test(text)) return 'tcgHeal';
    if (/파괴/.test(text)) return 'tcgDestroy';
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
  const latestCue = current.latestEventId && current.latestEventId !== previous.latestEventId
    ? eventCue(current)
    : '';
  if (SIGNATURE_EVENT_CUES.has(latestCue)) return latestCue;
  if (current.playerShields < previous.playerShields || current.enemyShields < previous.enemyShields) return 'tcgShieldBreak';
  if (PRIORITY_EVENT_CUES.has(latestCue)) return latestCue;
  if (current.playerBanished > previous.playerBanished || current.enemyBanished > previous.enemyBanished) return 'tcgBanish';
  if (current.playerLp > previous.playerLp || current.enemyLp > previous.enemyLp) return 'tcgHeal';
  if (current.playerLp < previous.playerLp) return 'tcgDamage';
  if (current.enemyLp < previous.enemyLp) return 'tcgHit';
  if (
    current.playerGrave > previous.playerGrave
    || current.enemyGrave > previous.enemyGrave
  ) return 'tcgDestroy';
  if (current.chainCount > previous.chainCount) return 'tcgChain';
  if (current.chainCount < previous.chainCount && current.chainCount === 0) return 'tcgChainResolve';
  if (current.promptKind !== previous.promptKind && current.promptKind !== 'NONE') {
    if (current.promptKind === 'SELECT_COST_MIKA_NEGATE') return 'tcgMikaCost';
    return current.promptKind === 'RESPOND' ? 'tcgChain' : 'tcgPrompt';
  }
  if (latestCue) return latestCue;
  if (current.turn !== previous.turn || current.turnPlayer !== previous.turnPlayer) return 'tcgTurn';
  if (current.phase !== previous.phase) return 'tcgPhase';
  return '';
}

export function dualAcademyTcgEventPresentation(event) {
  const type = String(event?.type || 'GREET');
  const text = String(event?.text || '듀얼 이벤트를 기다리고 있습니다.');
  const effect = String(event?.payload?.effect || '');
  if (effect === 'mika-negate') return { action: 'tcg-mika-negate', label: '미카 효과 무효' };
  if (effect === 'mika-battle-boost') return { action: 'tcg-mika-burst', label: '미카 전투 돌파' };
  if (effect === 'hina-destroy-any') return { action: 'tcg-hina-discipline', label: '히나 제압' };
  if (effect === 'hina-battle-heal') return { action: 'tcg-hina-recover', label: '히나 전투 회복' };
  if (effect === 'yuuka-data-shield') return { action: 'tcg-yuuka-guard', label: '유우카 대상 보호' };
  if (effect === 'yuuka-search') return { action: 'tcg-yuuka-search', label: '유우카 서치' };
  if (effect === 'counter-negate' || effect === 'chain-negated') return { action: 'tcg-counter', label: '체인 무효' };
  if (effect === 'shield') return { action: 'tcg-shield', label: '보호막 부여' };
  if (effect === 'banish-enemy-card') return { action: 'tcg-banish', label: '카드 제외' };
  if (effect === 'heal' || /LP 회복/.test(text)) return { action: 'tcg-heal', label: 'LP 회복' };
  if (type === 'DRAW') return { action: 'draw', label: '드로우' };
  if (type === 'SUMMON') return { action: 'summon', label: '소환' };
  if (type === 'SET') return { action: 'set', label: '카드 세트' };
  if (type === 'POSITION_CHANGE') return { action: 'position', label: '표시 변경' };
  if (type === 'ATTACK_DECLARE') {
    if (/직접 공격/.test(text)) return { action: 'tcg-direct-attack', label: '직접 공격' };
    if (/파괴/.test(text)) return { action: 'tcg-destroy', label: '전투 파괴' };
    if (/전투 피해 없음|와 전투했습니다/.test(text)) return { action: 'tcg-clash', label: '몬스터 전투' };
    return { action: 'attack', label: '공격' };
  }
  if (type === 'DAMAGE_TAKEN') {
    return /관통/.test(text)
      ? { action: 'tcg-pierce', label: '관통 피해' }
      : { action: 'attack', label: 'LP 피해' };
  }
  if (type === 'EFFECT_ACTIVATE') {
    if (/무효/.test(text)) return { action: 'tcg-counter', label: '효과 무효' };
    if (/제외/.test(text)) return { action: 'tcg-banish', label: '카드 제외' };
    if (/보호막|대상 보호/.test(text)) return { action: 'tcg-shield', label: '대상 보호' };
    if (/회복/.test(text)) return { action: 'tcg-heal', label: 'LP 회복' };
    if (/파괴/.test(text)) return { action: 'tcg-destroy', label: '카드 파괴' };
    return { action: 'effect', label: '효과 처리' };
  }
  if (type === 'TURN_START') return { action: 'turn', label: '턴 시작' };
  if (type === 'PHASE') return { action: 'phase', label: '페이즈 전환' };
  if (type === 'PROMPT') return { action: 'target', label: '처리 안내' };
  if (type === 'WIN') return { action: 'victory', label: '승리' };
  if (type === 'LOSE') return /덱이 비어/.test(text)
    ? { action: 'tcg-deck-out', label: '덱 아웃' }
    : { action: 'defeat', label: '패배' };
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
    : dualAcademyTcgEventPresentation(event);
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
    promptAction: promptKind === 'RESPOND' ? 'tcg-counter' : promptKind === 'NONE' ? 'phase' : 'target',
    chainLabel: `체인 ${chainCount}`,
    chainAction: chainCount > 0 ? 'chain' : 'tcg-chain-resolve',
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
