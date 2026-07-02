'use client';

import { zoneHasKioskFlag } from '../_lib/coreSpawnRuntime';
import { listActiveDimensionRifts } from '../_lib/dimensionRiftRuntime';

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export default function SimulationWorldSpawnToolbar({
  activeMapId,
  day,
  spawnState,
  zones,
}) {
  if (day <= 0) return null;
  const state = spawnState && String(spawnState.mapId || '') === String(activeMapId || '') ? spawnState : null;
  if (!state) return null;

  const unopenedCrates = safeArray(state.legendaryCrates).filter((crate) => crate && !crate.opened).length;
  const unopenedTranscendCrates = safeArray(state.transcendCrates).filter((crate) => crate && !crate.opened).length;
  const activeDimensionRifts = listActiveDimensionRifts(state).length;
  const unpickedCore = safeArray(state.coreNodes).filter((node) => node && !node.picked).length;
  const meteorCnt = safeArray(state.coreNodes).filter((node) => node && !node.picked && String(node.kind) === 'meteor').length;
  const lifeTreeCnt = safeArray(state.coreNodes).filter((node) => node && !node.picked && String(node.kind) === 'life_tree').length;
  const bosses = state.bosses || {};
  const alphaOn = !!bosses?.alpha?.alive;
  const omegaOn = !!bosses?.omega?.alive;
  const weaklineOn = !!bosses?.weakline?.alive;
  const wildlifeMap = state?.wildlife && typeof state.wildlife === 'object' ? state.wildlife : {};
  const eligibleWildZones = safeArray(zones)
    .filter((zone) => zone && zone.zoneId)
    .filter((zone) => !zoneHasKioskFlag(zone))
    .map((zone) => String(zone.zoneId));
  const wildlifeTotal = eligibleWildZones.reduce((sum, zoneId) => sum + Math.max(0, Number(wildlifeMap?.[zoneId] ?? 0)), 0);
  const wildlifeEmpty = eligibleWildZones.reduce((count, zoneId) => count + (Math.max(0, Number(wildlifeMap?.[zoneId] ?? 0)) <= 0 ? 1 : 0), 0);

  if (
    !unopenedCrates
    && !unopenedTranscendCrates
    && !activeDimensionRifts
    && !unpickedCore
    && !alphaOn
    && !omegaOn
    && !weaklineOn
    && wildlifeTotal <= 0
  ) {
    return null;
  }

  return (
    <div className="worldspawn-toolbar">
      <span className="ws-title">🌍 월드스폰</span>
      <span className="ws-chip">🟪 전설상자: <b>{unopenedCrates}</b></span>
      <span className="ws-chip">🎁 초월상자: <b>{unopenedTranscendCrates}</b></span>
      <span className="ws-chip">🌀 차원의 틈: <b>{activeDimensionRifts}</b></span>
      <span className="ws-chip">🌠 오브젝트: 운석 <b>{meteorCnt}</b> / 생나 <b>{lifeTreeCnt}</b></span>
      <span className="ws-chip" title="시간대별 종별 야생동물 스폰">🦌 야생동물: <b>{wildlifeTotal}</b>{wildlifeEmpty > 0 ? ` (빈구역 ${wildlifeEmpty})` : ''}</span>
      <span className="ws-chip">👹 알파: <b>{alphaOn ? 'ON' : 'off'}</b></span>
      <span className="ws-chip">👹 오메가: <b>{omegaOn ? 'ON' : 'off'}</b></span>
      <span className="ws-chip">👹 위클라인: <b>{weaklineOn ? 'ON' : 'off'}</b></span>
    </div>
  );
}
