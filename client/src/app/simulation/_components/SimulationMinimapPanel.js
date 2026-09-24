'use client';

import { cloneElement, useState } from 'react';
import GameActionIcon from '../../games/_components/GameActionIcon';
import SimulationMinimapCanvas from './SimulationMinimapCanvas';
import SimulationMinimapHyperloopControl from './SimulationMinimapHyperloopControl';
import { buildMinimapTeamLegend } from '../_lib/minimapTeamPresentationRuntime.js';

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

function MinimapView({ children, expanded = false }) {
  const [zoomed, setZoomed] = useState(false);
  return <div className={expanded ? 'minimap-expanded-view' : 'minimap-fitted-view'}>
    <div className="minimap-zoom-controls" role="group" aria-label="지도 배율">
      <button type="button" aria-label="지도 전체 보기" aria-pressed={!zoomed} onClick={() => setZoomed(false)}>전체 지도</button>
      <button type="button" aria-label="지도 2배 확대" aria-pressed={zoomed} onClick={() => setZoomed(true)}>2배 확대</button>
      <span>{zoomed ? '스크롤로 이동 · 표식을 눌러 참가자 확인' : '섬 전체를 화면에 맞춰 표시'}</span>
    </div>
    {cloneElement(children, { expanded, fitViewport: true, zoomed })}
  </div>;
}

export default function SimulationMinimapPanel({
  trackedActorIds,
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
  openMap,
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
  const forbiddenCount = forbiddenNow instanceof Set ? forbiddenNow.size : safeArray(forbiddenNow).length;
  const hyperloopCount = hyperloopZoneSet instanceof Set ? hyperloopZoneSet.size : safeArray(hyperloopZoneSet).length;
  const hotZoneText = pickHotZone(survivors, getZoneName);
  const teamLegend = buildMinimapTeamLegend([...safeArray(survivors), ...safeArray(dead)], trackedActorIds);
  const mapCanvas = <SimulationMinimapCanvas
    trackedActorIds={trackedActorIds}
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
  />;

  return (
    <div className={`minimap-panel battlefield-panel ${uiModal === 'map' ? 'modal-open' : ''}`}>
      {uiModal === 'map' ? (
        <button className="eh-modal-close" type="button" data-game-sfx="click" onClick={closeUiModal} aria-label="닫기" title="닫기">
          <GameActionIcon action="close" label="닫기" />
        </button>
      ) : null}

      <div className="minimap-panel-heading">
        <div><strong>전장 지도</strong><small>팀 색·번호와 HP · 표시를 누르면 지역 참가자 보기</small></div>
        {uiModal !== 'map' ? <button type="button" data-game-sfx="nav" onClick={openMap} disabled={!openMap}>
          <GameActionIcon action="map" label="지도 크게 보기" />
          크게 보기
        </button> : null}
      </div>

      <div className="minimap-status-row" aria-label="미니맵 상태 요약">
        <span><b>{aliveCount}</b><em>생존</em></span>
        <span><b>{deadCount}</b><em>사망</em></span>
        <span><b>{forbiddenCount}</b><em>금지</em></span>
        <span><b>{hyperloopCount}</b><em>하이퍼루프</em></span>
        <span><b>{hotZoneText}</b></span>
      </div>

      {teamLegend.length ? <div className="minimap-team-legend" aria-label="팀 색상 범례">
        {teamLegend.map((team) => <span key={team.teamId} className={team.selected ? 'selected' : ''}>
          <i style={{ '--minimap-team-color': team.color }}>{team.shortLabel}</i>
          <b>{team.teamName}</b>
          <small>{team.aliveCount}명</small>
        </span>)}
      </div> : null}

      <MinimapView key={uiModal === 'map' ? 'expanded' : 'inline'} expanded={uiModal === 'map'}>{mapCanvas}</MinimapView>

      <details className="minimap-help">
      <summary>지도 안내 · 금색 외곽선은 관전 팀</summary>
      <div className="minimap-help-body">
      <div className="minimap-legend">
        <span><i className="minimap-dot dead" /> 시체</span>
        <span><i className="minimap-dot forbidden" /> 금지구역</span>
        <span><i className="minimap-dot hyperloop" /> 하이퍼루프</span>
        <span><i className="minimap-tracked-ring" /> 금색 외곽선은 관전 팀</span>
      </div>
      <p className="minimap-location-note">표시는 해당 지역의 요약 위치입니다. 이동선은 지역 간 이동을 나타내며 실제 골목길·교전 좌표가 아닙니다.</p>
      </div>
      </details>

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
