'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import { useToast } from '../../components/ToastProvider';
import { apiGetCached } from '../../utils/api';

const EMPTY_HUB = {
  counts: { users: 0, posts: 0, characters: 0, rooms: 0, activeRooms: 0 },
  recentPosts: [],
  activeRooms: [],
  rankings: { points: [], characters: [] },
};

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeHub(payload) {
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

function GameMetric({ label, value }) {
  return (
    <div className="games-metric">
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
    </div>
  );
}

function GameCard({ tone, title, subtitle, body, metrics, links, visual }) {
  return (
    <article className={`games-card is-${tone} ${visual ? 'has-visual' : ''}`}>
      {visual ? <div className="games-card-visual" aria-hidden="true" /> : null}
      <div className="games-card-main">
        <div>
          <span>{subtitle}</span>
          <h2>{title}</h2>
          <p>{body}</p>
        </div>
        <div className="games-card-metrics">
          {metrics.map((metric) => (
            <GameMetric key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </div>
        <div className="games-card-actions">
          {links.map((link) => (
            <Link href={link.href} key={`${link.href}-${link.label}`}>{link.label}</Link>
          ))}
        </div>
      </div>
    </article>
  );
}

function ActivityList({ title, href, items, empty, renderItem }) {
  return (
    <section className="games-panel">
      <div className="games-panel-title">
        <h2>{title}</h2>
        <Link href={href}>전체 보기</Link>
      </div>
      {items.length ? (
        <div className="games-activity-list">
          {items.map(renderItem)}
        </div>
      ) : (
        <div className="games-empty">{empty}</div>
      )}
    </section>
  );
}

export default function GamesPage() {
  const { showToast } = useToast();
  const [hub, setHub] = useState(EMPTY_HUB);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHub = useCallback(async (options = {}) => {
    setLoading(true);
    setError('');
    try {
      const payload = await apiGetCached('/public/home-hub', {
        ttlMs: 30000,
        timeoutMs: 15000,
        storage: 'session',
        force: Boolean(options.force),
      });
      setHub(normalizeHub(payload));
    } catch (err) {
      const message = err?.message || '게임 허브 정보를 불러오지 못했습니다.';
      setHub(EMPTY_HUB);
      setError(message);
      showToast({ tone: 'warning', message });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadHub();
  }, [loadHub]);

  const gamePosts = useMemo(() => {
    const rows = hub.recentPosts.filter((post) => ['game', 'simulation', 'guide'].includes(String(post?.category || '')));
    return (rows.length ? rows : hub.recentPosts).slice(0, 6);
  }, [hub.recentPosts]);

  const topCharacter = hub.rankings.characters[0] || null;
  const topUser = hub.rankings.points[0] || null;

  const games = [
    {
      tone: 'battle',
      title: 'Eternal Hunger',
      subtitle: 'Battle Simulation',
      body: '캐릭터, 장비, 전술 스킬, 금지구역 흐름을 한 경기 안에서 굴리는 메인 게임입니다.',
      visual: true,
      metrics: [
        { label: '캐릭터', value: hub.counts.characters },
        { label: '게시글', value: hub.counts.posts },
        { label: '최고 LP', value: topUser?.lp || 0 },
      ],
      links: [
        { href: '/simulation', label: '게임 시작' },
        { href: '/records', label: '기록소' },
        { href: '/leaderboard', label: '랭킹' },
      ],
    },
    {
      tone: 'twenty',
      title: '스무고개',
      subtitle: 'Community Game',
      body: '방장이 정답과 힌트를 잡고, 참가자가 질문과 정답 도전으로 맞히는 커뮤니티 게임입니다.',
      metrics: [
        { label: '전체 방', value: hub.counts.rooms },
        { label: '진행 중', value: hub.counts.activeRooms },
        { label: '표시 방', value: hub.activeRooms.length },
      ],
      links: [
        { href: '/twenty-questions', label: '방 목록' },
        { href: '/twenty-questions?status=active', label: '진행 중' },
        { href: '/twenty-questions?create=1', label: '방 만들기' },
      ],
    },
    {
      tone: 'community',
      title: '게임 게시판',
      subtitle: 'Community Board',
      body: '게임 이야기, 공략, 버그 제보, 피드백을 모아 다음 플레이 흐름으로 이어가는 공간입니다.',
      metrics: [
        { label: '게시글', value: hub.counts.posts },
        { label: '회원', value: hub.counts.users },
        { label: '최근 글', value: gamePosts.length },
      ],
      links: [
        { href: '/board?category=game', label: '게임 글' },
        { href: '/guides', label: '가이드' },
        { href: '/search', label: '검색' },
      ],
    },
  ];

  return (
    <main className="games-page-shell">
      <SiteHeader />
      <section className="games-page">
        <section className="games-hero">
          <div>
            <p className="games-kicker">Games</p>
            <h1>게임 허브</h1>
            <p>플레이, 커뮤니티 게임, 게시판 활동, 기록 흐름을 한 화면에서 확인합니다.</p>
          </div>
          <div className="games-hero-actions">
            <button type="button" onClick={() => void loadHub({ force: true })} disabled={loading}>
              {loading ? '갱신 중...' : '새로고침'}
            </button>
            <Link href="/simulation">바로 시작</Link>
          </div>
        </section>

        <section className="games-summary" aria-label="게임 허브 요약">
          <GameMetric label="회원" value={hub.counts.users} />
          <GameMetric label="캐릭터" value={hub.counts.characters} />
          <GameMetric label="게시글" value={hub.counts.posts} />
          <GameMetric label="진행 방" value={hub.counts.activeRooms} />
        </section>

        {error ? (
          <div className="games-empty games-error">
            <span>{error}</span>
            <button type="button" onClick={() => void loadHub({ force: true })}>다시 불러오기</button>
          </div>
        ) : null}

        <section className="games-grid" aria-label="게임 목록">
          {games.map((game) => (
            <GameCard key={game.title} {...game} />
          ))}
        </section>

        <section className="games-dashboard">
          <ActivityList
            title="진행 중인 스무고개"
            href="/twenty-questions"
            items={hub.activeRooms.slice(0, 6)}
            empty="진행 중인 방이 없습니다."
            renderItem={(room) => {
              const attemptCount = Number(room?.attemptCount != null ? room.attemptCount : Number(room?.questionCount || 0) + Number(room?.guessCount || 0));
              return (
                <Link href={`/twenty-questions/${room._id}`} key={`room-${room._id || room.title}`}>
                  <strong>{safeText(room.title, '제목 없음')}</strong>
                  <span>{safeText(room.hostName, '익명')} · {formatNumber(attemptCount)}/{formatNumber(room.maxQuestions || 20)} · {safeText(room.categoryLabel, room.category || '자유')}</span>
                </Link>
              );
            }}
          />

          <ActivityList
            title="최근 게임 글"
            href="/board?category=game"
            items={gamePosts}
            empty="표시할 게임 글이 없습니다."
            renderItem={(post) => (
              <Link href={`/board/${post._id}`} key={`post-${post._id || post.title}`}>
                <strong>{safeText(post.title, '제목 없음')}</strong>
                <span>{safeText(post.authorName, '익명')} · 조회 {formatNumber(post.viewCount)} · 추천 {formatNumber(post.reactionCount)} · {formatDate(post.createdAt || post.updatedAt) || '-'}</span>
              </Link>
            )}
          />

          <section className="games-panel">
            <div className="games-panel-title">
              <h2>상위 기록</h2>
              <Link href="/leaderboard">랭킹</Link>
            </div>
            <div className="games-rank-split">
              <div>
                <span>LP 1위</span>
                {topUser ? (
                  userHref(topUser)
                    ? <Link href={userHref(topUser)}>{safeText(topUser.displayName || topUser.nickname || topUser.username, '사용자')}</Link>
                    : <strong>{safeText(topUser.displayName || topUser.nickname || topUser.username, '사용자')}</strong>
                ) : <strong>기록 없음</strong>}
                <small>{formatNumber(topUser?.lp)} LP</small>
              </div>
              <div>
                <span>캐릭터 1위</span>
                <strong>{safeText(topCharacter?.name, '기록 없음')}</strong>
                <small>{formatNumber(topCharacter?.totalWins)}승 · {formatNumber(topCharacter?.totalKills)}킬</small>
              </div>
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}
