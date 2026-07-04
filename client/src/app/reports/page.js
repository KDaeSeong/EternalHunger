'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import { useToast } from '../../components/ToastProvider';
import { apiGet } from '../../utils/api';
import { useAuthToken, useHydrated } from '../../utils/client-auth';

const EMPTY_REPORTS = {
  reports: [],
  summary: { open: 0, reviewing: 0, resolved: 0, dismissed: 0, total: 0 },
};

const STATUS_TONE = {
  open: '접수',
  reviewing: '검토 중',
  resolved: '처리 완료',
  dismissed: '기각',
};

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePayload(payload) {
  const src = payload && typeof payload === 'object' ? payload : {};
  return {
    reports: normalizeList(src.reports),
    summary: { ...EMPTY_REPORTS.summary, ...(src.summary || {}) },
  };
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
  return date.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function targetTypeLabel(type) {
  if (type === 'user') return '유저';
  return type === 'comment' ? '댓글' : '게시글';
}

export default function ReportsPage() {
  const hydrated = useHydrated();
  const token = useAuthToken();
  const { showToast } = useToast();
  const [payload, setPayload] = useState(() => normalizePayload(null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReports = useCallback(async () => {
    if (!token) {
      setPayload(normalizePayload(null));
      setLoading(false);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await apiGet('/reports/mine', { timeoutMs: 15000 });
      setPayload(normalizePayload(data));
    } catch (err) {
      const message = err?.message || '내 신고 내역을 불러오지 못했습니다.';
      setPayload(normalizePayload(null));
      setError(message);
      showToast({ tone: 'warning', message });
    } finally {
      setLoading(false);
    }
  }, [showToast, token]);

  useEffect(() => {
    if (!hydrated) return;
    void loadReports();
  }, [hydrated, loadReports]);

  const summary = payload.summary || EMPTY_REPORTS.summary;
  const reports = payload.reports || [];

  return (
    <main className="reports-page-shell">
      <SiteHeader />
      <section className="reports-page">
        <section className="reports-hero">
          <div>
            <p className="reports-kicker">Reports</p>
            <h1>내 신고 내역</h1>
            <p>게시글과 댓글 신고 접수 상태, 관리자 처리 결과를 확인합니다.</p>
          </div>
          <div className="reports-hero-actions">
            <button type="button" onClick={() => void loadReports()} disabled={loading || !token}>
              {loading ? '갱신 중' : '새로고침'}
            </button>
            <Link href="/board">게시판</Link>
          </div>
        </section>

        {!hydrated ? (
          <div className="reports-empty">계정 상태를 확인하는 중입니다.</div>
        ) : !token ? (
          <div className="reports-empty reports-login">
            <strong>로그인이 필요합니다.</strong>
            <p>로그인하면 내가 접수한 신고의 처리 상태를 볼 수 있습니다.</p>
            <Link href="/login">로그인</Link>
          </div>
        ) : (
          <>
            <section className="reports-summary" aria-label="신고 요약">
              <div><span>전체</span><strong>{formatNumber(summary.total)}</strong></div>
              <div><span>접수</span><strong>{formatNumber(summary.open)}</strong></div>
              <div><span>검토 중</span><strong>{formatNumber(summary.reviewing)}</strong></div>
              <div><span>처리됨</span><strong>{formatNumber(Number(summary.resolved || 0) + Number(summary.dismissed || 0))}</strong></div>
            </section>

            {error ? (
              <div className="reports-empty reports-error">
                <p>{error}</p>
                <button type="button" onClick={() => void loadReports()}>다시 불러오기</button>
              </div>
            ) : null}

            {loading ? <div className="reports-empty">신고 내역을 불러오는 중입니다.</div> : null}

            {!loading && !error && reports.length === 0 ? (
              <div className="reports-empty">
                <strong>접수한 신고가 없습니다.</strong>
                <p>게시글이나 댓글 상세 화면에서 신고를 접수하면 여기에 표시됩니다.</p>
              </div>
            ) : null}

            {!loading && !error && reports.length ? (
              <section className="reports-list" aria-label="내 신고 목록">
                {reports.map((report) => (
                  <article className="reports-card" key={report._id}>
                    <header>
                      <div>
                        <span className={`reports-status is-${report.status}`}>{report.statusLabel || STATUS_TONE[report.status] || report.status}</span>
                        <strong>{report.reasonLabel || '기타'}</strong>
                        <small>{targetTypeLabel(report.targetType)} · {formatDate(report.createdAt) || '날짜 없음'}</small>
                      </div>
                      <Link href={report.target?.url || '/board'}>대상 열기</Link>
                    </header>

                    <div className="reports-target">
                      <span>{safeText(report.target?.title, '제목 없음')}</span>
                      <p>{safeText(report.target?.excerpt, '내용 없음')}</p>
                    </div>

                    {report.detail ? <p className="reports-detail">신고 내용: {report.detail}</p> : null}
                    {report.adminNote ? <p className="reports-note">관리 메모: {report.adminNote}</p> : null}

                    <dl className="reports-meta">
                      <div><dt>대상 작성자</dt><dd>{safeText(report.target?.authorName, '익명')}</dd></div>
                      <div><dt>대상 상태</dt><dd>{report.target?.postExists ? '존재' : '삭제됨'}</dd></div>
                      <div><dt>처리자</dt><dd>{safeText(report.handledByName, '-')}</dd></div>
                      <div><dt>처리일</dt><dd>{formatDate(report.handledAt) || '-'}</dd></div>
                    </dl>
                  </article>
                ))}
              </section>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
