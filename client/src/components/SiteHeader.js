'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Bell, ChevronDown, Menu, Search, X } from 'lucide-react';
import { apiGet, clearAuth } from '../utils/api';
import { useAuthUser, useHydrated } from '../utils/client-auth';
import { NOTIFICATIONS_SYNC_EVENT, NOTIFICATIONS_SYNC_STORAGE_KEY } from '../utils/notification-events';
import { useToast } from './ToastProvider';
import {
  ACCOUNT_LINKS,
  COMMUNITY_LINKS,
  ETERNAL_HUNGER_LINKS,
  GAME_LINKS,
  PRIMARY_SECTIONS,
  isLinkActive,
  showsEternalHungerSubnav,
} from './siteNavigation';

function formatNumber(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

function getDisplayName(user) {
  return String(user?.nickname || user?.username || '사용자').trim() || '사용자';
}

// Click-outside + Escape handling shared by the dropdowns and the mobile drawer.
function useDisclosure() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return { open, setOpen, close, rootRef, triggerRef };
}

function useUnreadNotifications(loggedIn, userKey, pathname) {
  const [unreadState, setUnreadState] = useState({ userKey: '', count: 0 });

  useEffect(() => {
    let cancelled = false;
    if (!loggedIn || !userKey) return () => { cancelled = true; };

    const setUnreadCount = (value) => {
      const count = Number(value || 0);
      setUnreadState({ userKey, count: Number.isFinite(count) && count > 0 ? Math.floor(count) : 0 });
    };
    const setCountFromDetail = (detail) => {
      const nextCount = Number(detail?.unreadCount);
      if (!Number.isFinite(nextCount) || nextCount < 0) return false;
      setUnreadCount(Math.floor(nextCount));
      return true;
    };
    const refreshUnreadCount = () => {
      apiGet('/notifications?unread=1&limit=1', { timeoutMs: 8000 })
        .then((data) => { if (!cancelled) setUnreadCount(Number(data?.unreadCount || 0)); })
        .catch(() => { if (!cancelled) setUnreadCount(0); });
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

  return userKey && unreadState.userKey === userKey ? unreadState.count : 0;
}

function NavDropdown({ label, links, pathname, active }) {
  const { open, setOpen, close, rootRef, triggerRef } = useDisclosure();
  const menuId = useId();
  return (
    <div className={`sh-dropdown ${open ? 'is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className={`sh-nav-link sh-nav-trigger ${active ? 'is-active' : ''}`}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
        <ChevronDown aria-hidden="true" size={16} strokeWidth={2.2} />
      </button>
      <div className="sh-menu" id={menuId} hidden={!open}>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={isLinkActive(pathname, link) ? 'is-active' : ''}
            aria-current={isLinkActive(pathname, link) ? 'page' : undefined}
            onClick={close}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function AccountMenu({ user, onLogout, pathname }) {
  const { open, setOpen, close, rootRef, triggerRef } = useDisclosure();
  const menuId = useId();
  const perkCount = Array.isArray(user?.perks) ? user.perks.length : 0;
  return (
    <div className={`sh-dropdown sh-account ${open ? 'is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className="sh-account-trigger"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="sh-account-name">{getDisplayName(user)}</span>
        <span className="sh-account-lp">{formatNumber(user?.lp)} LP</span>
        <ChevronDown aria-hidden="true" size={16} strokeWidth={2.2} />
      </button>
      <div className="sh-menu sh-menu--end" id={menuId} hidden={!open}>
        <dl className="sh-wallet">
          <div><dt>LP</dt><dd>{formatNumber(user?.lp)}</dd></div>
          <div><dt>크레딧</dt><dd>{formatNumber(user?.credits)}</dd></div>
          <div><dt>특전</dt><dd>{formatNumber(perkCount)}개</dd></div>
        </dl>
        {ACCOUNT_LINKS.map((link) => (
          <Link key={link.href} href={link.href} onClick={close} aria-current={isLinkActive(pathname, link) ? 'page' : undefined}>
            {link.label}
          </Link>
        ))}
        {user?.isAdmin ? <Link href="/admin" onClick={close}>관리자</Link> : null}
        <button type="button" className="sh-menu-logout" onClick={() => { close(); onLogout(); }}>
          로그아웃
        </button>
      </div>
    </div>
  );
}

function MobileDrawer({ id, open, onClose, pathname, user, loggedIn, hydrated, onLogout }) {
  if (!open) return null;
  const groups = [
    { title: '이터널 헝거', links: ETERNAL_HUNGER_LINKS },
    { title: '게임', links: GAME_LINKS },
    { title: '커뮤니티', links: COMMUNITY_LINKS },
  ];
  const linkProps = (link) => ({
    href: link.href,
    onClick: onClose,
    className: isLinkActive(pathname, link) ? 'is-active' : '',
    'aria-current': isLinkActive(pathname, link) ? 'page' : undefined,
  });
  return (
    <div className="sh-drawer" id={id}>
      <div className="sh-drawer-top">
        <Link {...linkProps({ href: '/', label: '홈', exact: true })}>홈</Link>
        <Link {...linkProps({ href: '/leaderboard', label: '랭킹' })}>랭킹</Link>
        <Link {...linkProps({ href: '/search', label: '검색' })}>검색</Link>
      </div>
      {groups.map((group) => (
        <section key={group.title} className="sh-drawer-group" aria-label={group.title}>
          <h2>{group.title}</h2>
          <div>
            {group.links.map((link) => <Link key={link.href} {...linkProps(link)}>{link.label}</Link>)}
          </div>
        </section>
      ))}
      <section className="sh-drawer-group sh-drawer-account" aria-label="계정">
        {!hydrated ? null : loggedIn ? (
          <>
            <h2>{getDisplayName(user)} <span>{formatNumber(user?.lp)} LP · 크레딧 {formatNumber(user?.credits)}</span></h2>
            <div>
              {ACCOUNT_LINKS.map((link) => <Link key={link.href} {...linkProps(link)}>{link.label}</Link>)}
              {user?.isAdmin ? <Link href="/admin" onClick={onClose}>관리자</Link> : null}
              <button type="button" className="sh-menu-logout" onClick={() => { onClose(); onLogout(); }}>로그아웃</button>
            </div>
          </>
        ) : (
          <div className="sh-drawer-auth">
            <Link href="/login" onClick={onClose} className="sh-button sh-button--quiet">로그인</Link>
            <Link href="/signup" onClick={onClose} className="sh-button sh-button--primary">회원가입</Link>
          </div>
        )}
      </section>
    </div>
  );
}

function EternalHungerSubnav({ pathname }) {
  const linksRef = useRef(null);

  // On narrow screens the links scroll sideways; keep the current page's link in view.
  useEffect(() => {
    const container = linksRef.current;
    const active = container?.querySelector('a.is-active');
    if (!container || !active || container.scrollWidth <= container.clientWidth) return;
    const left = active.offsetLeft - (container.clientWidth - active.offsetWidth) / 2;
    container.scrollLeft = Math.max(0, left);
  }, [pathname]);

  return (
    <nav className="eh-subnav" aria-label="이터널 헝거 메뉴">
      <div className="eh-subnav__inner">
        <span className="eh-subnav__title">이터널 헝거</span>
        <div className="eh-subnav__links" ref={linksRef}>
          {ETERNAL_HUNGER_LINKS.map((link) => {
            const active = isLinkActive(pathname, link);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`${active ? 'is-active' : ''} ${link.href === '/eternalhunger' ? 'is-play' : ''}`.trim()}
                aria-current={active ? 'page' : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export default function SiteHeader({ className = '' }) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const hydrated = useHydrated();
  const user = useAuthUser();
  const { showToast } = useToast();
  const {
    open: drawerOpen,
    setOpen: setDrawerOpen,
    close: closeDrawer,
    rootRef: drawerRootRef,
    triggerRef: drawerTriggerRef,
  } = useDisclosure();
  const drawerId = useId();

  const loggedIn = hydrated && Boolean(user);
  const userKey = loggedIn ? String(user?._id || user?.id || user?.userId || user?.username || '') : '';
  const unreadCount = useUnreadNotifications(loggedIn, userKey, pathname);
  const withSubnav = showsEternalHungerSubnav(pathname);

  const handleLogout = () => {
    clearAuth();
    showToast({ tone: 'success', message: '로그아웃했습니다.' });
    router.refresh();
  };

  return (
    <>
      <header className={`site-header ${withSubnav ? 'site-header--with-subnav' : ''} ${className}`.trim()}>
        <div className="site-header__inner sh-bar" ref={drawerRootRef}>
          <Link href="/" className="sh-logo" aria-label="케이의 게임개발소 홈">
            <span className="sh-logo-owner">케이의</span>
            <span className="sh-logo-name">게임개발소</span>
          </Link>

          <nav className="sh-nav" aria-label="주요 메뉴">
            {PRIMARY_SECTIONS.map((section) => {
              const active = section.isActive(pathname);
              if (section.links) {
                return <NavDropdown key={section.key} label={section.label} links={section.links} pathname={pathname} active={active} />;
              }
              return (
                <Link
                  key={section.key}
                  href={section.href}
                  className={`sh-nav-link ${active ? 'is-active' : ''}`}
                  aria-current={pathname === section.href ? 'page' : undefined}
                >
                  {section.label}
                </Link>
              );
            })}
          </nav>

          <div className="sh-actions">
            <Link href="/search" className="sh-icon-button" aria-label="검색" title="검색">
              <Search aria-hidden="true" size={19} strokeWidth={2.1} />
            </Link>
            {!hydrated ? (
              <span className="sh-auth-placeholder" aria-hidden="true" />
            ) : loggedIn ? (
              <>
                <Link
                  href="/notifications"
                  className={`sh-icon-button ${unreadCount > 0 ? 'has-unread' : ''}`}
                  aria-label={unreadCount > 0 ? `알림 ${unreadCount}개 안 읽음` : '알림'}
                  title="알림"
                >
                  <Bell aria-hidden="true" size={19} strokeWidth={2.1} />
                  {unreadCount > 0 ? <span className="sh-badge">{unreadCount > 99 ? '99+' : unreadCount}</span> : null}
                </Link>
                <AccountMenu user={user} onLogout={handleLogout} pathname={pathname} />
              </>
            ) : (
              <div className="sh-auth-links">
                <Link href="/login" className="sh-button sh-button--quiet">로그인</Link>
                <Link href="/signup" className="sh-button sh-button--primary">회원가입</Link>
              </div>
            )}
            <button
              type="button"
              ref={drawerTriggerRef}
              className="sh-icon-button sh-menu-toggle"
              aria-expanded={drawerOpen}
              aria-controls={drawerId}
              aria-label={drawerOpen ? '메뉴 닫기' : '메뉴 열기'}
              onClick={() => setDrawerOpen((value) => !value)}
            >
              {drawerOpen ? <X aria-hidden="true" size={21} /> : <Menu aria-hidden="true" size={21} />}
            </button>
          </div>

          <MobileDrawer
            id={drawerId}
            open={drawerOpen}
            onClose={closeDrawer}
            pathname={pathname}
            user={user}
            loggedIn={loggedIn}
            hydrated={hydrated}
            onLogout={handleLogout}
          />
        </div>
      </header>
      {withSubnav ? <EternalHungerSubnav pathname={pathname} /> : null}
    </>
  );
}
