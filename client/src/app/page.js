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
    href: '/simulation',
    tag: 'Play',
    title: '게임 시작',
    body: '현재 데이터로 시뮬레이션을 실행하고 결과를 기록합니다.',
    emphasis: true,
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
  const [myCharTop3, setMyCharTop3] = useState({ wins: [], kills: [] });

  const myUsername = user?.username || null;
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
            <p className="home-kicker">Eternal Hunger Hub</p>
            <h1>ETERNAL HUNGER</h1>
            <p>
              시뮬레이션, 기록소, 게시판, 스무고개를 한 화면에서 확인하는 커뮤니티 허브입니다.
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
