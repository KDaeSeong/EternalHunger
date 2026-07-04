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
    boardHref: '/board?category=simulation',
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
    guideHref: '/board?category=game',
    guideLabel: '게임 게시판',
    metrics: ['rooms', 'activeRooms', 'solvedRooms'],
    statusItems: [
      '방 생성 후 정답은 방장과 종료된 방에서만 공개됩니다.',
      '질문과 정답 도전이 모두 제한 횟수를 소모합니다.',
      '힌트 채팅은 방장만 남길 수 있습니다.',
    ],
  },
];

export function findGameBySlug(slug) {
  const key = String(slug || '').trim();
  return GAME_CATALOG.find((game) => game.slug === key) || null;
}

export function gameDetailHref(game) {
  return `/games/${game.slug}`;
}
