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

const MENU_ITEMS = [
  {
    href: '/eternalhunger',
    tag: 'Play',
    title: '게임 시작',
    body: '현재 데이터로 시뮬레이션을 실행하고 결과를 기록합니다.',
    emphasis: true,
  },
  {
    href: '/games',
    tag: 'Hub',
    title: '게임 허브',
    body: '플레이, 커뮤니티 게임, 게시판 활동, 기록 흐름을 한 화면에서 확인합니다.',
  },
  {
    href: '/achievements',
    tag: 'Season',
    title: '업적',
    body: '시즌 점수와 다음 목표를 확인합니다.',
  },
  {
    href: '/activity',
    tag: 'Feed',
    title: '활동 피드',
    body: '새 글, 댓글, 스무고개 진행 상황을 한 흐름으로 확인합니다.',
  },
  {
    href: '/characters',
    tag: 'Roster',
    title: '캐릭터 설정',
    body: '캐릭터, 무기, 초월 장비 세팅, 스킬 구성을 관리합니다.',
  },
  {
    href: '/search',
    tag: 'Search',
    title: '통합 검색',
    body: '게시글, 스무고개, 유저, 캐릭터 기록을 한 번에 찾습니다.',
  },
  {
    href: '/records',
    tag: 'Stats',
    title: '기록소',
    body: '캐릭터별, 팀별 전적과 승률을 확인합니다.',
  },
  {
    href: '/balance',
    tag: 'Balance',
    title: '밸런스 분석',
    body: '캐릭터, 팀, 행동 병목을 기록 기반으로 점검합니다.',
  },
  {
    href: '/leaderboard',
    tag: 'Rank',
    title: '리더보드',
    body: 'LP, 캐릭터, 팀 기준으로 사이트 전체 순위를 비교합니다.',
  },
  {
    href: '/board',
    tag: 'Board',
    title: '게시판',
    body: '공지, 공략, 피드백, 버그 제보를 모아봅니다.',
  },
  {
    href: '/bookmarks',
    tag: 'Save',
    title: '저장글',
    body: '다시 볼 게시글과 공략을 개인 목록에 모아둡니다.',
  },
  {
    href: '/twenty-questions',
    tag: '20Q',
    title: '스무고개',
    body: '방을 만들고 질문과 정답 시도로 같이 플레이합니다.',
  },
  {
    href: '/perks',
    tag: 'LP',
    title: '특전 상점',
    body: 'LP로 장기 성장용 특전을 구매합니다.',
  },
  {
    href: '/details',
    tag: 'Tune',
    title: '상세 설정',
    body: '스탯, 성장값, 캐릭터별 세부 값을 조정합니다.',
  },
  {
    href: '/guides',
    tag: 'Guide',
    title: '가이드 허브',
    body: '규칙, 공략 글, 시뮬레이션 토론을 한곳에서 확인합니다.',
  },
];

const EMPTY_HUB = {
  counts: { users: 0, posts: 0, characters: 0, rooms: 0, activeRooms: 0 },
  notices: [],
  recentPosts: [],
  activeRooms: [],
  rankings: { points: [], characters: [] },
};

const EMPTY_PROGRESS = {
  season: {
    name: '프리시즌',
    title: '기반 시즌',
    score: 0,
    maxScore: 0,
    completedCount: 0,
    totalCount: 0,
  },
  next: [],
  onboarding: {
    completedCount: 0,
    totalCount: 0,
    next: [],
  },
};

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

function formatPercent(value) {
  const n = Number(value || 0);
  const safe = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
  return `${Math.round(safe * 100)}%`;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
}

function normalizeHub(payload) {
  const src = payload && typeof payload === 'object' ? payload : {};
  const rankings = src.rankings && typeof src.rankings === 'object' ? src.rankings : {};
  return {
    counts: { ...EMPTY_HUB.counts, ...(src.counts || {}) },
    notices: normalizeList(src.notices),
    recentPosts: normalizeList(src.recentPosts),
    activeRooms: normalizeList(src.activeRooms),
    rankings: {
      points: normalizeList(rankings.points),
      characters: normalizeList(rankings.characters),
    },
  };
}

function normalizeProgress(payload) {
  const src = payload && typeof payload === 'object' ? payload : {};
  const season = src.season && typeof src.season === 'object' ? src.season : {};
  return {
    season: { ...EMPTY_PROGRESS.season, ...season },
    next: normalizeList(src.next).slice(0, 3),
    onboarding: {
      ...EMPTY_PROGRESS.onboarding,
      ...(src.onboarding && typeof src.onboarding === 'object' ? src.onboarding : {}),
      next: normalizeList(src.onboarding?.next).slice(0, 3),
    },
  };
}

function userHref(user) {
  const id = user?._id || user?.id;
  return id ? `/users/${id}` : '';
}

function getWins(row) {
  return Number(row?.totalWins ?? row?.records?.totalWins ?? 0);
}

function getKills(row) {
  return Number(row?.totalKills ?? row?.records?.totalKills ?? 0);
}

function getAssists(row) {
  return Number(row?.totalAssists ?? row?.records?.totalAssists ?? 0);
}

function getUserKey(user) {
  return String(user?._id || user?.id || user?.userId || user?.username || '').trim();
}

function ProgressBar({ value }) {
  return (
    <div className="home-progress-bar" aria-label={`진행도 ${formatPercent(value)}`}>
      <span style={{ width: formatPercent(value) }} />
    </div>
  );
}

function NextGoalRows({ goals }) {
  if (!goals.length) return <div className="home-empty">지금 표시할 다음 목표가 없습니다.</div>;

  return (
    <div className="home-next-goals">
      {goals.map((goal) => {
        const href = safeText(goal?.href, '/achievements');
        const valueText = `${formatNumber(goal?.value)} / ${formatNumber(goal?.target)}`;
        return (
          <Link href={href} className="home-goal-row" key={goal?.id || goal?.title}>
            <div>
              <strong>{safeText(goal?.title, '업적')}</strong>
              <span>{safeText(goal?.sectionLabel, '업적')} · {valueText}</span>
            </div>
            <small>{formatPercent(goal?.progress)}</small>
            <ProgressBar value={goal?.progress} />
          </Link>
        );
      })}
    </div>
  );
}

function OnboardingRows({ onboarding }) {
  const steps = normalizeList(onboarding?.next).slice(0, 3);
  if (!steps.length) return <div className="home-empty">시작 체크리스트를 모두 완료했습니다.</div>;

  return (
    <div className="home-onboarding-rows">
      {steps.map((step) => (
        <Link href={safeText(step?.href, '/achievements')} className="home-onboarding-row" key={step?.id || step?.title}>
          <span>다음</span>
          <div>
            <strong>{safeText(step?.title, '시작 항목')}</strong>
            <small>{safeText(step?.description, '')}</small>
          </div>
        </Link>
      ))}
    </div>
  );
}

function HubLinkList({ items, empty, type }) {
  if (!items.length) return <div className="home-empty">{empty}</div>;

  return (
    <div className="home-link-list">
      {items.map((item) => {
        const href = type === 'room' ? `/twenty-questions/${item._id}` : `/board/${item._id}`;
        const roomAttemptCount = Number(item?.attemptCount != null ? item.attemptCount : Number(item?.questionCount || 0) + Number(item?.guessCount || 0));
        const roomMaxQuestions = Number(item?.maxQuestions || 20);
        const meta = type === 'room'
          ? `사용 ${formatNumber(roomAttemptCount)}/${formatNumber(roomMaxQuestions)} · 질문 ${formatNumber(item.questionCount)} · 시도 ${formatNumber(item.guessCount)}`
          : `조회 ${formatNumber(item.viewCount)} · 추천 ${formatNumber(item.reactionCount)} · 댓글 ${formatNumber(item.commentCount)} · ${formatDate(item.createdAt) || '날짜 없음'}`;
        return (
          <Link href={href} key={`${type}-${item._id || item.title}`}>
            <strong>{safeText(item.title, '제목 없음')}</strong>
            <span>{meta}</span>
          </Link>
        );
      })}
    </div>
  );
}

function RankingRows({ rows, empty, renderValue, renderName, renderHref }) {
  if (!rows.length) return <div className="home-empty">{empty}</div>;

  return (
    <ol className="home-ranking-list">
      {rows.slice(0, 5).map((row, index) => {
        const name = renderName(row);
        const href = renderHref?.(row) || '';
        return (
          <li key={`${name}-${index}`}>
            <span>{index + 1}</span>
            <div>
              {href ? <Link href={href}>{name}</Link> : <strong>{name}</strong>}
              <small>{renderValue(row)}</small>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

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
      setProgress(EMPTY_PROGRESS);
      setProgressLoading(false);
      setProgressError('');
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
            <Link href={mounted && user ? '/simulation' : '/login'} className="home-primary-action">
              {mounted && user ? '게임 시작' : '로그인하고 시작'}
            </Link>
            <Link href="/board" className="home-secondary-action">게시판</Link>
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
              <Link href="/simulation">게임 시작</Link>
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
