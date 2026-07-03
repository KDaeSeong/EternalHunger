'use client';

export default function SimulationMarketDiagnosticsPanel({
  runActionSummary,
  runSupportSummary,
  simulationDiagnostics,
  simulationDiagnosticsLine,
}) {
  return (
    <>
      <div className="market-card sim-diagnostics-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
        <div className="market-title">밸런스 진단</div>
        <div className="market-small">{simulationDiagnosticsLine}</div>
        <div className="sim-diagnostics-grid" style={{ marginTop: 8 }}>
          <div>
            <b>{Number(simulationDiagnostics?.deaths?.byBand?.opening || 0)}</b>
            <span>1일차</span>
          </div>
          <div>
            <b>{Number(simulationDiagnostics?.deaths?.byBand?.mid || 0)}</b>
            <span>중반 사망</span>
          </div>
          <div>
            <b>{Number(simulationDiagnostics?.deaths?.byBand?.end || 0)}</b>
            <span>후반 사망</span>
          </div>
          <div>
            <b>{Number(simulationDiagnostics?.chase?.caught || 0)}</b>
            <span>추격 성공</span>
          </div>
        </div>
        {(Array.isArray(simulationDiagnostics?.recommendations) ? simulationDiagnostics.recommendations : []).slice(0, 3).map((note, idx) => (
          <div key={`sim-diag-note-${idx}`} className="market-small sim-diagnostics-note">
            {note}
          </div>
        ))}
      </div>

      <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
        <div className="market-title">🩹 사용/상태 요약</div>
        <div className="market-small">{runSupportSummary?.line}</div>
        {runSupportSummary?.topItems ? (
          <div className="market-small" style={{ marginTop: 6 }}>top use: {runSupportSummary.topItems}</div>
        ) : null}
        {runSupportSummary?.topEffects ? (
          <div className="market-small" style={{ marginTop: 6 }}>top effects: {runSupportSummary.topEffects}</div>
        ) : null}
      </div>

      <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
        <div className="market-title">⏱️ 행동 큐/추격 요약</div>
        <div className="market-small">{runActionSummary?.line}</div>
        <div className="market-small" style={{ marginTop: 6 }}>{runActionSummary?.chaseLine}</div>
        {runActionSummary?.tuningLine ? (
          <div className="market-small" style={{ marginTop: 6 }}>{runActionSummary.tuningLine}</div>
        ) : null}
        {runActionSummary?.topObjectiveMoves ? (
          <div className="market-small" style={{ marginTop: 6 }}>top objective: {runActionSummary.topObjectiveMoves}</div>
        ) : null}
        {runActionSummary?.topBlocked ? (
          <div className="market-small" style={{ marginTop: 6 }}>top blocked: {runActionSummary.topBlocked}</div>
        ) : null}
        {runActionSummary?.topDeferred ? (
          <div className="market-small" style={{ marginTop: 6 }}>top deferred: {runActionSummary.topDeferred}</div>
        ) : null}
      </div>
    </>
  );
}
