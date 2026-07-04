'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../../../components/SiteHeader';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet } from '../../../../utils/api';

const EMPTY_DETAIL = {
  run: null,
  participants: [],
  timeline: { source: 'logs', totalEvents: 0, totalLogLines: 0, items: [], groups: [] },
  fullLog: [],
};

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'danger', label: '교전' },
  { key: 'loot', label: '파밍/제작' },
  { key: 'move', label: '이동' },
  { key: 'warning', label: '경고' },
];

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeDetail(payload) {
  const src = payload && typeof payload === 'object' ? payload : {};
  const timeline = src.timeline && typeof src.timeline === 'object' ? src.timeline : {};
  return {
    run: src.run && typeof src.run === 'object' ? src.run : null,
    participants: normalizeList(src.participants),
    timeline: {
      source: timeline.source || 'logs',
      totalEvents: Number(timeline.totalEvents || 0),
      totalLogLines: Number(timeline.totalLogLines || 0),
      items: normalizeList(timeline.items),
      groups: normalizeList(timeline.groups),
    },
    fullLog: normalizeList(src.fullLog),
  };
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function winnerName(run) {
  return run?.winnerTeamName || (Array.isArray(run?.winnerTeamMembers) ? run.winnerTeamMembers.join(' / ') : '') || run?.winnerName || '우승자 없음';
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

function Participants({ rows }) {
  if (!rows.length) return <div className="records-empty">참가자 기록이 없습니다.</div>;
  return (
    <div className="records-participant-list">
      {rows.map((row) => (
        <div className={row.isWinner ? 'winner' : ''} key={`${row.id}-${row.name}`}>
          <strong>{safeText(row.name, '참가자')}</strong>
          <span>{safeText(row.teamName, '팀 미기록')}</span>
          <small>{formatNumber(row.kills)}킬 · {formatNumber(row.assists)}어시 · {row.alive ? '생존' : '탈락'}</small>
        </div>
      ))}
    </div>
  );
}

function TimelineGroup({ group }) {
  const items = normalizeList(group?.items);
  return (
    <section className="records-timeline-group">
      <h2>{safeText(group?.label, '시간 미기록')}</h2>
      <ol className="records-timeline-items">
        {items.map((item) => (
          <li className={`records-timeline-item tone-${item?.tone || 'info'}`} key={item?.id || `${item?.title}-${item?.body}`}>
            <span>{safeText(item?.kind, 'event')}</span>
            <div>
              <strong>{safeText(item?.title, '이벤트')}</strong>
              <p>{safeText(item?.body, '상세 정보 없음')}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function groupFilteredTimeline(groups, filterKey) {
  return normalizeList(groups)
    .map((group) => ({
      ...group,
      items: normalizeList(group?.items).filter((item) => filterKey === 'all' || item?.tone === filterKey),
    }))
    .filter((group) => group.items.length > 0);
}

export default function RunReplayPage() {
  const params = useParams();
  const id = String(params?.id || '');
  const { showToast } = useToast();
  const [payload, setPayload] = useState(() => normalizeDetail(null));
  const [filterKey, setFilterKey] = useState('all');
  const [showRawLog, setShowRawLog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let canceled = false;

    async function loadReplay() {
      if (!id) return;
      setLoading(true);
      setError('');
      try {
        const data = await apiGet(`/records/runs/${id}`, { timeoutMs: 20000 });
        if (!canceled) setPayload(normalizeDetail(data));
      } catch (err) {
        const message = err?.message || '리플레이를 불러오지 못했습니다.';
        if (!canceled) {
          setPayload(normalizeDetail(null));
          setError(message);
          showToast({ tone: 'warning', message });
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    }

    void loadReplay();
    return () => {
      canceled = true;
    };
  }, [id, showToast]);

  const groups = useMemo(() => groupFilteredTimeline(payload.timeline.groups, filterKey), [filterKey, payload.timeline.groups]);
  const run = payload.run || {};
  const sourceLabel = payload.timeline.source === 'events' ? '정밀 이벤트' : '전체 로그';

  return (
    <main className="records-page">
      <SiteHeader />
      <section className="records-container records-run-detail">
        <div className="records-detail-head">
          <div>
            <p>시뮬레이션 리플레이</p>
            <h1>{winnerName(run)}</h1>
            <span>{formatDateTime(run?.playedAt)} · {String(run?.matchMode || '').toLowerCase() === 'solo' ? '솔로' : `스쿼드 · 팀당 ${formatNumber(run?.teamSize || 0)}명`}</span>
          </div>
          <div className="records-detail-actions">
            <Link href="/records">기록소</Link>
            <Link href="/balance">분석실</Link>
            <Link href="/simulation">새 경기</Link>
          </div>
        </div>

        <section className="records-stats" aria-label="실행 요약">
          <StatCard label="킬 / 사망" value={`${formatNumber(run?.totalKills)} / ${formatNumber(run?.totalDeaths)}`} />
          <StatCard label="부활 / 도주" value={`${formatNumber(run?.totalRevives)} / ${formatNumber(run?.totalFlees)}`} />
          <StatCard label="초월 / 전설" value={`${formatNumber(run?.transCount)} / ${formatNumber(run?.legendCount)}`} />
          <StatCard label="타임라인" value={`${formatNumber(groups.reduce((sum, group) => sum + group.items.length, 0))}개`} hint={sourceLabel} />
        </section>

        {loading ? <div className="records-empty"><strong>리플레이를 불러오는 중입니다.</strong></div> : null}
        {error ? (
          <div className="records-empty">
            <strong>{error}</strong>
            <Link href="/records">기록소로 돌아가기</Link>
          </div>
        ) : null}

        {!loading && !error ? (
          <div className="records-detail-grid">
            <aside className="records-detail-card">
              <div className="records-detail-card-head">
                <h2>참가자</h2>
                <span>{formatNumber(payload.participants.length)}명</span>
              </div>
              <Participants rows={payload.participants} />
            </aside>

            <section className="records-timeline-panel">
              <div className="records-timeline-toolbar">
                <div>
                  <h2>타임라인</h2>
                  <p>{sourceLabel} 기준 · 원본 이벤트 {formatNumber(payload.timeline.totalEvents)}개 · 로그 {formatNumber(payload.timeline.totalLogLines)}줄</p>
                </div>
                <div className="records-timeline-filters" role="tablist" aria-label="타임라인 필터">
                  {FILTERS.map((filter) => (
                    <button
                      type="button"
                      key={filter.key}
                      className={filterKey === filter.key ? 'active' : ''}
                      onClick={() => setFilterKey(filter.key)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {groups.length ? (
                <div className="records-timeline-groups">
                  {groups.map((group) => <TimelineGroup group={group} key={group.label} />)}
                </div>
              ) : (
                <div className="records-empty">선택한 필터에 표시할 타임라인이 없습니다.</div>
              )}

              <div className="records-raw-log-toggle">
                <button type="button" onClick={() => setShowRawLog((value) => !value)}>
                  {showRawLog ? '원본 로그 닫기' : '원본 로그 보기'}
                </button>
              </div>
              {showRawLog ? (
                <pre className="records-log-box">{payload.fullLog.join('\n') || '원본 로그가 없습니다.'}</pre>
              ) : null}
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
