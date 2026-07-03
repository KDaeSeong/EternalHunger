'use client';

export default function SimulationMarketDebugDetailsPanel({
  runProgressSummary,
  selectedChar,
  selectedCharId,
  showDevDebugDetails,
}) {
  if (!showDevDebugDetails || !selectedCharId || !selectedChar) return null;

  const craftDebug = selectedChar?._craftDebug || null;
  const aiDebug = selectedChar?._aiDebug || null;
  const runProgress = runProgressSummary || null;

  return (
    <>
      <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
        <div className="market-title">🧪 제작 디버그</div>
        {!craftDebug ? (
          <div className="market-small">아직 제작 판정 로그가 없습니다.</div>
        ) : (
          <>
            <div className="market-small">code: <b>{String(craftDebug?.code || '-')}</b>{craftDebug?.targetName ? ` / target: ${craftDebug.targetName}` : ''}</div>
            <div className="market-small" style={{ marginTop: 6 }}>{String(craftDebug?.text || '')}</div>
            {Array.isArray(craftDebug?.missing) && craftDebug.missing.length > 0 ? (
              <div className="market-small" style={{ marginTop: 6 }}>missing: {craftDebug.missing.slice(0, 5).join(', ')}</div>
            ) : null}
          </>
        )}
      </div>

      <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
        <div className="market-title">🤖 AI 디버그</div>
        {!aiDebug ? (
          <div className="market-small">아직 AI 판단 로그가 없습니다.</div>
        ) : (
          <>
            <div className="market-small">action: <b>{String(aiDebug?.action || '-')}</b>{aiDebug?.itemName ? ` / item: ${aiDebug.itemName}` : ''}</div>
            <div className="market-small" style={{ marginTop: 6 }}>zone: {String(aiDebug?.zoneName || '-')} {aiDebug?.targetZoneName ? `→ ${aiDebug.targetZoneName}` : ''}</div>
            <div className="market-small" style={{ marginTop: 6 }}>reason: {String(aiDebug?.reason || '-')}</div>
            {Array.isArray(aiDebug?.queuePreview) && aiDebug.queuePreview.length > 0 ? (
              <div className="market-small" style={{ marginTop: 6 }}>queue: {aiDebug.queuePreview.join(' → ')}</div>
            ) : null}
            {Array.isArray(aiDebug?.candidatePreview) && aiDebug.candidatePreview.length > 0 ? (
              <div className="market-small" style={{ marginTop: 6 }}>candidates: {aiDebug.candidatePreview.join(' > ')}</div>
            ) : null}
            {Array.isArray(aiDebug?.candidateScores) && aiDebug.candidateScores.length > 0 ? (
              <div className="market-small" style={{ marginTop: 6 }}>scores: {aiDebug.candidateScores.join(' | ')}</div>
            ) : null}
            {Array.isArray(aiDebug?.blockedReasons) && aiDebug.blockedReasons.length > 0 ? (
              <div className="market-small" style={{ marginTop: 6 }}>blocked: {aiDebug.blockedReasons.join(', ')}</div>
            ) : null}
            {aiDebug?.goalName ? <div className="market-small" style={{ marginTop: 6 }}>goal: {String(aiDebug.goalName)}</div> : null}
            {Array.isArray(aiDebug?.missingNames) && aiDebug.missingNames.length > 0 ? (
              <div className="market-small" style={{ marginTop: 6 }}>missing: {aiDebug.missingNames.join(', ')}</div>
            ) : null}
            <div className="market-small" style={{ marginTop: 6 }}>
              late: {aiDebug?.wantLegend ? '전설 ' : ''}{aiDebug?.wantTrans ? '초월 ' : ''}{aiDebug?.farmCredits ? '/ 크레딧 파밍' : ''}{!aiDebug?.wantLegend && !aiDebug?.wantTrans && !aiDebug?.farmCredits ? '일반 성장' : ''}
            </div>
            {aiDebug?.fleeReason ? <div className="market-small" style={{ marginTop: 6 }}>flee: {String(aiDebug.fleeReason)}</div> : null}
          </>
        )}
      </div>

      <div className="market-card" style={{ marginTop: 10, borderStyle: 'dashed' }}>
        <div className="market-title">📈 런 메트릭</div>
        {!runProgress ? (
          <div className="market-small">아직 메트릭이 없습니다.</div>
        ) : (
          <>
            <div className="market-small">drone: <b>{Number(runProgress?.droneCalls || 0)}</b> / kiosk: <b>{Number(runProgress?.kioskGains || 0)}</b> / craft: <b>{Number(runProgress?.craftCount || 0)}</b></div>
            <div className="market-small" style={{ marginTop: 6 }}>first legend: {String(runProgress?.firstLegendText || '-')}</div>
            <div className="market-small" style={{ marginTop: 6 }}>first transcend: {String(runProgress?.firstTransText || '-')}</div>
            <div className="market-small" style={{ marginTop: 6 }}>latest legend: {String(runProgress?.latestLegendText || '-')}</div>
            <div className="market-small" style={{ marginTop: 6 }}>latest transcend: {String(runProgress?.latestTransText || '-')}</div>
          </>
        )}
      </div>
    </>
  );
}
