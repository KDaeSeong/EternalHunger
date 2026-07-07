import { GAME_CATALOG, GAME_ROADMAP } from '../../games/_lib/gameCatalog';

export const BOARD_CATEGORIES = [
  { value: 'free', label: '자유' },
  { value: 'guide', label: '공략' },
  { value: 'feedback', label: '피드백' },
  { value: 'bug', label: '버그' },
  { value: 'simulation', label: '시뮬레이션' },
  { value: 'game', label: '게임' },
];

export function normalizeGameSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function getGameOptions() {
  const seen = new Set();
  return [...GAME_CATALOG, ...GAME_ROADMAP].reduce((list, game) => {
    const value = normalizeGameSlug(game?.slug);
    if (!value || seen.has(value)) return list;
    seen.add(value);
    list.push({ value, label: safeText(game?.title, value) });
    return list;
  }, []);
}

export function gameLabelForSlug(options, slug) {
  const value = normalizeGameSlug(slug);
  if (!value) return '';
  return options.find((option) => option.value === value)?.label || value;
}

export function formatDate(value) {
  if (!value) return '날짜 없음';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '날짜 없음';
  return date.toLocaleString('ko-KR');
}

export function getUserId(user) {
  return user?._id || user?.id || user?.userId || '';
}

export function normalizeIdValue(value) {
  if (!value) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value?.$oid) return String(value.$oid);
  if (value?._id && value._id !== value) return normalizeIdValue(value._id);
  if (value?.id && value.id !== value) return normalizeIdValue(value.id);
  if (typeof value?.toString === 'function') return value.toString();
  return '';
}

export function userProfileHref(value) {
  const id = normalizeIdValue(value);
  return id ? `/users/${id}` : '';
}

export function normalizeRouteId(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw == null ? '' : String(raw);
}

export function safeText(value, fallback = '') {
  if (value == null) return fallback;
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value).trim();
    return text || fallback;
  }
  return fallback;
}

export function normalizeComment(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const authorId = row.authorId || row.userId || row.author?._id || row.author?.id || row.user?._id || row.user?.id || '';
  return {
    ...row,
    _normalizedId: normalizeIdValue(row._id || row.id),
    authorId,
    authorName: safeText(row.author?.nickname || row.user?.nickname || authorId?.nickname || row.authorName || row.username || row.author?.username || row.user?.username || authorId?.username, '익명'),
    content: safeText(row.content, ''),
    createdAt: row.createdAt || row.created_at || row.date || '',
    updatedAt: row.updatedAt || row.updated_at || '',
  };
}

export function normalizePost(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const authorId = row.authorId || row.userId || row.author?._id || row.author?.id || row.user?._id || row.user?.id || '';
  const comments = Array.isArray(row.comments) ? row.comments.map(normalizeComment).filter(Boolean) : [];
  return {
    ...row,
    title: safeText(row.title, '제목 없음'),
    content: safeText(row.content, ''),
    category: safeText(row.category, 'free'),
    categoryLabel: safeText(row.categoryLabel, '자유'),
    commentCount: Number(row.commentCount ?? comments.length ?? 0),
    reactionCount: Number(row.reactionCount || 0),
    viewCount: Number(row.viewCount || 0),
    isNotice: Boolean(row.isNotice),
    noticePinnedAt: row.noticePinnedAt || '',
    gameSlug: normalizeGameSlug(row.gameSlug),
    comments,
    createdAt: row.createdAt || row.created_at || row.date || '',
    updatedAt: row.updatedAt || row.updated_at || '',
    authorId,
    authorName: safeText(row.author?.nickname || row.user?.nickname || authorId?.nickname || row.authorName || row.username || row.author?.username || row.user?.username || authorId?.username, '익명'),
  };
}

export function unwrapPost(data) {
  const post = data?.post || data?.data || data;
  return normalizePost(post);
}
