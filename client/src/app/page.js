'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import SiteHeader from '../components/SiteHeader';
import { useToast } from '../components/ToastProvider';
import { apiGet, apiGetCached, clearAuth, updateStoredUser } from '../utils/api';
import { useAuthUser, useHydrated } from '../utils/client-auth';
import {
  HOF_SYNC_EVENT,
  HOF_SYNC_KEY,
  readHallOfFameState,
  summarizeHallOfFameTop3,
} from '../utils/hallOfFame';
import { PostRows, RankingRows, RoomRows } from './_components/HomeHubPanels';
import { ProgressStrip } from './_components/HomeProgressPanels';
import GameKeyArt from './games/_components/GameKeyArt';
import { GameTile } from './games/_components/GamesHubCards';
import { findGameBySlug } from './games/_lib/gameCatalog';
import { gameTagline } from './games/_lib/gameTaglines';
import {
  EMPTY_HUB,
  EMPTY_PROGRESS,
  formatNumber,
  getAssists,
  getKills,
  getUserKey,
  getWins,
  normalizeHub,
  normalizeProgress,
  safeText,
  userHref,
} from './_lib/homePageUtils';

// Shown under "다른 게임" on the home page.
const OTHER_GAME_SLUGS = ['twenty-questions', 'dual-academy-tcg', 'ba-srpg', 'myanimecraft'];

export default function Home() {
  const mounted = useHydrated();
  const user = useAuthUser();
  const { showToast } = useToast();
  const [hub, setHub] = useState(EMPTY_HUB);
  const [loading, setLoading] = useState(true);
  // Until the hub loads (or when it fails, e.g. while the API server wakes up),
  // show "—" instead of 0 so placeholder numbers never look like real counts.
  const [hubLoaded, setHubLoaded] = useState(false);
  const [progress, setProgress] = useState(EMPTY_PROGRESS);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState('');
  const [myCharTop3, setMyCharTop3] = useState({ wins: [], kills: [] });

  const myUsername = user?.username || null;
  const userKey = getUserKey(user);

  useEffect(() => {
    let canceled = false;

    async function refreshHome() {
      setLoading(true);
      try {
        const payload = await apiGetCached('/public/home-hub', {
          ttlMs: 30000,
          timeoutMs: 15000,
          storage: 'session',
        });
        if (!canceled) {
          setHub(normalizeHub(payload));
          setHubLoaded(true);
        }
      } catch (err) {
        if (!canceled) {
          setHub(EMPTY_HUB);
          setHubLoaded(false);
          showToast({ tone: 'warning', message: err?.message || '홈 정보를 불러오지 못했습니다.' });
        }
      } finally {
        if (!canceled) setLoading(false);
      }

      if (!user) return;

      try {
        const me = await apiGet('/user/me');
        if (me && typeof me === 'object') updateStoredUser((current) => ({ ...(current || {}), ...me }));
      } catch (err) {
        const status = Number(err?.status || 0);
        if (status === 401 || status === 403) clearAuth();
      }
    }

    void refreshHome();
    return () => {
      canceled = true;
    };
  }, [showToast, user]);

  useEffect(() => {
    let canceled = false;

    if (!mounted || !userKey) {
      Promise.resolve().then(() => {
        if (canceled) return;
        setProgress(EMPTY_PROGRESS);
        setProgressLoading(false);
        setProgressError('');
      });
      return () => {
        canceled = true;
      };
    }

    async function refreshProgress() {
      setProgressLoading(true);
      setProgressError('');
      try {
        const payload = await apiGet('/achievements', { timeoutMs: 12000 });
        if (!canceled) setProgress(normalizeProgress(payload));
      } catch (err) {
        if (!canceled) {
          const status = Number(err?.status || 0);
          if (status === 401 || status === 403) {
            clearAuth();
          } else {
            setProgress(EMPTY_PROGRESS);
            setProgressError(err?.message || '내 목표를 불러오지 못했습니다.');
          }
        }
      } finally {
        if (!canceled) setProgressLoading(false);
      }
    }

    void refreshProgress();
    return () => {
      canceled = true;
    };
  }, [mounted, userKey]);

  useEffect(() => {
    const syncMyHallOfFame = () => {
      if (!myUsername) {
        setMyCharTop3({ wins: [], kills: [] });
        return;
      }
      const state = readHallOfFameState({ username: myUsername });
      setMyCharTop3(summarizeHallOfFameTop3(state));
    };

    syncMyHallOfFame();
    if (typeof window === 'undefined') return undefined;

    const onStorage = (event) => {
      if (!event?.key) return;
      if (event.key === HOF_SYNC_KEY || event.key === `eh_hof_${myUsername}`) syncMyHallOfFame();
    };
    const onHofSync = () => syncMyHallOfFame();
    window.addEventListener('storage', onStorage);
    window.addEventListener(HOF_SYNC_EVENT, onHofSync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(HOF_SYNC_EVENT, onHofSync);
    };
  }, [myUsername]);

  const boardPosts = useMemo(() => {
    const noticeRows = (hub.notices.length ? hub.notices : hub.recentPosts.filter((post) => post.isNotice)).slice(0, 2);
    const seen = new Set(noticeRows.map((post) => String(post._id)));
    const rest = hub.recentPosts.filter((post) => !seen.has(String(post._id)));
    return [...noticeRows, ...rest].slice(0, 6);
  }, [hub.notices, hub.recentPosts]);

  const otherGames = useMemo(
    () => OTHER_GAME_SLUGS.map(findGameBySlug).filter(Boolean),
    [],
  );

  const loggedIn = mounted && Boolean(user);
  const topCharacter = hub.rankings.characters[0] || null;

  return (
    <main className="home-page">
      <SiteHeader />

      <div className="ui-page hm">
        <h1 className="ui-visually-hidden">케이의 게임개발소</h1>

        <section className="ui-hero" aria-labelledby="ui-hero-title">
          <GameKeyArt
            slug="eternal-hunger"
            title="이터널 헝거"
            className="ui-hero__art"
            preload
            sizes="(max-width: 860px) 100vw, 60vw"
          />
          <div className="ui-hero__copy">
            <h2 id="ui-hero-title">이터널 헝거</h2>
            <p>{gameTagline('eternal-hunger')}</p>
            <div className="ui-hero__actions">
              <Link href="/eternalhunger" className="ui-button ui-hero__play">이터널 헝거 플레이</Link>
              {loggedIn ? (
                <Link href="/characters" className="ui-button ui-hero__secondary">캐릭터 설정</Link>
              ) : (
                <Link href="/games/eternal-hunger" className="ui-button ui-hero__secondary">게임 소개</Link>
              )}
            </div>
            <dl className="ui-hero__facts">
              <div>
                <dt>등록된 캐릭터</dt>
                <dd className="ui-num">{hubLoaded ? `${formatNumber(hub.counts.characters)}명` : '—'}</dd>
              </div>
              {topCharacter ? (
                <div>
                  <dt>캐릭터 1위</dt>
                  <dd>{safeText(topCharacter.name, '캐릭터')} <span className="ui-num">{formatNumber(getWins(topCharacter))}승</span></dd>
                </div>
              ) : null}
            </dl>
          </div>
        </section>

        {loggedIn ? (
          <ProgressStrip progress={progress} loading={progressLoading} error={progressError} />
        ) : null}

        <div className="hm-columns">
          <div className="hm-main">
            <section className="ui-panel" aria-labelledby="hm-board-title">
              <div className="ui-panel__head">
                <h2 id="hm-board-title">게시판</h2>
                <Link href="/board">게시판 가기</Link>
              </div>
              {loading ? <p className="ui-empty">게시글을 불러오는 중입니다.</p> : (
                <PostRows posts={boardPosts} empty="아직 게시글이 없습니다. 첫 글을 남겨 보세요." />
              )}
            </section>

            <section className="ui-panel" aria-labelledby="hm-rooms-title">
              <div className="ui-panel__head">
                <h2 id="hm-rooms-title">열린 방</h2>
                <span className="ui-panel__links">
                  <Link href="/twenty-questions">스무고개</Link>
                  <Link href="/games/rooms">게임방</Link>
                </span>
              </div>
              {loading ? <p className="ui-empty">방 목록을 불러오는 중입니다.</p> : (
                <RoomRows rooms={hub.activeRooms} empty="지금 열린 방이 없습니다. 스무고개나 게임방을 직접 열 수 있습니다." />
              )}
            </section>
          </div>

          <aside className="hm-side" aria-label="랭킹">
            <section className="ui-panel" aria-labelledby="hm-lp-title">
              <div className="ui-panel__head">
                <h2 id="hm-lp-title">LP 랭킹</h2>
                <Link href="/leaderboard">전체 순위</Link>
              </div>
              <RankingRows
                rows={hub.rankings.points}
                empty="아직 순위가 없습니다."
                renderName={(row) => safeText(row.displayName || row.nickname || row.username, '사용자')}
                renderHref={(row) => userHref(row)}
                renderValue={(row) => `${formatNumber(row.lp)} LP`}
              />
            </section>

            <section className="ui-panel" aria-labelledby="hm-char-title">
              <div className="ui-panel__head">
                <h2 id="hm-char-title">캐릭터 랭킹</h2>
                <Link href="/leaderboard?tab=characters">전체 순위</Link>
              </div>
              <RankingRows
                rows={hub.rankings.characters}
                empty="아직 캐릭터 기록이 없습니다."
                renderName={(row) => safeText(row.name, '캐릭터')}
                renderSub={(row) => safeText(row.ownerName, '')}
                renderValue={(row) => `${formatNumber(getWins(row))}승`}
              />
            </section>

            {loggedIn && myCharTop3.wins.length ? (
              <section className="ui-panel" aria-labelledby="hm-hof-title">
                <div className="ui-panel__head">
                  <h2 id="hm-hof-title">내 캐릭터 기록</h2>
                  <Link href="/records">기록소</Link>
                </div>
                <RankingRows
                  rows={myCharTop3.wins}
                  empty="아직 내 승리 기록이 없습니다."
                  renderName={(row) => safeText(row.name, '캐릭터')}
                  renderSub={(row) => `${getKills(row)}킬 · ${getAssists(row)}도움`}
                  renderValue={(row) => `${getWins(row)}승`}
                />
              </section>
            ) : null}
          </aside>
        </div>

        <section className="hm-games" aria-labelledby="hm-games-title">
          <div className="hm-games__head">
            <h2 id="hm-games-title">다른 게임</h2>
            <Link href="/games">게임 전체 보기</Link>
          </div>
          <ul className="hm-games__grid">
            {otherGames.map((game) => (
              <li key={game.slug}>
                <GameTile game={game} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
