'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../../../utils/api';

const STATUS_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'active', label: '정상' },
  { value: 'suspended', label: '정지' },
  { value: 'admin', label: '관리자' },
];

const SUSPEND_OPTIONS = [
  { value: '1', label: '1일' },
  { value: '7', label: '7일' },
  { value: '30', label: '30일' },
  { value: '90', label: '90일' },
];

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function formatNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toLocaleString('ko-KR') : '0';
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR');
}

function displayName(user) {
  return safeText(user?.nickname || user?.username, '이름 없음');
}

function normalizeUser(row) {
  if (!row || typeof row !== 'object') return null;
  const statistics = row.statistics && typeof row.statistics === 'object' ? row.statistics : {};
  return {
    _id: safeText(row._id || row.id, ''),
    username: safeText(row.username, ''),
    nickname: safeText(row.nickname, ''),
    lp: Number(row.lp || 0),
    credits: Number(row.credits || 0),
    statistics: {
      totalGames: Number(statistics.totalGames || 0),
      totalKills: Number(statistics.totalKills || 0),
      totalWins: Number(statistics.totalWins || 0),
    },
    isAdmin: Boolean(row.isAdmin),
    moderationStatus: safeText(row.moderationStatus, 'active'),
    moderationReason: safeText(row.moderationReason, ''),
    suspendedUntil: row.suspendedUntil || null,
    suspensionActive: Boolean(row.suspensionActive),
    createdAt: row.createdAt || null,
  };
}

function userStatusLabel(user) {
  if (user.isAdmin) return '관리자';
  if (user.suspensionActive) return '정지';
  if (user.moderationStatus === 'suspended') return '정지 만료';
  return '정상';
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [summary, setSummary] = useState({ total: 0, admins: 0, suspended: 0 });
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [message, setMessage] = useState('');
  const [daysById, setDaysById] = useState({});
  const [reasonById, setReasonById] = useState({});

  const params = useMemo(() => {
    const next = new URLSearchParams();
    next.set('page', String(page));
    next.set('limit', '50');
    if (query) next.set('q', query);
    if (statusFilter) next.set('status', statusFilter);
    return next.toString();
  }, [page, query, statusFilter]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet(`/admin/users?${params}`, { timeoutMs: 20000 });
      const nextUsers = (Array.isArray(data?.users) ? data.users : []).map(normalizeUser).filter(Boolean);
      setUsers(nextUsers);
      setSummary(data?.summary || { total: 0, admins: 0, suspended: 0 });
      setTotalPages(Math.max(1, Number(data?.totalPages || 1)));
      setDaysById((current) => {
        const next = { ...current };
        nextUsers.forEach((user) => {
          if (next[user._id] === undefined) next[user._id] = '7';
        });
        return next;
      });
      setReasonById((current) => {
        const next = { ...current };
        nextUsers.forEach((user) => {
          if (next[user._id] === undefined) next[user._id] = user.moderationReason || '';
        });
        return next;
      });
      setMessage('');
    } catch (err) {
      setUsers([]);
      setMessage(err?.message || '유저 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const submitSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setQuery(searchInput.trim());
  };

  const suspendUser = async (user) => {
    if (!user?._id) return;
    const reason = safeText(reasonById[user._id], '운영 정책 위반으로 계정이 정지되었습니다.');
    const days = Number(daysById[user._id] || 7);
    const ok = window.confirm(`${displayName(user)} 계정을 ${days}일 정지하시겠습니까?`);
    if (!ok) return;

    setSavingId(user._id);
    try {
      const data = await apiPost(`/admin/users/${user._id}/suspend`, { days, reason }, { timeoutMs: 20000 });
      setMessage(data?.message || '계정을 정지했습니다.');
      await loadUsers();
    } catch (err) {
      setMessage(err?.message || '계정 정지에 실패했습니다.');
    } finally {
      setSavingId('');
    }
  };

  const unsuspendUser = async (user) => {
    if (!user?._id) return;
    const ok = window.confirm(`${displayName(user)} 계정 정지를 해제하시겠습니까?`);
    if (!ok) return;

    setSavingId(user._id);
    try {
      const data = await apiPost(`/admin/users/${user._id}/unsuspend`, {}, { timeoutMs: 20000 });
      setMessage(data?.message || '계정 정지를 해제했습니다.');
      await loadUsers();
    } catch (err) {
      setMessage(err?.message || '계정 정지 해제에 실패했습니다.');
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="admin-users-page">
      <div className="admin-topbar">
        <div>
          <h1>유저 관리</h1>
          <p>가입 유저를 조회하고 운영 제재 상태를 관리합니다.</p>
        </div>
        <button type="button" className="admin-btn" onClick={loadUsers} disabled={loading}>
          새로고침
        </button>
      </div>

      <section className="admin-card admin-user-summary">
        <div><span>전체</span><strong>{formatNumber(summary.total)}</strong></div>
        <div><span>관리자</span><strong>{formatNumber(summary.admins)}</strong></div>
        <div><span>정지</span><strong>{formatNumber(summary.suspended)}</strong></div>
      </section>

      <section className="admin-card admin-user-toolbar">
        <form onSubmit={submitSearch}>
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="아이디 또는 닉네임 검색"
          />
          <button type="submit" className="admin-btn primary">검색</button>
        </form>
        <select
          value={statusFilter}
          onChange={(event) => {
            setPage(1);
            setStatusFilter(event.target.value);
          }}
          aria-label="상태 필터"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </section>

      {message ? <div className="admin-card admin-user-message">{message}</div> : null}

      <section className="admin-card admin-user-table-card">
        {loading ? <div className="admin-muted">유저 목록을 불러오는 중입니다.</div> : null}
        {!loading && users.length === 0 ? <div className="admin-muted">표시할 유저가 없습니다.</div> : null}
        {!loading && users.length > 0 ? (
          <table className="admin-table admin-user-table">
            <thead>
              <tr>
                <th>유저</th>
                <th>상태</th>
                <th>재화</th>
                <th>전적</th>
                <th>제재</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id}>
                  <td>
                    <strong>{displayName(user)}</strong>
                    <div className="admin-muted">@{user.username || '-'}</div>
                    <div className="admin-muted">가입 {formatDate(user.createdAt)}</div>
                  </td>
                  <td>
                    <span className={`admin-user-status is-${user.suspensionActive ? 'suspended' : user.isAdmin ? 'admin' : 'active'}`}>
                      {userStatusLabel(user)}
                    </span>
                    {user.suspendedUntil ? (
                      <div className="admin-muted">해제 예정 {formatDate(user.suspendedUntil)}</div>
                    ) : null}
                  </td>
                  <td>
                    <div>LP {formatNumber(user.lp)}</div>
                    <div>Cr {formatNumber(user.credits)}</div>
                  </td>
                  <td>
                    <div>게임 {formatNumber(user.statistics.totalGames)}</div>
                    <div>승리 {formatNumber(user.statistics.totalWins)} · 킬 {formatNumber(user.statistics.totalKills)}</div>
                  </td>
                  <td>
                    <textarea
                      value={reasonById[user._id] || ''}
                      onChange={(event) => setReasonById({ ...reasonById, [user._id]: event.target.value })}
                      maxLength={500}
                      rows={3}
                      placeholder="정지 사유"
                      disabled={user.isAdmin || savingId === user._id}
                    />
                    {user.moderationReason ? (
                      <div className="admin-muted">현재 사유: {user.moderationReason}</div>
                    ) : null}
                  </td>
                  <td>
                    <div className="admin-btn-row">
                      <select
                        value={daysById[user._id] || '7'}
                        onChange={(event) => setDaysById({ ...daysById, [user._id]: event.target.value })}
                        disabled={user.isAdmin || savingId === user._id}
                      >
                        {SUSPEND_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="admin-btn danger"
                        onClick={() => suspendUser(user)}
                        disabled={user.isAdmin || savingId === user._id}
                      >
                        {savingId === user._id ? '처리 중...' : '정지'}
                      </button>
                      {user.moderationStatus === 'suspended' ? (
                        <button
                          type="button"
                          className="admin-btn"
                          onClick={() => unsuspendUser(user)}
                          disabled={savingId === user._id}
                        >
                          정지 해제
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <div className="admin-btn-row admin-user-pager">
        <button type="button" className="admin-btn" onClick={() => setPage((v) => Math.max(1, v - 1))} disabled={page <= 1 || loading}>
          이전
        </button>
        <span>{page} / {totalPages}</span>
        <button type="button" className="admin-btn" onClick={() => setPage((v) => Math.min(totalPages, v + 1))} disabled={page >= totalPages || loading}>
          다음
        </button>
      </div>
    </div>
  );
}
