'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import SiteHeader from '../../components/SiteHeader';
import { apiGetCached } from '../../utils/api';

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

function roomHref(room) {
  return room?.href || (room?.roomType === 'game-room' ? `/games/rooms/${room._id}` : `/twenty-questions/${room._id}`);
}

const ROOM_STATUS_LABELS = { open: '대기 중', playing: '진행 중', finished: '종료', closed: '종료' };

function roomSummary(room) {
  if (room?.roomType === 'game-room') {
    const status = ROOM_STATUS_LABELS[String(room?.status || 'open')] || '대기 중';
    return `게임방 · ${safeText(room.hostName, '익명')} · ${formatNumber(room.playerCount)}/${formatNumber(room.maxPlayers || 1)}명 · ${status}`;
  }
  const attemptCount = Number(room?.attemptCount != null ? room.attemptCount : Number(room?.questionCount || 0) + Number(room?.guessCount || 0));
  return `스무고개 · ${safeText(room.hostName, '익명')} · ${formatNumber(attemptCount)}/${formatNumber(room.maxQuestions || 20)}회 사용`;
}

const SECTIONS = [
  { key: 'posts', label: '게시글' },
  { key: 'rooms', label: '방' },
  { key: 'users', label: '유저' },
  { key: 'characters', label: '캐릭터' },
];

function ResultPanel({ id, title, count, children }) {
  return (
    <section className="ui-panel" aria-labelledby={id}>
      <div className="ui-panel__head">
        <h2 id={id}>{title} <span className="sr-count">{formatNumber(count)}</span></h2>
      </div>
      {children}
    </section>
  );
}

export default function SearchPage() {
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('all');
  const [payload, setPayload] = useState(() => normalizePayload(null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runSearch = useCallback(async (rawQuery, options = {}) => {
    const nextQuery = String(rawQuery || '').trim();
    setError('');
    setSection('all');

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
      const data = await apiGetCached(`/public/search?q=${encodeURIComponent(nextQuery)}`, {
        ttlMs: 15000,
        timeoutMs: 15000,
        storage: 'session',
      });
      setPayload(normalizePayload(data));
    } catch (err) {
      // 결과 자리에 오류를 보여 주므로 토스트는 띄우지 않습니다.
      setError(err?.message || '검색 결과를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const initialQuery = String(params.get('q') || '').trim();
    if (!initialQuery) {
      inputRef.current?.focus();
      return;
    }
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
  const sectionCounts = {
    posts: results.posts.length,
    rooms: results.rooms.length,
    users: results.users.length,
    characters: results.characters.length,
  };
  const totalCount = Number(counts.total || 0) || Object.values(sectionCounts).reduce((sum, value) => sum + value, 0);
  const visible = (key) => sectionCounts[key] > 0 && (section === 'all' || section === key);

  return (
    <main className="search-page-shell">
      <SiteHeader />
      <div className="ui-page sr">
        <PageHeader title="검색" description="게시글, 스무고개와 게임방, 유저, 캐릭터 기록을 한 번에 찾습니다." />

        <form className="sr-form" role="search" onSubmit={handleSubmit}>
          <Search size={20} aria-hidden="true" className="sr-form__icon" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="검색어를 입력하세요"
            aria-label="검색어"
            maxLength={80}
          />
          <button type="submit" className="ui-button ui-button--primary" disabled={loading}>{loading ? '찾는 중' : '검색'}</button>
        </form>

        {error ? (
          <div className="ui-notice ui-notice--danger" role="alert">
            <span>{error}</span>
            <button type="button" className="ui-button ui-button--quiet ui-button--small" onClick={() => void runSearch(query, { updateUrl: true })}>다시 검색</button>
          </div>
        ) : null}

        {loading ? <p className="ui-empty">검색 결과를 불러오는 중입니다.</p> : null}

        {hasSubmittedQuery && !loading && !error ? (
          totalCount === 0 ? (
            <div className="ui-empty sr-empty">
              <p><strong>‘{submittedQuery}’</strong>에 맞는 결과가 없습니다.</p>
              <p>철자를 확인하거나 더 짧은 단어로 찾아보세요.</p>
            </div>
          ) : (
            <>
              <div className="ui-tabs sr-filter" role="group" aria-label="결과 종류">
                <button type="button" aria-pressed={section === 'all'} onClick={() => setSection('all')}>
                  전체 <small>{formatNumber(totalCount)}</small>
                </button>
                {SECTIONS.map((item) => (
                  <button
                    type="button"
                    key={item.key}
                    aria-pressed={section === item.key}
                    onClick={() => setSection(item.key)}
                    disabled={sectionCounts[item.key] === 0}
                  >
                    {item.label} <small>{formatNumber(sectionCounts[item.key])}</small>
                  </button>
                ))}
              </div>

              <div className="sr-results">
                {visible('posts') ? (
                  <ResultPanel id="sr-posts" title="게시글" count={sectionCounts.posts}>
                    <ul className="ui-list">
                      {results.posts.map((post) => (
                        <li key={`post-${post._id || post.title}`}>
                          <Link href={`/board/${post._id}`} className="ui-list-row sr-row">
                            <span className="ui-list-row__main">
                              <strong>
                                <em className="ui-tag">{POST_CATEGORY_LABELS[post.category] || '글'}</em>
                                {safeText(post.title, '제목 없음')}
                              </strong>
                              {post.contentPreview ? <span className="sr-preview">{post.contentPreview}</span> : null}
                              <span>{safeText(post.authorName, '익명')} · {formatDate(post.updatedAt || post.createdAt) || '날짜 없음'} · 댓글 {formatNumber(post.commentCount)}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </ResultPanel>
                ) : null}

                {visible('rooms') ? (
                  <ResultPanel id="sr-rooms" title="방" count={sectionCounts.rooms}>
                    <ul className="ui-list">
                      {results.rooms.map((room) => (
                        <li key={`room-${room._id || room.title}`}>
                          <Link href={roomHref(room)} className="ui-list-row sr-row">
                            <span className="ui-list-row__main">
                              <strong>
                                {room.roomType !== 'game-room' && ROOM_CATEGORY_LABELS[room.category] ? <em className="ui-tag">{ROOM_CATEGORY_LABELS[room.category]}</em> : null}
                                {safeText(room.title, '제목 없음')}
                              </strong>
                              <span>{roomSummary(room)}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </ResultPanel>
                ) : null}

                {visible('users') ? (
                  <ResultPanel id="sr-users" title="유저" count={sectionCounts.users}>
                    <ul className="ui-list">
                      {results.users.map((user) => {
                        const href = userHref(user);
                        const body = (
                          <>
                            <span className="ui-list-row__main">
                              <strong>{safeText(user.displayName || user.nickname || user.username, '사용자')}</strong>
                            </span>
                            <span className="ui-list-row__value">{formatNumber(user.lp)} LP</span>
                          </>
                        );
                        return (
                          <li key={`user-${user._id || user.username}`}>
                            {href ? <Link href={href} className="ui-list-row">{body}</Link> : <div className="ui-list-row">{body}</div>}
                          </li>
                        );
                      })}
                    </ul>
                  </ResultPanel>
                ) : null}

                {visible('characters') ? (
                  <ResultPanel id="sr-characters" title="캐릭터" count={sectionCounts.characters}>
                    <ul className="ui-list">
                      {results.characters.map((character) => {
                        const ownerLink = userHref(character.owner);
                        const body = (
                          <>
                            <span className="ui-list-row__main">
                              <strong>{safeText(character.name, '캐릭터')}</strong>
                              <span>{[safeText(character.weaponType, ''), safeText(character.ownerName, '')].filter(Boolean).join(' · ') || '정보 없음'}</span>
                            </span>
                            <span className="ui-list-row__value">{formatNumber(character.totalWins)}승 {formatNumber(character.totalKills)}킬</span>
                          </>
                        );
                        return (
                          <li key={`character-${character._id || character.name}`}>
                            {ownerLink ? <Link href={ownerLink} className="ui-list-row">{body}</Link> : <div className="ui-list-row">{body}</div>}
                          </li>
                        );
                      })}
                    </ul>
                  </ResultPanel>
                ) : null}
              </div>
            </>
          )
        ) : null}
      </div>
    </main>
  );
}
