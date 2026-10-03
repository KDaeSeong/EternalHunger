// Site information architecture (2026-10 UI pass).
// - The top bar holds only site-wide sections.
// - Eternal Hunger owns its own sub-menu, shown on its pages only.
// Keep this file free of React so scripts and tests can import it.

export const ETERNAL_HUNGER_HOME = '/games/eternal-hunger';

export const ETERNAL_HUNGER_LINKS = [
  { href: ETERNAL_HUNGER_HOME, label: '개요', exact: true },
  { href: '/eternalhunger', label: '플레이' },
  { href: '/characters', label: '캐릭터' },
  { href: '/details', label: '상세 설정' },
  { href: '/modifiers', label: '보정치' },
  { href: '/perks', label: '특전 상점' },
  { href: '/records', label: '기록소' },
  { href: '/balance', label: '밸런스 분석' },
];

export const COMMUNITY_LINKS = [
  { href: '/board', label: '게시판' },
  { href: '/twenty-questions', label: '스무고개' },
  { href: '/games/rooms', label: '게임방' },
  { href: '/activity', label: '활동 피드' },
  { href: '/guides', label: '가이드' },
];

export const GAME_LINKS = [
  { href: '/games', label: '게임 허브', exact: true },
  { href: '/hungergames', label: '헝거게임 시뮬레이터' },
  { href: '/myanime', label: 'MyAnime' },
  { href: '/srpg', label: 'SRPG' },
  { href: '/games/records', label: '게임 기록' },
  { href: '/games/saves', label: '저장 슬롯' },
];

export const ACCOUNT_LINKS = [
  { href: '/account', label: '내 계정' },
  { href: '/achievements', label: '업적' },
  { href: '/bookmarks', label: '저장한 글' },
  { href: '/reports', label: '내 신고' },
  { href: '/help', label: '도움말' },
];

function startsWithSegment(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isLinkActive(pathname, link) {
  const path = String(pathname || '/');
  if (link.exact || link.href === '/') return path === link.href;
  return startsWithSegment(path, link.href);
}

const ETERNAL_HUNGER_PATHS = ['/eternalhunger', '/simulation', ETERNAL_HUNGER_HOME, '/characters', '/details', '/modifiers', '/perks', '/records', '/balance'];

export function isEternalHungerPath(pathname) {
  const path = String(pathname || '/');
  return ETERNAL_HUNGER_PATHS.some((href) => startsWithSegment(path, href));
}

// The play screen fills the viewport, so it keeps only the top bar.
export function showsEternalHungerSubnav(pathname) {
  const path = String(pathname || '/');
  return isEternalHungerPath(path) && !startsWithSegment(path, '/eternalhunger') && !startsWithSegment(path, '/simulation');
}

export function isCommunityPath(pathname) {
  return COMMUNITY_LINKS.some((link) => isLinkActive(pathname, link));
}

export function isGamesPath(pathname) {
  const path = String(pathname || '/');
  if (isEternalHungerPath(path) || isCommunityPath(path)) return false;
  return startsWithSegment(path, '/games') || startsWithSegment(path, '/myanime')
    || startsWithSegment(path, '/srpg') || startsWithSegment(path, '/hungergames');
}

export const PRIMARY_SECTIONS = [
  { key: 'home', href: '/', label: '홈', isActive: (path) => path === '/' },
  { key: 'games', href: '/games', label: '게임', isActive: isGamesPath },
  { key: 'eternal-hunger', href: ETERNAL_HUNGER_HOME, label: '이터널 헝거', isActive: isEternalHungerPath },
  { key: 'community', label: '커뮤니티', links: COMMUNITY_LINKS, isActive: isCommunityPath },
  { key: 'ranking', href: '/leaderboard', label: '랭킹', isActive: (path) => startsWithSegment(String(path || '/'), '/leaderboard') },
];
