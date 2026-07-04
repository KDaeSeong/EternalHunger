'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/', label: '메인 화면' },
  { href: '/admin', label: '대시보드' },
  { href: '/admin/users', label: '유저 관리' },
  { href: '/admin/audit', label: '데이터 검사' },
  { href: '/admin/items', label: '아이템' },
  { href: '/admin/import', label: '데이터 가져오기' },
  { href: '/admin/maps', label: '맵 구역' },
  { href: '/admin/kiosks', label: '키오스크' },
  { href: '/admin/drone', label: '전송 드론' },
  { href: '/admin/crates', label: '상자' },
  { href: '/admin/credits', label: '크레딧' },
  { href: '/admin/perks', label: '특전' },
  { href: '/admin/reports', label: '신고 관리' },
  { href: '/board', label: '게시판' },
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
    letterSpacing: '0',
  };

  const linkActive = {
    background: '#2563eb',
    color: '#ffffff',
  };

  return (
    <nav className="admin-nav" style={navStyle}>
      {items.map((it) => {
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
