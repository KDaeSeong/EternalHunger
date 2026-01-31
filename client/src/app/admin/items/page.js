export const metadata = {
  title: 'Admin Items | EternalHunger',
};

export default function AdminItemsPage() {
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
      <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.4px' }}>아이템 관리자</div>
      <div style={{ opacity: 0.8, lineHeight: 1.5 }}>
        아직 기능은 비어있고, 일단 404가 안 나도록 페이지부터 잡아둔 상태야.
      </div>

      <div style={box}>
        <div style={{ fontWeight: 900 }}>다음 패치에서 붙일 UI</div>
        <ul style={{ marginTop: 10, paddingLeft: 18, lineHeight: 1.6 }}>
          <li>검색(이름/종류) + 정렬(가격/이름)</li>
          <li>아이템 추가/수정(페이지 내 수정 모드)</li>
          <li>저장 시 서버 API(/api/items)로 반영 (없으면 임시로 localStorage)</li>
        </ul>
      </div>
    </div>
  );
}
