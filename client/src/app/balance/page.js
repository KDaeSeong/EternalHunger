'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import { useToast } from '../../components/ToastProvider';
import { apiGet } from '../../utils/api';

const EMPTY_BALANCE = {
  counts: { characters: 0, playedCharacters: 0, teams: 0, playedTeams: 0, runs: 0 },
  characters: {
    averageScore: 0,
    strongest: [],
    weakest: [],
    groups: { weapons: [], roles: [], traits: [], tacticalSkills: [] },
  },
  teams: { averageScore: 0, strongest: [], weakest: [] },
  runs: {
    totals: {
      gamesAnalyzed: 0,
      participantCount: 0,
      totalKills: 0,
      totalDeaths: 0,
      totalRevives: 0,
      craftCount: 0,
      droneCalls: 0,
      kioskGains: 0,
      avgKills: 0,
      avgRevives: 0,
      avgCrafts: 0,
      avgRunEvents: 0,
      transPerGame: 0,
      legendPerGame: 0,
    },
    bottlenecks: [],
    deferred: [],
    objectives: [],
  },
  recommendations: [],
};

const GROUP_TABS = [
  { key: 'weapons', label: '무기' },
  { key: 'roles', label: '역할' },
  { key: 'traits', label: '특성' },
  { key: 'tacticalSkills', label: '전술' },
];

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePayload(payload) {
  const src = payload && typeof payload === 'object' ? payload : {};
  const characters = src.characters && typeof src.characters === 'object' ? src.characters : {};
  const groups = characters.groups && typeof characters.groups === 'object' ? characters.groups : {};
  const teams = src.teams && typeof src.teams === 'object' ? src.teams : {};
  const runs = src.runs && typeof src.runs === 'object' ? src.runs : {};
  return {
    counts: { ...EMPTY_BALANCE.counts, ...(src.counts || {}) },
    characters: {
      averageScore: Number(characters.averageScore || 0),
      strongest: normalizeList(characters.strongest),
      weakest: normalizeList(characters.weakest),
      groups: {
        weapons: normalizeList(groups.weapons),
        roles: normalizeList(groups.roles),
        traits: normalizeList(groups.traits),
        tacticalSkills: normalizeList(groups.tacticalSkills),
      },
    },
    teams: {
      averageScore: Number(teams.averageScore || 0),
      strongest: normalizeList(teams.strongest),
      weakest: normalizeList(teams.weakest),
    },
    runs: {
      totals: { ...EMPTY_BALANCE.runs.totals, ...(runs.totals || {}) },
      bottlenecks: normalizeList(runs.bottlenecks),
      deferred: normalizeList(runs.deferred),
      objectives: normalizeList(runs.objectives),
    },
    recommendations: normalizeList(src.recommendations),
  };
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

function formatRate(value) {
  return `${Math.round(Number(value || 0) * 1000) / 10}%`;
}

function formatDelta(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n === 0) return '±0';
  return n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1);
}

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function statusLabel(status) {
  if (status === 'strong') return '강세';
  if (status === 'weak') return '약세';
  if (status === 'thin') return '표본 부족';
  if (status === 'empty') return '기록 없음';
  return '정상';
}

function MetricCard({ label, value, hint }) {
  return (
    <div className="balance-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

function RecommendationList({ rows }) {
  return (
    <section className="balance-recommendations" aria-label="밸런스 제안">
      {rows.map((row, index) => (
        <article className={`balance-recommendation tone-${row.tone || 'info'}`} key={`${row.title}-${index}`}>
          <span>{safeText(row.title, '분석 신호')}</span>
          <p>{safeText(row.body, '추가 기록이 필요합니다.')}</p>
        </article>
      ))}
    </section>
  );
}

function EntityList({ title, subtitle, rows, empty, kind = 'character' }) {
  return (
    <section className="balance-panel">
      <div className="balance-panel-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <span>{formatNumber(rows.length)}</span>
      </div>
      {rows.length ? (
        <ol className="balance-entity-list">
          {rows.map((row, index) => (
            <li key={`${kind}-${row.id || row.name || row.teamName}-${index}`}>
              <b>{index + 1}</b>
              <div>
                <strong>{kind === 'team' ? safeText(row.teamName, '팀') : safeText(row.name, '캐릭터')}</strong>
                <small>
                  {kind === 'team'
                    ? normalizeList(row.rosterNames).join(' · ') || '멤버 미기록'
                    : `${safeText(row.weaponType, '무기 미설정')} · ${safeText(row.erTrait, '특성 미설정')}`}
                </small>
              </div>
              <span className={`balance-badge status-${row.status || 'normal'}`}>{statusLabel(row.status)}</span>
              <em>{formatNumber(row.totalWins)}승 · {formatRate(row.winRate)} · {formatDelta(row.scoreDelta)}</em>
            </li>
          ))}
        </ol>
      ) : (
        <div className="balance-empty">{empty}</div>
      )}
    </section>
  );
}

function GroupTable({ rows }) {
  if (!rows.length) return <div className="balance-empty">표시할 분류 기록이 없습니다.</div>;
  return (
    <div className="balance-table-wrap">
      <table className="balance-table">
        <thead>
          <tr>
            <th>분류</th>
            <th>캐릭터</th>
            <th>참가</th>
            <th>승률</th>
            <th>킬/게임</th>
            <th>생존률</th>
            <th>지표</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>{safeText(row.label, '미분류')}</td>
              <td data-label="캐릭터">{formatNumber(row.members)}</td>
              <td data-label="참가">{formatNumber(row.gamesPlayed)}</td>
              <td data-label="승률">{formatRate(row.winRate)}</td>
              <td data-label="킬/게임">{Number(row.killRate || 0).toFixed(2)}</td>
              <td data-label="생존률">{formatRate(row.survivalRate)}</td>
              <td data-label="지표">{Number(row.score || 0).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WeightedList({ title, rows, empty }) {
  return (
    <section className="balance-panel">
      <div className="balance-panel-head">
        <div>
          <h2>{title}</h2>
          <p>최근 실행 기록 기준</p>
        </div>
        <span>{formatNumber(rows.length)}</span>
      </div>
      {rows.length ? (
        <ol className="balance-weighted-list">
          {rows.map((row, index) => (
            <li key={`${title}-${row.label}`}>
              <b>{index + 1}</b>
              <span>{safeText(row.label, '미기록')}</span>
              <strong>{formatNumber(row.count)}회</strong>
            </li>
          ))}
        </ol>
      ) : (
        <div className="balance-empty">{empty}</div>
      )}
    </section>
  );
}

export default function BalancePage() {
  const { showToast } = useToast();
  const [payload, setPayload] = useState(() => normalizePayload(null));
  const [groupKey, setGroupKey] = useState('weapons');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBalance = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGet('/analytics/balance', { timeoutMs: 20000 });
      setPayload(normalizePayload(data));
    } catch (err) {
      const message = err?.message || '밸런스 분석을 불러오지 못했습니다.';
      setPayload(normalizePayload(null));
      setError(message);
      showToast({ tone: 'warning', message });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadBalance();
  }, [loadBalance]);

  const groupRows = payload.characters.groups[groupKey] || [];
  const runTotals = payload.runs.totals || EMPTY_BALANCE.runs.totals;
  const metrics = useMemo(() => [
    { label: '분석 경기', value: formatNumber(runTotals.gamesAnalyzed), hint: `이벤트 평균 ${formatNumber(runTotals.avgRunEvents)}` },
    { label: '기록 캐릭터', value: formatNumber(payload.counts.playedCharacters), hint: `전체 ${formatNumber(payload.counts.characters)}명` },
    { label: '평균 킬', value: formatNumber(runTotals.avgKills), hint: `총 ${formatNumber(runTotals.totalKills)}킬` },
    { label: '초월/전설', value: `${formatNumber(runTotals.transPerGame)} / ${formatNumber(runTotals.legendPerGame)}`, hint: '판당 평균' },
  ], [payload.counts.characters, payload.counts.playedCharacters, runTotals]);

  return (
    <main className="balance-page">
      <SiteHeader />
      <section className="balance-container">
        <section className="balance-hero">
          <div>
            <p>Balance Lab</p>
            <h1>밸런스 분석실</h1>
            <span>캐릭터, 팀, 행동 병목을 기록 기반으로 비교합니다.</span>
          </div>
          <div className="balance-actions">
            <button type="button" onClick={() => void loadBalance()} disabled={loading}>
              {loading ? '갱신 중' : '새로고침'}
            </button>
            <Link href="/records">기록소</Link>
            <Link href="/eternalhunger">시뮬레이션</Link>
          </div>
        </section>

        <section className="balance-metrics" aria-label="분석 요약">
          {metrics.map((item) => (
            <MetricCard key={item.label} label={item.label} value={item.value} hint={item.hint} />
          ))}
        </section>

        {error ? (
          <div className="balance-empty balance-error">
            <strong>{error}</strong>
            <button type="button" onClick={() => void loadBalance()}>다시 불러오기</button>
          </div>
        ) : null}

        {loading ? <div className="balance-empty">밸런스 분석을 불러오는 중입니다.</div> : null}

        {!loading && !error ? (
          <>
            <RecommendationList rows={payload.recommendations.length ? payload.recommendations : EMPTY_BALANCE.recommendations} />

            <section className="balance-grid">
              <EntityList
                title="강세 캐릭터"
                subtitle={`평균 지표 ${Number(payload.characters.averageScore || 0).toFixed(1)}`}
                rows={payload.characters.strongest}
                empty="아직 캐릭터 전적이 없습니다."
              />
              <EntityList
                title="점검 캐릭터"
                subtitle="낮은 지표부터 표시"
                rows={payload.characters.weakest}
                empty="아직 캐릭터 전적이 없습니다."
              />
              <EntityList
                title="강세 팀"
                subtitle={`평균 지표 ${Number(payload.teams.averageScore || 0).toFixed(1)}`}
                rows={payload.teams.strongest}
                empty="아직 팀 전적이 없습니다."
                kind="team"
              />
            </section>

            <section className="balance-panel balance-wide">
              <div className="balance-panel-head">
                <div>
                  <h2>분류별 편차</h2>
                  <p>현재 캐릭터 설정 기준</p>
                </div>
                <div className="balance-segments" role="tablist" aria-label="분류 선택">
                  {GROUP_TABS.map((tab) => (
                    <button
                      type="button"
                      key={tab.key}
                      className={groupKey === tab.key ? 'active' : ''}
                      onClick={() => setGroupKey(tab.key)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
              <GroupTable rows={groupRows} />
            </section>

            <section className="balance-grid">
              <WeightedList title="행동 병목" rows={payload.runs.bottlenecks} empty="아직 병목 데이터가 없습니다." />
              <WeightedList title="밀린 행동" rows={payload.runs.deferred} empty="아직 밀린 행동 데이터가 없습니다." />
              <WeightedList title="목표 이동" rows={payload.runs.objectives} empty="아직 목표 이동 데이터가 없습니다." />
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}
