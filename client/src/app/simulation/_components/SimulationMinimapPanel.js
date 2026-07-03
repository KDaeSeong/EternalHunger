'use client';

import SimulationMinimapCanvas from './SimulationMinimapCanvas';
import SimulationMinimapHyperloopControl from './SimulationMinimapHyperloopControl';

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
  recentPings,
  selectedCharId,
  setHyperloopDestId,
  survivors,
  uiModal,
  zones,
  zoneEdges,
  zonePos,
}) {
  return (
    <div className={`minimap-panel battlefield-panel ${uiModal === 'map' ? 'modal-open' : ''}`}>
      {uiModal === 'map' ? (<button className="eh-modal-close" onClick={closeUiModal} aria-label="닫기">✕</button>) : null}

      <SimulationMinimapCanvas
        activeMapId={activeMapId}
        dead={dead}
        forbiddenNow={forbiddenNow}
        getTeamStateForActor={getTeamStateForActor}
        getZoneName={getZoneName}
        hyperloopCharId={hyperloopCharId}
        hyperloopZoneSet={hyperloopZoneSet}
        recentPings={recentPings}
        survivors={survivors}
        zones={zones}
        zoneEdges={zoneEdges}
        zonePos={zonePos}
      />

      <div className="minimap-legend">
        <span className="minimap-dot alive" /> 생존자 · <span className="minimap-dot dead" /> 사망자 · <span className="minimap-dot forbidden" /> 금지구역 · ⭐ 하이퍼루프 대상
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
