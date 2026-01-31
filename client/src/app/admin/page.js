export const metadata = {
  title: 'Admin | EternalHunger',
};

export default function AdminDashboardPage() {
  const wrap = {
    maxWidth: 980,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  };

  const grid = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 12,
  };

  const card = {
    display: 'block',
    padding: 14,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.03)',
    textDecoration: 'none',
    color: '#e5e7eb',
  };

  const title = { fontSize: 22, fontWeight: 900, letterSpacing: '-0.4px' };
  const sub = { opacity: 0.8, marginTop: 6, lineHeight: 1.5 };

  const sections = [
    {
      href: '/admin/items',
      name: '아이템',
      desc: '상점/드랍/조합에 쓰일 아이템 데이터 관리',
    },
    {
      href: '/admin/maps',
      name: '맵/구역',
      desc: '구역/금지구역/시간대 조건 등 맵 데이터 관리',
    },
    {
      href: '/events',
      name: '이벤트(유저)',
      desc: '현재 유저 화면(/events)으로 이동',
    },
    {
      href: '/board',
      name: '게시판(유저)',
      desc: '현재 유저 화면(/board)으로 이동',
    },
  ];

  return (
    <div style={wrap}>
      <div>
        <div style={title}>관리자 대시보드</div>
        <div style={sub}>
          여기서부터 관리 기능을 확장해 나가자. (이번 단계는 404 방지용 스텁 페이지)
        </div>
      </div>

      <div style={grid}>
        {sections.map((s) => (
          <a key={s.href} href={s.href} style={card}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{s.name}</div>
            <div style={{ opacity: 0.8, marginTop: 8, lineHeight: 1.45 }}>{s.desc}</div>
          </a>
        ))}
      </div>

      <div
        style={{
          border: '1px dashed rgba(255,255,255,0.18)',
          borderRadius: 14,
          padding: 14,
          opacity: 0.9,
        }}
      >
        <div style={{ fontWeight: 900 }}>다음에 바로 할 것(예정)</div>
        <ul style={{ marginTop: 10, paddingLeft: 18, lineHeight: 1.6 }}>
          <li>아이템 관리자: 리스트/검색/추가/수정/삭제(페이지 내 수정 모드)</li>
          <li>맵 관리자: 맵 선택 + 구역/금지구역 편집 + 조건 프리뷰</li>
          <li>서버 인증 스키마 고정: /api/auth/me 같은 단일 엔드포인트로 통일</li>
        </ul>
      </div>
    </div>
  );
}
