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
};

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
    stage: 'prototype',
    stageLabel: '프로토타입',
    adapter: 'shared-game-room',
    roomSystem: 'game-room',
    supportsRooms: true,
    supportsStateSync: true,
    supportsRecords: true,
    supportsSaves: true,
    resultMode: 'room-record',
    minPlayers: 1,
    maxPlayers: 2,
  },
  'primitive-archive': {
    stage: 'planned',
    stageLabel: '이식 대기',
    adapter: 'survival-loop',
    supportsRecords: true,
    supportsSaves: true,
    resultMode: 'survival-score',
    maxPlayers: 4,
  },
  'tonkatsu-teacher': {
    stage: 'planned',
    stageLabel: '이식 대기',
    adapter: 'management-loop',
    supportsRecords: true,
    supportsSaves: true,
    resultMode: 'ledger-score',
  },
  'schale-idle-rpg': {
    stage: 'planned',
    stageLabel: '장기 설계',
    adapter: 'idle-rpg',
    supportsRecords: true,
    supportsSaves: true,
    resultMode: 'account-progress',
  },
  'ba-srpg': {
    stage: 'planned',
    stageLabel: '장기 설계',
    adapter: 'tactical-grid',
    supportsRecords: true,
    supportsSaves: true,
    resultMode: 'mission-clear',
  },
  myanimecraft: {
    stage: 'planned',
    stageLabel: '분리 후보',
    adapter: 'league-sim',
    supportsRecords: true,
    supportsSaves: true,
    resultMode: 'league-standing',
  },
  'school-simulator': {
    stage: 'planned',
    stageLabel: '분리 후보',
    adapter: 'school-sim',
    supportsRecords: true,
    supportsSaves: true,
    resultMode: 'term-report',
  },
  'si-coding-sim': {
    stage: 'planned',
    stageLabel: '실험 후보',
    adapter: 'challenge-sim',
    supportsRecords: true,
    supportsSaves: true,
    resultMode: 'challenge-score',
  },
  'rail3d-sim': {
    stage: 'planned',
    stageLabel: '실험 후보',
    adapter: 'transport-sim',
    supportsRecords: true,
    supportsSaves: true,
    resultMode: 'route-score',
  },
  'company-report': {
    stage: 'planned',
    stageLabel: '후순위',
    adapter: 'business-ledger',
    supportsRecords: true,
    supportsSaves: true,
    resultMode: 'ledger-score',
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
    primaryHref: '/simulation',
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
    scope: '카드 DB, 덱 빌더, 듀얼 샌드박스',
    summary: '턴, 페이즈, 소환, 세트, 전투, 체인 데모가 이미 있어 두 번째 실제 플레이 게임으로 붙이기 좋습니다.',
    nextStep: '카드 데이터와 룰 엔진을 Next 화면으로 옮기고, 덱 저장을 계정 데이터와 연결합니다.',
  },
  {
    slug: 'ba-vanguard',
    title: 'BA Vanguard',
    subtitle: 'Deck Builder',
    priority: '1차 후보',
    scope: '카드 라이브러리, 덱 검사, 플레이테스트',
    summary: '덱 구성 규칙과 샌드박스 로그가 명확해서 TCG 계열을 확장할 때 같이 흡수하기 좋습니다.',
    nextStep: '듀얼 아카데미 TCG 이식 후 카드 허브나 별도 룰셋으로 분리합니다.',
  },
  {
    slug: 'primitive-archive',
    title: 'Primitive Archive',
    subtitle: 'Survival Sim',
    priority: '2차 이식',
    scope: '채집, 제작, 캠프, 파티 생존',
    summary: '원시 생존과 학생 파티 시뮬레이션이라 Eternal Hunger의 제작, 장비, 생존 루프와 궁합이 좋습니다.',
    nextStep: '로컬 저장 루프를 계정 저장 슬롯으로 바꾸고, 런 정산을 기록소와 연결합니다.',
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
    scope: '장비, 타워, 미션, 강화, 분해',
    summary: '장비 관리와 반복 성장 UI가 많이 쌓여 있어 장기 접속형 게임으로 키우기 좋습니다.',
    nextStep: '저장 구조와 자동 분해 룰을 서버 계정 데이터에 맞게 재설계합니다.',
  },
  {
    slug: 'ba-srpg',
    title: 'BA SRPG',
    subtitle: 'Tactical SRPG',
    priority: '장기 주력',
    scope: '그리드 전투, 미션, 상점, 성장',
    summary: '기획과 데이터가 가장 큰 후보입니다. 바로 전부 옮기기보다 1개 미션 playable slice가 현실적입니다.',
    nextStep: '전투 코어, 미션 데이터, 전투 HUD를 작은 독립 라우트로 검증합니다.',
  },
  {
    slug: 'myanimecraft',
    title: 'Starleague Sim',
    subtitle: 'League Sim',
    priority: '분리 후보',
    scope: '개인리그, 프로리그, 위너스리그',
    summary: '스포츠 리그 운영과 랭킹 흐름이 뚜렷해서 별도 시뮬레이션 카테고리로 좋습니다.',
    nextStep: '팀과 선수 데이터를 공용 기록소 모델과 맞출 수 있는지 먼저 확인합니다.',
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
    priority: '후순위',
    scope: '거래, 재무, 원장, 보고서',
    summary: '규모가 큰 별도 경영 시스템이라 현재 게임 허브와는 느슨하게 연결하는 편이 낫습니다.',
    nextStep: '독립 관리형 게임으로 남길지, 운영자 도구형 시뮬레이션으로 쓸지 먼저 결정합니다.',
  },
];

export function getGameIntegration(slugOrGame) {
  const slug = typeof slugOrGame === 'object' ? slugOrGame?.slug : slugOrGame;
  const key = String(slug || '').trim();
  return {
    ...GAME_INTEGRATION_DEFAULTS,
    ...(GAME_INTEGRATIONS[key] || {}),
  };
}

export function withGameIntegration(game) {
  if (!game) return null;
  return {
    ...game,
    integration: getGameIntegration(game.slug),
  };
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

export function findGameBySlug(slug) {
  const key = String(slug || '').trim();
  const liveGame = GAME_CATALOG.find((game) => game.slug === key);
  if (liveGame) return withGameIntegration(liveGame);

  const roadmapGame = GAME_ROADMAP.find((game) => game.slug === key);
  if (!roadmapGame) return null;
  const hasPrototype = key === 'dual-academy-tcg';

  return withGameIntegration({
    ...roadmapGame,
    tone: 'roadmap',
    detail: roadmapGame.summary || '',
    primaryHref: hasPrototype ? `/games/${key}/play` : `/board?category=game&gameSlug=${key}&write=1`,
    primaryLabel: hasPrototype ? '프로토타입 플레이' : '이식 논의',
    boardHref: `/board?category=game&gameSlug=${key}`,
    boardLabel: '게임 게시판',
    recordHref: `/games/records?gameSlug=${key}`,
    recordLabel: '전적',
    guideHref: '/guides',
    guideLabel: '가이드',
    visual: '',
    metrics: ['posts'],
    statusItems: [
      roadmapGame.scope ? `범위: ${roadmapGame.scope}` : '',
      roadmapGame.nextStep || '',
    ].filter(Boolean),
    isRoadmap: true,
  });
}

export function gameDetailHref(game) {
  return `/games/${game.slug}`;
}
