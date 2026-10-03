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
