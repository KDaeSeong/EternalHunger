'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import { useToast } from '../../components/ToastProvider';
import { apiGetCached } from '../../utils/api';
import {
  GAME_CATALOG,
  GAME_ROADMAP,
  MYANIME_GAME_SLUGS,
  SRPG_GAME_SLUGS,
  dynamicGameCandidateToGame,
  findGameBySlug,
  gameDetailHref,
  getGameIntegration,
  getGamePortingChecklist,
  getGamePortingProgress,
} from './_lib/gameCatalog';

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

function normalizeDynamicGames(payload) {
  return normalizeList(payload?.candidates).map(dynamicGameCandidateToGame).filter(Boolean);
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

function roomGameTitle(room, gameTitleBySlug = new Map()) {
  const slug = String(room?.gameSlug || '').trim();
  return gameTitleBySlug.get(slug) || findGameBySlug(slug)?.title || slug || '게임';
}

function roomMeta(room, gameTitleBySlug) {
  if (room?.roomType === 'game-room') {
    return `${roomGameTitle(room, gameTitleBySlug)} · ${safeText(room.hostName, '익명')} · ${formatNumber(room.playerCount)}/${formatNumber(room.maxPlayers || 1)}명 · ${safeText(room.status, 'open')}`;
  }
  const attemptCount = Number(room?.attemptCount != null ? room.attemptCount : Number(room?.questionCount || 0) + Number(room?.guessCount || 0));
  return `스무고개 · ${safeText(room.hostName, '익명')} · ${formatNumber(attemptCount)}/${formatNumber(room.maxQuestions || 20)} · ${safeText(room.categoryLabel, room.category || '자유')}`;
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

function GameFamilyCard({ tone, kicker, title, body, href, stats, links }) {
  return (
    <article className={`games-family-card is-${tone}`}>
      <div>
        <span>{kicker}</span>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
      <div className="games-family-stats">
        {stats.map((stat) => (
          <div key={`${title}-${stat.label}`}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>
      <div className="games-family-actions">
        <Link href={href}>허브 열기</Link>
        {links.map((link) => (
          <Link href={link.href} key={`${title}-${link.href}`}>{link.label}</Link>
        ))}
      </div>
    </article>
  );
}

function RoadmapCard({ item, index }) {
  const game = findGameBySlug(item.slug) || item;
  const integration = getGameIntegration(game);
  const checklist = getGamePortingChecklist(game);
  const progress = getGamePortingProgress(game);
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
        <div>
          <dt>이식 상태</dt>
          <dd>{integration.stageLabel} · {integration.adapter} · {progress.label}</dd>
        </div>
      </dl>
      <div className="games-porting-strip" aria-label={`${item.title} 이식 체크리스트`}>
        {checklist.map((entry) => (
          <span className={entry.done ? 'is-done' : 'is-pending'} key={entry.key}>{entry.label}</span>
        ))}
      </div>
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
  const [dynamicCandidates, setDynamicCandidates] = useState([]);
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
      try {
        const candidatePayload = await apiGetCached('/public/game-candidates', {
          ttlMs: 30000,
          timeoutMs: 15000,
          storage: 'session',
          force: Boolean(options.force),
        });
        setDynamicCandidates(normalizeDynamicGames(candidatePayload));
      } catch {
        setDynamicCandidates([]);
      }
    } catch (err) {
      const message = err?.message || '게임 허브 정보를 불러오지 못했습니다.';
      setHub(EMPTY_HUB);
      setDynamicCandidates([]);
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
  const gameTitleBySlug = useMemo(() => new Map(dynamicCandidates.map((game) => [game.slug, game.title])), [dynamicCandidates]);
  const gameFamilies = useMemo(() => {
    const eternal = findGameBySlug('eternal-hunger');
    const myAnimeGames = MYANIME_GAME_SLUGS.map(findGameBySlug).filter(Boolean);
    const srpgGames = SRPG_GAME_SLUGS.map(findGameBySlug).filter(Boolean);
    const myAnimePlayable = myAnimeGames.filter((game) => !String(game.primaryHref || '').startsWith('/board')).length;
    const srpgPlayable = srpgGames.filter((game) => !String(game.primaryHref || '').startsWith('/board')).length;

    return [
      {
        tone: 'battle',
        kicker: 'Main Game',
        title: '이터널 헝거',
        body: '배틀 시뮬레이션, 캐릭터 설정, 기록소, 밸런스 흐름을 전용 주소로 분리합니다.',
        href: '/eternalhunger',
        stats: [
          { label: '주소', value: '/eternalhunger' },
          { label: '캐릭터', value: formatNumber(hub.counts.characters) },
          { label: '상태', value: eternal?.integration?.stageLabel || '운영' },
        ],
        links: [
          { href: '/records', label: '기록소' },
          { href: '/board?gameSlug=eternal-hunger', label: '게시판' },
        ],
      },
      {
        tone: 'community',
        kicker: 'Prototype Hub',
        title: 'MyAnime',
        body: '업로드된 MyAnime 계열 프로토타입을 한 허브에 모으고, 각 게임은 하위 주소로 이동합니다.',
        href: '/myanime',
        stats: [
          { label: '주소', value: '/myanime' },
          { label: '게임', value: formatNumber(myAnimeGames.length) },
          { label: '플레이', value: formatNumber(myAnimePlayable) },
        ],
        links: [
          { href: myAnimeGames[0]?.primaryHref || '/myanime', label: '첫 게임' },
          { href: '/games/records', label: '기록' },
        ],
      },
      {
        tone: 'srpg',
        kicker: 'Tactical Hub',
        title: 'SRPG',
        body: '그리드 전투와 미션형 게임은 SRPG 전용 허브로 분리해서 별도 장르처럼 키웁니다.',
        href: '/srpg',
        stats: [
          { label: '주소', value: '/srpg' },
          { label: '게임', value: formatNumber(srpgGames.length) },
          { label: '플레이', value: formatNumber(srpgPlayable) },
        ],
        links: [
          { href: srpgGames[0]?.primaryHref || '/srpg', label: '첫 미션' },
          { href: '/games/saves', label: '저장' },
        ],
      },
    ];
  }, [hub.counts.characters]);
  const roadmapGames = useMemo(() => {
    const staticSlugs = new Set([...GAME_CATALOG, ...GAME_ROADMAP].map((game) => game.slug));
    return [
      ...GAME_ROADMAP,
      ...dynamicCandidates.filter((game) => game?.slug && !staticSlugs.has(game.slug)),
    ];
  }, [dynamicCandidates]);
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
            <Link href="/eternalhunger">바로 시작</Link>
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

        <section className="games-family-section" aria-label="게임군 바로가기">
          <div className="games-roadmap-title">
            <div>
              <p className="games-kicker">Routes</p>
              <h2>게임별 주소 분리</h2>
              <p>메인 게임과 이식 게임을 같은 목록에 섞지 않고, 성격별 허브에서 시작하도록 나눕니다.</p>
            </div>
            <Link href="/games">전체 게임 보기</Link>
          </div>
          <div className="games-family-grid">
            {gameFamilies.map((family) => (
              <GameFamilyCard key={family.href} {...family} />
            ))}
          </div>
        </section>

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
            {roadmapGames.map((item, index) => (
              <RoadmapCard item={item} index={index} key={item.slug} />
            ))}
          </div>
        </section>

        <section className="games-dashboard">
          <ActivityList
            title="진행 중인 게임방"
            href="/games/rooms"
            items={hub.activeRooms.slice(0, 6)}
            empty="진행 중인 게임방이 없습니다."
            renderItem={(room) => (
              <Link href={roomHref(room)} key={`room-${room._id || room.title}`}>
                <strong>{safeText(room.title, '제목 없음')}</strong>
                <span>{roomMeta(room, gameTitleBySlug)}</span>
              </Link>
            )}
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
