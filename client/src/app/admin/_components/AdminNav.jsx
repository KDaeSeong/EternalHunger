'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/admin', label: '대시보드' },
  { href: '/admin/items', label: '아이템' },
  { href: '/admin/maps', label: '맵/구역' },
  { href: '/admin/kiosks', label: '키오스크' },
  { href: '/admin/drone', label: '전송 드론' },
  { href: '/admin/credits', label: '크레딧' },
  { href: '/admin/perks', label: '특전' },
  { href: '/board', label: '게시판(유저)' },
  { href: '/events', label: '이벤트(유저)' },
];

export default function AdminNav() {
  const pathname = usePathname();

  const navStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  };

  const linkBase = {
    display: 'block',
    padding: '10px 12px',
    borderRadius: 10,
    textDecoration: 'none',
    color: '#e5e7eb',
    fontWeight: 700,
    letterSpacing: '-0.2px',
  };

  const linkActive = {
    background: '#2563eb',
    color: '#ffffff',
  };

  return (
    <nav className="admin-nav" style={navStyle}>
      {items.map((it) => {
        // '/admin'은 모든 '/admin/*'의 prefix라서, 여기만 예외로 "정확히 일치"일 때만 활성 처리
        const active =
          it.href === '/admin'
            ? pathname === '/admin'
            : pathname === it.href || pathname.startsWith(`${it.href}/`);

        return (
          <Link
            key={it.href}
            href={it.href}
            className={active ? 'active' : ''}
            style={active ? { ...linkBase, ...linkActive } : linkBase}
            aria-current={active ? 'page' : undefined}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
