'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import SiteHeader from '../../components/SiteHeader';
import { apiGetCached } from '../../utils/api';

const EMPTY_LEADERBOARD = {
  counts: { users: 0, characters: 0, teams: 0 },
  users: [],
  characters: [],
  teams: [],
};

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePayload(payload) {
  const src = payload && typeof payload === 'object' ? payload : {};
  return {
    counts: { ...EMPTY_LEADERBOARD.counts, ...(src.counts || {}) },
    users: normalizeList(src.users),
    characters: normalizeList(src.characters),
    teams: normalizeList(src.teams),
  };
}

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

function formatRate(value) {
  return `${Math.round(Number(value || 0) * 1000) / 10}%`;
}

function userHref(user) {
  const id = user?._id || user?.id;
  return id ? `/users/${id}` : '';
}

function formatKda(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

function teamName(row) {
  return safeText(row?.teamName || normalizeList(row?.rosterNames).join(' / '), '이름 없는 팀');
}

const TABS = [
  { key: 'users', label: 'LP', countKey: 'users' },
  { key: 'characters', label: '캐릭터', countKey: 'characters' },
  { key: 'teams', label: '팀', countKey: 'teams' },
];

// Columns per tab. `main` is the ranking value; `optional` columns hide on narrow screens.
const COLUMNS = {
  users: [
    { key: 'lp', label: 'LP', main: true, render: (row) => formatNumber(row.lp) },
    { key: 'games', label: '경기', optional: true, render: (row) => formatNumber(row.totalGames) },
    { key: 'wins', label: '승리', optional: true, render: (row) => formatNumber(row.totalWins) },
    { key: 'kills', label: '킬', optional: true, render: (row) => formatNumber(row.totalKills) },
  ],
  characters: [
    { key: 'wins', label: '승리', main: true, render: (row) => formatNumber(row.totalWins) },
    { key: 'games', label: '경기', optional: true, render: (row) => formatNumber(row.gamesPlayed) },
    { key: 'rate', label: '승률', optional: true, render: (row) => formatRate(row.winRate) },
    { key: 'kills', label: '킬', optional: true, render: (row) => formatNumber(row.totalKills) },
    { key: 'kda', label: 'KDA', optional: true, render: (row) => formatKda(row.kda) },
  ],
  teams: [
    { key: 'wins', label: '승리', main: true, render: (row) => formatNumber(row.totalWins) },
    { key: 'games', label: '경기', optional: true, render: (row) => formatNumber(row.gamesPlayed) },
    { key: 'rate', label: '승률', optional: true, render: (row) => formatRate(row.winRate) },
    { key: 'kills', label: '킬', optional: true, render: (row) => formatNumber(row.totalKills) },
  ],
};

function rowIdentity(tab, row) {
  if (tab === 'users') {
    return {
      name: safeText(row.displayName || row.nickname || row.username, '사용자'),
      sub: '',
      href: userHref(row),
    };
  }
  if (tab === 'characters') {
    return {
      name: safeText(row.name, '캐릭터'),
      sub: [safeText(row.weaponType, ''), safeText(row.ownerName, '')].filter(Boolean).join(' · '),
      href: userHref(row.owner),
    };
  }
  return {
    name: teamName(row),
    sub: [normalizeList(row.rosterNames).join(' · '), safeText(row.ownerName, '')].filter(Boolean).join(' · '),
    href: userHref(row.owner),
  };
}

const EMPTY_TEXT = {
  users: '아직 LP 순위가 없습니다.',
  characters: '아직 캐릭터 전적이 없습니다. 이터널 헝거 경기를 마치면 순위가 생깁니다.',
  teams: '아직 팀 전적이 없습니다. 스쿼드 경기를 마치면 순위가 생깁니다.',
};

function RankingTable({ tab, rows }) {
  const columns = COLUMNS[tab];
  if (!rows.length) return <p className="ui-empty lb-empty">{EMPTY_TEXT[tab]}</p>;

  return (
    <table className="ui-table lb-table">
      <thead>
        <tr>
          <th scope="col" className="lb-col-rank">순위</th>
          <th scope="col">{tab === 'users' ? '유저' : tab === 'characters' ? '캐릭터' : '팀'}</th>
          {columns.map((column) => (
            <th scope="col" key={column.key} className={`is-num ${column.optional ? 'is-optional' : ''} ${column.main ? 'is-main' : ''}`}>
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => {
          const { name, sub, href } = rowIdentity(tab, row);
          return (
            <tr key={`${tab}-${row._id || index}`} className={index < 3 ? 'is-podium' : ''}>
              <td className="lb-col-rank">
                <span className={`ui-rank ${index === 0 ? 'ui-rank--1' : ''}`}>{index + 1}</span>
              </td>
              <th scope="row" className="lb-name">
                <span className="lb-name__inner">
                  {href ? <Link href={href}>{name}</Link> : <span>{name}</span>}
                  {sub ? <small>{sub}</small> : null}
                </span>
              </th>
              {columns.map((column) => (
                <td key={column.key} className={`is-num ${column.optional ? 'is-optional' : ''} ${column.main ? 'is-main' : ''}`}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function readInitialTab() {
  if (typeof window === 'undefined') return 'users';
  const tab = new URLSearchParams(window.location.search).get('tab');
  return TABS.some((item) => item.key === tab) ? tab : 'users';
}

export default function LeaderboardPage() {
  const [payload, setPayload] = useState(() => normalizePayload(null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('users');

  const loadLeaderboard = useCallback(async (options = {}) => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGetCached('/public/leaderboard', {
        ttlMs: 30000,
        timeoutMs: 15000,
        storage: 'session',
        force: Boolean(options.force),
      });
      setPayload(normalizePayload(data));
    } catch (err) {
      setPayload(normalizePayload(null));
      // 화면 안 오류 문구로만 알립니다(토스트 중복 없음).
      setError(err?.message || '랭킹을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    void Promise.resolve().then(() => setTab(readInitialTab()));
  }, []);

  const selectTab = (nextTab) => {
    setTab(nextTab);
    if (typeof window !== 'undefined') {
      const url = nextTab === 'users' ? '/leaderboard' : `/leaderboard?tab=${nextTab}`;
      window.history.replaceState(null, '', url);
    }
  };

  const rows = payload[tab] || [];

  return (
    <main className="leaderboard-page-shell">
      <SiteHeader />
      <div className="ui-page lb">
        <PageHeader
          title="랭킹"
          description="LP와 이터널 헝거 전적으로 매긴 사이트 순위입니다. 상위 25위까지 보여 줍니다."
          actions={<Link href="/records" className="ui-button ui-button--quiet">내 기록 보기</Link>}
        />

        <div className="ui-tabs lb-tabs" role="tablist" aria-label="랭킹 종류">
          {TABS.map((item) => (
            <button
              type="button"
              role="tab"
              key={item.key}
              id={`lb-tab-${item.key}`}
              aria-selected={tab === item.key}
              aria-controls="lb-panel"
              onClick={() => selectTab(item.key)}
            >
              {item.label}
              {!loading && !error ? <small>{formatNumber(payload.counts[item.countKey])}</small> : null}
            </button>
          ))}
        </div>

        <section className="ui-panel lb-panel" id="lb-panel" role="tabpanel" aria-labelledby={`lb-tab-${tab}`}>
          {error ? (
            <div className="ui-empty lb-empty">
              <p>{error}</p>
              <button type="button" className="ui-button ui-button--quiet ui-button--small" onClick={() => void loadLeaderboard({ force: true })}>
                다시 불러오기
              </button>
            </div>
          ) : loading ? (
            <p className="ui-empty lb-empty">랭킹을 불러오는 중입니다.</p>
          ) : (
            <RankingTable tab={tab} rows={rows} />
          )}
        </section>
      </div>
    </main>
  );
}
