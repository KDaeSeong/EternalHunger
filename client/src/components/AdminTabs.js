'use client';

import Link from 'next/link';

// 관리자 페이지 상단 탭 네비게이션
// current: 현재 활성 탭 키 (예: 'items')
export default function AdminTabs({ current = '' }) {
  const tabs = [
    { key: 'dashboard', href: '/admin', label: '대시보드' },
    { key: 'items', href: '/admin/items', label: '아이템' },
    { key: 'maps', href: '/admin/maps', label: '맵/구역' },
    { key: 'kiosks', href: '/admin/kiosks', label: '키오스크' },
    { key: 'drone', href: '/admin/drone', label: '전송 드론' },
    { key: 'credits', href: '/admin/credits', label: '크레딧' },
    { key: 'perks', href: '/admin/perks', label: '특전' },
  ];

  return (
    <div className="admin-btn-row" style={{ marginTop: 0, marginBottom: 14 }}>
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`admin-btn ${current === t.key ? 'primary' : ''}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
