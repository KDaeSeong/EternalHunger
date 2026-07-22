function counter(state, key) {
  return Number(state?.counters?.[key] || 0);
}

export const TONKATSU_METHOD_CUES = {
  m_fry: 'fry',
  m_grill: 'grill',
  m_boil: 'boil',
  m_simmer: 'simmer',
  m_sauce: 'sauce',
  m_dessert: 'dessert',
};

const METHOD_LABELS = {
  m_fry: '튀김 조리 완료',
  m_grill: '구이 조리 완료',
  m_boil: '삶기 조리 완료',
  m_simmer: '조림 조리 완료',
  m_sauce: '소스 조리 완료',
  m_dessert: '디저트 조리 완료',
};

const FEEDBACK_PROFILES = {
  idle: { action: '', cue: '', label: '이번 운영 결과', tone: '' },
  newRun: { action: 'new', cue: 'start', label: '새 영업 시작', tone: 'highlight' },
  methodLevelUp: { action: 'upgrade', cue: 'methodLevelUp', label: '조리 숙련 상승', tone: 'success' },
  cookFail: { action: 'cook', cue: 'cookFail', label: '조리 실패', tone: 'danger' },
  cook: { action: 'cook', cue: 'cook', label: '메뉴 조리 완료', tone: 'success' },
  battleVictory: { action: 'victory', cue: 'victory', label: '전투 승리', tone: 'success' },
  battleDefeat: { action: 'combat', cue: 'defeat', label: '전투 패배', tone: 'danger' },
  tournamentWin: { action: 'trophy', cue: 'champion', label: '대회 우승', tone: 'champion' },
  tournamentLoss: { action: 'tournament', cue: 'defeat', label: '대회 참가 결과', tone: 'warning' },
  judgeCorrect: { action: 'verdict', cue: 'judgeCorrect', label: '심사 정답', tone: 'success' },
  judgeWrong: { action: 'verdict', cue: 'judgeWrong', label: '심사 오답', tone: 'warning' },
  judgeStart: { action: 'verdict', cue: 'verdict', label: '심사 매치 준비', tone: 'highlight' },
  judgeReset: { action: 'reset', cue: 'warning', label: '심사 기록 초기화', tone: 'warning' },
  orderComplete: { action: 'order', cue: 'orderComplete', label: '일일 주문 완료', tone: 'success' },
  serve: { action: 'serve', cue: 'serve', label: '학생 배식 완료', tone: 'success' },
  facilityUpgrade: { action: 'upgrade', cue: 'upgrade', label: '시설 업그레이드', tone: 'success' },
  research: { action: 'research', cue: 'research', label: '레시피 연구 완료', tone: 'success' },
  cosmeticBuy: { action: 'shop', cue: 'shop', label: '장식 구매', tone: 'success' },
  cosmeticEquip: { action: 'equip', cue: 'equip', label: '장식 장착', tone: 'highlight' },
  sale: { action: 'sales', cue: 'sales', label: '메뉴 판매', tone: 'success' },
  purchase: { action: 'trade', cue: 'trade', label: '재료 매입', tone: 'highlight' },
  businessMode: { action: 'tonkatsu-service', cue: 'businessMode', label: '영업 방식 변경', tone: 'highlight' },
  complete: { action: 'trophy', cue: 'complete', label: '14일 운영 완료', tone: 'champion' },
  nextDay: { action: 'advance', cue: 'advance', label: '다음 영업일', tone: 'highlight' },
  blocked: { action: 'warning', cue: 'warning', label: '실행 불가', tone: 'warning' },
};

const TEXT_PRESENTATIONS = [
  {
    pattern: /로그인|실패|부족|없습니다|필요|할 수 없습니다|찾을 수 없습니다|초과|먼저 구매|이미 (?:보유|장착|최대)|낼 수 없습니다|종료 상태/,
    force: true,
    value: { action: 'warning', label: '처리 안내', tone: 'warning' },
  },
  { pattern: /불러오|불러왔/, force: true, value: { action: 'load', label: '운영 불러오기', tone: 'success' } },
  { pattern: /저장/, force: true, value: { action: 'save', label: '운영 저장', tone: 'success' } },
  { pattern: /전적|운영 기록/, force: true, value: { action: 'archive', label: '운영 기록', tone: 'success' } },
  { pattern: /초기화/, force: true, value: { action: 'reset', label: '기록 초기화', tone: 'warning' } },
  { pattern: /새 운영/, value: { action: 'new', label: '새 영업 시작', tone: 'highlight' } },
];

function craftSerial(state) {
  return Number(state?.lastCraft?.serial || 0);
}

function equippedSignature(state) {
  return Object.entries(state?.equippedCosmetics || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slot, cosmeticId]) => `${slot}:${cosmeticId || ''}`)
    .join('|');
}

function judgeMatchSignature(state) {
  const match = state?.judgeMatch;
  if (!match) return '';
  return `${match.id || ''}:${match.tierId || ''}:${match.resolved ? 'resolved' : 'open'}`;
}

export function tonkatsuFeedbackSnapshot(state) {
  return {
    runId: String(state?.runId || ''),
    craftSerial: craftSerial(state),
    craftSuccess: Boolean(state?.lastCraft?.success),
    craftMethodId: String(state?.lastCraft?.primaryMethodId || ''),
    craftMasteryCount: Array.isArray(state?.lastCraft?.masteryRaised) ? state.lastCraft.masteryRaised.length : 0,
    purchases: counter(state, 'purchases'),
    sold: counter(state, 'sold'),
    supplied: counter(state, 'supplied'),
    battles: counter(state, 'battles'),
    victories: counter(state, 'victories'),
    facilityUpgrades: counter(state, 'facilityUpgrades'),
    researches: counter(state, 'researches'),
    tournaments: counter(state, 'tournaments'),
    tournamentWins: counter(state, 'tournamentWins'),
    orders: counter(state, 'orders'),
    judgeMatches: counter(state, 'judgeMatches'),
    judgeCorrect: counter(state, 'judgeCorrect'),
    cosmeticsBought: counter(state, 'cosmeticsBought'),
    judgeHistoryCount: Array.isArray(state?.judgeHistory) ? state.judgeHistory.length : 0,
    judgeMatchSignature: judgeMatchSignature(state),
    judgeMatchOpen: Boolean(state?.judgeMatch && !state.judgeMatch.resolved),
    equippedSignature: equippedSignature(state),
    businessMode: String(state?.businessMode || 'hall'),
    day: Number(state?.day || 0),
    ended: Boolean(state?.ended),
    latestLog: String(state?.log?.[0] || ''),
  };
}

function asSnapshot(value) {
  return Object.prototype.hasOwnProperty.call(value || {}, 'craftSerial')
    ? value
    : tonkatsuFeedbackSnapshot(value);
}

export function tonkatsuFeedbackTransition(previousValue, currentValue) {
  if (!previousValue || !currentValue) return 'idle';
  const previous = asSnapshot(previousValue);
  const current = asSnapshot(currentValue);

  if (previous.runId !== current.runId) return 'newRun';
  if (current.craftSerial > previous.craftSerial) {
    if (current.craftMasteryCount > 0) return 'methodLevelUp';
    if (!current.craftSuccess) return 'cookFail';
    return 'cook';
  }
  if (current.battles > previous.battles) {
    return current.victories > previous.victories ? 'battleVictory' : 'battleDefeat';
  }
  if (current.tournaments > previous.tournaments) {
    return current.tournamentWins > previous.tournamentWins ? 'tournamentWin' : 'tournamentLoss';
  }
  if (current.judgeMatches > previous.judgeMatches) {
    const attempts = current.judgeMatches - previous.judgeMatches;
    const correct = current.judgeCorrect - previous.judgeCorrect;
    return correct / attempts >= 0.5 ? 'judgeCorrect' : 'judgeWrong';
  }
  if (current.judgeHistoryCount < previous.judgeHistoryCount) return 'judgeReset';
  if (
    current.judgeMatchOpen
    && current.judgeMatchSignature
    && current.judgeMatchSignature !== previous.judgeMatchSignature
  ) return 'judgeStart';
  if (current.orders > previous.orders) return 'orderComplete';
  if (current.supplied > previous.supplied) return 'serve';
  if (current.facilityUpgrades > previous.facilityUpgrades) return 'facilityUpgrade';
  if (current.researches > previous.researches) return 'research';
  if (current.cosmeticsBought > previous.cosmeticsBought) return 'cosmeticBuy';
  if (current.equippedSignature !== previous.equippedSignature) return 'cosmeticEquip';
  if (current.sold > previous.sold) return 'sale';
  if (current.purchases > previous.purchases) return 'purchase';
  if (current.businessMode !== previous.businessMode) return 'businessMode';
  if (!previous.ended && current.ended) return 'complete';
  if (current.day !== previous.day) return 'nextDay';
  if (
    current.latestLog
    && current.latestLog !== previous.latestLog
    && /실패|부족|없습니다|필요|할 수 없습니다|찾을 수 없습니다|초과|먼저 구매|이미 (?:보유|장착|최대)|낼 수 없습니다/.test(current.latestLog)
  ) return 'blocked';
  return 'idle';
}

export function tonkatsuResultCue(previous, next) {
  const presentation = tonkatsuResultPresentation(previous, next);
  if (presentation.key !== 'cook') return presentation.cue || '';
  const current = asSnapshot(next);
  return TONKATSU_METHOD_CUES[current.craftMethodId] || presentation.cue || 'cook';
}

export function tonkatsuResultPresentation(previousValue, currentValue) {
  const previous = asSnapshot(previousValue);
  const current = asSnapshot(currentValue);
  const key = tonkatsuFeedbackTransition(previous, current);
  const profile = { key, ...FEEDBACK_PROFILES[key] };

  if (key === 'cook') {
    return {
      ...profile,
      action: TONKATSU_METHOD_CUES[current.craftMethodId] || profile.action,
      cue: TONKATSU_METHOD_CUES[current.craftMethodId] || profile.cue,
      label: METHOD_LABELS[current.craftMethodId] || profile.label,
    };
  }
  if (key === 'purchase') return { ...profile, label: `재료 ${current.purchases - previous.purchases}개 매입` };
  if (key === 'sale') return { ...profile, label: `메뉴 ${current.sold - previous.sold}개 판매` };
  if (key === 'orderComplete') return { ...profile, label: `일일 주문 ${current.orders - previous.orders}건 완료` };
  if (key === 'serve') return { ...profile, label: `학생 배식 ${current.supplied - previous.supplied}회 완료` };
  if (key === 'nextDay') return { ...profile, label: `Day ${current.day} 영업 시작` };
  return profile;
}

export function tonkatsuTextPresentation(text, fallback = FEEDBACK_PROFILES.idle) {
  const normalized = String(text || '');
  const matched = TEXT_PRESENTATIONS.find((row) => row.pattern.test(normalized));
  if (fallback?.key && fallback.key !== 'idle' && !matched?.force) return fallback;
  return matched ? { key: 'message', cue: '', ...matched.value } : fallback;
}
