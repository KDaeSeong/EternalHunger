'use client';

export default function SimulationMarketEventLogCard({
  addLog,
  devEventPreviewLimit,
  runEvents,
  runEventsPreviewText,
  showDevEventLog,
}) {
  const events = Array.isArray(runEvents) ? runEvents : [];

  if (!showDevEventLog) {
    return (
      <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
        <div className="market-title">🧾 이벤트 로그(JSON)</div>
        <div className="market-small">runEvents: <strong>{events.length}</strong>개 · 필요할 때만 위의 이벤트 JSON 버튼을 켜세요.</div>
      </div>
    );
  }

  return (
    <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
      <div className="market-title">🧾 이벤트 로그(JSON)</div>
      <div className="market-small">runEvents: <strong>{events.length}</strong>개 (최근 {devEventPreviewLimit}개만 표시)</div>
      <textarea
        readOnly
        value={runEventsPreviewText}
        style={{ width: '100%', minHeight: 160, marginTop: 8 }}
      />
      <div className="market-actions" style={{ marginTop: 8 }}>
        <button
          onClick={() => {
            try {
              navigator.clipboard?.writeText(JSON.stringify(events, null, 2));
              addLog('✅ 이벤트 로그 복사 완료', 'system');
            } catch {
              addLog('⚠️ 이벤트 로그 복사 실패', 'death');
            }
          }}
          disabled={!events.length}
        >
          전체 복사
        </button>
      </div>
    </div>
  );
}
