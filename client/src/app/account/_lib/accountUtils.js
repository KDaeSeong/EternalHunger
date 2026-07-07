export const EMPTY_ACTIVITY = {
  user: null,
  summary: {},
  recentPosts: [],
  recentComments: [],
  recentRooms: [],
  topCharacters: [],
  topTeams: [],
  social: { followers: [], following: [] },
};

export const CATEGORY_LABELS = {
  free: '자유',
  guide: '공략',
  feedback: '피드백',
  bug: '버그',
  simulation: '시뮬레이션',
  game: '게임',
};

export const ROOM_STATUS_LABELS = {
  active: '진행 중',
  solved: '정답 공개',
  closed: '종료',
};

export function cleanNickname(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

export function getDisplayName(user) {
  return cleanNickname(user?.displayName) || cleanNickname(user?.nickname) || cleanNickname(user?.username) || '사용자';
}

export function getUserId(user) {
  return user?._id || user?.id || user?.userId || '';
}

export function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeActivity(payload) {
  const src = payload && typeof payload === 'object' ? payload : {};
  return {
    user: src.user && typeof src.user === 'object' ? src.user : null,
    summary: src.summary && typeof src.summary === 'object' ? src.summary : {},
    recentPosts: normalizeList(src.recentPosts),
    recentComments: normalizeList(src.recentComments),
    recentRooms: normalizeList(src.recentRooms),
    topCharacters: normalizeList(src.topCharacters),
    topTeams: normalizeList(src.topTeams),
    social: {
      followers: normalizeList(src.social?.followers),
      following: normalizeList(src.social?.following),
    },
  };
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

export function formatRoomAttemptMeta(room) {
  const questionCount = Number(room?.questionCount || 0);
  const guessCount = Number(room?.guessCount || 0);
  const attemptCount = Number(room?.attemptCount != null ? room.attemptCount : questionCount + guessCount);
  return `사용 ${formatNumber(attemptCount)}/${formatNumber(room?.maxQuestions || 20)} · 질문 ${formatNumber(questionCount)} · 시도 ${formatNumber(guessCount)}`;
}

export function formatRate(value) {
  return `${Math.round(Number(value || 0) * 1000) / 10}%`;
}

export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
}
