import { dynamicGameCandidateToGame } from './gameCatalog';

export const EMPTY_HUB = {
  counts: {
    users: 0,
    posts: 0,
    characters: 0,
    teams: 0,
    runs: 0,
    rooms: 0,
    activeRooms: 0,
    solvedRooms: 0,
    closedRooms: 0,
    visibleRooms: 0,
  },
  recentPosts: [],
  activeRooms: [],
  recentRooms: [],
  recentRuns: [],
  rankings: { points: [], characters: [], teams: [] },
};

export function normalizeRouteId(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw == null ? '' : String(raw);
}

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeHub(payload) {
  const src = payload && typeof payload === 'object' ? payload : {};
  const rankings = src.rankings && typeof src.rankings === 'object' ? src.rankings : {};
  return {
    counts: { ...EMPTY_HUB.counts, ...(src.counts || {}) },
    recentPosts: normalizeList(src.recentPosts),
    activeRooms: normalizeList(src.activeRooms),
    recentRooms: normalizeList(src.recentRooms),
    recentRuns: normalizeList(src.recentRuns),
    rankings: {
      points: normalizeList(rankings.points),
      characters: normalizeList(rankings.characters),
      teams: normalizeList(rankings.teams),
    },
  };
}

export function findDynamicGameCandidate(payload, slug) {
  const key = String(slug || '').trim();
  if (!key) return null;
  return normalizeList(payload?.candidates)
    .map(dynamicGameCandidateToGame)
    .find((game) => game?.slug === key) || null;
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

export function formatPercent(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return '0%';
  return `${Math.round(n * 100)}%`;
}

export function roomStatusLabel(value) {
  if (value === 'open') return '모집';
  if (value === 'playing') return '진행';
  if (value === 'finished') return '완료';
  if (value === 'solved') return '정답';
  if (value === 'closed') return '종료';
  return '진행';
}

export function roomHref(room) {
  return room?.href || (room?.roomType === 'game-room' ? `/games/rooms/${room._id}` : `/twenty-questions/${room._id}`);
}

export function roomMeta(room) {
  if (room?.roomType === 'game-room') {
    return `${roomStatusLabel(room.status)} · ${safeText(room.hostName, '익명')} · ${formatNumber(room.playerCount)}/${formatNumber(room.maxPlayers || 1)}명`;
  }
  const attemptCount = Number(room?.attemptCount != null ? room.attemptCount : Number(room?.questionCount || 0) + Number(room?.guessCount || 0));
  return `${roomStatusLabel(room.status)} · ${safeText(room.hostName, '익명')} · ${formatNumber(attemptCount)}/${formatNumber(room.maxQuestions || 20)}`;
}

export function runHref(run, fallback = '/records') {
  return run?.href || fallback;
}

export function runTitle(run) {
  return safeText(run?.winnerTeamName || run?.winnerName || run?.title, '결과');
}

export function runMeta(run) {
  if (run?.kind === 'room-result' || run?.recordCount != null) {
    return `${formatDate(run.playedAt) || '-'} · ${safeText(run.matchMode, '모드 없음')} · 기록 ${formatNumber(run.recordCount)}건`;
  }
  return `${formatDate(run?.playedAt) || '-'} · 킬 ${formatNumber(run?.totalKills)} · 부활 ${formatNumber(run?.totalRevives)} · 초월 ${formatNumber(run?.transCount)}`;
}

export function metricValueForKey(key, hub) {
  const topUser = hub.rankings.points[0] || null;
  if (key === 'characters') return hub.counts.characters;
  if (key === 'teams') return hub.counts.teams;
  if (key === 'runs') return hub.counts.runs;
  if (key === 'posts') return hub.counts.posts;
  if (key === 'topLp') return topUser?.lp || 0;
  if (key === 'rooms') return hub.counts.rooms;
  if (key === 'activeRooms') return hub.counts.activeRooms;
  if (key === 'solvedRooms') return hub.counts.solvedRooms;
  if (key === 'visibleRooms') return hub.counts.visibleRooms || hub.activeRooms.length;
  return 0;
}

export function metricLabelForKey(key) {
  if (key === 'characters') return '캐릭터';
  if (key === 'teams') return '팀 전적';
  if (key === 'runs') return '저장 경기';
  if (key === 'posts') return '게시글';
  if (key === 'topLp') return '최고 LP';
  if (key === 'rooms') return '전체 방';
  if (key === 'activeRooms') return '진행 중';
  if (key === 'solvedRooms') return '정답 방';
  if (key === 'visibleRooms') return '표시 방';
  return '지표';
}
