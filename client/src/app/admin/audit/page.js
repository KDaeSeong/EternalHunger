'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet } from '../../../utils/api';

const EMPTY_AUDIT = {
  generatedAt: '',
  summary: {
    score: 0,
    totalIssues: 0,
    criticalCount: 0,
    warningCount: 0,
    infoCount: 0,
    counts: { items: 0, characters: 0, maps: 0, kiosks: 0, droneOffers: 0 },
  },
  categories: [],
};

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'critical', label: '심각' },
  { key: 'warning', label: '주의' },
  { key: 'info', label: '참고' },
];

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeAudit(payload) {
  const src = payload && typeof payload === 'object' ? payload : {};
  const summary = src.summary && typeof src.summary === 'object' ? src.summary : {};
  return {
    generatedAt: src.generatedAt || '',
    summary: {
      ...EMPTY_AUDIT.summary,
      ...summary,
      counts: { ...EMPTY_AUDIT.summary.counts, ...(summary.counts || {}) },
    },
    categories: normalizeList(src.categories).map((category) => ({
      ...category,
      issues: normalizeList(category?.issues),
    })),
  };
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

function formatDateTime(value) {
  if (!value) return '아직 실행 전';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '아직 실행 전';
  return date.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function severityLabel(value) {
  if (value === 'critical') return '심각';
  if (value === 'warning') return '주의';
  return '참고';
}

function scoreTone(score) {
  const n = Number(score || 0);
  if (n >= 85) return 'good';
  if (n >= 60) return 'warn';
  return 'bad';
}

function filterCategory(category, filter) {
  const issues = normalizeList(category?.issues).filter((issue) => filter === 'all' || issue?.severity === filter);
  return { ...category, issues };
}

function SummaryCard({ label, value, hint, tone = '' }) {
  return (
    <div className={`admin-audit-summary-card ${tone ? `tone-${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

function IssueItem({ issue }) {
  return (
    <li className={`admin-audit-issue severity-${issue?.severity || 'info'}`}>
      <div className="admin-audit-issue-main">
        <span>{severityLabel(issue?.severity)}</span>
        <div>
          <strong>{issue?.title || '검수 항목'}</strong>
          <p>{issue?.body || '상세 내용이 없습니다.'}</p>
          {normalizeList(issue?.meta).length ? (
            <div className="admin-audit-meta">
              {normalizeList(issue.meta).slice(0, 6).map((row, index) => (
                <em key={`${issue?.id || issue?.title}-${index}`}>{row}</em>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {issue?.href ? <Link href={issue.href}>수정 위치</Link> : null}
    </li>
  );
}

function CategorySection({ category }) {
  return (
    <section className="admin-audit-category">
      <div className="admin-audit-category-head">
        <div>
          <h2>{category?.title || '검수 항목'}</h2>
          <p>{category?.description || '데이터 상태를 확인합니다.'}</p>
        </div>
        <div>
          <span>{formatNumber(category?.issues?.length)}건</span>
          {category?.href ? <Link href={category.href}>관리</Link> : null}
        </div>
      </div>
      {normalizeList(category?.issues).length ? (
        <ul className="admin-audit-issues">
          {category.issues.map((issue, index) => (
            <IssueItem issue={issue} key={issue?.id || `${category?.key}-${index}`} />
          ))}
        </ul>
      ) : (
        <div className="admin-audit-ok">현재 필터에서 표시할 문제가 없습니다.</div>
      )}
    </section>
  );
}

export default function AdminAuditPage() {
  const [payload, setPayload] = useState(() => normalizeAudit(null));
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const data = await apiGet('/admin/audit', { timeoutMs: 30000 });
      setPayload(normalizeAudit(data));
    } catch (err) {
      setPayload(normalizeAudit(null));
      setMessage(err?.message || '데이터 검수 결과를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleCategories = useMemo(() => (
    payload.categories.map((category) => filterCategory(category, filter))
  ), [filter, payload.categories]);
  const visibleIssueCount = visibleCategories.reduce((sum, category) => sum + normalizeList(category.issues).length, 0);
  const counts = payload.summary.counts || EMPTY_AUDIT.summary.counts;

  return (
    <div className="admin-audit-page">
      <div className="admin-topbar">
        <div>
          <h1>데이터 검수 센터</h1>
          <p className="admin-muted">중복, 끊긴 참조, 드론 티어, 캐릭터 목표 장비와 스킬 스크립트를 한 번에 확인합니다.</p>
        </div>
        <div className="admin-btn-row">
          <button className="admin-btn" type="button" onClick={load} disabled={loading}>
            {loading ? '검수 중' : '새로고침'}
          </button>
        </div>
      </div>

      {message ? <div className="admin-card admin-audit-message">{message}</div> : null}

      <section className="admin-audit-hero">
        <div className={`admin-audit-score tone-${scoreTone(payload.summary.score)}`}>
          <span>건강도</span>
          <strong>{formatNumber(payload.summary.score)}</strong>
          <small>마지막 검수 {formatDateTime(payload.generatedAt)}</small>
        </div>
        <div className="admin-audit-summary">
          <SummaryCard label="전체 이슈" value={formatNumber(payload.summary.totalIssues)} hint={`${formatNumber(visibleIssueCount)}건 표시 중`} />
          <SummaryCard label="심각" value={formatNumber(payload.summary.criticalCount)} tone="critical" />
          <SummaryCard label="주의" value={formatNumber(payload.summary.warningCount)} tone="warning" />
          <SummaryCard label="참고" value={formatNumber(payload.summary.infoCount)} tone="info" />
        </div>
      </section>

      <section className="admin-audit-counts" aria-label="검수 대상 수">
        <div><span>아이템</span><strong>{formatNumber(counts.items)}</strong></div>
        <div><span>캐릭터</span><strong>{formatNumber(counts.characters)}</strong></div>
        <div><span>맵</span><strong>{formatNumber(counts.maps)}</strong></div>
        <div><span>키오스크</span><strong>{formatNumber(counts.kiosks)}</strong></div>
        <div><span>드론 제안</span><strong>{formatNumber(counts.droneOffers)}</strong></div>
      </section>

      <div className="admin-audit-toolbar">
        <div className="admin-audit-filters" role="tablist" aria-label="심각도 필터">
          {FILTERS.map((row) => (
            <button
              type="button"
              key={row.key}
              className={filter === row.key ? 'active' : ''}
              onClick={() => setFilter(row.key)}
            >
              {row.label}
            </button>
          ))}
        </div>
        <div className="admin-muted">
          이 화면은 자동 수정하지 않습니다. 각 항목의 수정 위치에서 직접 확인해 주세요.
        </div>
      </div>

      {loading ? <div className="admin-card">데이터를 검수하는 중입니다.</div> : null}

      {!loading ? (
        <div className="admin-audit-categories">
          {visibleCategories.map((category) => (
            <CategorySection category={category} key={category?.key || category?.title} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
