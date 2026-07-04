'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import { useToast } from '../../components/ToastProvider';
import { apiGetCached } from '../../utils/api';
import { useAuthToken, useHydrated } from '../../utils/client-auth';

const EMPTY_FEED = {
  counts: { total: 0, posts: 0, comments: 0, rooms: 0, solvedRooms: 0 },
  scope: { mode: 'all', followingCount: 0 },
  activity: [],
};

const SCOPE_FILTERS = [
  { value: 'all', label: '전체 활동' },
  { value: 'following', label: '팔로잉' },
];

const KIND_FILTERS = [
  { value: 'all', label: '전체' },
  { value: 'post', label: '게시글' },
  { value: 'comment', label: '댓글' },
  { value: 'room', label: '스무고개' },
];

const CATEGORY_LABELS = {
  free: '자유',
  guide: '공략',
  feedback: '피드백',
  bug: '버그',
  simulation: '시뮬레이션',
  game: '게임',
  character: '캐릭터',
  item: '아이템',
  country: '나라',
  place: '지명',
  person: '인물',
  food: '음식',
  organism: '생물',
  comic: '만화',
  movie: '영화',
  drama: '드라마',
  program: '프로그램',
};

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeCounts(value) {
  const src = value && typeof value === 'object' ? value : {};
  return {
    total: Number(src.total || 0),
    posts: Number(src.posts || 0),
    comments: Number(src.comments || 0),
    rooms: Number(src.rooms || 0),
    solvedRooms: Number(src.solvedRooms || 0),
  };
}

function normalizeFeed(payload) {
  const src = payload && typeof payload === 'object' ? payload : {};
  const scope = src.scope && typeof src.scope === 'object' ? src.scope : {};
  return {
    counts: normalizeCounts(src.counts),
    scope: {
      mode: safeText(scope.mode, 'all'),
      followingCount: Number(scope.followingCount || 0),
    },
    activity: normalizeList(src.activity),
  };
}

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function categoryLabel(value) {
  return CATEGORY_LABELS[value] || safeText(value, '기타');
}

function actorHref(actor) {
  const id = actor?._id || actor?.id;
  return id ? `/users/${id}` : '';
}

function statLine(row) {
  const stats = row?.stats && typeof row.stats === 'object' ? row.stats : {};
  if (row?.kind === 'room') {
    return `사용 ${formatNumber(stats.attempts)}회 · 질문 ${formatNumber(stats.questions)} · 정답 ${formatNumber(stats.guesses)} · 남음 ${formatNumber(stats.remaining)}`;
  }
  return `조회 ${formatNumber(stats.views)} · 추천 ${formatNumber(stats.reactions)} · 댓글 ${formatNumber(stats.comments)}`;
}

function matchesActivity(row, keyword) {
  if (!keyword) return true;
  const haystack = [
    row?.title,
    row?.label,
    row?.category,
    categoryLabel(row?.category),
    row?.actorName,
    row?.contentPreview,
  ].join(' ').toLowerCase();
  return haystack.includes(keyword);
}

function ActivityCard({ row }) {
  const href = safeText(row?.href, '#');
  const userHref = actorHref(row?.actor);
  const dateLabel = formatDateTime(row?.updatedAt || row?.createdAt);
  return (
    <article className={`activity-card is-${row?.kind || 'post'}`}>
      <div className="activity-card__head">
        <span className="activity-kind">{safeText(row?.label, '활동')}</span>
        <span>{categoryLabel(row?.category)}</span>
      </div>
      <h2>
        <Link href={href}>{safeText(row?.title, '제목 없음')}</Link>
      </h2>
      {row?.contentPreview ? <p>{row.contentPreview}</p> : null}
      <div className="activity-meta">
        {userHref ? (
          <Link href={userHref}>{safeText(row?.actorName, '익명')}</Link>
        ) : (
          <strong>{safeText(row?.actorName, '익명')}</strong>
        )}
        <span>{dateLabel || '날짜 없음'}</span>
        <span>{statLine(row)}</span>
      </div>
    </article>
  );
}

export default function ActivityPage() {
  const hydrated = useHydrated();
  const token = useAuthToken();
  const { showToast } = useToast();
  const [feed, setFeed] = useState(EMPTY_FEED);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');
  const [query, setQuery] = useState('');

  const loadFeed = useCallback(async (options = {}) => {
    if (scopeFilter === 'following' && !token) {
      setFeed({ ...EMPTY_FEED, scope: { mode: 'following', followingCount: 0 } });
      setError('');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload = await apiGetCached(`/public/activity?limit=60&scope=${encodeURIComponent(scopeFilter)}`, {
        ttlMs: 12000,
        timeoutMs: 15000,
        storage: 'session',
        force: Boolean(options.force),
      });
      setFeed(normalizeFeed(payload));
    } catch (err) {
      const message = err?.message || '활동 피드를 불러오지 못했습니다.';
      setFeed(EMPTY_FEED);
      setError(message);
      showToast({ tone: 'warning', message });
    } finally {
      setLoading(false);
    }
  }, [scopeFilter, showToast, token]);

  useEffect(() => {
    if (!hydrated) return;
    void loadFeed();
  }, [hydrated, loadFeed]);

  const filteredActivity = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return feed.activity.filter((row) => {
      const kindMatched = kindFilter === 'all' || row?.kind === kindFilter;
      return kindMatched && matchesActivity(row, keyword);
    });
  }, [feed.activity, kindFilter, query]);

  return (
    <main className="activity-page-shell">
      <SiteHeader />
      <section className="activity-page">
        <section className="activity-hero">
          <div>
            <p className="activity-kicker">Community Feed</p>
            <h1>활동 피드</h1>
            <p>게시글, 댓글, 스무고개 진행 상황을 시간순으로 모아 봅니다.</p>
          </div>
          <div className="activity-actions">
            <button type="button" onClick={() => void loadFeed({ force: true })} disabled={loading}>
              {loading ? '갱신 중...' : '새로고침'}
            </button>
            <Link href="/board?write=1">글쓰기</Link>
            <Link href="/twenty-questions?create=1">방 만들기</Link>
          </div>
        </section>

        <section className="activity-summary" aria-label="활동 요약">
          <div><span>전체</span><strong>{formatNumber(feed.counts.total)}</strong></div>
          <div><span>게시글</span><strong>{formatNumber(feed.counts.posts)}</strong></div>
          <div><span>댓글</span><strong>{formatNumber(feed.counts.comments)}</strong></div>
          <div><span>스무고개</span><strong>{formatNumber(feed.counts.rooms)}</strong></div>
        </section>

        <section className="activity-toolbar" aria-label="활동 필터">
          <div className="activity-filter-groups">
            <div className="activity-scope-tabs" aria-label="피드 범위">
              {SCOPE_FILTERS.map((item) => (
                <button
                  type="button"
                  className={scopeFilter === item.value ? 'is-active' : ''}
                  onClick={() => setScopeFilter(item.value)}
                  key={item.value}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="activity-tabs" aria-label="활동 종류">
              {KIND_FILTERS.map((item) => (
                <button
                  type="button"
                  className={kindFilter === item.value ? 'is-active' : ''}
                  onClick={() => setKindFilter(item.value)}
                  key={item.value}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="제목, 내용, 작성자 검색"
            aria-label="활동 검색"
          />
        </section>

        {error ? (
          <div className="activity-empty activity-error">
            <span>{error}</span>
            <button type="button" onClick={() => void loadFeed({ force: true })}>다시 불러오기</button>
          </div>
        ) : null}

        <section className="activity-list" aria-label="활동 목록">
          {filteredActivity.length ? (
            filteredActivity.map((row) => (
              <ActivityCard row={row} key={row?._id || `${row?.kind}-${row?.href}-${row?.updatedAt}`} />
            ))
          ) : (
            <div className="activity-empty">
              {loading
                ? '활동을 불러오는 중입니다.'
                : scopeFilter === 'following' && !token
                  ? '로그인하면 팔로우한 유저의 활동을 따로 볼 수 있습니다.'
                  : scopeFilter === 'following' && feed.scope.followingCount === 0
                    ? '아직 팔로우한 유저가 없습니다.'
                    : '표시할 활동이 없습니다.'}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
