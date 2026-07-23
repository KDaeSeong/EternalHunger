const SIDE_LABELS = {
  me: '나',
  opp: 'AI',
};

const PHASE_LABELS = {
  STAND: '스탠드',
  DRAW: '드로우',
  MAIN: '메인',
  BATTLE: '배틀',
  END: '엔드',
};

const FEEDBACK_PROFILES = {
  idle: { action: 'duel', cue: '', label: '최근 듀얼 결과', tone: 'ready' },
  newDuel: { action: 'new', cue: 'vanguardStart', label: '새 듀얼 개시', tone: 'highlight' },
  turn: { action: 'vanguard-turn', cue: 'vanguardTurn', label: '새 턴 시작', tone: 'highlight' },
  phase: { action: 'phase', cue: 'vanguardPhase', label: '페이즈 진행', tone: 'highlight' },
  draw: { action: 'vanguard-draw', cue: 'vanguardDraw', label: '카드 드로우', tone: 'success' },
  ride: { action: 'vanguard-ride', cue: 'vanguardRide', label: '라이드 성공', tone: 'success' },
  rideAssist: { action: 'vanguard-ride-assist', cue: 'vanguardRideAssist', label: '라이드 어시스트', tone: 'success' },
  call: { action: 'vanguard-call', cue: 'vanguardCall', label: '리어가드 콜', tone: 'success' },
  stride: { action: 'vanguard-stride', cue: 'vanguardStride', label: '스트라이드 성공', tone: 'champion' },
  skill: { action: 'vanguard-skill', cue: 'vanguardSkill', label: 'VC 스킬 발동', tone: 'highlight' },
  attackDeclared: { action: 'vanguard-attack', cue: 'vanguardAttack', label: '공격 선언', tone: 'highlight' },
  guardWindow: { action: 'vanguard-guard-window', cue: 'vanguardGuardWindow', label: '가드 판단', tone: 'warning' },
  guardAdded: { action: 'vanguard-guard', cue: 'vanguardGuard', label: '가드 보강', tone: 'success' },
  perfectGuard: { action: 'vanguard-perfect-guard', cue: 'vanguardPerfectGuard', label: '완전 가드', tone: 'champion' },
  attackBlocked: { action: 'vanguard-blocked', cue: 'vanguardBlocked', label: '공격 차단', tone: 'success' },
  trigger: { action: 'vanguard-trigger', cue: 'vanguardTrigger', label: '트리거 발동', tone: 'champion' },
  triggerCritical: { action: 'vanguard-trigger-critical', cue: 'vanguardTriggerCritical', label: '크리티컬 트리거', tone: 'champion' },
  triggerDraw: { action: 'vanguard-trigger-draw', cue: 'vanguardTriggerDraw', label: '드로우 트리거', tone: 'success' },
  triggerStand: { action: 'vanguard-trigger-stand', cue: 'vanguardTriggerStand', label: '스탠드 트리거', tone: 'highlight' },
  triggerHeal: { action: 'vanguard-trigger-heal', cue: 'vanguardTriggerHeal', label: '힐 트리거', tone: 'success' },
  attackHit: { action: 'vanguard-hit', cue: 'vanguardHit', label: '공격 히트', tone: 'success' },
  damageTaken: { action: 'vanguard-damage', cue: 'vanguardDamage', label: '데미지 발생', tone: 'danger' },
  retired: { action: 'vanguard-retire', cue: 'vanguardRetire', label: '유닛 퇴각', tone: 'warning' },
  victory: { action: 'vanguard-victory', cue: 'vanguardVictory', label: '듀얼 승리', tone: 'champion' },
  defeat: { action: 'vanguard-defeat', cue: 'vanguardDefeat', label: '듀얼 패배', tone: 'danger' },
  deckOutVictory: { action: 'vanguard-deck-out', cue: 'vanguardVictory', label: '덱 아웃 승리', tone: 'champion' },
  deckOutDefeat: { action: 'vanguard-deck-out', cue: 'vanguardDeckOut', label: '덱 아웃 패배', tone: 'danger' },
  rideBlocked: { action: 'vanguard-ride', cue: 'vanguardRideBlocked', label: '라이드 불가', tone: 'warning' },
  strideBlocked: { action: 'vanguard-stride', cue: 'vanguardStrideBlocked', label: '스트라이드 불가', tone: 'warning' },
  skillBlocked: { action: 'vanguard-skill', cue: 'vanguardSkillBlocked', label: 'VC 스킬 불가', tone: 'warning' },
  guardBlocked: { action: 'vanguard-guard', cue: 'vanguardGuardBlocked', label: '가드 불가', tone: 'warning' },
  attackDenied: { action: 'vanguard-attack', cue: 'vanguardAttackDenied', label: '공격 불가', tone: 'warning' },
  invalid: { action: 'vanguard-invalid', cue: 'vanguardInvalid', label: '액션 실행 불가', tone: 'warning' },
  replay: { action: 'vanguard-replay', cue: 'vanguardReplay', label: '리플레이 준비', tone: 'success' },
};

const TEXT_PRESENTATIONS = [
  { pattern: /새 .*듀얼|새 플레이테스트/, force: true, value: FEEDBACK_PROFILES.newDuel },
  { pattern: /리플레이.*(?:준비|저장|다운로드)/, force: true, value: FEEDBACK_PROFILES.replay },
  { pattern: /로그인|실패|없습니다|아닙니다|찾을 수 없|불러오지 못|할 수 없습니다|조건을 만족하지 못|오류|충돌|필요합니다/i, force: true, value: FEEDBACK_PROFILES.invalid },
  { pattern: /불러오|불러왔/, force: true, value: { action: 'load', cue: '', label: '듀얼 불러오기', tone: 'success' } },
  { pattern: /게임방.*저장/, force: true, value: { action: 'room', cue: '', label: '게임방 동기화', tone: 'success' } },
  { pattern: /저장/, force: true, value: { action: 'save', cue: '', label: '듀얼 저장', tone: 'success' } },
  { pattern: /전적.*기록/, force: true, value: { action: 'archive', cue: '', label: '전적 기록', tone: 'success' } },
];

const BLOCKED_LOG = /실패|조건을 만족하지 못|없습니다|아닙니다|할 수 없습니다|이미 .*사용|비용이 부족|공격할 수 없습니다/;
const DECK_OUT_LOG = /덱이 비어|덱이 비었습니다/;

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function damageCount(duel, side) {
  return safeArray(duel?.players?.[side]?.damage).length;
}

function handCount(duel, side) {
  return safeArray(duel?.players?.[side]?.hand).length;
}

function deckCount(duel, side) {
  return safeArray(duel?.players?.[side]?.deck).length;
}

function dropCount(duel, side) {
  return safeArray(duel?.players?.[side]?.drop).length;
}

function soulCount(duel, side) {
  return safeArray(duel?.players?.[side]?.soul).length;
}

function fieldCount(duel, side) {
  return Object.values(duel?.players?.[side]?.circles || {}).filter(Boolean).length;
}

function battleSnapshot(battle) {
  if (!battle) return null;
  return {
    attackerSide: String(battle.attackerSide || ''),
    attackerCircle: String(battle.attackerCircle || ''),
    defenderSide: String(battle.defenderSide || ''),
    defenderCircle: String(battle.defenderCircle || ''),
    guardShield: Number(battle.guardShield || 0),
    guardCards: safeArray(battle.guardCards).length,
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
    recentLogs: safeArray(duel?.log).slice(0, 6).map((row) => String(row || '')),
    logCount: safeArray(duel?.log).length,
    meDamage: damageCount(duel, 'me'),
    oppDamage: damageCount(duel, 'opp'),
    meHand: handCount(duel, 'me'),
    oppHand: handCount(duel, 'opp'),
    meDeck: deckCount(duel, 'me'),
    oppDeck: deckCount(duel, 'opp'),
    meDrop: dropCount(duel, 'me'),
    oppDrop: dropCount(duel, 'opp'),
    meSoul: soulCount(duel, 'me'),
    oppSoul: soulCount(duel, 'opp'),
    meField: fieldCount(duel, 'me'),
    oppField: fieldCount(duel, 'opp'),
    meStrided: Boolean(duel?.players?.me?.isStrided),
    oppStrided: Boolean(duel?.players?.opp?.isStrided),
    battle: battleSnapshot(duel?.battle),
  };
}

function asSnapshot(value) {
  return Object.prototype.hasOwnProperty.call(value || {}, 'meDamage')
    ? value
    : baVanguardFeedbackSnapshot(value);
}

function transitionFromLog(latestLog) {
  const text = String(latestLog || '');
  if (BLOCKED_LOG.test(text)) {
    if (/스트라이드 (?:조건|비용)|G존|G 유닛/.test(text)) return 'strideBlocked';
    if (/라이드|Grade \d+ 노멀 유닛/.test(text)) return 'rideBlocked';
    if (/VC 스킬|스킬 비용/.test(text)) return 'skillBlocked';
    if (/가드|실드|G 가디언/.test(text)) return 'guardBlocked';
    if (/공격/.test(text)) return 'attackDenied';
    return 'invalid';
  }
  if (/공격이 막혔/.test(text)) return 'attackBlocked';
  if (/공격이 히트/.test(text)) return 'attackHit';
  if (/크리티컬 트리거/.test(text)) return 'triggerCritical';
  if (/드로우 트리거/.test(text)) return 'triggerDraw';
  if (/스탠드 트리거/.test(text)) return 'triggerStand';
  if (/힐 트리거/.test(text)) return 'triggerHeal';
  if (/트리거/.test(text)) return 'trigger';
  if (/G 가디언|가드에 사용/.test(text)) return 'guardAdded';
  if (/퇴각/.test(text)) return 'retired';
  if (/스트라이드/.test(text)) return 'stride';
  if (/라이드 어시스트/.test(text)) return 'rideAssist';
  if (/라이드/.test(text)) return 'ride';
  if (/콜했습니다/.test(text)) return 'call';
  if (/VC 스킬| 스킬:/.test(text)) return 'skill';
  if (/멀리건|드로우/.test(text)) return 'draw';
  if (/공격했습니다/.test(text)) return 'attackDeclared';
  if (/턴 \d+을 시작/.test(text)) return 'turn';
  if (/페이즈/.test(text)) return 'phase';
  return '';
}

export function baVanguardFeedbackTransition(previousValue, currentValue) {
  if (!previousValue || !currentValue) return 'idle';
  const previous = asSnapshot(previousValue);
  const current = asSnapshot(currentValue);
  const logChanged = current.latestLog !== previous.latestLog || current.logCount > previous.logCount;

  if (current.winner && current.winner !== previous.winner) {
    if (DECK_OUT_LOG.test(current.latestLog)) {
      return current.winner === 'me' ? 'deckOutVictory' : 'deckOutDefeat';
    }
    return current.winner === 'me' ? 'victory' : 'defeat';
  }
  if (current.meDamage > previous.meDamage) return 'damageTaken';
  if (current.oppDamage > previous.oppDamage) return 'attackHit';

  if (current.battle && !previous.battle) {
    return current.battle.defenderSide === 'me' ? 'guardWindow' : 'attackDeclared';
  }
  if (current.battle && previous.battle) {
    if (current.battle.perfectGuard && !previous.battle.perfectGuard) return 'perfectGuard';
    if (
      current.battle.guardShield > previous.battle.guardShield
      || current.battle.guardCards > previous.battle.guardCards
    ) return 'guardAdded';
  }

  if (current.latestLog && logChanged) {
    const addedLogCount = Math.max(1, current.logCount - previous.logCount);
    const addedLogs = safeArray(current.recentLogs).slice(0, addedLogCount);
    if (addedLogs.some((row) => /라이드 어시스트/.test(row))) return 'rideAssist';
    const logTransition = transitionFromLog(current.latestLog);
    if (logTransition) return logTransition;
  }
  if (current.meHand > previous.meHand || current.oppHand > previous.oppHand) return 'draw';
  if (current.meDrop > previous.meDrop || current.oppDrop > previous.oppDrop) return 'retired';
  if (current.turn !== previous.turn || current.active !== previous.active) return 'turn';
  if (current.phase !== previous.phase) return 'phase';
  return 'idle';
}

function profileFor(key) {
  return { key, ...(FEEDBACK_PROFILES[key] || FEEDBACK_PROFILES.idle) };
}

function signedValue(value) {
  const numeric = Number(value || 0);
  return `${numeric > 0 ? '+' : ''}${numeric.toLocaleString('ko-KR')}`;
}

function feedbackImpacts(previousValue, currentValue) {
  if (!previousValue || !currentValue) return [];
  const previous = asSnapshot(previousValue);
  const current = asSnapshot(currentValue);
  const guardDelta = Number(current.battle?.guardShield || 0) - Number(previous.battle?.guardShield || 0);
  const candidates = [
    { action: 'vanguard-damage', label: '내 데미지', value: current.meDamage - previous.meDamage, tone: 'danger' },
    { action: 'vanguard-hit', label: 'AI 데미지', value: current.oppDamage - previous.oppDamage, tone: 'success' },
    { action: 'vanguard-guard', label: '가드 실드', value: guardDelta, tone: 'success' },
    { action: 'vanguard-call', label: '내 필드', value: current.meField - previous.meField, tone: current.meField >= previous.meField ? 'success' : 'warning' },
    { action: 'target', label: 'AI 필드', value: current.oppField - previous.oppField, tone: current.oppField <= previous.oppField ? 'success' : 'warning' },
    { action: 'vanguard-ride', label: '내 소울', value: current.meSoul - previous.meSoul, tone: 'highlight' },
    { action: 'vanguard-draw', label: '내 패', value: current.meHand - previous.meHand, tone: current.meHand >= previous.meHand ? 'success' : 'warning' },
    { action: 'vanguard-draw', label: 'AI 패', value: current.oppHand - previous.oppHand, tone: current.oppHand <= previous.oppHand ? 'success' : 'warning' },
    { action: 'deck', label: '내 덱', value: current.meDeck - previous.meDeck, tone: 'warning' },
    { action: 'deck', label: 'AI 덱', value: current.oppDeck - previous.oppDeck, tone: 'highlight' },
    { action: 'vanguard-retire', label: '내 드롭', value: current.meDrop - previous.meDrop, tone: 'warning' },
    { action: 'vanguard-retire', label: 'AI 드롭', value: current.oppDrop - previous.oppDrop, tone: 'success' },
  ];
  return candidates
    .filter((item) => item.value !== 0)
    .slice(0, 4)
    .map((item) => ({ ...item, value: signedValue(item.value) }));
}

export function baVanguardResultPresentation(previousValue, currentValue) {
  const current = asSnapshot(currentValue);
  const key = baVanguardFeedbackTransition(previousValue, current);
  const profile = { ...profileFor(key), impacts: feedbackImpacts(previousValue, currentValue) };
  if (key === 'turn') {
    return { ...profile, detail: `${current.turn}턴 · ${SIDE_LABELS[current.active] || current.active} 차례가 시작됐습니다.` };
  }
  if (key === 'phase') {
    return { ...profile, detail: `${SIDE_LABELS[current.active] || current.active} ${PHASE_LABELS[current.phase] || current.phase} 페이즈입니다.` };
  }
  if (key === 'rideAssist') {
    const assistLog = safeArray(current.recentLogs).find((row) => /라이드 어시스트/.test(row));
    return { ...profile, detail: assistLog || current.latestLog || '라이드 어시스트로 다음 그레이드 유닛을 확보했습니다.' };
  }
  if (key === 'guardWindow') {
    return {
      ...profile,
      detail: `${current.battle.attackerCircle} 공격을 ${current.battle.defenderCircle}에서 방어합니다. 패와 G 가디언의 실드를 확인하세요.`,
    };
  }
  if (key === 'guardAdded' || key === 'perfectGuard') {
    return {
      ...profile,
      detail: `${current.battle?.guardCards || 0}장 가드 · 실드 ${(current.battle?.guardShield || 0).toLocaleString('ko-KR')}${current.battle?.perfectGuard ? ' · 완전 가드 적용' : ''}`,
    };
  }
  if (key === 'attackHit') {
    return { ...profile, detail: current.latestLog || `AI 데미지 ${current.oppDamage}/6` };
  }
  if (key === 'damageTaken') {
    return { ...profile, detail: current.latestLog || `내 데미지 ${current.meDamage}/6` };
  }
  if (key === 'victory' || key === 'deckOutVictory') {
    return { ...profile, detail: current.latestLog || `최종 데미지 ${current.meDamage}:${current.oppDamage}` };
  }
  if (key === 'defeat' || key === 'deckOutDefeat') {
    return { ...profile, detail: current.latestLog || `최종 데미지 ${current.meDamage}:${current.oppDamage}` };
  }
  return current.latestLog ? { ...profile, detail: current.latestLog } : profile;
}

export function baVanguardFeedbackCue(previousValue, currentValue) {
  if (!previousValue || !currentValue) return '';
  return baVanguardResultPresentation(previousValue, currentValue).cue || '';
}

export function baVanguardTextPresentation(text, fallback = profileFor('idle')) {
  const normalized = String(text || '');
  const matched = TEXT_PRESENTATIONS.find((row) => row.pattern.test(normalized));
  if (fallback?.key && fallback.key !== 'idle' && !matched?.force) return fallback;
  return matched ? { key: 'message', ...matched.value } : fallback;
}
