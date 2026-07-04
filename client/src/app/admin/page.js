import Link from 'next/link';
import AdminDataHealthPanel from './_components/AdminDataHealthPanel';

export const metadata = {
  title: 'Admin | EternalHunger',
};

const sections = [
  {
    title: '게임 허브',
    items: [
      {
        href: '/admin/games',
        name: '게임 이식 관리',
        desc: '게임별 이식 단계, 공통 연결 상태, 다음 작업과 운영 바로가기를 확인합니다.',
      },
    ],
  },
  {
    title: '콘텐츠 데이터',
    items: [
      {
        href: '/admin/audit',
        name: '데이터 검수',
        desc: '중복, 참조 끊김, 드론 티어, 캐릭터 목표 장비와 스킬 스크립트를 점검합니다.',
      },
      {
        href: '/admin/items',
        name: '아이템',
        desc: '장비, 재료, 소모품, 조합식과 기본 아이템 트리를 관리합니다.',
      },
      {
        href: '/admin/import',
        name: '이식/임포트',
        desc: 'NGUH JSON과 위키 기반 정리 데이터를 병합하거나 덮어씁니다.',
      },
      {
        href: '/admin/maps',
        name: '맵/구역',
        desc: '루미아 섬 구역, 연결 동선, 키오스크, 자연 코어 스폰 기준을 정리합니다.',
      },
      {
        href: '/admin/kiosks',
        name: '키오스크',
        desc: '구역별 키오스크 판매 목록과 특수 재료 구매 데이터를 관리합니다.',
      },
    ],
  },
  {
    title: '운영 규칙',
    items: [
      {
        href: '/admin/drone',
        name: '전송 드론',
        desc: '드론 주문 가능 품목과 즉시 지급 구매 데이터를 관리합니다.',
      },
      {
        href: '/admin/crates',
        name: '상자(드랍)',
        desc: '음식 상자, 영웅/전설/초월 보급 상자 드랍 테이블을 관리합니다.',
      },
      {
        href: '/admin/credits',
        name: '크레딧',
        desc: '킬, 야생동물, 보스, 상자, 차원의 틈 보상 등 경제 값을 조정합니다.',
      },
      {
        href: '/admin/perks',
        name: '특전',
        desc: 'LP로 구매하는 치장형 보상과 추후 밸런스 외 보너스를 관리합니다.',
      },
      {
        href: '/admin/reports',
        name: '신고 관리',
        desc: '게시글과 댓글 신고를 확인하고 처리 상태와 관리 메모를 남깁니다.',
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
    maxWidth: 1120,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  };

  const title = {
    fontSize: 24,
    fontWeight: 900,
    letterSpacing: 0,
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
        <div style={sub}>
          아이템, 맵, 키오스크, 드론, 특전 등 운영 데이터를 계정별로 관리합니다.
        </div>
      </header>

      <AdminDataHealthPanel />

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
          이 화면은 로그인 토큰과 관리자 권한 확인을 통과한 뒤 표시됩니다. 운영 데이터 변경은 현재
          로그인한 관리자 계정 범위 안에서 처리됩니다.
        </div>
      </div>
    </div>
  );
}
