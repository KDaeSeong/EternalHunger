export const metadata = {
  title: 'Admin Maps | EternalHunger',
};

export default function AdminMapsPage() {
  const wrap = {
    maxWidth: 980,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  };

  const box = {
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: 14,
    background: 'rgba(255,255,255,0.03)',
  };

  return (
    <div style={wrap}>
      <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.4px' }}>맵/구역 관리자</div>
      <div style={{ opacity: 0.8, lineHeight: 1.5 }}>
        일단 페이지 뼈대만 만들어서 /admin/maps 진입이 되게 해뒀어.
      </div>

      <div style={box}>
        <div style={{ fontWeight: 900 }}>다음 패치에서 붙일 UI</div>
        <ul style={{ marginTop: 10, paddingLeft: 18, lineHeight: 1.6 }}>
          <li>맵 선택 드롭다운(activeMapId)</li>
          <li>구역/금지구역 편집 + 조건(시간대/맵) 프리뷰</li>
          <li>이벤트 필터링 결과 미리보기(몇 건 매칭되는지)</li>
        </ul>
      </div>
    </div>
  );
}
