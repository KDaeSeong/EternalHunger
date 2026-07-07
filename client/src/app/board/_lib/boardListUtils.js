import { normalizePost as normalizeSharedPost, safeText } from './boardUtils';

export {
  BOARD_CATEGORIES,
  formatDate,
  gameLabelForSlug,
  getGameOptions,
  getUserId,
  normalizeGameSlug,
  normalizeIdValue,
  safeText,
  userProfileHref,
} from './boardUtils';

export const BOARD_SORTS = [
  { value: 'latest', label: '최신순' },
  { value: 'popular', label: '인기순' },
  { value: 'views', label: '조회순' },
  { value: 'comments', label: '댓글순' },
];

export const BOARD_PAGE_SIZE = 20;

export function normalizePostId(post) {
  const id = post?._id || post?.id;
  if (!id) return '';
  if (typeof id === 'string' || typeof id === 'number') return String(id);
  if (id?.$oid) return String(id.$oid);
  if (typeof id?.toString === 'function') return id.toString();
  return '';
}

function normalizeBoardListPost(row) {
  const post = normalizeSharedPost(row);
  if (!post) return null;
  return {
    ...post,
    _normalizedId: normalizePostId(row),
    content: safeText(row.content ?? row.contentPreview, ''),
    contentPreview: safeText(row.contentPreview ?? row.content, ''),
  };
}

export function unwrapPostList(data) {
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.posts)
      ? data.posts
      : Array.isArray(data?.data)
        ? data.data
        : [];
  return list.map(normalizeBoardListPost).filter(Boolean);
}

export function normalizePagination(raw, fallbackCount = 0, fallbackPage = 1) {
  const page = Math.max(1, Number(raw?.page || fallbackPage || 1));
  const limit = Math.max(1, Number(raw?.limit || BOARD_PAGE_SIZE));
  const total = Math.max(0, Number(raw?.total ?? fallbackCount ?? 0));
  const totalPages = Math.max(1, Number(raw?.totalPages || Math.ceil(total / limit) || 1));
  return {
    page,
    limit,
    total,
    totalPages,
    hasPrev: Boolean(raw?.hasPrev ?? page > 1),
    hasNext: Boolean(raw?.hasNext ?? page < totalPages),
  };
}

export function getUserDisplayName(user) {
  return safeText(user?.nickname, '') || safeText(user?.username, '사용자');
}
