'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import { useToast } from '../../components/ToastProvider';
import { apiGet } from '../../utils/api';

const SORT_OPTIONS = [
  { value: 'wins', label: '승리' },
  { value: 'games', label: '참가' },
  { value: 'kills', label: '킬' },
  { value: 'assists', label: '어시스트' },
  { value: 'winRate', label: '승률' },
  { value: 'kda', label: 'KDA' },
];

function formatNumber(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

function formatRate(value) {
  return `${Math.round(Number(value || 0) * 1000) / 10}%`;
}

function formatKda(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}

function normalizeRecordsPayload(payload) {
  const src = payload && typeof payload === 'object' ? payload : {};
  return {
    characters: Array.isArray(src.characters) ? src.characters : [],
    teams: Array.isArray(src.teams) ? src.teams : [],
    totals: src.totals && typeof src.totals === 'object' ? src.totals : {},
  };
}

function rowName(row, view) {
  if (view === 'teams') {
    return row?.teamName || (Array.isArray(row?.rosterNames) ? row.rosterNames.join(' / ') : '') || '이름 없는 팀';
  }
  return row?.name || '이름 없는 캐릭터';
}

function rowSubtitle(row, view) {
  if (view === 'teams') {
    const names = Array.isArray(row?.rosterNames) ? row.rosterNames.filter(Boolean) : [];
    return names.length ? names.join(' · ') : '로스터 정보 없음';
  }
  return row?.weaponType || '무기 미설정';
}

function sortRows(rows, sortKey, view) {
  const keyMap = {
    wins: 'totalWins',
    games: 'gamesPlayed',
    kills: 'totalKills',
    assists: 'totalAssists',
    winRate: 'winRate',
    kda: 'kda',
  };
  const key = keyMap[sortKey] || 'totalWins';
  return [...rows].sort((a, b) => (
    Number(b?.[key] || 0) - Number(a?.[key] || 0) ||
    Number(b?.totalKills || 0) - Number(a?.totalKills || 0) ||
    String(rowName(a, view)).localeCompare(String(rowName(b, view)), 'ko')
  ));
}

function StatCard({ label, value, hint }) {
  return (
    <div className="records-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

function IdentityCell({ row, view }) {
  const name = rowName(row, view);
  const initial = name.trim().slice(0, 1).toUpperCase() || '?';
  const previewImage = view === 'characters' ? String(row?.previewImage || '') : '';
  return (
    <div className="records-identity">
      <span
        className="records-avatar"
        style={previewImage ? { backgroundImage: `url("${previewImage}")` } : undefined}
      >
        {previewImage ? '' : initial}
      </span>
      <span>
        <strong>{name}</strong>
        <small>{rowSubtitle(row, view)}</small>
      </span>
    </div>
  );
}

function RecordsTable({ rows, view }) {
  if (!rows.length) {
    return (
      <div className="records-empty">
        <strong>표시할 기록이 없습니다.</strong>
        <p>{view === 'teams' ? '스쿼드 경기를 완료하면 팀 전적이 여기에 누적됩니다.' : '시뮬레이션을 완료하면 캐릭터 전적이 여기에 누적됩니다.'}</p>
      </div>
    );
  }

  return (
    <div className="records-table-wrap">
      <table className="records-table">
        <thead>
          <tr>
            <th>{view === 'teams' ? '팀' : '캐릭터'}</th>
            <th>참가</th>
            <th>승리</th>
            <th>승률</th>
            <th>킬</th>
            <th>어시스트</th>
            <th>사망</th>
            <th>KDA</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id || row.teamKey || row.name}>
              <td data-label={view === 'teams' ? '팀' : '캐릭터'}><IdentityCell row={row} view={view} /></td>
              <td data-label="참가">{formatNumber(row.gamesPlayed)}</td>
              <td data-label="승리">{formatNumber(row.totalWins)}</td>
              <td data-label="승률">{formatRate(row.winRate)}</td>
              <td data-label="킬">{formatNumber(row.totalKills)}</td>
              <td data-label="어시스트">{formatNumber(row.totalAssists)}</td>
              <td data-label="사망">{formatNumber(row.deathCount)}</td>
              <td data-label="KDA">{formatKda(row.kda)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RecordsPage() {
  const { showToast } = useToast();
  const [payload, setPayload] = useState(() => normalizeRecordsPayload(null));
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('characters');
  const [sortKey, setSortKey] = useState('wins');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let canceled = false;

    async function loadRecords() {
      setLoading(true);
      setError('');
      try {
        const data = await apiGet('/records', { timeoutMs: 20000 });
        if (!canceled) setPayload(normalizeRecordsPayload(data));
      } catch (err) {
        if (!canceled) {
          setPayload(normalizeRecordsPayload(null));
          setError(err?.message || '기록을 불러오지 못했습니다.');
          showToast({ tone: 'warning', message: err?.message || '기록을 불러오지 못했습니다.' });
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    }

    void loadRecords();
    return () => {
      canceled = true;
    };
  }, [showToast]);

  const activeRows = view === 'teams' ? payload.teams : payload.characters;
  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = !needle
      ? activeRows
      : activeRows.filter((row) => {
        const haystack = [
          rowName(row, view),
          rowSubtitle(row, view),
          ...(Array.isArray(row?.rosterNames) ? row.rosterNames : []),
        ].join(' ').toLowerCase();
        return haystack.includes(needle);
      });
    return sortRows(rows, sortKey, view);
  }, [activeRows, query, sortKey, view]);

  const totals = view === 'teams' ? payload.totals?.teams : payload.totals?.characters;
  const totalRows = view === 'teams' ? payload.teams.length : payload.characters.length;
  const winRate = Number(totals?.gamesPlayed || 0) > 0
    ? Number(totals?.totalWins || 0) / Number(totals.gamesPlayed || 1)
    : 0;

  return (
    <main className="records-page">
      <SiteHeader />

      <section className="records-container">
        <div className="records-head">
          <div>
            <p>기록소</p>
            <h1>캐릭터와 팀 전적</h1>
          </div>
          <Link href="/simulation" className="records-start-link">경기 시작</Link>
        </div>

        <div className="records-tabs" role="tablist" aria-label="기록 종류">
          <button type="button" className={view === 'characters' ? 'active' : ''} onClick={() => setView('characters')}>
            캐릭터별
          </button>
          <button type="button" className={view === 'teams' ? 'active' : ''} onClick={() => setView('teams')}>
            팀별
          </button>
        </div>

        <section className="records-stats" aria-label="전적 요약">
          <StatCard label={view === 'teams' ? '기록 팀' : '기록 캐릭터'} value={`${formatNumber(totalRows)}개`} />
          <StatCard label="참가" value={`${formatNumber(totals?.gamesPlayed)}회`} />
          <StatCard label="승리" value={`${formatNumber(totals?.totalWins)}회`} hint={`승률 ${formatRate(winRate)}`} />
          <StatCard label="킬 / 어시스트" value={`${formatNumber(totals?.totalKills)} / ${formatNumber(totals?.totalAssists)}`} />
        </section>

        <section className="records-panel">
          <div className="records-toolbar">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={view === 'teams' ? '팀명 또는 멤버 검색' : '캐릭터명 또는 무기 검색'}
            />
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value)}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}순</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="records-empty"><strong>기록을 불러오는 중입니다.</strong></div>
          ) : error ? (
            <div className="records-empty">
              <strong>기록을 불러오지 못했습니다.</strong>
              <p>{error}</p>
              <Link href="/login">로그인으로 이동</Link>
            </div>
          ) : (
            <RecordsTable rows={filteredRows} view={view} />
          )}
        </section>
      </section>
    </main>
  );
}
