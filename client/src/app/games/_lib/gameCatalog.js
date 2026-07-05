export const GAME_INTEGRATION_DEFAULTS = {
  stage: 'planned',
  stageLabel: '기획',
  adapter: 'discussion',
  roomSystem: 'none',
  supportsRooms: false,
  supportsStateSync: false,
  supportsRecords: false,
  supportsSaves: false,
  minPlayers: 1,
  maxPlayers: 1,
  resultMode: 'manual',
  completionPct: null,
};

export const MYANIME_GAME_SLUGS = [
  'myanimecraft',
  'dual-academy-tcg',
  'ba-vanguard',
  'schale-idle-rpg',
  'school-simulator',
  'tonkatsu-teacher',
  'si-coding-sim',
  'rail3d-sim',
  'company-report',
  'racing-logos-demo',
  'primitive-archive',
];

export const SRPG_GAME_SLUGS = ['ba-srpg'];

export const GAME_ENTRY_ROUTES = {
  'eternal-hunger': '/eternalhunger',
  ...Object.fromEntries(MYANIME_GAME_SLUGS.map((slug) => [slug, `/myanime/${slug}/play`])),
  ...Object.fromEntries(SRPG_GAME_SLUGS.map((slug) => [slug, `/srpg/${slug}/play`])),
};

export const GAME_ROUTE_FAMILIES = {
  eternalhunger: {
    key: 'eternalhunger',
    label: '이터널 헝거',
    baseHref: '/eternalhunger',
    detailBaseHref: '/games',
    playBaseHref: '/eternalhunger',
    description: '메인 배틀 시뮬레이션과 전적 흐름',
  },
  myanime: {
    key: 'myanime',
    label: 'MyAnime',
    baseHref: '/myanime',
    detailBaseHref: '/myanime',
    playBaseHref: '/myanime',
    description: '업로드된 MyAnime 기반 프로토타입 모음',
  },
  srpg: {
    key: 'srpg',
    label: 'SRPG',
    baseHref: '/srpg',
    detailBaseHref: '/srpg',
    playBaseHref: '/srpg',
    description: '그리드 전투와 미션형 전술 게임',
  },
  community: {
    key: 'community',
    label: '커뮤니티 게임',
    baseHref: '/twenty-questions',
    detailBaseHref: '/games',
    playBaseHref: '/twenty-questions',
    description: '게시판과 방 기반 커뮤니티 게임',
  },
  games: {
    key: 'games',
    label: '게임 허브',
    baseHref: '/games',
    detailBaseHref: '/games',
    playBaseHref: '/games',
    description: '전체 게임 도감과 공용 기록',
  },
};

export function getGameRouteFamily(slugOrGame) {
  const slug = typeof slugOrGame === 'object' ? slugOrGame?.slug : slugOrGame;
  const key = String(slug || '').trim();
  if (key === 'eternal-hunger') return GAME_ROUTE_FAMILIES.eternalhunger;
  if (MYANIME_GAME_SLUGS.includes(key)) return GAME_ROUTE_FAMILIES.myanime;
  if (SRPG_GAME_SLUGS.includes(key)) return GAME_ROUTE_FAMILIES.srpg;
  if (key === 'twenty-questions') return GAME_ROUTE_FAMILIES.community;
  return GAME_ROUTE_FAMILIES.games;
}

export const GAME_ADAPTER_PRESETS = [
  {
    adapter: 'discussion',
    label: '논의/기획',
    roomSystem: 'none',
    resultMode: 'manual',
    supportsStateSync: false,
    supportsRecords: true,
    supportsSaves: true,
    description: '게시판과 문서로 기획을 정리하는 초기 후보입니다.',
  },
  {
    adapter: 'shared-game-room',
    label: '공용 게임방',
    roomSystem: 'game-room',
    resultMode: 'room-record',
    supportsStateSync: true,
    supportsRecords: true,
    supportsSaves: true,
    description: '공용 방, 상태 저장, 수동 결과 기록을 사용하는 이식 기본형입니다.',
  },
  {
    adapter: 'simulation',
    label: '시뮬레이션',
    roomSystem: 'none',
    resultMode: 'run-summary',
    supportsStateSync: false,
    supportsRecords: true,
    supportsSaves: false,
    description: '단독 시뮬레이션 실행 결과를 전적/요약으로 남기는 구조입니다.',
  },
  {
    adapter: 'twenty-questions',
    label: '스무고개 전용',
    roomSystem: 'twenty-questions',
    resultMode: 'host-judged',
    supportsStateSync: false,
    supportsRecords: true,
    supportsSaves: false,
    description: '방장 판정과 질문/정답 카운트를 사용하는 전용 방 구조입니다.',
  },
  {
    adapter: 'survival-loop',
    label: '생존 루프',
    roomSystem: 'game-room',
    resultMode: 'survival-score',
    supportsStateSync: true,
    supportsRecords: true,
    supportsSaves: true,
    description: '채집, 제작, 생존 상태를 방 상태로 누적하는 구조입니다.',
  },
  {
    adapter: 'management-loop',
    label: '경영 루프',
    roomSystem: 'game-room',
    resultMode: 'ledger-score',
    supportsStateSync: true,
    supportsRecords: true,
    supportsSaves: true,
    description: '자원, 매출, 일정 같은 장부형 진행 상태를 저장합니다.',
  },
  {
    adapter: 'idle-rpg',
    label: '방치 RPG',
    roomSystem: 'none',
    resultMode: 'account-progress',
    supportsStateSync: false,
    supportsRecords: true,
    supportsSaves: true,
    description: '계정 단위 성장과 반복 보상을 기록하는 구조입니다.',
  },
  {
    adapter: 'tactical-grid',
    label: '전술 그리드',
    roomSystem: 'game-room',
    resultMode: 'mission-clear',
    supportsStateSync: true,
    supportsRecords: true,
    supportsSaves: true,
    description: '턴, 좌표, 미션 클리어 상태를 방 상태로 저장합니다.',
  },
  {
    adapter: 'league-sim',
    label: '리그 시뮬레이션',
    roomSystem: 'none',
    resultMode: 'league-standing',
    supportsStateSync: false,
    supportsRecords: true,
    supportsSaves: true,
    description: '시즌, 순위표, 경기 결과를 누적하는 리그형 구조입니다.',
  },
  {
    adapter: 'school-sim',
    label: '학교 운영',
    roomSystem: 'none',
    resultMode: 'term-report',
    supportsStateSync: false,
    supportsRecords: true,
    supportsSaves: true,
    description: '주차/학기 단위 결과를 보고서처럼 남기는 구조입니다.',
  },
  {
    adapter: 'challenge-sim',
    label: '챌린지',
    roomSystem: 'none',
    resultMode: 'challenge-score',
    supportsStateSync: false,
    supportsRecords: true,
    supportsSaves: true,
    description: '문제 풀이, 점수, 제출 결과를 기록하는 구조입니다.',
  },
  {
    adapter: 'transport-sim',
    label: '운송 시뮬레이션',
    roomSystem: 'none',
    resultMode: 'route-score',
    supportsStateSync: false,
    supportsRecords: true,
    supportsSaves: true,
    description: '노선, 시간표, 수송 성과를 기록하는 구조입니다.',
  },
  {
    adapter: 'asset-lab',
    label: '에셋 검증',
    roomSystem: 'none',
    resultMode: 'asset-audit',
    supportsStateSync: false,
    supportsRecords: true,
    supportsSaves: true,
    description: '로고, 표시명, 공개 fallback 같은 게임 에셋 연결 상태를 검수합니다.',
  },
  {
    adapter: 'business-ledger',
    label: '사업 장부',
    roomSystem: 'none',
    resultMode: 'ledger-score',
    supportsStateSync: false,
    supportsRecords: true,
    supportsSaves: true,
    description: '거래와 재무 기록 중심의 장부형 구조입니다.',
  },
];

export function findGameAdapterPreset(adapter) {
  const key = String(adapter || '').trim();
  return GAME_ADAPTER_PRESETS.find((preset) => preset.adapter === key) || null;
}

const GAME_INTEGRATIONS = {
  'eternal-hunger': {
    stage: 'live',
    stageLabel: '운영',
    adapter: 'simulation',
    supportsRecords: true,
    resultMode: 'run-summary',
    maxPlayers: 15,
  },
  'twenty-questions': {
    stage: 'live',
    stageLabel: '운영',
    adapter: 'twenty-questions',
    roomSystem: 'twenty-questions',
    supportsRooms: true,
    resultMode: 'host-judged',
    minPlayers: 2,
    maxPlayers: 20,
  },
  'dual-academy-tcg': {
    stage: 'playable',
    stageLabel: '플레이 가능',
    adapter: 'shared-game-room',
    roomSystem: 'game-room',
    supportsRooms: true,
    supportsStateSync: true,
    supportsRecords: true,
    supportsSaves: true,
    resultMode: 'room-record',
    completionPct: 88,
    minPlayers: 1,
    maxPlayers: 2,
  },
  'ba-vanguard': {
    stage: 'playable',
    stageLabel: '플레이 가능',
    adapter: 'shared-game-room',
    roomSystem: 'game-room',
    supportsRooms: true,
    supportsStateSync: true,
    supportsRecords: true,
    supportsSaves: true,
    resultMode: 'deck-validation',
    completionPct: 89,
    minPlayers: 1,
    maxPlayers: 2,
  },
  'primitive-archive': {
    stage: 'playable',
    stageLabel: '플레이 가능',
    adapter: 'survival-loop',
    supportsRecords: true,
    supportsSaves: true,
    resultMode: 'survival-score',
    completionPct: 99,
    maxPlayers: 4,
  },
  'tonkatsu-teacher': {
    stage: 'prototype',
    stageLabel: '프로토타입',
    adapter: 'management-loop',
    supportsRecords: true,
    supportsSaves: true,
    resultMode: 'ledger-score',
  },
  'schale-idle-rpg': {
    stage: 'playable',
    stageLabel: '플레이 가능',
    adapter: 'idle-rpg',
    supportsRecords: true,
    supportsSaves: true,
    resultMode: 'account-progress',
    completionPct: 86,
  },
  'ba-srpg': {
    stage: 'playable',
    stageLabel: '플레이 가능',
    adapter: 'tactical-grid',
    supportsRecords: true,
    supportsSaves: true,
    resultMode: 'mission-clear',
    completionPct: 88,
  },
  myanimecraft: {
    stage: 'playable',
    stageLabel: '플레이 가능',
    adapter: 'league-sim',
    supportsRecords: true,
    supportsSaves: true,
    resultMode: 'league-standing',
    completionPct: 100,
  },
  'school-simulator': {
    stage: 'prototype',
    stageLabel: '프로토타입',
    adapter: 'school-sim',
    supportsRecords: true,
    supportsSaves: true,
    resultMode: 'term-report',
  },
  'si-coding-sim': {
    stage: 'prototype',
    stageLabel: '프로토타입',
    adapter: 'challenge-sim',
    supportsRecords: true,
    supportsSaves: true,
    resultMode: 'challenge-score',
  },
  'rail3d-sim': {
    stage: 'prototype',
    stageLabel: '프로토타입',
    adapter: 'transport-sim',
    supportsRecords: true,
    supportsSaves: true,
    resultMode: 'route-score',
  },
  'company-report': {
    stage: 'prototype',
    stageLabel: '프로토타입',
    adapter: 'business-ledger',
    supportsRecords: true,
    supportsSaves: true,
    resultMode: 'ledger-score',
  },
  'racing-logos-demo': {
    stage: 'prototype',
    stageLabel: '프로토타입',
    adapter: 'asset-lab',
    supportsRecords: true,
    supportsSaves: true,
    resultMode: 'asset-audit',
  },
};

export const GAME_CATALOG = [
  {
    slug: 'eternal-hunger',
    title: 'Eternal Hunger',
    subtitle: 'Battle Simulation',
    tone: 'battle',
    summary: '캐릭터, 장비, 전술 스킬, 금지구역 흐름을 한 경기 안에서 굴리는 메인 게임입니다.',
    detail: '시뮬레이션 플레이, 캐릭터 설정, 전적 저장, 랭킹 흐름이 직접 연결된 현재 사이트의 중심 게임입니다.',
    primaryHref: GAME_ENTRY_ROUTES['eternal-hunger'],
    primaryLabel: '게임 시작',
    boardHref: '/board?gameSlug=eternal-hunger',
    boardLabel: '시뮬레이션 글',
    recordHref: '/records',
    recordLabel: '기록소',
    guideHref: '/guides',
    guideLabel: '가이드',
    visual: 'map',
    metrics: ['characters', 'teams', 'runs'],
    statusItems: [
      '참가 캐릭터와 상세 설정을 직접 편집합니다.',
      '경기 종료 후 캐릭터별, 팀별 전적을 저장합니다.',
      'LP와 캐릭터 기록을 랭킹으로 비교합니다.',
    ],
  },
  {
    slug: 'twenty-questions',
    title: '스무고개',
    subtitle: 'Community Game',
    tone: 'twenty',
    summary: '방장이 정답과 힌트를 잡고, 참가자가 질문과 정답 도전으로 맞히는 커뮤니티 게임입니다.',
    detail: '질문과 정답 도전을 같은 횟수로 관리하고, 방장만 힌트를 남기는 가벼운 모임형 게임입니다.',
    primaryHref: '/twenty-questions?create=1',
    primaryLabel: '방 만들기',
    boardHref: '/twenty-questions?status=active',
    boardLabel: '진행 중인 방',
    recordHref: '/twenty-questions',
    recordLabel: '방 목록',
    guideHref: '/guides',
    guideLabel: '가이드',
    metrics: ['rooms', 'activeRooms', 'solvedRooms'],
    statusItems: [
      '방 생성 후 정답은 방장과 종료된 방에서만 공개됩니다.',
      '질문과 정답 도전이 모두 제한 횟수를 소모합니다.',
      '힌트 채팅은 방장만 남길 수 있습니다.',
    ],
  },
];

export const GAME_ROADMAP = [
  {
    slug: 'dual-academy-tcg',
    title: '듀얼 아카데미 TCG',
    subtitle: 'Card Battle',
    priority: '1차 이식',
    scope: '카드 DB, 덱 빌더, 듀얼 샌드박스, 방 저장, 전적, 자동 플레이 보조, 턴 어드바이저, 매치 리포트, 기능별 탭 UI',
    summary: '턴, 페이즈, 소환, 세트, 전투, 체인, 덱 저장, 게임방 상태 저장, 전적 기록, 보드/턴 판단/패/로그 탭, 매치 리포트까지 붙은 카드 배틀 playable slice입니다.',
    nextStep: '원본 v13 카드 효과를 더 넓게 이식하고, 리플레이 내보내기와 멀티 동시성 검증을 강화합니다.',
  },
  {
    slug: 'ba-vanguard',
    title: 'BA Vanguard',
    subtitle: 'Deck Builder',
    priority: '1차 후보',
    scope: '카드 라이브러리, 덱 검사, 플레이테스트, 라이브 전술 리포트, 매치업 자동 실험, 저장/전적, 게임방 상태 저장, 기능별 탭 UI',
    summary: '덱 구성 규칙, 라이드/콜/스트라이드/배틀 샌드박스, 간단 AI 진행, 전술 리포트, 매치업 자동 실험 리포트, 게임방 상태 저장이 붙은 카드 배틀 playable slice입니다.',
    nextStep: '카드 효과 범위, 리플레이 내보내기, 방 동시 편집 충돌 검증을 강화합니다.',
  },
  {
    slug: 'primitive-archive',
    title: 'Primitive Archive',
    subtitle: 'Survival Sim',
    priority: '1차 완료권',
    scope: '채집, 사냥, 제작, 캠프, 연구, 장비, 자동 운영, 런 정산, 런 리포트',
    summary: '원시 생존과 학생 파티 시뮬레이션을 사이트 플레이 화면으로 이식했고, 저장/전적/아카이브 목표/하루 자동 운영/위험 리포트까지 연결했습니다.',
    nextStep: '캐릭터 초상, 사운드, 장기 자동 승리 루트 같은 전용 연출과 밸런스만 더 다듬습니다.',
  },
  {
    slug: 'tonkatsu-teacher',
    title: '돈까스 사장 선생님',
    subtitle: 'Management Loop',
    priority: '2차 후보',
    scope: '주방, 영업, 배분, 전투, 대회',
    summary: '생산과 판매, 대회 점수 계산이 돌아가는 경영형 미니게임으로 차별화가 분명합니다.',
    nextStep: '게임 허브 안의 가벼운 싱글 플레이 미니게임으로 먼저 붙입니다.',
  },
  {
    slug: 'schale-idle-rpg',
    title: 'Schale Idle RPG',
    subtitle: 'Idle RPG',
    priority: '장기 성장형',
    scope: '방치 정산, 장비, 타워, 미션, 강화, 분해, 상점, 성장 리포트, 성장 로드맵, 저장/전적, 기능별 탭 UI',
    summary: '방치 정산과 반복 성장, 장비 프리셋, 자동 분해, 탑 상점, 성장 리포트, 오늘/주간/장기 로드맵까지 연결된 장기 성장형 playable slice입니다.',
    nextStep: '서버 계정 성장 데이터, 장기 밸런스, 원본 콘텐츠팩 기반 이벤트/시즌 확장을 강화합니다.',
  },
  {
    slug: 'ba-srpg',
    title: 'BA SRPG',
    subtitle: 'Tactical SRPG',
    priority: '장기 주력',
    scope: '그리드 전투, 캠페인 별 진행, Hard/VeryHard 미션, 작전 브리핑, 타운 경제, 제작/상점, 의뢰, 저장/전적, 기능별 탭 UI',
    summary: '격자 이동, AP, 사거리, 엄폐, 적 턴, 자동 전투, Hard/VeryHard 해금 미션, 작전 브리핑, 타운 경제까지 연결한 전술 SRPG playable slice입니다.',
    nextStep: '전투 HUD 연출, 적 AI 가중치, 장기 밸런스와 추가 챕터/적 패턴을 강화합니다.',
  },
  {
    slug: 'myanimecraft',
    title: 'Starleague Sim',
    subtitle: 'League Sim',
    priority: '1차 완료권',
    scope: '팀리그, 포스트시즌, 개인리그, 위너스리그, 팀 운영, 시장/장비, 경기 아카이브, 내부 메타 기반 빌드/해설, 시즌 메타 리포트, 시즌 결산 보드, 기능별 탭 UI',
    summary: '팀 리그와 포스트시즌을 한 시즌 단위로 진행하고, 정규리그/컵/팀 운영/시장/기록 탭에서 누적 경기 데이터가 빌드 선택·해설·시즌 메타 리포트와 시즌 결산 보드에 반영되는 리그 시뮬레이터입니다.',
    nextStep: '외부 경기 메타 데이터 연동, 장기 시즌 밸런스 튜닝, 리플레이 내보내기 같은 확장 작업만 남았습니다.',
  },
  {
    slug: 'school-simulator',
    title: '학교 운영 시뮬레이터',
    subtitle: 'School Sim',
    priority: '분리 후보',
    scope: '운영, 학생, 교사, 진로, 보고',
    summary: '운영 탭과 주간 정산 중심의 정적 프로토타입이라 포털형 시뮬레이션으로 묶기 좋습니다.',
    nextStep: '저장과 주간 정산을 모듈화한 뒤 학교 운영 게임으로 분리합니다.',
  },
  {
    slug: 'si-coding-sim',
    title: 'SI 코딩 시뮬레이터',
    subtitle: 'Coding Sim',
    priority: '실험 후보',
    scope: '과제, 판정, 힌트, 커리어',
    summary: '실제 코딩 과제처럼 다중 파일을 보고 고치는 구조라 커뮤니티 챌린지로 확장할 수 있습니다.',
    nextStep: '문제 데이터와 판정 규칙을 안전한 브라우저 샌드박스 기준으로 재검토합니다.',
  },
  {
    slug: 'rail3d-sim',
    title: 'Rail 3D Sim',
    subtitle: 'Transport Sim',
    priority: '실험 후보',
    scope: '블록, 예약, 시간표, 토큰',
    summary: '운영 코어가 분리되어 있어 시뮬레이터 실험실 성격으로 둘 수 있습니다.',
    nextStep: '3D 표현보다 먼저 디버그 미니맵과 시간표 루프를 웹에서 검증합니다.',
  },
  {
    slug: 'company-report',
    title: '회사 리포트 시뮬레이터',
    subtitle: 'Business Ledger',
    priority: '이식 진행',
    scope: '거래, 재무, 원장, 보고서',
    summary: '거래처 주문, 재고, 매출채권, 월말 결산, 원장 스냅샷 복원 흐름을 사이트용 경영 루프로 이식했습니다.',
    nextStep: '원본 Spring API의 보고서 북마크, 내보내기, 원장 diff와 물리 복원 상세 절차를 단계적으로 붙입니다.',
  },
  {
    slug: 'racing-logos-demo',
    title: 'Racing Logos Demo',
    subtitle: 'Asset Lab',
    priority: '이식 진행',
    scope: '트랙, 이벤트, 로고팩, 로컬팩, fallback',
    summary: '공개 가능한 core 트랙/이벤트 데이터와 개인용 local pack 우선 로고 규칙을 사이트용 에셋 검수 루프로 이식했습니다.',
    nextStep: '실제 레이스 캘린더, 실존 로고팩 배포 방식, 레이스 결과 모델을 별도 데이터 팩으로 분리합니다.',
  },
];

export function getGameIntegration(slugOrGame) {
  const slug = typeof slugOrGame === 'object' ? slugOrGame?.slug : slugOrGame;
  const key = String(slug || '').trim();
  const dynamicIntegration = typeof slugOrGame === 'object' && slugOrGame?.integration && typeof slugOrGame.integration === 'object'
    ? slugOrGame.integration
    : {};
  return {
    ...GAME_INTEGRATION_DEFAULTS,
    ...(GAME_INTEGRATIONS[key] || {}),
    ...dynamicIntegration,
  };
}

export function withGameIntegration(game) {
  if (!game) return null;
  return {
    ...game,
    integration: getGameIntegration(game),
  };
}

export function getGamePortingChecklist(gameOrSlug) {
  const game = typeof gameOrSlug === 'object' ? gameOrSlug : findGameBySlug(gameOrSlug);
  const integration = getGameIntegration(game);
  const primaryHref = String(game?.primaryHref || '');
  const hasPlayableRoute = Boolean(primaryHref && !primaryHref.startsWith('/board'));

  return [
    {
      key: 'catalog',
      label: '카탈로그',
      done: Boolean(game?.slug && game?.title),
      note: game?.slug ? game.slug : '게임 키 필요',
    },
    {
      key: 'board',
      label: '게시판',
      done: Boolean(game?.boardHref),
      note: game?.boardHref ? '게임별 글 연결' : '게시판 연결 필요',
    },
    {
      key: 'room',
      label: '게임방',
      done: Boolean(integration.supportsRooms),
      note: integration.roomSystem === 'game-room' ? '공용 게임방' : integration.roomSystem === 'twenty-questions' ? '전용 방' : '방 없음',
    },
    {
      key: 'sync',
      label: '상태 동기화',
      done: Boolean(integration.supportsStateSync),
      note: integration.supportsStateSync ? '방 상태와 플레이 동기화' : '수동/단독 진행',
    },
    {
      key: 'records',
      label: '전적',
      done: Boolean(integration.supportsRecords),
      note: integration.resultMode || 'manual',
    },
    {
      key: 'saves',
      label: '저장 슬롯',
      done: Boolean(integration.supportsSaves),
      note: integration.supportsSaves ? '계정 저장 지원' : '저장 미연결',
    },
    {
      key: 'play',
      label: '플레이 화면',
      done: hasPlayableRoute,
      note: hasPlayableRoute ? game.primaryLabel || primaryHref : '이식 논의 단계',
    },
  ];
}

export function getGamePortingProgress(gameOrSlug) {
  const items = getGamePortingChecklist(gameOrSlug);
  const total = items.length || 1;
  const done = items.filter((item) => item.done).length;
  const integration = getGameIntegration(gameOrSlug);
  const configuredPct = Number(integration.completionPct);
  const percent = Number.isFinite(configuredPct)
    ? Math.max(0, Math.min(100, Math.round(configuredPct)))
    : Math.round((done / total) * 100);
  return {
    done,
    total,
    ratio: done / total,
    label: `${done}/${total}`,
    percent,
    percentLabel: `${percent}%`,
  };
}

export function dynamicGameCandidateToGame(candidate) {
  if (!candidate || typeof candidate !== 'object') return null;
  const slug = String(candidate.slug || '').trim();
  if (!slug) return null;
  const adapter = candidate.adapter || 'discussion';
  const adapterPreset = findGameAdapterPreset(adapter);
  const roomSystem = candidate.roomSystem || adapterPreset?.roomSystem || 'none';
  const integration = {
    stage: candidate.stage || 'planned',
    stageLabel: candidate.stageLabel || '이식 후보',
    adapter,
    roomSystem,
    supportsRooms: Boolean(candidate.supportsRooms || roomSystem !== 'none'),
    supportsStateSync: Boolean(candidate.supportsStateSync),
    supportsRecords: candidate.supportsRecords !== false,
    supportsSaves: candidate.supportsSaves !== false,
    resultMode: candidate.resultMode || adapterPreset?.resultMode || 'manual',
  };
  return withGameIntegration({
    slug,
    title: candidate.title || slug,
    subtitle: candidate.subtitle || 'Candidate',
    priority: candidate.priority || '후보',
    scope: candidate.scope || '',
    summary: candidate.summary || candidate.nextStep || '관리자 후보 저장소에 등록된 게임입니다.',
    nextStep: candidate.nextStep || '',
    tone: 'roadmap',
    detail: candidate.summary || candidate.nextStep || '관리자 후보 저장소에 등록된 게임입니다.',
    primaryHref: `/board?category=game&gameSlug=${slug}&write=1`,
    primaryLabel: '이식 논의',
    boardHref: `/board?category=game&gameSlug=${slug}`,
    boardLabel: '게임 게시판',
    recordHref: `/games/records?gameSlug=${slug}`,
    recordLabel: '전적',
    guideHref: '/guides',
    guideLabel: '가이드',
    visual: '',
    metrics: ['posts', 'rooms', 'runs'],
    statusItems: [
      candidate.scope ? `범위: ${candidate.scope}` : '',
      candidate.nextStep || '',
    ].filter(Boolean),
    integration,
    isRoadmap: true,
    isDynamicCandidate: true,
  });
}

export function getAllGames() {
  return [...GAME_CATALOG, ...GAME_ROADMAP].map((game) => withGameIntegration(game));
}

export function getGameRoomOptions() {
  return getAllGames().filter((game) => game.integration.roomSystem === 'game-room');
}

export function gameRoomCreateHref(gameOrSlug) {
  const slug = typeof gameOrSlug === 'object' ? gameOrSlug?.slug : gameOrSlug;
  return `/games/rooms?gameSlug=${encodeURIComponent(String(slug || ''))}&create=1`;
}

export function gameBoardWriteHref(gameOrSlug) {
  const slug = typeof gameOrSlug === 'object' ? gameOrSlug?.slug : gameOrSlug;
  return `/board?category=game&gameSlug=${encodeURIComponent(String(slug || ''))}&write=1`;
}

export function findGameBySlug(slug) {
  const key = String(slug || '').trim();
  const liveGame = GAME_CATALOG.find((game) => game.slug === key);
  if (liveGame) return withGameIntegration(liveGame);

  const roadmapGame = GAME_ROADMAP.find((game) => game.slug === key);
  if (!roadmapGame) return null;
  const prototypeRoutes = new Set([...MYANIME_GAME_SLUGS, ...SRPG_GAME_SLUGS]);
  const playableAliases = GAME_ENTRY_ROUTES;
  const hasPrototype = prototypeRoutes.has(key);

  return withGameIntegration({
    ...roadmapGame,
    tone: 'roadmap',
    detail: roadmapGame.summary || '',
    primaryHref: hasPrototype ? playableAliases[key] || `/games/${key}/play` : `/board?category=game&gameSlug=${key}&write=1`,
    primaryLabel: hasPrototype ? '프로토타입 플레이' : '이식 논의',
    boardHref: `/board?category=game&gameSlug=${key}`,
    boardLabel: '게임 게시판',
    recordHref: `/games/records?gameSlug=${key}`,
    recordLabel: '전적',
    guideHref: '/guides',
    guideLabel: '가이드',
    visual: '',
    metrics: ['posts', 'rooms', 'runs'],
    statusItems: [
      roadmapGame.scope ? `범위: ${roadmapGame.scope}` : '',
      roadmapGame.nextStep || '',
    ].filter(Boolean),
    isRoadmap: true,
  });
}

export function gameDetailHref(game) {
  const slug = String(game?.slug || '').trim();
  if (MYANIME_GAME_SLUGS.includes(slug)) return `/myanime/${slug}`;
  if (SRPG_GAME_SLUGS.includes(slug)) return `/srpg/${slug}`;
  return `/games/${slug}`;
}
