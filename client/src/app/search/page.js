'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import { useToast } from '../../components/ToastProvider';
import { apiGet } from '../../utils/api';

const EMPTY_RESULTS = {
  query: '',
  counts: { total: 0, posts: 0, rooms: 0, users: 0, characters: 0 },
  results: { posts: [], rooms: [], users: [], characters: [] },
};

const POST_CATEGORY_LABELS = {
  free: '자유',
  guide: '공략',
  feedback: '피드백',
  bug: '버그',
  simulation: '시뮬레이션',
  game: '게임',
};

const ROOM_CATEGORY_LABELS = {
  free: '자유',
  game: '게임',
  character: '캐릭터',
  item: '아이템',
};

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePayload(payload) {
  const src = payload && typeof payload === 'object' ? payload : {};
  const results = src.results && typeof src.results === 'object' ? src.results : {};
  const counts = src.counts && typeof src.counts === 'object' ? src.counts : {};
  return {
    query: String(src.query || '').trim(),
    counts: {
      ...EMPTY_RESULTS.counts,
      ...counts,
    },
    results: {
      posts: normalizeList(results.posts),
      rooms: normalizeList(results.rooms),
      users: normalizeList(results.users),
      characters: normalizeList(results.characters),
    },
  };
}

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
}

function userHref(user) {
  const id = user?._id || user?.id;
  return id ? `/users/${id}` : '';
}

function ResultPanel({ title, count, empty, children }) {
  return (
    <section className="search-panel">
      <div className="search-panel-title">
        <h2>{title}</h2>
        <span>{formatNumber(count)}</span>
      </div>
      {count > 0 ? children : <div className="search-empty">{empty}</div>}
    </section>
  );
}

export default function SearchPage() {
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [payload, setPayload] = useState(() => normalizePayload(null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runSearch = useCallback(async (rawQuery, options = {}) => {
    const nextQuery = String(rawQuery || '').trim();
    setError('');

    if (typeof window !== 'undefined' && options.updateUrl) {
      const url = nextQuery ? `/search?q=${encodeURIComponent(nextQuery)}` : '/search';
      window.history.replaceState(null, '', url);
    }

    if (!nextQuery) {
      setPayload(normalizePayload(null));
      return;
    }

    setLoading(true);
    try {
      const data = await apiGet(`/public/search?q=${encodeURIComponent(nextQuery)}`, { timeoutMs: 15000 });
      setPayload(normalizePayload(data));
    } catch (err) {
      const message = err?.message || '검색 결과를 불러오지 못했습니다.';
      setError(message);
      showToast({ tone: 'warning', message });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const initialQuery = String(params.get('q') || '').trim();
    if (!initialQuery) return;
    setQuery(initialQuery);
    void runSearch(initialQuery);
  }, [runSearch]);

  const handleSubmit = (event) => {
    event.preventDefault();
    void runSearch(query, { updateUrl: true });
  };

  const counts = payload.counts || EMPTY_RESULTS.counts;
  const results = payload.results || EMPTY_RESULTS.results;
  const submittedQuery = payload.query;
  const hasSubmittedQuery = Boolean(submittedQuery);
  const totalCount = Number(counts.total || 0);

  const summaryItems = useMemo(() => [
    { label: '전체', value: totalCount },
    { label: '게시글', value: counts.posts },
    { label: '스무고개', value: counts.rooms },
    { label: '유저', value: counts.users },
    { label: '캐릭터', value: counts.characters },
  ], [counts.characters, counts.posts, counts.rooms, counts.users, totalCount]);

  return (
    <main className="search-page-shell">
      <SiteHeader />
      <section className="search-page">
        <section className="search-hero">
          <div>
            <p className="search-kicker">Search</p>
            <h1>통합 검색</h1>
            <p>게시글, 공략, 스무고개 방, 유저, 캐릭터 기록을 한 번에 찾습니다.</p>
          </div>
          <form className="search-form" onSubmit={handleSubmit}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="검색어"
              aria-label="검색어"
              maxLength={80}
            />
            <button type="submit" disabled={loading}>{loading ? '검색 중' : '검색'}</button>
          </form>
        </section>

        <section className="search-summary" aria-label="검색 결과 요약">
          {summaryItems.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{formatNumber(item.value)}</strong>
            </div>
          ))}
        </section>

        {error ? (
          <div className="search-empty search-error">
            <p>{error}</p>
            <button type="button" onClick={() => void runSearch(query, { updateUrl: true })}>다시 검색</button>
          </div>
        ) : null}

        {!hasSubmittedQuery && !loading && !error ? (
          <div className="search-empty search-start">검색어를 입력하면 사이트 전체 결과가 섹션별로 표시됩니다.</div>
        ) : null}

        {loading ? <div className="search-empty">검색 결과를 불러오는 중입니다.</div> : null}

        {hasSubmittedQuery && !loading ? (
          <div className="search-content-grid">
            <ResultPanel title="게시글과 공략" count={results.posts.length} empty="일치하는 게시글이 없습니다.">
              <div className="search-result-list">
                {results.posts.map((post) => (
                  <Link href={`/board/${post._id}`} key={`post-${post._id || post.title}`}>
                    <span>{POST_CATEGORY_LABELS[post.category] || post.category || '글'}</span>
                    <strong>{safeText(post.title, '제목 없음')}</strong>
                    <p>{safeText(post.contentPreview, '미리보기가 없습니다.')}</p>
                    <small>
                      {safeText(post.authorName, '익명')} · 댓글 {formatNumber(post.commentCount)} · {formatDate(post.updatedAt || post.createdAt) || '날짜 없음'}
                    </small>
                  </Link>
                ))}
              </div>
            </ResultPanel>

            <ResultPanel title="스무고개" count={results.rooms.length} empty="일치하는 방이 없습니다.">
              <div className="search-result-list">
                {results.rooms.map((room) => (
                  <Link href={`/twenty-questions/${room._id}`} key={`room-${room._id || room.title}`}>
                    <span>{ROOM_CATEGORY_LABELS[room.category] || room.category || '방'}</span>
                    <strong>{safeText(room.title, '제목 없음')}</strong>
                    <p>{safeText(room.hint, '힌트 없음')}</p>
                    <small>
                      {safeText(room.hostName, '익명')} · 질문 {formatNumber(room.questionCount)} · 도전 {formatNumber(room.guessCount)}
                    </small>
                  </Link>
                ))}
              </div>
            </ResultPanel>

            <ResultPanel title="유저" count={results.users.length} empty="일치하는 유저가 없습니다.">
              <div className="search-compact-list">
                {results.users.map((user) => {
                  const href = userHref(user);
                  const body = (
                    <>
                      <strong>{safeText(user.displayName || user.nickname || user.username, '사용자')}</strong>
                      <small>{formatNumber(user.lp)} LP</small>
                    </>
                  );
                  return href ? <Link href={href} key={`user-${user._id}`}>{body}</Link> : <div key={`user-${user.username}`}>{body}</div>;
                })}
              </div>
            </ResultPanel>

            <ResultPanel title="캐릭터 기록" count={results.characters.length} empty="일치하는 캐릭터 기록이 없습니다.">
              <div className="search-compact-list">
                {results.characters.map((character) => {
                  const ownerLink = userHref(character.owner);
                  const body = (
                    <>
                      <strong>{safeText(character.name, '캐릭터')}</strong>
                      <small>
                        {safeText(character.weaponType, '무기 없음')} · {formatNumber(character.totalWins)}승 · {formatNumber(character.totalKills)}킬
                      </small>
                    </>
                  );
                  return ownerLink
                    ? <Link href={ownerLink} key={`character-${character._id || character.name}`}>{body}</Link>
                    : <div key={`character-${character._id || character.name}`}>{body}</div>;
                })}
              </div>
            </ResultPanel>
          </div>
        ) : null}
      </section>
    </main>
  );
}
