import { apiGet, getToken } from '../../../utils/api';
import { getRuleset } from '../../../utils/rulesets';
import { buildGuestSimulationMap } from './guestSimulationBootstrap';
import {
  deleteLocalSimulationMap,
  loadLocalSimulationMaps,
  saveLocalSimulationMap as persistLocalSimulationMap,
  selectLocalSimulationMap,
} from './localSimulationMapRuntime';
import {
  createInitialSpawnState,
  getEligibleSpawnZoneIds,
  getHyperloopDeviceZoneId,
} from './simulationEngine';
import { buildInitialFastRoutePlan, mergeInitialRoutePlanFields } from './simulationInitialRosterRuntime';

export function applyActiveMapIdToState(nextMapId, context = {}) {
  const refs = context.refs || {};
  const actions = context.actions || {};
  const { activeMapIdRef } = refs;
  const {
    setActiveMapId = () => {},
    setSpawnState = () => {},
  } = actions;

  const id = String(nextMapId || '');
  const prevId = String(activeMapIdRef?.current || '');
  if (activeMapIdRef) activeMapIdRef.current = id;
  setActiveMapId(id);
  if (prevId !== id) setSpawnState(createInitialSpawnState(id));
}

export function rebaseSurvivorsForMap(list, map, routeItems = []) {
  const mapId = String(map?._id || map?.id || 'local');
  const zoneIds = (Array.isArray(map?.zones) ? map.zones : [])
    .map((zone) => String(zone?.zoneId || '').trim()).filter(Boolean);
  const zoneSet = new Set(zoneIds);
  return (Array.isArray(list) ? list : []).map((actor, index) => {
    try {
      const route = buildInitialFastRoutePlan(actor, map, Array.isArray(routeItems) ? routeItems : []);
      const routeZoneIds = (Array.isArray(route?.zoneIds) ? route.zoneIds : []).map(String).filter((id) => zoneSet.has(id));
      const itemIdsByZone = Object.fromEntries(Object.entries(route?.itemIdsByZone || {})
        .filter(([zoneId]) => zoneSet.has(String(zoneId))));
      const safeRoute = { ...route, zoneIds: routeZoneIds, itemIdsByZone };
      const startZoneId = routeZoneIds[0] || zoneIds[index % Math.max(1, zoneIds.length)] || '__default__';
      return mergeInitialRoutePlanFields({
        ...actor,
        mapId,
        zoneId: startZoneId,
        routePlanIndex: 0,
        day1Moves: 0,
        day1HeroDone: false,
      }, safeRoute, 'map_rebase');
    } catch {
      return { ...actor, mapId, zoneId: String(zoneIds[index % Math.max(1, zoneIds.length)] || '__default__'), routePlanIndex: 0, day1Moves: 0, day1HeroDone: false };
    }
  });
}

export function createMapActionRuntime(context = {}) {
  const refs = context.refs || {};
  const state = context.state || {};
  const actions = context.actions || {};

  const {
    activeMapId,
    activeMapName,
    day,
    hyperloopPadName,
    hyperloopPadZoneId,
    isAdvancing,
    isGameOver,
    loading,
    maps,
    matchPhase,
    publicItems,
    settings,
    survivors,
  } = state;

  const {
    activeMapIdRef,
    activeMapRef,
    isRefreshingMapsRef,
    mapsRef,
  } = refs;

  const {
    addLog = () => {},
    applyActiveMapId = () => {},
    emitRunEvent = () => {},
    getForbiddenZoneIdsForPhase = () => [],
    onLocalRulesChanged = () => {},
    setIsRefreshingMapSettings = () => {},
    setCandidateSurvivors = () => {},
    setMaps = () => {},
    setSurvivors = () => {},
    showMapRefreshToast = () => {},
  } = actions;

  function doHyperloopJump(toMapId, whoId) {
    const toId = String(toMapId || '').trim();
    const who = String(whoId || '').trim();
    if (!who) {
      addLog('🌀 하이퍼루프: 이동할 캐릭터를 선택하세요.', 'system');
      return;
    }
    if (!toId) return;
    if (loading || isAdvancing || isGameOver) return;
    if (day <= 0) {
      addLog('🌀 하이퍼루프: 게임 시작 후(1일차부터) 사용할 수 있습니다.', 'system');
      return;
    }

    const padZid = String(hyperloopPadZoneId || '').trim();
    const actor = (Array.isArray(survivors) ? survivors : []).find((c) => String(c?._id || '') === who) || null;
    const actorZid = String(actor?.zoneId || '').trim();
    if (!padZid || actorZid !== padZid) {
      const padNm = String(hyperloopPadName || padZid || '하이퍼루프 구역');
      addLog(`🌀 하이퍼루프 장치: [${padNm}]에서만 사용할 수 있습니다.`, 'system');
      return;
    }

    const toMap = (Array.isArray(maps) ? maps : []).find((m) => String(m?._id) === toId) || null;
    if (!toMap) return;

    const ruleset = getRuleset(settings?.rulesetId, settings?.simulationRuleset);
    const forbiddenZoneIds = new Set(getForbiddenZoneIdsForPhase(toMap, day, matchPhase, ruleset));
    const toZones = Array.isArray(toMap?.zones) ? toMap.zones : [];
    const eligible = getEligibleSpawnZoneIds(toZones, forbiddenZoneIds);

    const destPad = String(getHyperloopDeviceZoneId(toId) || '').trim();
    const destPadOk = !!destPad
      && toZones.some((zone) => String(zone?.zoneId || '') === destPad)
      && !forbiddenZoneIds.has(destPad);
    const entryZoneId = String((destPadOk ? destPad : (eligible?.[0] || toZones?.[0]?.zoneId)) || '__default__');

    const fromName = String(activeMapName || '현재맵');
    const toName = String(toMap?.name || '목적지');
    applyActiveMapId(toId);
    setSurvivors((prev) => (Array.isArray(prev) ? prev : []).map((character) => (
      String(character?._id) === who ? { ...character, mapId: toId, zoneId: entryZoneId } : character
    )));
    const whoName = actor?.name || '선택 캐릭터';
    addLog(`🌀 하이퍼루프 이동: ${fromName} → ${toName} (${whoName})`, 'highlight');
    emitRunEvent('hyperloop', { whoId: who, who: whoName, fromMapId: String(activeMapId || ''), toMapId: toId, toZoneId: entryZoneId });
  }

  function applyLocalMapList(mapsList, preferredId = '', { forceRebase = false } = {}) {
    const list = Array.isArray(mapsList) && mapsList.length ? mapsList : [buildGuestSimulationMap()];
    const previousId = String(activeMapIdRef?.current || activeMapId || '');
    const keepId = String(preferredId || activeMapIdRef?.current || activeMapId || '');
    const nextId = keepId && list.some((map) => String(map?._id || '') === keepId)
      ? keepId
      : String(list[0]?._id || '');
    if (mapsRef) mapsRef.current = list;
    setMaps(list);
    if (nextId) {
      applyActiveMapId(nextId);
      const nextMap = list.find((map) => String(map?._id || '') === nextId) || null;
      if (activeMapRef) activeMapRef.current = nextMap;
      if (forceRebase || previousId !== nextId) {
        setSurvivors((previous) => rebaseSurvivorsForMap(previous, nextMap, publicItems));
        setCandidateSurvivors((previous) => rebaseSurvivorsForMap(previous, nextMap, publicItems));
      }
    }
    return nextId;
  }

  function selectLocalMap(mapId) {
    if (getToken() || day > 0 || isGameOver || loading || isAdvancing) return false;
    const result = selectLocalSimulationMap(mapId, buildGuestSimulationMap());
    if (!result.ok) {
      addLog(result.errors?.[0] || '로컬 지도를 선택하지 못했습니다.', 'death');
      return false;
    }
    applyLocalMapList(result.maps, result.selectedMapId);
    addLog(`🗺️ 로컬 지도 선택: ${result.maps.find((map) => String(map?._id) === String(result.selectedMapId))?.name || '내장 지도'}`, 'system');
    return true;
  }

  function saveLocalMap(mapDraft) {
    if (getToken() || day > 0 || isGameOver || loading || isAdvancing) return { ok: false, errors: ['새 경기 준비 중에만 로컬 지도를 저장할 수 있습니다.'] };
    const result = persistLocalSimulationMap(mapDraft);
    if (!result.ok) return result;
    const mapsList = loadLocalSimulationMaps(buildGuestSimulationMap());
    applyLocalMapList(mapsList, result.map._id, { forceRebase: true });
    addLog(`🗺️ 로컬 지도 저장: ${result.map.name}`, 'system');
    return { ...result, maps: mapsList };
  }

  function removeLocalMap(mapId) {
    if (getToken() || day > 0 || isGameOver || loading || isAdvancing) return { ok: false, errors: ['새 경기 준비 중에만 로컬 지도를 삭제할 수 있습니다.'] };
    const result = deleteLocalSimulationMap(mapId);
    if (!result.ok) return result;
    const mapsList = loadLocalSimulationMaps(buildGuestSimulationMap());
    applyLocalMapList(mapsList);
    addLog('🗺️ 로컬 지도를 삭제하고 내장 지도를 보존했습니다.', 'system');
    return { ...result, maps: mapsList };
  }

  async function refreshMapSettingsFromServer(reason = 'manual') {
    if (!getToken()) {
      const mapsList = loadLocalSimulationMaps(buildGuestSimulationMap());
      applyLocalMapList(mapsList, '', { forceRebase: false });
      onLocalRulesChanged();
      if (reason === 'manual') {
        addLog('로컬 모드에서 저장된 지도·규칙을 새로 불러왔습니다.', 'system');
        showMapRefreshToast('로컬 지도 새로고침 완료', 'ok');
      }
      return true;
    }
    if (isRefreshingMapsRef?.current) return false;
    if (isRefreshingMapsRef) isRefreshingMapsRef.current = true;
    setIsRefreshingMapSettings(true);
    try {
      const mapsRes = await apiGet('/public/maps', { timeoutMs: 8000 });
      const mapsList = Array.isArray(mapsRes) ? mapsRes : [];
      if (!mapsList.length) {
        addLog('⚠️ 맵 설정 새로고침 실패(맵 목록 없음)', 'death');
        showMapRefreshToast('맵 목록이 없습니다.', 'error');
        return false;
      }

      if (mapsRef) mapsRef.current = mapsList;
      setMaps(mapsList);

      const keepId = String(activeMapIdRef?.current || activeMapId || '');
      const nextId = (keepId && mapsList.some((map) => String(map?._id) === keepId))
        ? keepId
        : String(mapsList[0]?._id || '');

      if (nextId) {
        applyActiveMapId(nextId);
        if (activeMapRef) activeMapRef.current = mapsList.find((map) => String(map?._id) === nextId) || null;
      }

      addLog(reason === 'start' ? '🔄 맵 설정을 서버에서 새로 불러왔습니다.' : '🔄 맵 설정을 새로고침했습니다.', 'system');
      showMapRefreshToast(reason === 'start' ? '서버에서 새로 불러옴' : '새로고침 완료', 'ok');
      return true;
    } catch {
      addLog('⚠️ 맵 설정 새로고침 실패(기존 설정 유지)', 'death');
      showMapRefreshToast('새로고침 실패(기존 유지)', 'error');
      return false;
    } finally {
      if (isRefreshingMapsRef) isRefreshingMapsRef.current = false;
      setIsRefreshingMapSettings(false);
    }
  }

  return {
    doHyperloopJump,
    removeLocalMap,
    refreshMapSettingsFromServer,
    saveLocalMap,
    selectLocalMap,
  };
}
