import { dynamicGameCandidateToGame, findGameBySlug } from './gameCatalog';

export const EMPTY_HUB = {
  counts: { users: 0, posts: 0, characters: 0, rooms: 0, activeRooms: 0 },
  recentPosts: [],
  activeRooms: [],
  rankings: { points: [], characters: [] },
};

export function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeHub(payload) {
  const src = payload && typeof payload === 'object' ? payload : {};
  const rankings = src.rankings && typeof src.rankings === 'object' ? src.rankings : {};
  return {
    counts: { ...EMPTY_HUB.counts, ...(src.counts || {}) },
    recentPosts: normalizeList(src.recentPosts),
    activeRooms: normalizeList(src.activeRooms),
    rankings: {
      points: normalizeList(rankings.points),
      characters: normalizeList(rankings.characters),
    },
  };
}

export function normalizeDynamicGames(payload) {
  return normalizeList(payload?.candidates).map(dynamicGameCandidateToGame).filter(Boolean);
}

export function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
}

export function userHref(user) {
  const id = user?._id || user?.id;
  return id ? `/users/${id}` : '';
}

export function roomHref(room) {
  return room?.href || (room?.roomType === 'game-room' ? `/games/rooms/${room._id}` : `/twenty-questions/${room._id}`);
}

export function roomGameTitle(room, gameTitleBySlug = new Map()) {
  const slug = String(room?.gameSlug || '').trim();
  return gameTitleBySlug.get(slug) || findGameBySlug(slug)?.title || slug || '게임';
}

export function roomMeta(room, gameTitleBySlug) {
  if (room?.roomType === 'game-room') {
    return `${roomGameTitle(room, gameTitleBySlug)} · ${safeText(room.hostName, '익명')} · ${formatNumber(room.playerCount)}/${formatNumber(room.maxPlayers || 1)}명 · ${safeText(room.status, 'open')}`;
  }
  const attemptCount = Number(room?.attemptCount != null ? room.attemptCount : Number(room?.questionCount || 0) + Number(room?.guessCount || 0));
  return `스무고개 · ${safeText(room.hostName, '익명')} · ${formatNumber(attemptCount)}/${formatNumber(room.maxQuestions || 20)} · ${safeText(room.categoryLabel, room.category || '자유')}`;
}

export function metricValueForKey(key, hub, derived) {
  if (key === 'characters') return hub.counts.characters;
  if (key === 'posts') return hub.counts.posts;
  if (key === 'topLp') return derived.topUser?.lp || 0;
  if (key === 'rooms') return hub.counts.rooms;
  if (key === 'activeRooms') return hub.counts.activeRooms;
  if (key === 'visibleRooms') return hub.activeRooms.length;
  return 0;
}

export function metricLabelForKey(key) {
  if (key === 'characters') return '캐릭터';
  if (key === 'posts') return '게시글';
  if (key === 'topLp') return '최고 LP';
  if (key === 'rooms') return '전체 방';
  if (key === 'activeRooms') return '진행 중';
  if (key === 'visibleRooms') return '표시 방';
  return '지표';
}
