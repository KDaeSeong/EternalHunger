'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import { useToast } from '../../components/ToastProvider';
import { apiGet } from '../../utils/api';

const RECORD_SORT_OPTIONS = [
  { value: 'wins', label: '승리' },
  { value: 'games', label: '참가' },
  { value: 'kills', label: '킬' },
  { value: 'assists', label: '어시스트' },
  { value: 'winRate', label: '승률' },
  { value: 'kda', label: 'KDA' },
];

const RUN_SORT_OPTIONS = [
  { value: 'latest', label: '최신순' },
  { value: 'kills', label: '킬' },
  { value: 'events', label: '이벤트' },
  { value: 'craft', label: '제작' },
  { value: 'revive', label: '부활' },
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

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeRecordsPayload(payload) {
  const src = payload && typeof payload === 'object' ? payload : {};
  return {
    characters: Array.isArray(src.characters) ? src.characters : [],
    teams: Array.isArray(src.teams) ? src.teams : [],
    runs: Array.isArray(src.runs) ? src.runs : [],
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

function sortRecordRows(rows, sortKey, view) {
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

function sortRuns(rows, sortKey) {
  const keyMap = {
    kills: 'totalKills',
    events: 'runEventCount',
    craft: 'craftCount',
    revive: 'totalRevives',
  };
  if (sortKey === 'latest') {
    return [...rows].sort((a, b) => new Date(b?.playedAt || 0) - new Date(a?.playedAt || 0));
  }
  const key = keyMap[sortKey] || 'totalKills';
  return [...rows].sort((a, b) => (
    Number(b?.[key] || 0) - Number(a?.[key] || 0) ||
    new Date(b?.playedAt || 0) - new Date(a?.playedAt || 0)
  ));
}

function deltaText(current, previous, key) {
  if (!previous) return '';
  const diff = Number(current?.[key] || 0) - Number(previous?.[key] || 0);
  if (!Number.isFinite(diff) || diff === 0) return '±0';
  return diff > 0 ? `+${formatNumber(diff)}` : `-${formatNumber(Math.abs(diff))}`;
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

function RunCard({ run, previous }) {
  const winnerTeam = run?.winnerTeamName || (Array.isArray(run?.winnerTeamMembers) ? run.winnerTeamMembers.join(' / ') : '') || run?.winnerName || '우승자 없음';
  return (
    <article className="records-run-card">
      <header>
        <div>
          <span>{formatDateTime(run?.playedAt)}</span>
          <h2>{winnerTeam}</h2>
          <p>{String(run?.matchMode || '').toLowerCase() === 'solo' ? '솔로' : `스쿼드 · 팀당 ${formatNumber(run?.teamSize || 0)}명`}</p>
        </div>
        <div className="records-run-meta">
          <strong>{formatNumber(run?.participantCount)}명 / {formatNumber(run?.teamCount)}팀</strong>
          {run?.id ? <Link href={`/records/runs/${run.id}`}>리플레이</Link> : null}
        </div>
      </header>

      <div className="records-run-metrics">
        <div><span>킬</span><strong>{formatNumber(run?.totalKills)}</strong><small>{deltaText(run, previous, 'totalKills')}</small></div>
        <div><span>부활</span><strong>{formatNumber(run?.totalRevives)}</strong><small>{deltaText(run, previous, 'totalRevives')}</small></div>
        <div><span>제작</span><strong>{formatNumber(run?.craftCount)}</strong><small>{deltaText(run, previous, 'craftCount')}</small></div>
        <div><span>이벤트</span><strong>{formatNumber(run?.runEventCount)}</strong><small>{deltaText(run, previous, 'runEventCount')}</small></div>
      </div>

      <div className="records-run-lines">
        <p>초월 {formatNumber(run?.transCount)}명 · 전설 {formatNumber(run?.legendCount)}명 · 드론 {formatNumber(run?.droneCalls)}회 · 키오스크 {formatNumber(run?.kioskGains)}회</p>
        <p>첫 전설 {run?.firstLegendText || '-'} · 첫 초월 {run?.firstTransText || '-'}</p>
        {run?.topObjectiveMoves ? <p>주요 목표 이동: {run.topObjectiveMoves}</p> : null}
        {run?.topBlocked ? <p>많이 막힌 이유: {run.topBlocked}</p> : null}
        {run?.topDeferred ? <p>자주 밀린 행동: {run.topDeferred}</p> : null}
      </div>

      {Array.isArray(run?.topParticipants) && run.topParticipants.length ? (
        <div className="records-run-participants">
          {run.topParticipants.map((participant) => (
            <span key={`${run.id}-${participant.id || participant.name}`}>
              {participant.name || '익명'} · {formatNumber(participant.kills)}킬 / {formatNumber(participant.assists)}어시
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function RunList({ rows }) {
  if (!rows.length) {
    return (
      <div className="records-empty">
        <strong>최근 실행 기록이 없습니다.</strong>
        <p>시뮬레이션을 끝까지 완료하면 각 판의 요약과 이전 판 대비 변화가 여기에 저장됩니다.</p>
      </div>
    );
  }

  return (
    <div className="records-run-list">
      {rows.map((run, index) => (
        <RunCard run={run} previous={rows[index + 1]} key={run.id || `${run.playedAt}-${index}`} />
      ))}
    </div>
  );
}

export default function RecordsPage() {
  const { showToast } = useToast();
  const [payload, setPayload] = useState(() => normalizeRecordsPayload(null));
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('characters');
  const [sortKey, setSortKey] = useState('wins');
  const [runSortKey, setRunSortKey] = useState('latest');
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
          setError(err?.message || '기록소를 불러오지 못했습니다.');
          showToast({ tone: 'warning', message: err?.message || '기록소를 불러오지 못했습니다.' });
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
    if (view === 'runs') return [];
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
    return sortRecordRows(rows, sortKey, view);
  }, [activeRows, query, sortKey, view]);

  const filteredRuns = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = !needle
      ? payload.runs
      : payload.runs.filter((run) => [
        run?.winnerName,
        run?.winnerTeamName,
        run?.matchMode,
        run?.topBlocked,
        run?.topDeferred,
        run?.topObjectiveMoves,
        ...(Array.isArray(run?.winnerTeamMembers) ? run.winnerTeamMembers : []),
        ...(Array.isArray(run?.topParticipants) ? run.topParticipants.map((p) => p?.name) : []),
      ].join(' ').toLowerCase().includes(needle));
    return sortRuns(rows, runSortKey);
  }, [payload.runs, query, runSortKey]);

  const totals = view === 'teams'
    ? payload.totals?.teams
    : view === 'runs'
      ? payload.totals?.runs
      : payload.totals?.characters;
  const totalRows = view === 'teams' ? payload.teams.length : view === 'runs' ? payload.runs.length : payload.characters.length;
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
            <h1>캐릭터, 팀, 실행 기록</h1>
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
          <button type="button" className={view === 'runs' ? 'active' : ''} onClick={() => setView('runs')}>
            최근 실행
          </button>
        </div>

        <section className="records-stats" aria-label="전적 요약">
          {view === 'runs' ? (
            <>
              <StatCard label="저장된 실행" value={`${formatNumber(totalRows)}개`} />
              <StatCard label="총 킬" value={`${formatNumber(totals?.totalKills)}킬`} />
              <StatCard label="부활 / 사망" value={`${formatNumber(totals?.totalRevives)} / ${formatNumber(totals?.totalDeaths)}`} />
              <StatCard label="드론 / 키오스크" value={`${formatNumber(totals?.droneCalls)} / ${formatNumber(totals?.kioskGains)}`} />
            </>
          ) : (
            <>
              <StatCard label={view === 'teams' ? '기록 팀' : '기록 캐릭터'} value={`${formatNumber(totalRows)}개`} />
              <StatCard label="참가" value={`${formatNumber(totals?.gamesPlayed)}회`} />
              <StatCard label="승리" value={`${formatNumber(totals?.totalWins)}회`} hint={`승률 ${formatRate(winRate)}`} />
              <StatCard label="킬 / 어시스트" value={`${formatNumber(totals?.totalKills)} / ${formatNumber(totals?.totalAssists)}`} />
            </>
          )}
        </section>

        <section className="records-panel">
          <div className="records-toolbar">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={view === 'teams' ? '팀명 또는 멤버 검색' : view === 'runs' ? '우승팀, 참가자, 막힌 이유 검색' : '캐릭터명 또는 무기 검색'}
            />
            <select value={view === 'runs' ? runSortKey : sortKey} onChange={(event) => (view === 'runs' ? setRunSortKey(event.target.value) : setSortKey(event.target.value))}>
              {(view === 'runs' ? RUN_SORT_OPTIONS : RECORD_SORT_OPTIONS).map((option) => (
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
          ) : view === 'runs' ? (
            <RunList rows={filteredRuns} />
          ) : (
            <RecordsTable rows={filteredRows} view={view} />
          )}
        </section>
      </section>
    </main>
  );
}
