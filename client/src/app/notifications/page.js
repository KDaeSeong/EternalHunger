'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import { useToast } from '../../components/ToastProvider';
import { apiGet, apiRequest } from '../../utils/api';
import { useAuthToken, useHydrated } from '../../utils/client-auth';

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeId(value) {
  if (!value) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value?._id) return normalizeId(value._id);
  if (value?.id) return normalizeId(value.id);
  if (value?.$oid) return String(value.$oid);
  return '';
}

function normalizeNotification(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    ...row,
    _id: normalizeId(row),
    title: safeText(row.title, '알림'),
    message: safeText(row.message, ''),
    link: safeText(row.link, ''),
    actorName: safeText(row.actorName || row.actor?.nickname || row.actor?.username, ''),
    unread: Boolean(row.unread || !row.readAt),
    createdAt: row.createdAt || '',
  };
}

function unwrapNotifications(payload) {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.notifications)
      ? payload.notifications
      : [];
  return list.map(normalizeNotification).filter(Boolean);
}

export default function NotificationsPage() {
  const hydrated = useHydrated();
  const token = useAuthToken();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');

  const loadNotifications = useCallback(async () => {
    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await apiGet('/notifications?limit=80', { timeoutMs: 12000 });
      setNotifications(unwrapNotifications(data));
      setUnreadCount(Number(data?.unreadCount || 0));
    } catch (err) {
      setNotifications([]);
      setUnreadCount(0);
      showToast({ tone: 'danger', message: err?.message || '알림을 불러오지 못했습니다.' });
    } finally {
      setLoading(false);
    }
  }, [showToast, token]);

  useEffect(() => {
    if (!hydrated) return;
    void loadNotifications();
  }, [hydrated, loadNotifications]);

  const hasUnread = useMemo(
    () => unreadCount > 0 || notifications.some((notification) => notification.unread),
    [notifications, unreadCount]
  );

  const markRead = async (id) => {
    if (!id) return;
    setSaving(id);
    try {
      const data = await apiRequest('PATCH', `/notifications/${id}/read`, {});
      const nextNotification = normalizeNotification(data?.notification);
      setNotifications((current) => current.map((item) => (
        item._id === id ? { ...item, ...(nextNotification || {}), unread: false } : item
      )));
      setUnreadCount((value) => Math.max(0, Number(value || 0) - 1));
    } catch (err) {
      showToast({ tone: 'danger', message: err?.message || '알림 읽음 처리에 실패했습니다.' });
    } finally {
      setSaving('');
    }
  };

  const markAllRead = async () => {
    setSaving('all');
    try {
      await apiRequest('PATCH', '/notifications/read-all', {});
      setNotifications((current) => current.map((item) => ({ ...item, unread: false, readAt: item.readAt || new Date().toISOString() })));
      setUnreadCount(0);
      showToast({ tone: 'success', message: '모든 알림을 읽음 처리했습니다.' });
    } catch (err) {
      showToast({ tone: 'danger', message: err?.message || '알림 읽음 처리에 실패했습니다.' });
    } finally {
      setSaving('');
    }
  };

  return (
    <main className="notifications-page-shell">
      <SiteHeader />
      <section className="notifications-page">
        <div className="notifications-head">
          <div>
            <p className="notifications-kicker">Notifications</p>
            <h1>알림</h1>
          </div>
          {token ? (
            <button type="button" onClick={markAllRead} disabled={!hasUnread || saving === 'all'}>
              {saving === 'all' ? '처리 중...' : '모두 읽음'}
            </button>
          ) : null}
        </div>

        {!hydrated || loading ? (
          <div className="notifications-empty">알림을 확인하는 중입니다.</div>
        ) : !token ? (
          <div className="notifications-empty">
            <p>로그인하면 댓글, 신고 처리, 스무고개 진행 알림을 볼 수 있습니다.</p>
            <Link href="/login">로그인</Link>
          </div>
        ) : notifications.length === 0 ? (
          <div className="notifications-empty">아직 알림이 없습니다.</div>
        ) : (
          <div className="notifications-list">
            {notifications.map((notification) => (
              <article
                className={`notifications-card ${notification.unread ? 'is-unread' : ''}`}
                key={notification._id}
              >
                <div className="notifications-card-main">
                  <div className="notifications-title-row">
                    {notification.unread ? <span className="notifications-dot" aria-label="읽지 않음" /> : null}
                    <strong>{notification.title}</strong>
                  </div>
                  <p>{notification.message}</p>
                  <small>
                    {notification.actorName ? `${notification.actorName} · ` : ''}
                    {formatDate(notification.createdAt)}
                  </small>
                </div>
                <div className="notifications-actions">
                  {notification.link ? (
                    <Link href={notification.link} onClick={() => { if (notification.unread) void markRead(notification._id); }}>
                      이동
                    </Link>
                  ) : null}
                  {notification.unread ? (
                    <button type="button" onClick={() => markRead(notification._id)} disabled={saving === notification._id}>
                      {saving === notification._id ? '처리 중' : '읽음'}
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
