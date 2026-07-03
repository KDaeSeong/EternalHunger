'use client';

export default function SimulationMarketToolbar({
  exportBattleLog,
  marketCardRenderLimit,
  setShowAllMarketRows,
  setShowDevDebugDetails,
  setShowDevEventLog,
  showAllMarketRows,
  showDevDebugDetails,
  showDevEventLog,
}) {
  return (
    <div className="market-row" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
      <button
        type="button"
        className="market-mini-btn"
        onClick={() => exportBattleLog('md')}
        title="1일차 낮부터 현재까지 누적된 전투 로그를 Markdown 파일로 저장합니다."
      >
        로그 MD
      </button>
      <button
        type="button"
        className="market-mini-btn"
        onClick={() => exportBattleLog('json')}
        title="1일차 낮부터 현재까지 누적된 전투 로그와 runEvents를 JSON 파일로 저장합니다."
      >
        로그 JSON
      </button>
      <button
        type="button"
        className={`market-mini-btn ${showDevEventLog ? 'active' : ''}`}
        onClick={() => setShowDevEventLog((v) => !v)}
        title="큰 JSON 문자열 생성은 필요할 때만 켭니다."
      >
        {showDevEventLog ? '이벤트 JSON 숨김' : '이벤트 JSON'}
      </button>
      <button
        type="button"
        className={`market-mini-btn ${showDevDebugDetails ? 'active' : ''}`}
        onClick={() => setShowDevDebugDetails((v) => !v)}
        title="AI/제작/런 메트릭 상세 카드를 필요할 때만 렌더합니다."
      >
        {showDevDebugDetails ? '상세 디버그 숨김' : '상세 디버그'}
      </button>
      <button
        type="button"
        className={`market-mini-btn ${showAllMarketRows ? 'active' : ''}`}
        onClick={() => setShowAllMarketRows((v) => !v)}
        title={`상점 목록은 기본 ${marketCardRenderLimit}개만 렌더합니다.`}
      >
        {showAllMarketRows ? '목록 빠르게' : `목록 ${marketCardRenderLimit}개`}
      </button>
    </div>
  );
}
