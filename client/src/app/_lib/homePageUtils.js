export const MENU_ITEMS = [
  {
    href: '/games',
    tag: 'Hub',
    title: '게임 고르기',
    body: '이터널 헝거, MyAnime, SRPG를 게임별 주소에서 선택합니다.',
    emphasis: true,
  },
  {
    href: '/eternalhunger',
    tag: 'Battle',
    title: '이터널 헝거',
    body: '배틀 시뮬레이션, 캐릭터 설정, 기록소 흐름을 전용 게임으로 분리합니다.',
  },
  {
    href: '/myanime',
    tag: 'MyAnime',
    title: 'MyAnime 허브',
    body: '업로드된 MyAnime 계열 프로토타입을 한곳에서 골라 플레이합니다.',
  },
  {
    href: '/srpg',
    tag: 'SRPG',
    title: 'SRPG 허브',
    body: '그리드 전투와 미션형 게임을 별도 장르 허브에서 관리합니다.',
  },
  {
    href: '/achievements',
    tag: 'Season',
    title: '업적',
    body: '시즌 점수와 다음 목표를 확인합니다.',
  },
  {
    href: '/activity',
    tag: 'Feed',
    title: '활동 피드',
    body: '새 글, 댓글, 스무고개 진행 상황을 한 흐름으로 확인합니다.',
  },
  {
    href: '/characters',
    tag: 'Roster',
    title: '캐릭터 설정',
    body: '캐릭터, 무기, 초월 장비 세팅, 스킬 구성을 관리합니다.',
  },
  {
    href: '/search',
    tag: 'Search',
    title: '통합 검색',
    body: '게시글, 스무고개, 유저, 캐릭터 기록을 한 번에 찾습니다.',
  },
  {
    href: '/records',
    tag: 'Stats',
    title: '기록소',
    body: '캐릭터별, 팀별 전적과 승률을 확인합니다.',
  },
  {
    href: '/balance',
    tag: 'Balance',
    title: '밸런스 분석',
    body: '캐릭터, 팀, 행동 병목을 기록 기반으로 점검합니다.',
  },
  {
    href: '/leaderboard',
    tag: 'Rank',
    title: '리더보드',
    body: 'LP, 캐릭터, 팀 기준으로 사이트 전체 순위를 비교합니다.',
  },
  {
    href: '/board',
    tag: 'Board',
    title: '게시판',
    body: '공지, 공략, 피드백, 버그 제보를 모아봅니다.',
  },
  {
    href: '/bookmarks',
    tag: 'Save',
    title: '저장글',
    body: '다시 볼 게시글과 공략을 개인 목록에 모아둡니다.',
  },
  {
    href: '/twenty-questions',
    tag: '20Q',
    title: '스무고개',
    body: '방을 만들고 질문과 정답 시도로 같이 플레이합니다.',
  },
  {
    href: '/perks',
    tag: 'LP',
    title: '특전 상점',
    body: 'LP로 장기 성장용 특전을 구매합니다.',
  },
  {
    href: '/details',
    tag: 'Tune',
    title: '상세 설정',
    body: '스탯, 성장값, 캐릭터별 세부 값을 조정합니다.',
  },
  {
    href: '/guides',
    tag: 'Guide',
    title: '가이드 허브',
    body: '규칙, 공략 글, 시뮬레이션 토론을 한곳에서 확인합니다.',
  },
];

export const EMPTY_HUB = {
  counts: { users: 0, posts: 0, characters: 0, rooms: 0, activeRooms: 0 },
  notices: [],
  recentPosts: [],
  activeRooms: [],
  rankings: { points: [], characters: [] },
};

export const EMPTY_PROGRESS = {
  season: {
    name: '프리시즌',
    title: '기반 시즌',
    score: 0,
    maxScore: 0,
    completedCount: 0,
    totalCount: 0,
  },
  next: [],
  onboarding: {
    completedCount: 0,
    totalCount: 0,
    next: [],
  },
};

export function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

export function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

export function formatPercent(value) {
  const n = Number(value || 0);
  const safe = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
  return `${Math.round(safe * 100)}%`;
}

export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
}

export function normalizeHub(payload) {
  const src = payload && typeof payload === 'object' ? payload : {};
  const rankings = src.rankings && typeof src.rankings === 'object' ? src.rankings : {};
  return {
    counts: { ...EMPTY_HUB.counts, ...(src.counts || {}) },
    notices: normalizeList(src.notices),
    recentPosts: normalizeList(src.recentPosts),
    activeRooms: normalizeList(src.activeRooms),
    rankings: {
      points: normalizeList(rankings.points),
      characters: normalizeList(rankings.characters),
    },
  };
}

export function normalizeProgress(payload) {
  const src = payload && typeof payload === 'object' ? payload : {};
  const season = src.season && typeof src.season === 'object' ? src.season : {};
  return {
    season: { ...EMPTY_PROGRESS.season, ...season },
    next: normalizeList(src.next).slice(0, 3),
    onboarding: {
      ...EMPTY_PROGRESS.onboarding,
      ...(src.onboarding && typeof src.onboarding === 'object' ? src.onboarding : {}),
      next: normalizeList(src.onboarding?.next).slice(0, 3),
    },
  };
}

export function userHref(user) {
  const id = user?._id || user?.id;
  return id ? `/users/${id}` : '';
}

export function getWins(row) {
  return Number(row?.totalWins ?? row?.records?.totalWins ?? 0);
}

export function getKills(row) {
  return Number(row?.totalKills ?? row?.records?.totalKills ?? 0);
}

export function getAssists(row) {
  return Number(row?.totalAssists ?? row?.records?.totalAssists ?? 0);
}

export function getUserKey(user) {
  return String(user?._id || user?.id || user?.userId || user?.username || '').trim();
}
