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

  return (
    <nav className="admin-nav">
      {items.map((it) => {
        const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
        return (
          <Link key={it.href} href={it.href} className={active ? 'active' : ''}>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
