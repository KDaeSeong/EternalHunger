'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiGet, clearAuth } from '../utils/api';
import { useAuthUser, useHydrated } from '../utils/client-auth';
import { useToast } from './ToastProvider';

const NAV_ITEMS = [
  { href: '/', label: '메인' },
  { href: '/search', label: '검색' },
  { href: '/characters', label: '캐릭터 설정' },
  { href: '/records', label: '기록소' },
  { href: '/leaderboard', label: '랭킹' },
  { href: '/details', label: '상세 설정' },
  { href: '/modifiers', label: '보정치' },
  { href: '/perks', label: '특전 상점' },
  { href: '/board', label: '게시판' },
  { href: '/twenty-questions', label: '스무고개' },
  { href: '/guides', label: '가이드' },
  { href: '/help', label: '도움말' },
  { href: '/simulation', label: '게임 시작', emphasis: true },
];

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
  const perkCount = Array.isArray(user?.perks) ? user.perks.length : 0;
  const [unreadCount, setUnreadCount] = useState(0);
  const visibleUnreadCount = loggedIn ? unreadCount : 0;

  useEffect(() => {
    let cancelled = false;
    if (!loggedIn) {
      return () => {
        cancelled = true;
      };
    }

    apiGet('/notifications?unread=1&limit=1', { timeoutMs: 8000 })
      .then((data) => {
        if (!cancelled) setUnreadCount(Number(data?.unreadCount || 0));
      })
      .catch(() => {
        if (!cancelled) setUnreadCount(0);
      });

    return () => {
      cancelled = true;
    };
  }, [loggedIn]);

  const handleLogout = () => {
    clearAuth();
    showToast({ tone: 'success', message: '로그아웃되었습니다.' });
    router.refresh();
  };

  return (
    <header className={`site-header ${className}`.trim()}>
      <div className="site-header__inner">
        <Link href="/" className="site-header__logo" aria-label="ETERNAL HUNGER 메인">
          <span>ETERNAL</span>
          <strong>HUNGER</strong>
        </Link>

        <nav className="site-header__nav" aria-label="주요 메뉴">
          {NAV_ITEMS.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);
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
          })}
          {loggedIn && user?.isAdmin ? <Link href="/admin">관리자</Link> : null}
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
