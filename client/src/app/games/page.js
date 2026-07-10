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
  findGameBySlug,
  gameDetailHref,
} from './_lib/gameCatalog';
import { ActivityList, GameCard, GameFamilyCard, GameMetric, RoadmapCard } from './_components/GamesHubCards';
import {
  EMPTY_HUB,
  formatDate,
  formatNumber,
  metricLabelForKey,
  metricValueForKey,
  normalizeDynamicGames,
  normalizeHub,
  roomHref,
  roomMeta,
  safeText,
  userHref,
} from './_lib/gamesHubUtils';

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
    void Promise.resolve().then(loadHub);
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
    slug: game.slug,
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
            <Link href="/eternalhunger">이터널 헝거</Link>
            <Link href="/myanime">MyAnime</Link>
            <Link href="/srpg">SRPG</Link>
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
