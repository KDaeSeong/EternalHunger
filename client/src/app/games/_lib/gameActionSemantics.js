const ACTION_RULES = [
  { kind: 'reset', cue: 'warning', terms: ['초기화', '삭제', '제거', '퇴각', '임차 종료', 'discard', 'delete', 'reset', 'retire'] },
  { kind: 'save', cue: 'save', terms: ['저장', 'save'] },
  { kind: 'load', cue: 'load', terms: ['불러오기', '복원', 'reload', 'load', 'restore'] },
  { kind: 'download', cue: 'archive', terms: ['다운로드', '내보내기', 'export', 'download'] },
  { kind: 'sync', cue: 'save', terms: ['동기화', 'sync'] },
  { kind: 'new', cue: 'start', terms: ['새 게임', '새 매치', '새 운영', '새 작전', '새 당직', '새 학교', '새 현장', '새 검수', '새 듀얼', '새 런', '재시작', 'new game', 'new match', 'new run'] },
  { kind: 'close', cue: 'click', terms: ['닫기', '취소', 'close', 'cancel'] },
  { kind: 'pass', cue: 'pass', terms: ['응답 없음', '넘기기', '가드 종료', 'pass', 'skip'] },
  { kind: 'chain', cue: 'chain', terms: ['체인', '연계 해결', 'chain'] },
  { kind: 'shuffle', cue: 'shuffle', terms: ['멀리건', '셔플', 'mulligan', 'shuffle'] },
  { kind: 'ride', cue: 'ride', terms: ['라이드', '스트라이드', 'ride', 'stride'] },
  { kind: 'guard', cue: 'guard', terms: ['가드', '가디언', 'guard', 'guardian'] },
  { kind: 'skill', cue: 'skill', terms: ['필드 효과', '몬스터 효과', '스킬', '발동', 'skill', 'effect'] },
  { kind: 'summon', cue: 'summon', terms: ['소환', '콜', 'summon', 'call'] },
  { kind: 'zone', cue: 'select', terms: ['묘지', '제외', '드롭', '소울', 'g존', 'zone'] },
  { kind: 'replay', cue: 'archive', terms: ['리플레이', 'replay'] },
  { kind: 'gather', cue: 'gather', terms: ['채집', '채광', '수확', 'gather', 'mine'] },
  { kind: 'combat', cue: 'combat', terms: ['사냥', '전투', '공격', '듀얼', '교전', 'battle', 'attack', 'duel', 'hunt'] },
  { kind: 'fuel', cue: 'craft', terms: ['연료 넣기', '불 피우기', 'fuel'] },
  { kind: 'craft', cue: 'craft', terms: ['제작', '생산', '조리', '요리', '굽기', '레시피', 'craft', 'production', 'cook'] },
  { kind: 'consume', cue: 'consume', terms: ['식사', '배식', '먹기', '회복', '치료', 'feed', 'heal'] },
  { kind: 'rest', cue: 'rest', terms: ['휴식', '재정비', '숙영', 'rest'] },
  { kind: 'research', cue: 'research', terms: ['연구', '문서', '힌트', '분석', 'research', 'docs', 'hint'] },
  { kind: 'judge', cue: 'judge', terms: ['심사', '판정', '검수', '감사', 'audit', 'judge'] },
  { kind: 'trophy', cue: 'confirm', terms: ['대회', '출전', '컵', '리그', '랭킹', '시즌 우승', 'tournament', 'league', 'ranking'] },
  { kind: 'upgrade', cue: 'upgrade', terms: ['강화', '재련', '개량', '업그레이드', '성장', '투자', 'upgrade', 'enhance'] },
  { kind: 'trade', cue: 'trade', terms: ['구매', '판매', '매입', '시장', '거래', '상점', '협상', '채권', 'purchase', 'buy', 'sell', 'market', 'trade'] },
  { kind: 'training', cue: 'training', terms: ['훈련', '당직', '수업', '상담', 'training', 'duty', 'class'] },
  { kind: 'recruit', cue: 'confirm', terms: ['모집', '영입', '입학', '합류', 'recruit', 'admission'] },
  { kind: 'advance', cue: 'advance', terms: ['다음 경기', '전체 진행', '끝까지 진행', '다음 시즌', '다음 주', '다음 날', '다음 영업일', '턴 종료', '페이즈', '자동 운영', '정산', '진행', 'advance', 'next turn', 'next week'] },
  { kind: 'execute', cue: 'confirm', terms: ['실행', '발동', '적용', 'execute'] },
  { kind: 'dispatch', cue: 'dispatch', terms: ['운행', '배차', '열차', '시간표', '철도', 'dispatch', 'train', 'schedule'] },
  { kind: 'code', cue: 'code', terms: ['코드', '과제', '제출', '빌드', '터미널', 'code', 'task', 'submit', 'build'] },
  { kind: 'target', cue: 'select', terms: ['대상', '조준', '선택', 'target', 'select'] },
  { kind: 'defend', cue: 'toggle', terms: ['방어', '보호', '엄폐', 'defend', 'shield', 'cover'] },
  { kind: 'calendar', cue: 'select', terms: ['캘린더', '일정', 'calendar'] },
  { kind: 'map', cue: 'nav', terms: ['미니맵', '지도', '트랙', '경로', 'map', 'route', 'track'] },
  { kind: 'inventory', cue: 'select', terms: ['인벤토리', '장비', '보유', '보상', '로컬팩', '데이터팩', 'inventory', 'gear', 'pack'] },
  { kind: 'cards', cue: 'select', terms: ['카드', '덱', '핸드', '패 로그', '존 검사', 'card', 'deck', 'hand', 'zone'] },
  { kind: 'school', cue: 'select', terms: ['학교', '교사', '시설', '동아리', 'school', 'facility', 'club'] },
  { kind: 'kitchen', cue: 'select', terms: ['주방', '메뉴', '영업', '주문', 'kitchen', 'menu', 'order'] },
  { kind: 'finance', cue: 'trade', terms: ['경제', '경영', '결산', 'vat', '글로벌', '자본', '원장', '재무', 'finance', 'capital', 'ledger'] },
  { kind: 'archive', cue: 'archive', terms: ['기록', '로그', '리포트', '보고서', '이력', '아카이브', '결과', 'archive', 'record', 'report', 'history', 'log'] },
  { kind: 'event', cue: 'event', terms: ['이벤트', '사건', '연출', '특별전', 'event'] },
  { kind: 'survival', cue: 'select', terms: ['생존', '캠프', '숙소', 'survival', 'camp'] },
  { kind: 'guide', cue: 'select', terms: ['튜토리얼', '도움말', '가이드', 'tutorial', 'guide'] },
  { kind: 'analysis', cue: 'select', terms: ['진단', '비교', '매트릭스', '병목', '밸런스', 'advisor', 'analysis', 'matrix'] },
  { kind: 'tactics', cue: 'select', terms: ['작전', '전술', '임무', '보드', '블록', '캠페인', '팀 운영', 'mission', 'tactics', 'board', 'campaign'] },
  { kind: 'settings', cue: 'toggle', terms: ['상세', '설정', '관리', '플랜', 'settings', 'advanced'] },
  { kind: 'search', cue: 'select', terms: ['검색', '검사', 'search', 'inspect'] },
];

function normalizeActionText(values) {
  return values
    .flat(Infinity)
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value).toLowerCase())
    .join(' ')
    .replace(/[\s·/|:_-]+/g, ' ')
    .trim();
}

export function inferGameActionSemantic(...values) {
  const normalized = normalizeActionText(values);
  if (!normalized) return { kind: 'action', cue: 'click' };
  const found = ACTION_RULES.find((rule) => rule.terms.some((term) => normalized.includes(term)));
  return found ? { kind: found.kind, cue: found.cue } : { kind: 'action', cue: 'click' };
}
