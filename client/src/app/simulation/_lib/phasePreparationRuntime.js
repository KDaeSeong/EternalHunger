import {
  getFogLocalTimeSec,
  getNaturalCreditGain,
  getPhaseDurationSec,
  getRuleset,
} from '../../../utils/rulesets';
import { getMatchConfig } from './matchRosterRuntime';
import { applyRegionDataToZones } from './lumiaRegionData';
import { waitMs } from './simulationFormattingRuntime';
import { worldPhaseIndex, worldTimeText } from './simulationEngine';

export function beginSimulationPhase({
  actions = {},
  refs = {},
  state = {},
} = {}) {
  const {
    autoSpeed,
    day,
    matchSec,
    phase,
    settings,
  } = state;
  const {
    autoSpeedRef,
    suddenDeathActiveRef,
    suddenDeathEndAtSecRef,
  } = refs;
  const {
    addLog = () => {},
    normalizeAutoSpeed = (value) => Number(value || 1),
    resetPhaseLogs = () => {},
    setDay = () => {},
    setMatchSec = () => {},
    setPhase = () => {},
  } = actions;

  resetPhaseLogs();

  const nextPhase = phase === 'morning' ? 'night' : 'morning';
  const nextDay = phase === 'night' ? Number(day || 0) + 1 : Number(day || 0);
  const ruleset = getRuleset(settings?.rulesetId);

  const suddenDeathCfg = ruleset?.suddenDeath || {};
  const suddenDeathTotalSec = Math.max(10, Number(suddenDeathCfg.totalSec ?? suddenDeathCfg.durationSec ?? 180));
  const shouldActivateSuddenDeath = !suddenDeathActiveRef?.current && nextDay === 6 && nextPhase === 'night';
  if (shouldActivateSuddenDeath && !suddenDeathActiveRef.current) {
    suddenDeathActiveRef.current = true;
    if (typeof suddenDeathEndAtSecRef.current !== 'number') {
      suddenDeathEndAtSecRef.current = Number(matchSec || 0) + suddenDeathTotalSec;
    }
    addLog(`=== 서든데스 발동: 최종 안전구역 2곳 제외 전지역 금지 + 카운트다운 ${suddenDeathTotalSec}s ===`, 'day-header');
  }

  const useDetonation = !!ruleset?.detonation;
  const marketRules = ruleset?.market || {};
  const battleSettings = {
    ...settings,
    battle: { ...(ruleset?.battle || {}), ...(settings?.battle || {}), equipment: ruleset?.equipment || {} },
    skills: { ...(ruleset?.skills || {}), ...(settings?.skills || {}) },
  };
  const phaseDurationSec = getPhaseDurationSec(ruleset, nextDay, nextPhase);
  const phaseStartSec = Number(matchSec || 0);
  const tickSec = Math.max(1, Math.floor(Number(ruleset?.tickSec || 1)));
  let phaseRuntimeOffsetSec = 0;
  let phaseActionAbsSec = phaseStartSec;

  const currentActionSec = () => Math.max(0, Math.floor(Number(phaseActionAbsSec || phaseStartSec || 0)));
  const atNow = () => ({ day: nextDay, phase: nextPhase, sec: currentActionSec() });
  const reserveActionSecond = (seconds = tickSec) => {
    const offset = Math.max(0, Math.min(phaseDurationSec, Math.floor(Number(phaseRuntimeOffsetSec || 0))));
    phaseActionAbsSec = phaseStartSec + offset;
    phaseRuntimeOffsetSec = Math.min(
      phaseDurationSec,
      offset + Math.max(1, Math.floor(Number(seconds || tickSec || 1)))
    );
    return phaseActionAbsSec;
  };
  const getVisibleTickDelayMs = () => {
    const speed = normalizeAutoSpeed(autoSpeedRef?.current || autoSpeed);
    return Math.max(24, Math.round(1000 / speed));
  };
  const commitVisibleClock = async (absSec = phaseStartSec + phaseRuntimeOffsetSec, { wait = true } = {}) => {
    const nextSec = Math.max(
      phaseStartSec,
      Math.min(phaseStartSec + phaseDurationSec, Math.floor(Number(absSec || phaseStartSec)))
    );
    setMatchSec(nextSec);
    if (wait) await waitMs(getVisibleTickDelayMs());
  };
  const reserveVisibleSecond = async (seconds = tickSec) => {
    const actionSec = reserveActionSecond(seconds);
    await commitVisibleClock(phaseStartSec + phaseRuntimeOffsetSec);
    return actionSec;
  };
  const runVisibleClockToPhaseEnd = async () => {
    while (phaseRuntimeOffsetSec < phaseDurationSec) {
      reserveActionSecond(tickSec);
      await commitVisibleClock(phaseStartSec + phaseRuntimeOffsetSec);
    }
  };
  const getPhaseRuntimeOffsetSec = () => phaseRuntimeOffsetSec;
  const fogLocalSec = getFogLocalTimeSec(ruleset, nextDay, nextPhase, phaseDurationSec);

  if (!suddenDeathActiveRef?.current && nextDay === 6 && nextPhase === 'night') {
    addLog('=== 🔥 서든데스: 6번째 밤 돌입 (교전 빈도 증가) ===', 'day-header');
  }

  const baseCredits = getNaturalCreditGain(ruleset, nextDay, nextPhase, phaseDurationSec);

  setDay(nextDay);
  setPhase(nextPhase);
  addLog(`=== ${worldTimeText(nextDay, nextPhase)} (⏱ ${phaseDurationSec}s) ===`, 'day-header');

  if (suddenDeathActiveRef?.current && typeof suddenDeathEndAtSecRef?.current === 'number') {
    const remain = Math.max(0, Math.ceil(suddenDeathEndAtSecRef.current - Number(matchSec || 0)));
    addLog(`서든데스 카운트다운: ${remain}s`, 'system');
  }

  const phaseIdxNow = worldPhaseIndex(nextDay, nextPhase);
  const matchCfgNow = getMatchConfig(settings);
  const isSoloMatch = matchCfgNow.matchMode === 'solo';

  return {
    atNow,
    baseCredits,
    battleSettings,
    canReviveThisMatch: !isSoloMatch,
    commitVisibleClock,
    currentActionSec,
    fogLocalSec,
    getPhaseRuntimeOffsetSec,
    isSoloMatch,
    marketRules,
    matchCfgNow,
    nextDay,
    nextPhase,
    phaseDurationSec,
    phaseIdxNow,
    phaseStartSec,
    reserveActionSecond,
    reserveVisibleSecond,
    ruleset,
    runVisibleClockToPhaseEnd,
    tickSec,
    useDetonation,
  };
}

export function prepareForbiddenZonePhase({
  actions = {},
  helpers = {},
  refs = {},
  state = {},
} = {}) {
  const {
    activeMap,
    activeMapId,
    nextDay,
    nextPhase,
    ruleset,
    settings,
    useDetonation,
    zones,
  } = state;
  const {
    activeMapIdRef,
    activeMapRef,
    suddenDeathActiveRef,
    suddenDeathForbiddenAnnouncedRef,
  } = refs;
  const {
    getForbiddenAddedZoneIdsForPhase = () => [],
    getForbiddenZoneIdsForPhase = () => [],
    getZoneName = (zoneId) => String(zoneId || ''),
  } = helpers;
  const {
    addLog = () => {},
    setForbiddenAddedNow = () => {},
  } = actions;

  const mapIdNow = String(activeMapIdRef?.current || activeMapId || '');
  const mapObjRaw = activeMapRef?.current || activeMap;
  const mapObjBase = mapObjRaw || ((Array.isArray(zones) && zones.length)
    ? { _id: mapIdNow || 'local', zones }
    : null);
  const mapObj = mapObjBase
    ? { ...mapObjBase, zones: applyRegionDataToZones(Array.isArray(mapObjBase?.zones) ? mapObjBase.zones : zones) }
    : null;
  let forbiddenIds = mapObj ? new Set(getForbiddenZoneIdsForPhase(mapObj, nextDay, nextPhase, ruleset)) : new Set();
  let newlyAddedForbidden = mapObj ? getForbiddenAddedZoneIdsForPhase(mapObj, nextDay, nextPhase, ruleset) : [];
  let suddenDeathSafeZoneIds = [];

  if (suddenDeathActiveRef?.current && mapObj && Array.isArray(mapObj.zones)) {
    const allZoneIds = mapObj.zones
      .map((zone) => String(zone?.zoneId ?? zone?.id ?? zone?._id ?? ''))
      .filter(Boolean);

    const preferred = ['firestation', 'alley'];
    const safePick = preferred.filter((zoneId) => allZoneIds.includes(zoneId));
    while (safePick.length < 2 && allZoneIds.length) {
      const candidate = allZoneIds[Math.floor(Math.random() * allZoneIds.length)];
      if (!safePick.includes(candidate)) safePick.push(candidate);
    }
    const safeSet = new Set(safePick);
    suddenDeathSafeZoneIds = safePick.map((zoneId) => String(zoneId || '')).filter(Boolean);

    forbiddenIds = new Set(allZoneIds.filter((zoneId) => !safeSet.has(zoneId)));

    if (!suddenDeathForbiddenAnnouncedRef?.current) {
      newlyAddedForbidden = allZoneIds.filter((zoneId) => !safeSet.has(zoneId));
      suddenDeathForbiddenAnnouncedRef.current = true;
    } else {
      newlyAddedForbidden = [];
    }

    addLog(`🟩 최종 안전구역: ${safePick.map((zoneId) => getZoneName(zoneId)).join(', ')}`, 'highlight');
  }

  setForbiddenAddedNow(newlyAddedForbidden);
  const forbiddenNames = [...forbiddenIds].map((zoneId) => getZoneName(zoneId)).join(', ');
  const forbiddenAddedNames = newlyAddedForbidden.map((zoneId) => getZoneName(zoneId)).join(', ');

  const config = mapObj?.forbiddenZoneConfig || {};
  const damagePerTick = Number(config.damagePerTick ?? 0) || Math.round(Number(nextDay || 0) * (settings.forbiddenZoneDamageBase || 1.5));
  const totalZones = (Array.isArray(mapObj?.zones) && mapObj.zones.length) ? mapObj.zones.length : (Array.isArray(zones) ? zones.length : 0);
  const safeZones = Math.max(0, totalZones - forbiddenIds.size);
  const forbiddenEnabled = config.enabled !== false;
  const forbiddenStartDay = Number(config.startDay ?? settings.forbiddenZoneStartDay ?? 2);
  const forbiddenStartPhase = String(config.startPhase ?? config.startTimeOfDay ?? settings.forbiddenZoneStartPhase ?? 'night');
  const forbiddenPhaseIdx = Number(nextDay || 0) * 2 + (nextPhase === 'night' ? 1 : 0);
  const forbiddenStartIdx = Math.max(0, forbiddenStartDay) * 2 + (forbiddenStartPhase === 'night' ? 1 : 0);
  const forbiddenStateText = (!forbiddenEnabled)
    ? 'OFF'
    : (forbiddenPhaseIdx < forbiddenStartIdx ? `대기(${forbiddenStartDay}일차 ${forbiddenStartPhase === 'night' ? '밤' : '낮'}부터)` : 'ON');
  addLog(`🚫 금지구역 업데이트: +${newlyAddedForbidden.length} · 금지 ${forbiddenIds.size}/${totalZones} · 안전 ${safeZones} · ${forbiddenStateText}`, 'system');

  if (forbiddenIds.size > 0) {
    if (newlyAddedForbidden.length > 0) {
      addLog(`🚫 금지구역 확장: ${forbiddenAddedNames}`, 'highlight');
    }
    if (useDetonation) {
      const startSec = Number(ruleset?.detonation?.startSec || 20);
      const maxSec = Number(ruleset?.detonation?.maxSec || 30);
      addLog(`⚠️ 제한구역: ${forbiddenNames} (폭발 타이머: 기본 ${startSec}s / 최대 ${maxSec}s)`, 'system');
    } else {
      addLog(`⚠️ 금지구역: ${forbiddenNames} (해당 구역 체류 시 HP -${damagePerTick})`, 'system');
    }
  }

  return {
    config,
    damagePerTick,
    forbiddenIds,
    mapIdNow,
    mapObj,
    newlyAddedForbidden,
    safeZones,
    suddenDeathSafeZoneIds,
    totalZones,
  };
}
