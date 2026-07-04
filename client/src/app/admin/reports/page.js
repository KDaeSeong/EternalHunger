'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet, apiRequest } from '../../../utils/api';

const STATUS_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'open', label: '접수' },
  { value: 'reviewing', label: '검토 중' },
  { value: 'resolved', label: '처리 완료' },
  { value: 'dismissed', label: '기각' },
];

const NEXT_STATUS = [
  { value: 'reviewing', label: '검토 중' },
  { value: 'resolved', label: '처리 완료' },
  { value: 'dismissed', label: '기각' },
];

const SUSPEND_OPTIONS = [
  { value: '1', label: '1일 정지' },
  { value: '7', label: '7일 정지' },
  { value: '30', label: '30일 정지' },
];

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR');
}

function normalizeReport(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    ...row,
    _id: safeText(row._id || row.id, ''),
    status: safeText(row.status, 'open'),
    statusLabel: safeText(row.statusLabel, '접수'),
    reasonLabel: safeText(row.reasonLabel, '기타'),
    reporterName: safeText(row.reporterName || row.reporter?.nickname || row.reporter?.username, '익명'),
    targetUserId: safeText(row.targetUserId, ''),
    target: row.target && typeof row.target === 'object' ? row.target : {},
  };
}

function unwrapReports(payload) {
  const list = Array.isArray(payload?.reports) ? payload.reports : [];
  return list.map(normalizeReport).filter(Boolean);
}

function targetTypeLabel(type) {
  if (type === 'user') return '유저';
  return type === 'comment' ? '댓글' : '게시글';
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState([]);
  const [summary, setSummary] = useState({ open: 0, reviewing: 0, resolved: 0, dismissed: 0 });
  const [statusFilter, setStatusFilter] = useState('open');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [notes, setNotes] = useState({});
  const [suspendDays, setSuspendDays] = useState({});
  const [savingId, setSavingId] = useState('');

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const suffix = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
      const data = await apiGet(`/reports${suffix}`, { timeoutMs: 20000 });
      const nextReports = unwrapReports(data);
      setReports(nextReports);
      setSummary(data?.summary || { open: 0, reviewing: 0, resolved: 0, dismissed: 0 });
      setNotes((current) => {
        const next = { ...current };
        nextReports.forEach((report) => {
          if (next[report._id] === undefined) next[report._id] = report.adminNote || '';
        });
        return next;
      });
      setSuspendDays((current) => {
        const next = { ...current };
        nextReports.forEach((report) => {
          if (next[report._id] === undefined) next[report._id] = '7';
        });
        return next;
      });
      setMessage('');
    } catch (err) {
      setReports([]);
      setMessage(err?.message || '신고 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const totalActive = useMemo(() => Number(summary.open || 0) + Number(summary.reviewing || 0), [summary]);

  const updateReport = async (reportId, status) => {
    if (!reportId || !status) return;
    setSavingId(reportId);
    try {
      const data = await apiRequest('PATCH', `/reports/${reportId}`, {
        status,
        adminNote: notes[reportId] || '',
      }, { timeoutMs: 20000 });
      setMessage(data?.message || '신고 상태를 저장했습니다.');
      await loadReports();
    } catch (err) {
      setMessage(err?.message || '신고 상태 저장에 실패했습니다.');
    } finally {
      setSavingId('');
    }
  };

  const suspendTarget = async (report) => {
    if (!report?._id) return;
    setSavingId(report._id);
    try {
      const data = await apiRequest('POST', `/reports/${report._id}/suspend-target`, {
        days: Number(suspendDays[report._id] || 7),
        adminNote: notes[report._id] || '',
      }, { timeoutMs: 20000 });
      setMessage(data?.message || '대상 계정을 정지했습니다.');
      await loadReports();
    } catch (err) {
      setMessage(err?.message || '대상 계정 정지에 실패했습니다.');
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="admin-reports-page">
      <div className="admin-topbar">
        <div>
          <h1>신고 관리</h1>
          <p>게시글, 댓글, 유저 신고를 확인하고 처리 상태를 남깁니다.</p>
        </div>
        <Link href="/board" className="admin-btn">게시판</Link>
      </div>

      <section className="admin-card admin-report-summary">
        <div><span>접수</span><strong>{summary.open || 0}</strong></div>
        <div><span>검토 중</span><strong>{summary.reviewing || 0}</strong></div>
        <div><span>활성</span><strong>{totalActive}</strong></div>
        <div><span>완료</span><strong>{Number(summary.resolved || 0) + Number(summary.dismissed || 0)}</strong></div>
      </section>

      <section className="admin-card">
        <div className="admin-report-toolbar">
          <label>
            <span>상태</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <button type="button" className="admin-btn" onClick={loadReports} disabled={loading}>
            새로고침
          </button>
        </div>
      </section>

      {message ? <div className="admin-card admin-report-message">{message}</div> : null}

      <section className="admin-report-list">
        {loading ? <div className="admin-card">신고 목록을 불러오는 중입니다.</div> : null}
        {!loading && reports.length === 0 ? <div className="admin-card">표시할 신고가 없습니다.</div> : null}
        {!loading && reports.map((report) => (
          <article className="admin-card admin-report-item" key={report._id}>
            <header>
              <div>
                <span className={`admin-report-status is-${report.status}`}>{report.statusLabel}</span>
                <strong>{report.reasonLabel}</strong>
                <small>{targetTypeLabel(report.targetType)}</small>
              </div>
              <time>{formatDate(report.createdAt)}</time>
            </header>

            <div className="admin-report-target">
              <div>
                <span>대상</span>
                <strong>{safeText(report.target?.title, '제목 없음')}</strong>
              </div>
              <Link href={report.target?.url || '/board'} className="admin-btn">열기</Link>
            </div>

            <p className="admin-report-excerpt">{safeText(report.target?.excerpt, '내용 없음')}</p>

            <dl className="admin-report-meta">
              <div><dt>신고자</dt><dd>{report.reporterName}</dd></div>
              <div><dt>작성자</dt><dd>{safeText(report.target?.authorName, '익명')}</dd></div>
              <div><dt>대상 상태</dt><dd>{report.target?.postExists ? '존재' : '삭제됨'}</dd></div>
              <div><dt>처리자</dt><dd>{safeText(report.handledByName, '-')}</dd></div>
            </dl>

            {report.detail ? <p className="admin-report-detail">{report.detail}</p> : null}

            <label className="admin-report-note">
              <span>관리 메모</span>
              <textarea
                value={notes[report._id] || ''}
                onChange={(event) => setNotes({ ...notes, [report._id]: event.target.value })}
                rows={3}
                maxLength={1000}
              />
            </label>

            <div className="admin-btn-row">
              {NEXT_STATUS.map((option) => (
                <button
                  type="button"
                  className={`admin-btn ${option.value === 'dismissed' ? 'danger' : option.value === 'resolved' ? 'primary' : ''}`}
                  key={option.value}
                  onClick={() => updateReport(report._id, option.value)}
                  disabled={savingId === report._id}
                >
                  {savingId === report._id ? '저장 중...' : option.label}
                </button>
              ))}
              {(report.targetUserId || report.target?.authorId) && report.status !== 'resolved' ? (
                <>
                  <select
                    value={suspendDays[report._id] || '7'}
                    onChange={(event) => setSuspendDays({ ...suspendDays, [report._id]: event.target.value })}
                    disabled={savingId === report._id}
                  >
                    {SUSPEND_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="admin-btn danger"
                    onClick={() => suspendTarget(report)}
                    disabled={savingId === report._id}
                  >
                    대상 정지
                  </button>
                </>
              ) : null}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
