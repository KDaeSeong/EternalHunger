'use client';

import SimulationMinimapCanvas from './SimulationMinimapCanvas';
import SimulationMinimapHyperloopControl from './SimulationMinimapHyperloopControl';

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function pickHotZone(actors, getZoneName) {
  const counts = new Map();
  safeArray(actors).forEach((actor) => {
    const zoneId = String(actor?.zoneId || '').trim();
    if (!zoneId) return;
    counts.set(zoneId, (counts.get(zoneId) || 0) + 1);
  });
  const [zoneId, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || [];
  if (!zoneId || !count) return '교전 후보 없음';
  return `${getZoneName?.(zoneId) || zoneId} ${count}명`;
}

export default function SimulationMinimapPanel({
  activeMapId,
  closeUiModal,
  day,
  dead,
  doHyperloopJump,
  forbiddenNow,
  getTeamStateForActor,
  getZoneName,
  hyperloopCharId,
  hyperloopDestId,
  hyperloopDestIds,
  hyperloopPadName,
  hyperloopPadZoneId,
  hyperloopZoneSet,
  isAdvancing,
  isGameOver,
  isSelectedCharOnHyperloopPad,
  loading,
  maps,
  recentMoveTrails,
  recentPings,
  selectedCharId,
  setHyperloopDestId,
  survivors,
  uiModal,
  zones,
  zoneEdges,
  zonePos,
}) {
  const aliveCount = safeArray(survivors).length;
  const deadCount = safeArray(dead).length;
  const forbiddenCount = safeArray(forbiddenNow).length;
  const hyperloopCount = hyperloopZoneSet instanceof Set ? hyperloopZoneSet.size : safeArray(hyperloopZoneSet).length;
  const hotZoneText = pickHotZone(survivors, getZoneName);

  return (
    <div className={`minimap-panel battlefield-panel ${uiModal === 'map' ? 'modal-open' : ''}`}>
      {uiModal === 'map' ? (
        <button className="eh-modal-close" onClick={closeUiModal} aria-label="닫기">×</button>
      ) : null}

      <div className="minimap-status-row" aria-label="미니맵 상태 요약">
        <span><b>{aliveCount}</b> 생존</span>
        <span><b>{deadCount}</b> 사망</span>
        <span><b>{forbiddenCount}</b> 금지</span>
        <span><b>{hyperloopCount}</b> 하이퍼루프</span>
        <span><b>{hotZoneText}</b></span>
      </div>

      <SimulationMinimapCanvas
        activeMapId={activeMapId}
        dead={dead}
        forbiddenNow={forbiddenNow}
        getTeamStateForActor={getTeamStateForActor}
        getZoneName={getZoneName}
        hyperloopCharId={hyperloopCharId}
        hyperloopZoneSet={hyperloopZoneSet}
        recentMoveTrails={recentMoveTrails}
        recentPings={recentPings}
        survivors={survivors}
        zones={zones}
        zoneEdges={zoneEdges}
        zonePos={zonePos}
      />

      <div className="minimap-legend">
        <span className="minimap-dot alive" /> 생존
        <span className="minimap-dot dead" /> 시체
        <span className="minimap-dot forbidden" /> 금지구역
        <span className="minimap-dot hyperloop" /> 하이퍼루프 출발 가능
      </div>

      <SimulationMinimapHyperloopControl
        day={day}
        doHyperloopJump={doHyperloopJump}
        hyperloopDestId={hyperloopDestId}
        hyperloopDestIds={hyperloopDestIds}
        hyperloopPadName={hyperloopPadName}
        hyperloopPadZoneId={hyperloopPadZoneId}
        isAdvancing={isAdvancing}
        isGameOver={isGameOver}
        isSelectedCharOnHyperloopPad={isSelectedCharOnHyperloopPad}
        loading={loading}
        maps={maps}
        selectedCharId={selectedCharId}
        setHyperloopDestId={setHyperloopDestId}
      />
    </div>
  );
}
