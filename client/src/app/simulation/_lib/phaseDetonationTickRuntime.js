import { getCooldownTickMultiplier } from '../../../utils/statusLogic';
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

  if (!useDetonation || forbiddenIds.size <= 0) {
    return {
      newlyDead,
      updatedSurvivors,
    };
  }

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

  const safeLeft = allZoneIds.filter((zoneId) => !forbiddenIds.has(String(zoneId))).length;
  const allowForceAll = !suddenDeathActive;
  const forceAllAfterSec = (allowForceAll && safeLeft <= 2) ? Math.max(0, Number(detCfg.forceAllAfterSec ?? 40)) : null;
  if (forceAllAfterSec !== null) {
    addLog(`⏳ 안전구역 유예 ${forceAllAfterSec}s: 이후 모든 구역에서 폭발 타이머가 감소합니다.`, 'system');
  }

  const pickSafeZone = (fromZoneId) => {
    const neighbors = Array.isArray(zoneGraph[fromZoneId]) ? zoneGraph[fromZoneId] : [];
    const safeNeighbors = neighbors.map(String).filter((zoneId) => !forbiddenIds.has(String(zoneId)));
    if (safeNeighbors.length) return String(safeNeighbors[Math.floor(Math.random() * safeNeighbors.length)]);
    const safeAll = allZoneIds.filter((zoneId) => !forbiddenIds.has(String(zoneId)));
    if (safeAll.length) return String(safeAll[Math.floor(Math.random() * safeAll.length)]);
    return String(fromZoneId);
  };

  const fogWarningSec = Number(ruleset?.fog?.warningSec || 30);
  const fogDurationSec = Number(ruleset?.fog?.durationSec || 45);
  const fogStartLocal = (fogLocalSec === null || fogLocalSec === undefined) ? null : Number(fogLocalSec);
  const fogWarnLocal = (fogStartLocal !== null) ? Math.max(0, fogStartLocal - fogWarningSec) : null;
  const fogEndLocal = (fogStartLocal !== null) ? fogStartLocal + fogDurationSec : null;

  let aliveMap = buildRuntimeSurvivorMap(updatedSurvivors);
  aliveMap = new Map(Array.from(aliveMap.values()).map((survivor) => [String(survivor._id), { ...survivor, cooldowns: { ...(survivor.cooldowns || {}) } }]));

  for (let t = 0; t < phaseDurationSec; t += tickSec) {
    const absSec = phaseStartSec + t;

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

      if (survivor.cooldowns) {
        const cooldownTick = tickSec * getCooldownTickMultiplier(survivor);
        survivor.cooldowns.portableSafeZone = Math.max(0, Number(survivor.cooldowns.portableSafeZone || 0) - cooldownTick);
        survivor.cooldowns.cnotGate = Math.max(0, Number(survivor.cooldowns.cnotGate || 0) - cooldownTick);
        survivor.cooldowns.weaponSkill = Math.max(0, Number(survivor.cooldowns.weaponSkill || 0) - cooldownTick);
      }

      const zoneId = String(survivor.zoneId || '__default__');
      const forceAllNow = (forceAllAfterSec !== null && t >= forceAllAfterSec);
      const isForbidden = forceAllNow ? true : forbiddenIds.has(zoneId);

      if (forceAllAfterSec !== null && t === forceAllAfterSec) {
        addLog('⚠️ 유예 종료: 안전구역도 위험해졌습니다.', 'highlight');
      }

      if (!isForbidden) {
        if (survivor.detonationSec !== null && survivor.detonationSec !== undefined) {
          const maxDet = Number(survivor.detonationMaxSec || detCfg.maxSec || 30);
          survivor.detonationSec = Math.min(maxDet, Number(survivor.detonationSec || 0) + regenPerSec * tickSec);
        }
        survivor._detLogLastMilestone = null;
        continue;
      }

      const isProtected = Number(survivor.safeZoneUntil || 0) > absSec;
      if (!isProtected) {
        survivor.detonationSec = Math.max(0, Number(survivor.detonationSec || 0) - decPerSec * tickSec);
      }

      const detFloor = Math.max(0, Math.floor(Number(survivor.detonationSec || 0)));
      const milestones = Array.isArray(detCfg.logMilestones) ? detCfg.logMilestones.map((value) => Math.floor(Number(value))) : [15, 10, 5, 3, 1, 0];
      if (milestones.includes(detFloor) && Number(survivor._detLogLastMilestone) !== detFloor) {
        survivor._detLogLastMilestone = detFloor;
        addLog(`⏳ [${survivor.name}] 폭발 타이머 ${detFloor}s (구역: ${getZoneName(zoneId)})`, 'system');
      }

      if (Number(survivor.detonationSec || 0) <= criticalSec) {
        const energyNow = Number(survivor.gadgetEnergy || 0);

        if (Number(survivor.cooldowns?.cnotGate || 0) <= 0 && energyNow >= cnotCost) {
          const dest = pickSafeZone(zoneId);
          if (dest && String(dest) !== zoneId) {
            survivor.zoneId = String(dest);
            survivor.gadgetEnergy = energyNow - cnotCost;
            survivor.cooldowns.cnotGate = cnotCd;
            addLog(`🌀 [${survivor.name}] CNOT 게이트 발동 → ${getZoneName(dest)} (에너지 -${cnotCost})`, 'highlight');
          }
        }

        const afterEnergy = Number(survivor.gadgetEnergy || 0);
        if (forbiddenIds.has(String(survivor.zoneId || zoneId)) && Number(survivor.cooldowns?.portableSafeZone || 0) <= 0 && afterEnergy >= pszCost) {
          survivor.gadgetEnergy = afterEnergy - pszCost;
          survivor.cooldowns.portableSafeZone = pszCd;
          survivor.safeZoneUntil = absSec + pszDur;
          addLog(`🛡️ [${survivor.name}] 휴대용 안전지대 전개 (${pszDur}s) (에너지 -${pszCost})`, 'highlight');
        }
      }

      if (Number(survivor.detonationSec || 0) <= 0) {
        setDeathMetadata(survivor, 'detonation', { causeName: '폭발 타이머', atSec: absSec });
        survivor.hp = 0;
        survivor.deadAtPhaseIdx = phaseIdxNow;
        survivor.reviveEligible = canReviveThisMatch && phaseIdxNow <= reviveCutoffIdx;
        newlyDead.push(survivor);
        emitDeathRunEventOnce(survivor, { reason: 'detonation', cause: '폭발 타이머', at: atNow() });
        addLog(`💥 [${survivor.name}] 폭발 타이머가 0이 되어 사망했습니다. (구역: ${getZoneName(zoneId)})`, 'death');
      }
    }
  }

  if (suddenDeathActive) {
    const aliveNow = Array.from(aliveMap.values()).filter((survivor) => Number(survivor?.hp || 0) > 0);
    if (aliveNow.length === 0) {
      const deadNow = Array.from(aliveMap.values()).filter((survivor) => Number(survivor?.hp || 0) <= 0);
      if (deadNow.length) {
        const lastAt = Math.max(...deadNow.map((survivor) => Number(survivor?._deathAt || 0)));
        const candidates = deadNow.filter((survivor) => Number(survivor?._deathAt || 0) === lastAt);
        const lastWinner = candidates[Math.floor(Math.random() * candidates.length)];
        if (lastWinner) {
          const idx = newlyDead.findIndex((deadEntry) => String(deadEntry?._id) === String(lastWinner?._id));
          if (idx >= 0) newlyDead.splice(idx, 1);
          lastWinner.hp = Math.max(1, Number(lastWinner.hp || 1));
          aliveMap.set(lastWinner._id, lastWinner);
          addLog(`⚖️ 전원 폭발! 마지막까지 버틴 [${lastWinner.name}] 승리(무승부 방지)`, 'highlight');
        }
      }
    }
  }

  return {
    newlyDead,
    updatedSurvivors: normalizeRuntimeSurvivorList(Array.from(aliveMap.values())).filter((survivor) => Number(survivor.hp || 0) > 0),
  };
}
