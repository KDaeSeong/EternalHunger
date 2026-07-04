'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import { useToast } from '../../components/ToastProvider';
import { apiGetCached } from '../../utils/api';
import { GAME_CATALOG, GAME_ROADMAP, gameDetailHref } from './_lib/gameCatalog';

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

function metricValueForKey(key, hub, derived) {
  if (key === 'characters') return hub.counts.characters;
  if (key === 'posts') return hub.counts.posts;
  if (key === 'topLp') return derived.topUser?.lp || 0;
  if (key === 'rooms') return hub.counts.rooms;
  if (key === 'activeRooms') return hub.counts.activeRooms;
  if (key === 'visibleRooms') return hub.activeRooms.length;
  return 0;
}

function metricLabelForKey(key) {
  if (key === 'characters') return '캐릭터';
  if (key === 'posts') return '게시글';
  if (key === 'topLp') return '최고 LP';
  if (key === 'rooms') return '전체 방';
  if (key === 'activeRooms') return '진행 중';
  if (key === 'visibleRooms') return '표시 방';
  return '지표';
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

function RoadmapCard({ item, index }) {
  return (
    <article className="games-roadmap-card">
      <div className="games-roadmap-card__head">
        <span>{String(index + 1).padStart(2, '0')}</span>
        <div>
          <p>{item.subtitle}</p>
          <h3>{item.title}</h3>
        </div>
        <strong>{item.priority}</strong>
      </div>
      <p>{item.summary}</p>
      <dl>
        <div>
          <dt>범위</dt>
          <dd>{item.scope}</dd>
        </div>
        <div>
          <dt>다음 작업</dt>
          <dd>{item.nextStep}</dd>
        </div>
      </dl>
      <Link href={gameDetailHref(item)} className="games-roadmap-card__link">상세 보기</Link>
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
  const derived = useMemo(() => ({ topUser, topCharacter }), [topCharacter, topUser]);
  const games = useMemo(() => GAME_CATALOG.map((game) => ({
    tone: game.tone,
    title: game.title,
    subtitle: game.subtitle,
    body: game.summary,
    visual: game.visual === 'map',
    metrics: game.metrics.map((key) => ({
      label: metricLabelForKey(key),
      value: metricValueForKey(key, hub, derived),
    })),
    links: [
      { href: gameDetailHref(game), label: '상세 허브' },
      { href: game.primaryHref, label: game.primaryLabel },
      { href: game.recordHref, label: game.recordLabel },
    ],
  })), [derived, hub]);

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
            <Link href="/games/rooms">게임방</Link>
            <Link href="/games/saves">저장 슬롯</Link>
            <Link href="/games/records">게임 기록</Link>
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

        <section className="games-roadmap" aria-label="이식 예정 게임">
          <div className="games-roadmap-title">
            <div>
              <p className="games-kicker">Roadmap</p>
              <h2>이식 예정 게임</h2>
              <p>첨부된 프로토타입을 현재 사이트에 붙이기 쉬운 순서대로 정리했습니다.</p>
            </div>
            <Link href="/board?category=game">아이디어 논의</Link>
          </div>
          <div className="games-roadmap-grid">
            {GAME_ROADMAP.map((item, index) => (
              <RoadmapCard item={item} index={index} key={item.slug} />
            ))}
          </div>
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
