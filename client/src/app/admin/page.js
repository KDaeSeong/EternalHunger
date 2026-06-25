import Link from 'next/link';

export const metadata = {
  title: 'Admin | EternalHunger',
};

const sections = [
  {
    title: '콘텐츠 데이터',
    items: [
      {
        href: '/admin/items',
        name: '아이템',
        desc: '장비, 소모품, 음식, 재료, 드랍/제작용 아이템 데이터를 관리합니다.',
      },
      {
        href: '/admin/import',
        name: '이식/임포트',
        desc: 'NGUH JSON과 외부 정리 데이터를 병합하거나 덮어씁니다.',
      },
      {
        href: '/admin/maps',
        name: '맵/구역',
        desc: '루미아 섬 구역, 파밍 구역, 금지구역 기반 데이터를 관리합니다.',
      },
      {
        href: '/admin/kiosks',
        name: '키오스크',
        desc: '키오스크 판매 품목, 가격, 특수 재료 구매 데이터를 관리합니다.',
      },
    ],
  },
  {
    title: '운영 규칙',
    items: [
      {
        href: '/admin/drone',
        name: '전송 드론',
        desc: '드론 주문 가능 품목과 즉시 지급/구매 데이터를 관리합니다.',
      },
      {
        href: '/admin/crates',
        name: '상자(드랍)',
        desc: '음식 상자, 영웅/전설/초월 보급 상자 드랍 테이블을 관리합니다.',
      },
      {
        href: '/admin/credits',
        name: '크레딧',
        desc: '사냥, 보스, 상자, 킬 보상 등 경제 값을 조정합니다.',
      },
      {
        href: '/admin/perks',
        name: '특전',
        desc: '특성, 전술 보너스, 시뮬레이션용 패시브 효과를 관리합니다.',
      },
    ],
  },
  {
    title: '바로가기',
    items: [
      {
        href: '/',
        name: '메인 화면',
        desc: '유저 메인 화면으로 돌아갑니다.',
      },
      {
        href: '/board',
        name: '게시판(유저)',
        desc: '현재 유저 게시판 화면으로 이동합니다.',
      },
    ],
  },
];

export default function AdminDashboardPage() {
  const wrap = {
    maxWidth: 1040,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  };

  const title = {
    fontSize: 24,
    fontWeight: 900,
    letterSpacing: '-0.2px',
    color: '#f8fafc',
  };

  const sub = {
    color: '#b6c2d6',
    marginTop: 6,
    lineHeight: 1.5,
  };

  const sectionTitle = {
    fontSize: 15,
    fontWeight: 900,
    color: '#dbeafe',
    marginBottom: 10,
  };

  const grid = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
    gap: 10,
  };

  const card = {
    display: 'block',
    minHeight: 94,
    padding: 14,
    borderRadius: 8,
    border: '1px solid rgba(148, 163, 184, 0.20)',
    background: 'rgba(15, 23, 42, 0.72)',
    textDecoration: 'none',
    color: '#e5e7eb',
  };

  const status = {
    border: '1px solid rgba(56, 189, 248, 0.22)',
    borderRadius: 8,
    padding: 14,
    background: 'rgba(8, 47, 73, 0.22)',
    color: '#cbd5e1',
    lineHeight: 1.55,
  };

  return (
    <div style={wrap}>
      <header>
        <div style={title}>관리자 대시보드</div>
        <div style={sub}>현재 구현된 운영 도구를 한곳에서 관리합니다.</div>
      </header>

      {sections.map((section) => (
        <section key={section.title}>
          <div style={sectionTitle}>{section.title}</div>
          <div style={grid}>
            {section.items.map((item) => (
              <Link key={item.href} href={item.href} style={card}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>{item.name}</div>
                <div style={{ color: '#b6c2d6', marginTop: 8, lineHeight: 1.45 }}>{item.desc}</div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <div style={status}>
        <strong style={{ color: '#e0f2fe' }}>관리자 접근 상태</strong>
        <div style={{ marginTop: 6 }}>
          이 화면은 로그인 토큰과 관리자 권한 확인을 통과한 뒤 표시됩니다. 운영 데이터 변경은 각 관리 페이지에서 바로 처리할 수 있습니다.
        </div>
      </div>
    </div>
  );
}
