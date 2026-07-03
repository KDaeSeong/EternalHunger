'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import SiteHeader from '../components/SiteHeader';
import { useToast } from '../components/ToastProvider';
import { apiGet, clearAuth, updateStoredUser } from '../utils/api';
import { useAuthUser, useHydrated } from '../utils/client-auth';
import {
  HOF_SYNC_EVENT,
  HOF_SYNC_KEY,
  readHallOfFameState,
  summarizeHallOfFameTop3,
} from '../utils/hallOfFame';

const MENU_ITEMS = [
  {
    href: '/characters',
    icon: '👥',
    title: '캐릭터 설정',
    body: '참가할 실험체와 무기, 목표 장비, 전술 스킬을 관리합니다.',
  },
  {
    href: '/records',
    icon: '🏆',
    title: '기록소',
    body: '캐릭터별 전적과 같은 로스터로 쌓인 팀 전적을 확인합니다.',
  },
  {
    href: '/details',
    icon: '📊',
    title: '상세 스탯',
    body: '체력, 공격력, 방어력, 성장 스탯을 실험체별로 조정합니다.',
  },
  {
    href: '/modifiers',
    icon: '⚖️',
    title: '게임 밸런스',
    body: '교전, 파밍, 야생동물, 오브젝트의 확률과 가중치를 조절합니다.',
  },
  {
    href: '/perks',
    icon: 'LP',
    title: '특전 상점',
    body: 'LP로 치장형 특전과 편의성 보상을 구매합니다.',
  },
  {
    href: '/board',
    icon: '📝',
    title: '게시판',
    body: '공지, 피드백, 시뮬레이션 로그를 공유합니다.',
  },
  {
    href: '/twenty-questions',
    icon: '20',
    title: '스무고개',
    body: '방을 만들고 질문과 정답 도전으로 짧게 같이 플레이합니다.',
  },
  {
    href: '/help',
    icon: '?',
    title: '도움말',
    body: '목표, 전술, 장비, 숙련도처럼 낯선 용어를 빠르게 확인합니다.',
  },
];

function normalizeRankings(payload) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return {
      wins: Array.isArray(payload.wins) ? payload.wins : [],
      kills: Array.isArray(payload.kills) ? payload.kills : [],
      points: Array.isArray(payload.points) ? payload.points : [],
    };
  }

  const data = Array.isArray(payload) ? payload : [];
  return {
    wins: [...data].sort((a, b) => Number(b.totalWins || 0) - Number(a.totalWins || 0)).slice(0, 3),
    kills: [...data].sort((a, b) => Number(b.totalKills || 0) - Number(a.totalKills || 0)).slice(0, 3),
    points: [...data]
      .sort((a, b) => {
        const bScore = Number(b.totalWins || 0) * 100 + Number(b.totalKills || 0) * 10;
        const aScore = Number(a.totalWins || 0) * 100 + Number(a.totalKills || 0) * 10;
        return bScore - aScore;
      })
      .slice(0, 3),
  };
}

function getDisplayName(row) {
  return row?.nickname || row?.username || row?.name || row?.characterName || '기록 없음';
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

function getPoints(row) {
  return Number(row?.lp ?? (getWins(row) * 100 + getKills(row) * 10));
}

function RankingList({ rows, empty, renderValue }) {
  if (!rows?.length) return <li className="no-data">{empty}</li>;

  return rows.slice(0, 3).map((row, index) => (
    <li key={`${getDisplayName(row)}-${index}`} className={`rank-${index + 1}`}>
      <span className="rank-badge">{index + 1}</span>
      <div className="rank-info">
        <span className="rank-name">{getDisplayName(row)}</span>
        <span className="rank-val">{renderValue(row)}</span>
      </div>
    </li>
  ));
}

export default function Home() {
  const mounted = useHydrated();
  const user = useAuthUser();
  const { showToast } = useToast();
  const [rankings, setRankings] = useState({ wins: [], kills: [], points: [] });
  const [loading, setLoading] = useState(true);
  const [myCharTop3, setMyCharTop3] = useState({ wins: [], kills: [] });

  const myUsername = user?.username || null;
  const menuItems = useMemo(() => {
    if (!user?.isAdmin) return MENU_ITEMS;
    return [
      ...MENU_ITEMS,
      {
        href: '/admin',
        icon: '🛠',
        title: '관리자',
        body: '아이템, 맵, 키오스크, 특전 등 운영 데이터를 관리합니다.',
      },
    ];
  }, [user?.isAdmin]);

  useEffect(() => {
    let canceled = false;

    async function refreshHome() {
      setLoading(true);
      try {
        const payload = await apiGet('/rankings');
        if (!canceled) setRankings(normalizeRankings(payload));
      } catch (err) {
        if (!canceled) {
          setRankings({ wins: [], kills: [], points: [] });
          showToast({ tone: 'warning', message: err?.message || '랭킹 정보를 불러오지 못했습니다.' });
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

  return (
    <main className="home-page">
      <SiteHeader />

      <section className="home-container">
        <section className="hero-section">
          <div className="hero-logo-container" aria-label="ETERNAL HUNGER">
            <span className="hero-logo-sub">ETERNAL</span>
            <span className="hero-logo-main">HUNGER</span>
          </div>
          <p className="main-desc">
            나만의 캐릭터와 운영 데이터로 굴리는 이터널 리턴풍 배틀로얄 시뮬레이터
          </p>
        </section>

        <section className="menu-grid" aria-label="주요 메뉴">
          {menuItems.map((item) => (
            <Link href={item.href} className="menu-card" key={item.href}>
              <div className="icon">{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </Link>
          ))}
        </section>

        <div className="start-btn-container">
          <Link href={mounted && user ? '/simulation' : '/login'} className="start-btn">
            {mounted && user ? '시뮬레이션 시작하기' : '로그인하고 시작하기'}
          </Link>
        </div>

        <section className="hall-of-fame">
          <h2 className="hof-title">명예의 전당</h2>

          {loading ? (
            <p style={{ textAlign: 'center', color: '#666' }}>랭킹 정보를 불러오는 중입니다.</p>
          ) : (
            <div className="hof-grid">
              <div className="hof-card">
                <h3>내 캐릭터 승리</h3>
                <ul>
                  {mounted && user ? (
                    <RankingList
                      rows={myCharTop3.wins}
                      empty="아직 승리 기록이 없습니다."
                      renderValue={(row) => `${getWins(row)}승`}
                    />
                  ) : (
                    <li className="no-data">로그인하면 내 캐릭터 기록을 볼 수 있습니다.</li>
                  )}
                </ul>
              </div>

              <div className="hof-card">
                <h3>내 캐릭터 킬/어시스트</h3>
                <ul>
                  {mounted && user ? (
                    <RankingList
                      rows={myCharTop3.kills}
                      empty="아직 전투 기록이 없습니다."
                      renderValue={(row) => `${getKills(row)}킬 / ${getAssists(row)}어시`}
                    />
                  ) : (
                    <li className="no-data">로그인하면 전투 기록을 볼 수 있습니다.</li>
                  )}
                </ul>
              </div>

              <div className="hof-card">
                <h3>LP 랭킹</h3>
                <ul>
                  <RankingList
                    rows={rankings.points}
                    empty="아직 랭킹 기록이 없습니다."
                    renderValue={(row) => `${getPoints(row).toLocaleString('ko-KR')} LP`}
                  />
                </ul>
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
