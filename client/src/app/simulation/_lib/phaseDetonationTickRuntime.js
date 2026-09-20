import { simulationRandom } from '../../../utils/simulationRandom.js';
import { canMoveByStatus, hasActionBlockStatus, getNewDamageProtectedSeconds, getCollarPausedSeconds } from '../../../utils/statusLogic';
import { roundCombatTime } from './combatTimingRuntime.js';
import { getActorDimensionRiftId } from './dimensionRiftSpaceRuntime.js';
import { advanceActorCooldownClock } from './cooldownRuntime.js';
import { advanceUniqueResource } from './uniqueResourceRuntime.js';
import { isDimensionRiftDefeated } from '../../../utils/dimensionRiftDefeatLogic.js';
import { normalizeDetonationTimer, restoreDetonationTime } from './detonationTimerRuntime.js';
import {
  buildRuntimeSurvivorMap,
  normalizeRuntimeSurvivorList,
} from './simulationEngine';

export function runDetonationTickPhase({
  actions = {},
  state = {},
} = {}) {
  const {
    canReviveThisMatch = false,
    fogLocalSec,
    forbiddenIds = new Set(),
    mapObj,
    newlyDead = [],
    phaseDurationSec = 0,
    startOffsetSec = 0,
    endOffsetSec = phaseDurationSec,
    phaseIdxNow = 0,
    phaseStartSec = 0,
    reviveCutoffIdx = -1,
    ruleset,
    suddenDeathActive = false,
    tickSec = 1,
    updatedSurvivors = [],
    useDetonation = false,
    zoneGraph = {},
  } = state;
  const {
    addLog = () => {},
    atNow = () => null,
    emitDeathRunEventOnce = () => {},
    getZoneName = (zoneId) => String(zoneId || ''),
    setDeathMetadata = () => {},
  } = actions;

  const detCfg = ruleset?.detonation || {};
  const decPerSec = Number(detCfg.decreasePerSecForbidden ?? detCfg.decreasePerSec ?? 1);
  const regenPerSec = Number(detCfg.regenPerSecOutsideForbidden ?? detCfg.regenPerSecOutside ?? 1);
  const criticalSec = Number(detCfg.criticalSec || 5);

  const psz = ruleset?.gadgets?.portableSafeZone || {};
  const pszCost = Number(psz.energyCost || 40);
  const pszCd = Number(psz.cooldownSec || 30);
  const pszDur = Number(psz.durationSec || 7);

  const cnot = ruleset?.gadgets?.cnotGate || {};
  const cnotCost = Number(cnot.energyCost || 30);
  const cnotCd = Number(cnot.cooldownSec || 10);

  const allZoneIds = (Array.isArray(mapObj?.zones) && mapObj.zones.length)
    ? mapObj.zones.map((zone) => String(zone.zoneId))
    : [...forbiddenIds];

  const pickSafeZone = (fromZoneId) => {
    const neighbors = Array.isArray(zoneGraph[fromZoneId]) ? zoneGraph[fromZoneId] : [];
    const safeNeighbors = neighbors.map(String).filter((zoneId) => !forbiddenIds.has(String(zoneId)));
    if (safeNeighbors.length) return String(safeNeighbors[Math.floor(simulationRandom() * safeNeighbors.length)]);
    const safeAll = allZoneIds.filter((zoneId) => !forbiddenIds.has(String(zoneId)));
    if (safeAll.length) return String(safeAll[Math.floor(simulationRandom() * safeAll.length)]);
    return String(fromZoneId);
  };

  const fogWarningSec = Number(ruleset?.fog?.warningSec || 30);
  const fogDurationSec = Number(ruleset?.fog?.durationSec || 45);
  const fogStartLocal = (fogLocalSec === null || fogLocalSec === undefined) ? null : Number(fogLocalSec);
  const fogWarnLocal = (fogStartLocal !== null) ? Math.max(0, fogStartLocal - fogWarningSec) : null;
  const fogEndLocal = (fogStartLocal !== null) ? fogStartLocal + fogDurationSec : null;

  let aliveMap = buildRuntimeSurvivorMap(updatedSurvivors);
  const intervalStartActors = new Map((state.intervalStartActors || updatedSurvivors).map((actor) => [String(actor._id), actor]));
  aliveMap = new Map(Array.from(aliveMap.values()).map((survivor) => [String(survivor._id), { ...survivor,
    cooldowns: { ...(survivor.cooldowns || {}) },
    skillState: Object.fromEntries(Object.entries(survivor.skillState && typeof survivor.skillState === 'object' ? survivor.skillState : {})
      .map(([slot, value]) => [slot, value && typeof value === 'object' ? { ...value } : value])),
  }]));

  for (let t = startOffsetSec; t < Math.min(endOffsetSec, phaseDurationSec); t += tickSec) {
    const absSec = roundCombatTime(phaseStartSec + t);
    const elapsed = roundCombatTime(Math.min(tickSec, endOffsetSec - t, phaseDurationSec - t));

    if (fogWarnLocal !== null && t === fogWarnLocal) {
      addLog(`🌫️ 퍼플 포그 경고! 약 ${fogWarningSec}s 후, 일부 구역에서 시야가 악화됩니다.`, 'system');
    }
    if (fogStartLocal !== null && t === fogStartLocal) {
      addLog(`🌫️ 퍼플 포그 확산! (약 ${fogDurationSec}s)`, 'highlight');
    }
    if (fogEndLocal !== null && t === fogEndLocal) {
      addLog('🌫️ 퍼플 포그가 걷혔습니다.', 'system');
    }

    for (const survivor of aliveMap.values()) {
      if (!survivor || Number(survivor.hp || 0) <= 0) continue;

      const cooldownTick = advanceActorCooldownClock(survivor, absSec, elapsed, {
        effectSource: intervalStartActors.get(String(survivor._id)) || survivor,
        effectElapsedSec: t - startOffsetSec,
      }).progressSec;
      if (survivor.cooldowns) {
        survivor.cooldowns.portableSafeZone = Math.max(0, roundCombatTime(Number(survivor.cooldowns.portableSafeZone || 0) - cooldownTick));
        survivor.cooldowns.cnotGate = Math.max(0, roundCombatTime(Number(survivor.cooldowns.cnotGate || 0) - cooldownTick));
        survivor.cooldowns.weaponSkill = Math.max(0, roundCombatTime(Number(survivor.cooldowns.weaponSkill || 0) - cooldownTick));
      }
      if (!isDimensionRiftDefeated(survivor)) advanceUniqueResource(survivor, elapsed);

      // Even rulesets without collar or sudden-death pressure still advance
      // the shared match clocks above (cooldowns and opt-in unique resources).
      if (!useDetonation && !suddenDeathActive) continue;

      // The entrance's world hazards do not run inside the arena. Cooldowns
      // above still elapse; neither collar drain nor safe-field regeneration is
      // earned here. The objective observer closes/releases at the boundary.
      if (getActorDimensionRiftId(survivor)) continue;

      const zoneId = String(survivor.zoneId || '__default__');
      const isForbidden = forbiddenIds.has(zoneId);
      if (!useDetonation) {
        if (isForbidden) {
          const protectedSec = getNewDamageProtectedSeconds(intervalStartActors.get(String(survivor._id)), elapsed, t - startOffsetSec);
          const damage = Math.max(1, Number(survivor.maxHp || 100) * 0.05) * Math.max(0, elapsed - protectedSec);
          survivor.hp = Math.max(0, roundCombatTime(Number(survivor.hp) - damage));
          if (survivor.hp <= 0) {
            setDeathMetadata(survivor, 'final_zone_pressure', { causeName: '최종 금지구역 피해', atSec: roundCombatTime(absSec + elapsed) });
            survivor.deadAtPhaseIdx = phaseIdxNow;
            survivor.reviveEligible = false;
            newlyDead.push(survivor);
            emitDeathRunEventOnce(survivor, { reason: 'final_zone_pressure', cause: '최종 금지구역 피해', at: atNow() });
            addLog(`💀 [${survivor.name}] 최종 금지구역 피해로 사망했습니다.`, 'death');
          }
        }
        continue;
      }

      normalizeDetonationTimer(survivor, ruleset);
      if (!isForbidden) {
        restoreDetonationTime(survivor, regenPerSec * elapsed, ruleset);
        survivor._detLogLastMilestone = null;
        continue;
      }

      const pausedSec = getCollarPausedSeconds(intervalStartActors.get(String(survivor._id)), elapsed, t - startOffsetSec);
      // Both protections start at the interval boundary: overlap is not additive.
      const protectedSec = Math.max(pausedSec, Math.min(elapsed, Math.max(0, Number(survivor.safeZoneUntil || 0) - absSec)));
      survivor.detonationSec = Math.max(0, roundCombatTime(Number(survivor.detonationSec || 0) - decPerSec * (elapsed - protectedSec)));
      if (pausedSec >= elapsed) continue;

      const detFloor = Math.max(0, Math.floor(Number(survivor.detonationSec || 0)));
      const milestones = Array.isArray(detCfg.logMilestones) ? detCfg.logMilestones.map((value) => Math.floor(Number(value))) : [15, 10, 5, 3, 1, 0];
      if (milestones.includes(detFloor) && Number(survivor._detLogLastMilestone) !== detFloor) {
        survivor._detLogLastMilestone = detFloor;
        addLog(`⏳ [${survivor.name}] 폭발 타이머 ${detFloor}s (구역: ${getZoneName(zoneId)})`, 'system');
      }

      if (Number(survivor.detonationSec || 0) <= criticalSec) {
        const energyNow = Number(survivor.gadgetEnergy || 0);

        if (canMoveByStatus(survivor) && Number(survivor.cooldowns?.cnotGate || 0) <= 0 && energyNow >= cnotCost) {
          const dest = pickSafeZone(zoneId);
          if (dest && String(dest) !== zoneId) {
            survivor.zoneId = String(dest);
            survivor.gadgetEnergy = energyNow - cnotCost;
            survivor.cooldowns.cnotGate = cnotCd;
            addLog(`🌀 [${survivor.name}] CNOT 게이트 발동 → ${getZoneName(dest)} (에너지 -${cnotCost})`, 'highlight');
          }
        }

        const afterEnergy = Number(survivor.gadgetEnergy || 0);
        if (!hasActionBlockStatus(survivor) && forbiddenIds.has(String(survivor.zoneId || zoneId)) && Number(survivor.cooldowns?.portableSafeZone || 0) <= 0 && afterEnergy >= pszCost) {
          survivor.gadgetEnergy = afterEnergy - pszCost;
          survivor.cooldowns.portableSafeZone = pszCd;
          survivor.safeZoneUntil = roundCombatTime(absSec + elapsed + pszDur);
          addLog(`🛡️ [${survivor.name}] 휴대용 안전지대 전개 (${pszDur}s) (에너지 -${pszCost})`, 'highlight');
        }
      }

      if (Number(survivor.detonationSec || 0) <= 0) {
        setDeathMetadata(survivor, 'detonation', { causeName: '폭발 타이머', atSec: roundCombatTime(absSec + elapsed) });
        survivor.hp = 0;
        survivor.deadAtPhaseIdx = phaseIdxNow;
        survivor.reviveEligible = canReviveThisMatch && phaseIdxNow <= reviveCutoffIdx;
        newlyDead.push(survivor);
        emitDeathRunEventOnce(survivor, { reason: 'detonation', cause: '폭발 타이머', at: atNow() });
        addLog(`💥 [${survivor.name}] 폭발 타이머가 0이 되어 사망했습니다. (구역: ${getZoneName(zoneId)})`, 'death');
      }
    }
  }


  return {
    newlyDead,
    updatedSurvivors: normalizeRuntimeSurvivorList(Array.from(aliveMap.values())).filter((survivor) => Number(survivor.hp || 0) > 0),
  };
}
