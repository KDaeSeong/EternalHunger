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
import { HubLinkList, RankingRows } from './_components/HomeHubPanels';
import { NextGoalRows, OnboardingRows, ProgressBar } from './_components/HomeProgressPanels';
import {
  EMPTY_HUB,
  EMPTY_PROGRESS,
  MENU_ITEMS,
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

export default function Home() {
  const mounted = useHydrated();
  const user = useAuthUser();
  const { showToast } = useToast();
  const [hub, setHub] = useState(EMPTY_HUB);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(EMPTY_PROGRESS);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState('');
  const [myCharTop3, setMyCharTop3] = useState({ wins: [], kills: [] });

  const myUsername = user?.username || null;
  const userKey = getUserKey(user);
  const menuItems = useMemo(() => {
    if (!user?.isAdmin) return MENU_ITEMS;
    return [
      ...MENU_ITEMS,
      {
        href: '/admin',
        tag: 'Admin',
        title: '관리자',
        body: '아이템, 맵, 키오스크, 특전, 신고 상태를 관리합니다.',
      },
    ];
  }, [user?.isAdmin]);

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
        if (!canceled) setHub(normalizeHub(payload));
      } catch (err) {
        if (!canceled) {
          setHub(EMPTY_HUB);
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

  const notices = hub.notices.length ? hub.notices : hub.recentPosts.filter((post) => post.isNotice).slice(0, 3);

  return (
    <main className="home-page">
      <SiteHeader />

      <section className="home-container">
        <section className="home-command">
          <div>
            <p className="home-kicker">Kei&apos;s Game Lab</p>
            <h1>케이의 게임개발소</h1>
            <p>
              Eternal Hunger를 비롯한 여러 게임, 기록소, 저장 슬롯, 게시판, 스무고개를 한곳에 모은 종합 게임 사이트입니다.
            </p>
          </div>
          <div className="home-command-actions">
            <Link href={mounted && user ? '/games' : '/login'} className="home-primary-action">
              {mounted && user ? '게임 고르기' : '로그인하고 시작'}
            </Link>
            <Link href="/eternalhunger" className="home-secondary-action">이터널 헝거</Link>
            <Link href="/myanime" className="home-secondary-action">MyAnime</Link>
          </div>
        </section>

        <section className="home-metrics" aria-label="사이트 요약">
          <div><span>사용자</span><strong>{formatNumber(hub.counts.users)}</strong></div>
          <div><span>캐릭터</span><strong>{formatNumber(hub.counts.characters)}</strong></div>
          <div><span>게시글</span><strong>{formatNumber(hub.counts.posts)}</strong></div>
          <div><span>진행 중 스무고개</span><strong>{formatNumber(hub.counts.activeRooms)}</strong></div>
        </section>

        {mounted && user ? (
          <section className="home-personal" aria-label="내 진행 상황">
            <div className="home-personal-main">
              <div>
                <p className="home-kicker">{safeText(progress.season.name, '프리시즌')}</p>
                <h2>내 진행 보드</h2>
                <p>{progressLoading ? '목표를 불러오는 중입니다.' : '오늘 이어서 할 목표를 확인합니다.'}</p>
              </div>
              <div className="home-personal-score">
                <strong>{formatNumber(progress.season.score)} / {formatNumber(progress.season.maxScore)} pt</strong>
                <span>{formatNumber(progress.season.completedCount)} / {formatNumber(progress.season.totalCount)} 완료</span>
                <ProgressBar value={progress.season.maxScore ? Number(progress.season.score || 0) / Number(progress.season.maxScore || 1) : 0} />
              </div>
            </div>
            {progressError ? <div className="home-empty">{progressError}</div> : <NextGoalRows goals={progress.next} />}
            {!progressError ? (
              <div className="home-onboarding-box">
                <div className="home-mini-title">
                  <strong>시작 체크리스트</strong>
                  <span>{formatNumber(progress.onboarding.completedCount)} / {formatNumber(progress.onboarding.totalCount)}</span>
                </div>
                <OnboardingRows onboarding={progress.onboarding} />
              </div>
            ) : null}
            <div className="home-personal-actions">
              <Link href="/achievements">업적 전체 보기</Link>
              <Link href="/records">기록소</Link>
              <Link href="/eternalhunger">게임 시작</Link>
            </div>
          </section>
        ) : null}

        <section className="home-hub-layout" aria-label="커뮤니티 현황">
          <div className="home-main-column">
            <section className="home-panel">
              <div className="home-panel-title">
                <h2>공지</h2>
                <Link href="/board">전체 보기</Link>
              </div>
              {loading ? <div className="home-empty">홈 정보를 불러오는 중입니다.</div> : (
                <HubLinkList items={notices} empty="아직 공지가 없습니다." type="post" />
              )}
            </section>

            <section className="home-panel">
              <div className="home-panel-title">
                <h2>최신 게시글</h2>
                <Link href="/board">글 보러 가기</Link>
              </div>
              <HubLinkList items={hub.recentPosts} empty="아직 게시글이 없습니다." type="post" />
            </section>

            <section className="home-panel">
              <div className="home-panel-title">
                <h2>진행 중인 스무고개</h2>
                <Link href="/twenty-questions">방 목록</Link>
              </div>
              <HubLinkList items={hub.activeRooms} empty="진행 중인 방이 없습니다." type="room" />
            </section>
          </div>

          <aside className="home-side-column" aria-label="랭킹">
            <section className="home-panel">
              <div className="home-panel-title">
                <h2>LP 랭킹</h2>
              </div>
              <RankingRows
                rows={hub.rankings.points}
                empty="아직 랭킹이 없습니다."
                renderName={(row) => safeText(row.displayName || row.nickname || row.username, '사용자')}
                renderHref={(row) => userHref(row)}
                renderValue={(row) => `${formatNumber(row.lp)} LP`}
              />
            </section>

            <section className="home-panel">
              <div className="home-panel-title">
                <h2>캐릭터 랭킹</h2>
              </div>
              <RankingRows
                rows={hub.rankings.characters}
                empty="아직 캐릭터 기록이 없습니다."
                renderName={(row) => safeText(row.name, '캐릭터')}
                renderValue={(row) => `${formatNumber(row.totalWins)}승 · ${formatNumber(row.totalKills)}킬`}
              />
            </section>

            <section className="home-panel">
              <div className="home-panel-title">
                <h2>내 명예의 전당</h2>
              </div>
              {mounted && user ? (
                <RankingRows
                  rows={myCharTop3.wins}
                  empty="아직 내 승리 기록이 없습니다."
                  renderName={(row) => safeText(row.name, '캐릭터')}
                  renderValue={(row) => `${getWins(row)}승 · ${getKills(row)}킬 · ${getAssists(row)}도움`}
                />
              ) : (
                <div className="home-empty">로그인하면 내 캐릭터 기록을 볼 수 있습니다.</div>
              )}
            </section>
          </aside>
        </section>

        <section className="home-tools" aria-label="주요 기능">
          <div className="home-section-title">
            <p>Tools</p>
            <h2>바로가기</h2>
          </div>
          <div className="menu-grid">
            {menuItems.map((item) => (
              <Link href={item.href} className={`menu-card ${item.emphasis ? 'is-emphasis' : ''}`} key={item.href}>
                <span>{item.tag}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
