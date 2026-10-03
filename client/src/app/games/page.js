'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import SiteHeader from '../../components/SiteHeader';
import { apiGetCached } from '../../utils/api';
import {
  GAME_CATALOG,
  MYANIME_GAME_SLUGS,
  SRPG_GAME_SLUGS,
  findGameBySlug,
  gameDetailHref,
} from './_lib/gameCatalog';
import { ActivityPanel, GameTile } from './_components/GamesHubCards';
import {
  EMPTY_HUB,
  formatDate,
  formatNumber,
  normalizeDynamicGames,
  normalizeHub,
  roomHref,
  roomMeta,
  safeText,
} from './_lib/gamesHubUtils';

const FEATURED_SLUGS = ['eternal-hunger', 'hunger-games', 'twenty-questions'];

export default function GamesPage() {
  const [hub, setHub] = useState(EMPTY_HUB);
  const [dynamicCandidates, setDynamicCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // null metrics render as "—" until real counts arrive (never a fake 0).
  const [hubLoaded, setHubLoaded] = useState(false);

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
      setHubLoaded(true);
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
      setHubLoaded(false);
      setDynamicCandidates([]);
      // 화면 안 오류 문구로만 알립니다(토스트 중복 없음).
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadHub);
  }, [loadHub]);

  const gamePosts = useMemo(() => {
    const rows = hub.recentPosts.filter((post) => ['game', 'simulation', 'guide'].includes(String(post?.category || '')));
    return (rows.length ? rows : hub.recentPosts).slice(0, 5);
  }, [hub.recentPosts]);

  const gameTitleBySlug = useMemo(() => new Map(dynamicCandidates.map((game) => [game.slug, game.title])), [dynamicCandidates]);
  const featuredGames = useMemo(() => FEATURED_SLUGS.map(findGameBySlug).filter(Boolean), []);
  const myAnimeGames = useMemo(() => MYANIME_GAME_SLUGS.map(findGameBySlug).filter(Boolean), []);
  const srpgGames = useMemo(() => SRPG_GAME_SLUGS.map(findGameBySlug).filter(Boolean), []);
  // Candidates registered by admins that are not part of the built-in catalog yet.
  const upcomingGames = useMemo(() => {
    const known = new Set([...GAME_CATALOG.map((game) => game.slug), ...MYANIME_GAME_SLUGS, ...SRPG_GAME_SLUGS]);
    return dynamicCandidates.filter((game) => game?.slug && !known.has(game.slug));
  }, [dynamicCandidates]);
  const playableCount = featuredGames.length + myAnimeGames.length + srpgGames.length;

  return (
    <main className="games-page-shell">
      <SiteHeader />
      <div className="ui-page gh">
        <PageHeader
          title="게임"
          description={`사이트에서 바로 플레이할 수 있는 게임 ${formatNumber(playableCount)}개입니다.`}
          actions={(
            <>
              <Link href="/games/rooms" className="ui-button ui-button--quiet">게임방</Link>
              <Link href="/games/records" className="ui-button ui-button--quiet">게임 기록</Link>
              <Link href="/games/saves" className="ui-button ui-button--quiet">저장 슬롯</Link>
            </>
          )}
        />

        <section className="gh-section" aria-labelledby="gh-featured-title">
          <div className="gh-section__head">
            <h2 id="gh-featured-title">대표 게임</h2>
          </div>
          <ul className="gh-grid gh-grid--featured">
            {featuredGames.map((game) => (
              <li key={game.slug}>
                <GameTile game={game} withActions sizes="(max-width: 720px) 100vw, 33vw" />
              </li>
            ))}
          </ul>
        </section>

        <section className="gh-section" aria-labelledby="gh-myanime-title">
          <div className="gh-section__head">
            <div>
              <h2 id="gh-myanime-title">MyAnime 프로토타입</h2>
              <p>시뮬레이션, 카드, 경영 장르의 실험작입니다. 저장과 전적을 지원합니다.</p>
            </div>
            <Link href="/myanime">MyAnime 허브</Link>
          </div>
          <ul className="gh-grid">
            {myAnimeGames.map((game) => (
              <li key={game.slug}>
                <GameTile game={game} withActions />
              </li>
            ))}
          </ul>
        </section>

        <section className="gh-section" aria-labelledby="gh-srpg-title">
          <div className="gh-section__head">
            <div>
              <h2 id="gh-srpg-title">SRPG</h2>
              <p>격자 전투와 미션으로 진행하는 전술 게임입니다.</p>
            </div>
            <Link href="/srpg">SRPG 허브</Link>
          </div>
          <ul className="gh-grid">
            {srpgGames.map((game) => (
              <li key={game.slug}>
                <GameTile game={game} withActions />
              </li>
            ))}
          </ul>
        </section>

        {upcomingGames.length ? (
          <section className="ui-panel" aria-labelledby="gh-upcoming-title">
            <div className="ui-panel__head">
              <h2 id="gh-upcoming-title">준비 중인 게임</h2>
              <Link href="/board?category=game">아이디어 나누기</Link>
            </div>
            <ul className="ui-list">
              {upcomingGames.map((game) => (
                <li key={game.slug}>
                  <Link href={gameDetailHref(game)} className="ui-list-row">
                    <span className="ui-list-row__main">
                      <strong>{safeText(game.title, game.slug)}</strong>
                      <span>{safeText(game.stageLabel || game.subtitle, '준비 중')}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {error ? (
          <div className="ui-notice ui-notice--danger" role="alert">
            <span>게임방과 게시글을 불러오지 못했습니다. {error}</span>
            <button type="button" className="ui-button ui-button--quiet ui-button--small" onClick={() => void loadHub({ force: true })}>
              다시 불러오기
            </button>
          </div>
        ) : null}

        <div className="gh-activity">
          <ActivityPanel
            title="진행 중인 게임방"
            titleId="gh-rooms-title"
            href="/games/rooms"
            items={hubLoaded ? hub.activeRooms.slice(0, 5) : []}
            empty={loading ? '게임방을 불러오는 중입니다.' : '지금 열린 게임방이 없습니다. 게임방에서 직접 열 수 있습니다.'}
            renderItem={(room) => (
              <li key={`room-${room._id || room.title}`}>
                <Link href={roomHref(room)} className="ui-list-row">
                  <span className="ui-list-row__main">
                    <strong>{safeText(room.title, '제목 없음')}</strong>
                    <span>{roomMeta(room, gameTitleBySlug)}</span>
                  </span>
                </Link>
              </li>
            )}
          />

          <ActivityPanel
            title="최근 게임 글"
            titleId="gh-posts-title"
            href="/board?category=game"
            linkLabel="게시판"
            items={hubLoaded ? gamePosts : []}
            empty={loading ? '게시글을 불러오는 중입니다.' : '아직 게임 글이 없습니다.'}
            renderItem={(post) => (
              <li key={`post-${post._id || post.title}`}>
                <Link href={`/board/${post._id}`} className="ui-list-row">
                  <span className="ui-list-row__main">
                    <strong>{safeText(post.title, '제목 없음')}</strong>
                    <span>{safeText(post.authorName, '익명')} · {formatDate(post.createdAt || post.updatedAt) || '-'} · 댓글 {formatNumber(post.commentCount)}</span>
                  </span>
                </Link>
              </li>
            )}
          />
        </div>
      </div>
    </main>
  );
}
