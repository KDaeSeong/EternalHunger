function listLength(value) {
  if (Array.isArray(value)) return value.length;
  if (value instanceof Set) return value.size;
  return 0;
}

function listSignature(value) {
  const rows = value instanceof Set ? Array.from(value) : Array.isArray(value) ? value : [];
  return rows
    .map((entry) => String(entry?._id || entry?.id || entry || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .join('|');
}

const MAJOR_EVENT_RULES = [
  {
    key: 'suddenDeath',
    pattern: /서든데스(?: 발동|: 6번째 밤 돌입| 교전 집결| 결판| 종료)/,
    action: 'sudden-death',
    cue: 'suddenDeath',
    label: '서든데스',
    tone: 'danger',
  },
  {
    key: 'riftBattle',
    pattern: /차원의 틈 (?:교전|패배 후 분산)/,
    action: 'rift-battle',
    cue: 'riftBattle',
    label: '차원의 틈 교전',
    tone: 'danger',
  },
  {
    key: 'riftOpen',
    pattern: /차원의 틈 (?:개방|진입|무혈 점거)/,
    action: 'rift-open',
    cue: 'riftOpen',
    label: '차원의 틈',
    tone: 'highlight',
  },
  {
    key: 'kioskRevive',
    pattern: /키오스크 부활/,
    action: 'kiosk-revive',
    cue: 'kioskRevive',
    label: '키오스크 부활',
    tone: 'success',
  },
  {
    key: 'teamWipeProtection',
    pattern: /스쿼드 전멸 방지/,
    action: 'team-wipe-protection',
    cue: 'teamWipeProtection',
    label: '스쿼드 생존 보호',
    tone: 'warning',
  },
  {
    key: 'combatKill',
    pattern: /☠️.*\(\+1킬/,
    action: 'combat-kill',
    cue: 'combatKill',
    label: '처치 확정',
    tone: 'danger',
  },
  {
    key: 'bossDefeat',
    pattern: /(?:변이체\((?:위클라인|오메가)\).*(?:격파|처치)|야생동물\(알파\).*사냥 성공)/,
    action: 'boss-defeat',
    cue: 'bossDefeat',
    label: '특수 개체 격파',
    tone: 'success',
  },
  {
    key: 'reviveEvent',
    pattern: /(?:5초 상호작용으로 .* 부활!|자동 부활!)/,
    action: 'revive',
    cue: '',
    label: '스쿼드 부활',
    tone: 'success',
  },
  {
    key: 'detonationDeath',
    pattern: /폭발 타이머가 0이 되어 사망했습니다/,
    action: 'detonation-death',
    cue: 'detonationDeath',
    label: '폭발 타이머 사망',
    tone: 'danger',
  },
  {
    key: 'eliminationEvent',
    pattern: /(?:사망했습니다|결정타로 .*마무리했습니다)/,
    action: 'elimination',
    cue: '',
    label: '탈락 발생',
    tone: 'danger',
  },
  {
    key: 'bossSpawn',
    pattern: /(?:(?:알파|오메가|위클라인) 출현|변이 .* 출현)/,
    action: 'boss-spawn',
    cue: 'bossSpawn',
    label: '특수 개체 출현',
    tone: 'warning',
  },
  {
    key: 'transcendSupply',
    pattern: /초월 (?:보급 )?(?:장비 선택 )?상자.*(?:도착|발견|오픈|선택)/,
    action: 'transcend-supply',
    cue: 'transcendSupply',
    label: '초월 보급',
    tone: 'highlight',
  },
  {
    key: 'rareSupply',
    pattern: /전설 보급 상자 도착/,
    action: 'rare-supply',
    cue: 'rareSupply',
    label: '전설 보급',
    tone: 'highlight',
  },
  {
    key: 'legendaryCrateOpen',
    pattern: /전설 (?:재료 )?상자(?:를)?.*(?:열어|추가드랍)/,
    action: 'legendary-crate-open',
    cue: 'legendaryCrateOpen',
    label: '전설 재료 확보',
    tone: 'highlight',
    autoSilent: true,
  },
  {
    key: 'objectiveCollected',
    pattern: /오브젝트 채집:/,
    action: 'objective-collected',
    cue: 'objectiveCollected',
    label: '핵심 오브젝트 채집',
    tone: 'success',
    autoSilent: true,
  },
  {
    key: 'routeComplete',
    pattern: /1일차 (?:낮 )?루트 파밍(?: 보정)? 완료/,
    action: 'route-complete',
    cue: 'routeComplete',
    label: '초반 루트 완성',
    tone: 'success',
    autoSilent: true,
  },
  {
    key: 'masteryLevel',
    pattern: /숙련도 Lv\.\d+ 달성/,
    action: 'mastery-level',
    cue: 'masteryLevel',
    label: '무기 숙련 상승',
    tone: 'highlight',
    autoSilent: true,
  },
  {
    key: 'tacticalUpgrade',
    pattern: /전술 강화 모듈 사용.*전술 스킬 레벨/,
    action: 'tactical-upgrade',
    cue: 'tacticalUpgrade',
    label: '전술 스킬 강화',
    tone: 'highlight',
    autoSilent: true,
  },
  {
    key: 'objectiveSpawn',
    pattern: /오브젝트 등장:.*(?:운석|생명의 나무)/,
    action: 'objective-spawn',
    cue: 'objectiveSpawn',
    label: '핵심 오브젝트',
    tone: 'highlight',
  },
  {
    key: 'specialCraft',
    pattern: /포스 코어 조합|(?:즉시|후반) 제작:.*(?:전설|초월)|VF→초월|(?:운석|생나|미스릴|포스코어)→전설/,
    action: 'special-craft',
    cue: 'specialCraft',
    label: '특수 장비 제작',
    tone: 'success',
    autoSilent: true,
  },
  {
    key: 'marketCraftFailure',
    pattern: /\[조합 실패\]/,
    action: 'market-craft-failure',
    cue: 'marketCraftFailure',
    label: '장비 조합 실패',
    tone: 'danger',
  },
  {
    key: 'kioskTradeFailure',
    pattern: /\[키오스크 실패\]/,
    action: 'kiosk-trade-failure',
    cue: 'kioskTradeFailure',
    label: '키오스크 거래 실패',
    tone: 'danger',
  },
  {
    key: 'droneDeliveryFailure',
    pattern: /\[드론 구매 실패\]/,
    action: 'drone-delivery-failure',
    cue: 'droneDeliveryFailure',
    label: '드론 호출 실패',
    tone: 'danger',
  },
  {
    key: 'perkUnlockFailure',
    pattern: /\[특전 구매 실패\]/,
    action: 'perk-unlock-failure',
    cue: 'perkUnlockFailure',
    label: '특전 해금 실패',
    tone: 'danger',
  },
  {
    key: 'marketTradeFailure',
    pattern: /\[거래 (?:오퍼|취소|수락) 실패\]/,
    action: 'market-trade-failure',
    cue: 'marketTradeFailure',
    label: '플레이어 거래 실패',
    tone: 'danger',
  },
  {
    key: 'marketFailure',
    pattern: /\[상점 처리 실패\]/,
    action: 'market-failure',
    cue: 'marketFailure',
    label: '상점 처리 실패',
    tone: 'danger',
  },
  {
    key: 'marketCraft',
    pattern: /\[조합\].*(?:완료|성공)/,
    action: 'market-craft',
    cue: 'marketCraft',
    label: '장비 조합',
    tone: 'success',
  },
  {
    key: 'kioskTrade',
    pattern: /\[키오스크\].*(?:완료|구매|판매|교환)/,
    action: 'kiosk-trade',
    cue: 'kioskTrade',
    label: '키오스크 거래',
    tone: 'success',
  },
  {
    key: 'droneDelivery',
    pattern: /\[드론\].*(?:완료|구매|호출|도착)/,
    action: 'drone-delivery',
    cue: 'droneDelivery',
    label: '드론 배송',
    tone: 'success',
  },
  {
    key: 'perkUnlock',
    pattern: /\[특전\].*(?:구매 완료|해금)/,
    action: 'perk-unlock',
    cue: 'perkUnlock',
    label: '특전 해금',
    tone: 'highlight',
  },
  {
    key: 'marketTrade',
    pattern: /\[거래\].*(?:오퍼 생성 완료|수락 완료)/,
    action: 'market-trade',
    cue: 'marketTrade',
    label: '플레이어 거래',
    tone: 'success',
  },
  {
    key: 'fogWarning',
    pattern: /퍼플 포그 경고!/,
    action: 'fog-warning',
    cue: 'fogWarning',
    label: '퍼플 포그 경고',
    tone: 'warning',
  },
  {
    key: 'fogSpread',
    pattern: /퍼플 포그 확산!/,
    action: 'fog-active',
    cue: 'fogSpread',
    label: '퍼플 포그 확산',
    tone: 'danger',
  },
  {
    key: 'fogClear',
    pattern: /퍼플 포그가 걷혔습니다/,
    action: 'fog-clear',
    cue: 'fogClear',
    label: '퍼플 포그 해제',
    tone: 'success',
  },
  {
    key: 'detonationGraceEnded',
    pattern: /유예 종료: 안전구역도 위험해졌습니다/,
    action: 'detonation-grace',
    cue: 'detonationGraceEnded',
    label: '전 구역 폭발 위험',
    tone: 'danger',
  },
  {
    key: 'cnotEscape',
    pattern: /CNOT 게이트 발동/,
    action: 'cnot-escape',
    cue: 'cnotEscape',
    label: 'CNOT 게이트 탈출',
    tone: 'highlight',
    autoSilent: true,
  },
  {
    key: 'portableSafeZone',
    pattern: /휴대용 안전지대 전개/,
    action: 'portable-safe-zone',
    cue: 'portableSafeZone',
    label: '휴대용 안전지대',
    tone: 'success',
    autoSilent: true,
  },
  {
    key: 'hyperloopJump',
    pattern: /하이퍼루프 이동/,
    action: 'hyperloop-jump',
    cue: 'hyperloopJump',
    label: '하이퍼루프 이동',
    tone: 'ready',
    autoSilent: true,
  },
];

function normalizeLogEntry(entry) {
  if (entry && typeof entry === 'object') {
    return {
      id: String(entry.id || '').trim(),
      text: String(entry.text || '').trim(),
      type: String(entry.type || 'system').trim(),
    };
  }
  return { id: '', text: String(entry || '').trim(), type: 'system' };
}

export function classifySimulationMajorEvent(entry) {
  const normalized = normalizeLogEntry(entry);
  if (!normalized.text) return null;
  const rule = MAJOR_EVENT_RULES.find((candidate) => candidate.pattern.test(normalized.text));
  if (!rule) return null;
  return {
    action: rule.action,
    autoSilent: rule.autoSilent === true,
    cue: rule.cue,
    key: rule.key,
    label: rule.label,
    signature: `${rule.key}:${normalized.id || `${normalized.type}:${normalized.text}`}`,
    text: normalized.text,
    tone: rule.tone,
  };
}

function latestMajorEvent(logs, predicate = () => true) {
  const rows = Array.isArray(logs) ? logs : [];
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const event = classifySimulationMajorEvent(rows[index]);
    if (event && predicate(event)) return event;
  }
  return null;
}

export function createSimulationFeedbackSnapshot({
  autoPlay,
  day,
  dead,
  forbiddenAddedNow,
  isGameOver,
  logs,
  phase,
  winner,
}) {
  return {
    autoPlay: Boolean(autoPlay),
    fatalEvent: latestMajorEvent(
      logs,
      (event) => event.key === 'combatKill' || event.key === 'detonationDeath',
    ),
    day: Math.max(0, Number(day || 0)),
    deadCount: listLength(dead),
    forbiddenSignature: listSignature(forbiddenAddedNow),
    gameOver: Boolean(isGameOver),
    hasWinner: Boolean(winner),
    majorEvent: latestMajorEvent(logs),
    phase: String(phase || ''),
    winnerName: String(winner?.name || '').trim(),
  };
}

function feedbackRow(key, values) {
  return { ...values, key, signature: `${key}:${values.signature || ''}` };
}

function majorEventChanged(previous, current) {
  const signature = String(current?.majorEvent?.signature || '');
  return Boolean(signature && signature !== String(previous?.majorEvent?.signature || ''));
}

function fatalEventChanged(previous, current) {
  const signature = String(current?.fatalEvent?.signature || '');
  return Boolean(signature && signature !== String(previous?.fatalEvent?.signature || ''));
}

function presentMajorEvent(event, autoPlay) {
  if (!event) return null;
  const { autoSilent, ...presentation } = event;
  return {
    ...presentation,
    cue: autoPlay && autoSilent ? '' : presentation.cue,
  };
}

export function getSimulationFeedbackPresentation(previous, current) {
  if (!previous || !current) return null;
  if (current.day === 0 && previous.day > 0) return null;

  if (!previous.gameOver && current.gameOver) {
    return feedbackRow(current.hasWinner ? 'victory' : 'defeat', {
      action: current.hasWinner ? 'victory' : 'defeat',
      cue: current.hasWinner ? 'victory' : 'defeat',
      label: current.hasWinner ? '우승 확정' : '전멸',
      signature: current.winnerName || current.day,
      text: current.hasWinner
        ? `${current.winnerName || '최후 생존자'}의 승리가 확정됐습니다.`
        : '생존자가 남지 않아 경기가 종료됐습니다.',
      tone: current.hasWinner ? 'success' : 'danger',
    });
  }

  if (
    current.deadCount > previous.deadCount
    && fatalEventChanged(previous, current)
  ) return presentMajorEvent(current.fatalEvent, current.autoPlay);

  if (current.deadCount > previous.deadCount) {
    const delta = current.deadCount - previous.deadCount;
    return feedbackRow('elimination', {
      action: 'elimination',
      cue: 'elimination',
      label: '탈락 발생',
      signature: current.deadCount,
      text: `${delta}명이 새로 탈락했습니다. 누적 탈락 ${current.deadCount}명.`,
      tone: 'danger',
    });
  }

  if (
    current.deadCount < previous.deadCount
    && majorEventChanged(previous, current)
    && current.majorEvent?.key === 'kioskRevive'
  ) return presentMajorEvent(current.majorEvent, current.autoPlay);

  if (current.deadCount < previous.deadCount) {
    const delta = previous.deadCount - current.deadCount;
    return feedbackRow('revive', {
      action: 'revive',
      cue: 'revive',
      label: '부활 완료',
      signature: current.deadCount,
      text: `${delta}명이 전장으로 복귀했습니다. 현재 탈락 ${current.deadCount}명.`,
      tone: 'success',
    });
  }

  if (
    current.forbiddenSignature
    && current.forbiddenSignature !== previous.forbiddenSignature
  ) {
    return feedbackRow('zoneLock', {
      action: 'zone-lock',
      cue: 'zoneLock',
      label: '금지구역 확대',
      signature: current.forbiddenSignature,
      text: '새 금지구역이 추가됐습니다. 생존자의 이동 경로를 확인하세요.',
      tone: 'warning',
    });
  }

  if (majorEventChanged(previous, current)) {
    return presentMajorEvent(current.majorEvent, current.autoPlay);
  }

  const phaseChanged = current.day !== previous.day || current.phase !== previous.phase;
  if (!current.autoPlay && current.day > 0 && phaseChanged) {
    const isDay = current.phase === 'morning';
    return feedbackRow(isDay ? 'phaseDay' : 'phaseNight', {
      action: isDay ? 'season' : 'rest',
      cue: isDay ? 'phaseDay' : 'phaseNight',
      label: isDay ? '낮 페이즈' : '밤 페이즈',
      signature: `${current.day}:${current.phase}`,
      text: `${current.day}일차 ${isDay ? '낮' : '밤'}이 시작됐습니다.`,
      tone: isDay ? 'ready' : 'warning',
    });
  }
  return null;
}

export function getSimulationFeedbackDisplay(current) {
  if (!current || current.day <= 0) return null;

  if (current.gameOver) {
    return feedbackRow(current.hasWinner ? 'victory' : 'defeat', {
      action: current.hasWinner ? 'victory' : 'defeat',
      cue: '',
      label: current.hasWinner ? '우승 확정' : '전멸',
      signature: current.winnerName || current.day,
      text: current.hasWinner
        ? `${current.winnerName || '최후 생존자'}의 승리가 확정됐습니다.`
        : '생존자가 남지 않아 경기가 종료됐습니다.',
      tone: current.hasWinner ? 'success' : 'danger',
    });
  }

  if (current.majorEvent) return presentMajorEvent(current.majorEvent, current.autoPlay);

  if (current.forbiddenSignature) {
    return feedbackRow('zoneLock', {
      action: 'zone-lock',
      cue: '',
      label: '금지구역 현황',
      signature: current.forbiddenSignature,
      text: '이번 페이즈에 추가된 금지구역과 생존자의 이동 경로를 확인하세요.',
      tone: 'warning',
    });
  }

  if (current.deadCount > 0) {
    return feedbackRow('eliminationStatus', {
      action: 'elimination',
      cue: '',
      label: '탈락 현황',
      signature: current.deadCount,
      text: `현재 누적 탈락 ${current.deadCount}명입니다.`,
      tone: 'danger',
    });
  }

  const isDay = current.phase === 'morning';
  return feedbackRow(isDay ? 'phaseDay' : 'phaseNight', {
    action: isDay ? 'season' : 'rest',
    cue: '',
    label: isDay ? '낮 페이즈' : '밤 페이즈',
    signature: `${current.day}:${current.phase}`,
    text: `${current.day}일차 ${isDay ? '낮' : '밤'} 진행 중입니다.`,
    tone: isDay ? 'ready' : 'warning',
  });
}

export function getSimulationFeedbackCue(previous, current) {
  return getSimulationFeedbackPresentation(previous, current)?.cue || '';
}
