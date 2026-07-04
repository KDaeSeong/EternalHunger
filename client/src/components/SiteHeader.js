'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiGet, clearAuth } from '../utils/api';
import { useAuthUser, useHydrated } from '../utils/client-auth';
import { NOTIFICATIONS_SYNC_EVENT, NOTIFICATIONS_SYNC_STORAGE_KEY } from '../utils/notification-events';
import { useToast } from './ToastProvider';

const PRIMARY_NAV_ITEMS = [
  { href: '/', label: '메인' },
  { href: '/search', label: '검색' },
  { href: '/characters', label: '캐릭터 설정' },
  { href: '/records', label: '기록소' },
  { href: '/leaderboard', label: '랭킹' },
  { href: '/board', label: '게시판' },
  { href: '/twenty-questions', label: '스무고개' },
  { href: '/simulation', label: '게임 시작', emphasis: true },
];

const MORE_NAV_ITEMS = [
  { href: '/games', label: '게임 허브' },
  { href: '/games/rooms', label: '게임방' },
  { href: '/achievements', label: '업적' },
  { href: '/balance', label: '밸런스 분석' },
  { href: '/activity', label: '활동 피드' },
  { href: '/details', label: '상세 설정' },
  { href: '/modifiers', label: '보정치' },
  { href: '/perks', label: '특전 상점' },
  { href: '/bookmarks', label: '저장글' },
  { href: '/guides', label: '가이드' },
  { href: '/help', label: '도움말' },
];

function isNavActive(pathname, href) {
  return href === '/' ? pathname === '/' : pathname?.startsWith(href);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

function getDisplayName(user) {
  return String(user?.nickname || user?.username || '사용자').trim() || '사용자';
}

export default function SiteHeader({ className = '' }) {
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useHydrated();
  const user = useAuthUser();
  const { showToast } = useToast();

  const loggedIn = hydrated && Boolean(user);
  const userKey = loggedIn ? String(user?._id || user?.id || user?.userId || user?.username || '') : '';
  const perkCount = Array.isArray(user?.perks) ? user.perks.length : 0;
  const [unreadState, setUnreadState] = useState({ userKey: '', count: 0 });
  const visibleUnreadCount = userKey && unreadState.userKey === userKey ? unreadState.count : 0;
  const adminActive = Boolean(loggedIn && user?.isAdmin && pathname?.startsWith('/admin'));
  const moreActive = adminActive || MORE_NAV_ITEMS.some((item) => isNavActive(pathname, item.href));

  useEffect(() => {
    let cancelled = false;
    if (!loggedIn || !userKey) {
      return () => {
        cancelled = true;
      };
    }

    const setUnreadCount = (value) => {
      const count = Number(value || 0);
      setUnreadState({
        userKey,
        count: Number.isFinite(count) && count > 0 ? Math.floor(count) : 0,
      });
    };

    const setCountFromDetail = (detail) => {
      const nextCount = Number(detail?.unreadCount);
      if (Number.isFinite(nextCount) && nextCount >= 0) {
        setUnreadCount(Math.floor(nextCount));
        return true;
      }
      return false;
    };

    const refreshUnreadCount = () => {
      apiGet('/notifications?unread=1&limit=1', { timeoutMs: 8000 })
        .then((data) => {
          if (!cancelled) setUnreadCount(Number(data?.unreadCount || 0));
        })
        .catch(() => {
          if (!cancelled) setUnreadCount(0);
        });
    };

    const handleSync = (event) => {
      if (cancelled || setCountFromDetail(event?.detail)) return;
      refreshUnreadCount();
    };

    const handleStorage = (event) => {
      if (cancelled || event.key !== NOTIFICATIONS_SYNC_STORAGE_KEY) return;
      try {
        if (!setCountFromDetail(JSON.parse(event.newValue || '{}'))) refreshUnreadCount();
      } catch {
        refreshUnreadCount();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshUnreadCount();
    };

    refreshUnreadCount();
    const intervalId = window.setInterval(refreshUnreadCount, 60000);
    window.addEventListener(NOTIFICATIONS_SYNC_EVENT, handleSync);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', refreshUnreadCount);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener(NOTIFICATIONS_SYNC_EVENT, handleSync);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', refreshUnreadCount);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loggedIn, pathname, userKey]);

  const handleLogout = () => {
    clearAuth();
    showToast({ tone: 'success', message: '로그아웃되었습니다.' });
    router.refresh();
  };

  const renderNavLink = (item) => {
    const active = isNavActive(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={[
          active ? 'is-active' : '',
          item.emphasis ? 'is-emphasis' : '',
        ].filter(Boolean).join(' ')}
      >
        {item.emphasis ? '▶ ' : ''}
        {item.label}
      </Link>
    );
  };

  return (
    <header className={`site-header ${className}`.trim()}>
      <div className="site-header__inner">
        <Link href="/" className="site-header__logo" aria-label="케이의 게임개발소 메인">
          <span>케이의</span>
          <strong>게임개발소</strong>
        </Link>

        <nav className="site-header__nav" aria-label="주요 메뉴">
          {PRIMARY_NAV_ITEMS.map(renderNavLink)}
          <details className={`site-header__more ${moreActive ? 'is-active' : ''}`}>
            <summary>더보기</summary>
            <div className="site-header__more-menu">
              {MORE_NAV_ITEMS.map(renderNavLink)}
              {loggedIn && user?.isAdmin ? (
                <Link href="/admin" className={adminActive ? 'is-active' : ''}>관리자</Link>
              ) : null}
            </div>
          </details>
        </nav>

        <div className="site-header__auth">
          {!hydrated ? (
            <span className="site-header__auth-skeleton">확인 중</span>
          ) : loggedIn ? (
            <>
              <Link
                href="/notifications"
                className={`site-header__notify ${visibleUnreadCount > 0 ? 'has-unread' : ''}`}
                aria-label={`알림 ${visibleUnreadCount}개`}
              >
                알림
                {visibleUnreadCount > 0 ? <span>{visibleUnreadCount > 99 ? '99+' : visibleUnreadCount}</span> : null}
              </Link>
              <Link href="/account" className="site-header__user" title="계정 설정">
                <strong>{getDisplayName(user)}</strong>
                <small>LP {formatNumber(user.lp)} · Cr {formatNumber(user.credits)} · 특전 {perkCount}</small>
              </Link>
              <button type="button" className="site-header__logout" onClick={handleLogout}>
                로그아웃
              </button>
            </>
          ) : (
            <div className="site-header__auth-links">
              <Link href="/login">로그인</Link>
              <Link href="/signup">회원가입</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
