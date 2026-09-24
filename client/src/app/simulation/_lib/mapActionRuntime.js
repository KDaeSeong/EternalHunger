import { apiGet, getToken } from '../../../utils/api';
import { getRuleset } from '../../../utils/rulesets';
import { buildGuestSimulationMap } from './guestSimulationBootstrap';
import {
  prepareLocalSimulationMapChange,
} from './localSimulationMapRuntime';
import {
  createInitialSpawnState,
  getEligibleSpawnZoneIds,
  getHyperloopDeviceZoneId,
} from './simulationEngine';
import { buildInitialFastRoutePlanSteps, mergeInitialRoutePlanFields } from './simulationInitialRosterRuntime';
import { runMapPreparationSteps } from './mapPreparationRuntime';

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
  const steps = rebaseSurvivorsForMapSteps(list, map, routeItems);
  let step = steps.next();
  while (!step.done) step = steps.next();
  return step.value;
}

export function* rebaseSurvivorsForMapSteps(list, map, routeItems = []) {
  const mapId = String(map?._id || map?.id || 'local');
  const zoneIds = (Array.isArray(map?.zones) ? map.zones : [])
    .map((zone) => String(zone?.zoneId || '').trim()).filter(Boolean);
  const zoneSet = new Set(zoneIds);
  const actors = Array.isArray(list) ? list : [];
  const rebased = [];
  for (const [index, actor] of actors.entries()) {
    try {
      const route = yield* buildInitialFastRoutePlanSteps(actor, map, Array.isArray(routeItems) ? routeItems : []);
      const routeZoneIds = (Array.isArray(route?.zoneIds) ? route.zoneIds : []).map(String).filter((id) => zoneSet.has(id));
      const itemIdsByZone = Object.fromEntries(Object.entries(route?.itemIdsByZone || {})
        .filter(([zoneId]) => zoneSet.has(String(zoneId))));
      const safeRoute = { ...route, zoneIds: routeZoneIds, itemIdsByZone };
      const startZoneId = routeZoneIds[0] || zoneIds[index % Math.max(1, zoneIds.length)] || '__default__';
      rebased.push(mergeInitialRoutePlanFields({
        ...actor,
        mapId,
        zoneId: startZoneId,
        routePlanIndex: 0,
        day1Moves: 0,
        day1HeroDone: false,
      }, safeRoute, 'map_rebase'));
    } catch {
      rebased.push({ ...actor, mapId, zoneId: String(zoneIds[index % Math.max(1, zoneIds.length)] || '__default__'), routePlanIndex: 0, day1Moves: 0, day1HeroDone: false });
    }
    yield;
  }
  return rebased;
}

export function createMapActionRuntime(context = {}) {
  const refs = context.refs || {};
  const state = context.state || {};
  const actions = context.actions || {};

  const {
    activeMapId,
    activeMapName,
    candidateSurvivors,
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
    isAdvancingRef,
    runLockedRef,
    mapsRef,
  } = refs;
  const mapPreparationRef = refs.mapPreparationRef || { current: null };

  const {
    addLog = () => {},
    applyActiveMapId = () => {},
    emitRunEvent = () => {},
    getForbiddenZoneIdsForPhase = () => [],
    onLocalRulesChanged = () => {},
    setMapPreparation = () => {},
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

  async function changeLocalMap(operation, input) {
    if (getToken() || day > 0 || isGameOver || loading || isAdvancing
      || isAdvancingRef?.current || runLockedRef?.current || mapPreparationRef.current) {
      return { ok: false, errors: ['다른 준비 작업이 끝난 뒤 새 경기 설정에서 변경해 주세요.'] };
    }
    const job = { cancelled: false };
    mapPreparationRef.current = job;
    setMapPreparation({ name: '지도와 참가자 경로를 준비하고 있습니다.' });
    const isCurrent = () => {
      if (job.cancelled || mapPreparationRef.current !== job || getToken()
        || isAdvancingRef?.current || runLockedRef?.current) return false;
      const latest = actions.getCurrentMapInputs?.() || state;
      return ['survivors', 'candidateSurvivors', 'publicItems', 'settings', 'activeMapId', 'maps', 'day', 'loading', 'isGameOver']
        .every((key) => latest[key] === state[key]);
    };
    try {
      const staged = prepareLocalSimulationMapChange(operation, input, buildGuestSimulationMap(), context.storage);
      if (!staged.ok) return staged;
      const list = staged.maps;
      const preferredId = staged.map?._id || staged.selectedMapId || list[0]?._id;
      const nextMap = list.find((map) => String(map._id) === String(preferredId)) || list[0];
      const nextId = String(nextMap._id);
      function* prepareRosters() {
        // A stored map can change without changing its ID (another tab/editor).
        // Always prepare against the actual staged content, not only its ID.
        const nextSurvivors = yield* rebaseSurvivorsForMapSteps(survivors, nextMap, publicItems);
        const nextCandidates = yield* rebaseSurvivorsForMapSteps(candidateSurvivors, nextMap, publicItems);
        return { survivors: nextSurvivors, candidateSurvivors: nextCandidates };
      }
      const prepared = await runMapPreparationSteps(prepareRosters(), { ...context.preparationOptions, isCurrent });
      if (!prepared.ok || !isCurrent()) return { ok: false, cancelled: true, errors: ['준비 중 조건이 바뀌어 지도 변경을 취소했습니다.'] };
      const committed = staged.commit();
      if (!committed.ok) return committed;
      // No await between persistence and all React/ref updates. Route work must
      // never run in a React updater (which React is free to invoke again).
      if (mapsRef) mapsRef.current = list;
      if (activeMapRef) activeMapRef.current = nextMap;
      setMaps(list);
      applyActiveMapId(nextId);
      setSurvivors(prepared.value.survivors);
      setCandidateSurvivors(prepared.value.candidateSurvivors);
      return { ok: true, map: staged.map, maps: list, selectedMapId: nextId, errors: [] };
    } catch {
      return { ok: false, errors: ['지도를 준비하지 못했습니다. 기존 설정을 유지합니다.'] };
    } finally {
      if (mapPreparationRef.current === job) {
        mapPreparationRef.current = null;
        if (!job.cancelled) setMapPreparation(null);
      }
    }
  }

  async function selectLocalMap(mapId) {
    const result = await changeLocalMap('select', mapId);
    if (!result.ok) {
      if (!result.cancelled) addLog(result.errors?.[0] || '로컬 지도를 선택하지 못했습니다.', 'death');
      return false;
    }
    addLog(`🗺️ 로컬 지도 선택: ${result.maps.find((map) => String(map._id) === result.selectedMapId)?.name || '내장 지도'}`, 'system');
    return true;
  }

  async function saveLocalMap(mapDraft) {
    const result = await changeLocalMap('save', mapDraft);
    if (result.ok) addLog(`🗺️ 로컬 지도 저장: ${result.map.name}`, 'system');
    return result;
  }

  async function removeLocalMap(mapId) {
    const result = await changeLocalMap('remove', mapId);
    if (result.ok) addLog('🗺️ 로컬 지도를 삭제하고 내장 지도를 보존했습니다.', 'system');
    return result;
  }

  async function refreshMapSettingsFromServer(reason = 'manual') {
    if (!getToken()) {
      // Starting captures the prepared, visible conditions. An implicit reload
      // here could combine another tab's map with the old roster closure.
      if (reason === 'start') return true;
      const result = await changeLocalMap('refresh');
      if (!result.ok) {
        if (!result.cancelled) showMapRefreshToast(result.errors?.[0] || '지도 새로고침 실패(기존 유지)', 'error');
        return false;
      }
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
