import { worldPhaseIndex } from './worldTime';

function getForbiddenCount(forbiddenIds) {
  if (forbiddenIds instanceof Set) return forbiddenIds.size;
  if (Array.isArray(forbiddenIds)) return forbiddenIds.length;
  return 0;
}

function buildPvpPhaseRuntime(opts = {}) {
  const {
    fogLocalSec = null,
    forbiddenIds,
    mapObj,
    nextDay = 1,
    nextPhase = 'morning',
    ruleset = {},
  } = opts;

  const pvpProbCfg = ruleset?.pvp || {};
  const fogBonus = (ruleset.id === 'ER_S11' && fogLocalSec !== null && fogLocalSec !== undefined)
    ? Number(pvpProbCfg.encounterFogBonus ?? 0.08)
    : 0;
  const battleBase = Number(pvpProbCfg.encounterBase ?? 0.3);
  const battleScale = Number(pvpProbCfg.encounterDayScale ?? 0.05);
  const battleMax = Number(pvpProbCfg.encounterMax ?? 0.85);
  const suddenDeath = worldPhaseIndex(nextDay, nextPhase) >= worldPhaseIndex(6, 'night');

  const totalZonesCount = Math.max(1, Array.isArray(mapObj?.zones) ? mapObj.zones.length : 19);
  const restrictedRatio = Math.max(0, Math.min(1, getForbiddenCount(forbiddenIds) / totalZonesCount));
  const paceBonus = suddenDeath ? 0.35 : Math.min(0.25, 0.05 + Math.max(0, nextDay - 1) * 0.02 + restrictedRatio * 0.25);
  const battleCap = suddenDeath ? 0.99 : Math.max(battleMax, 0.88);
  const isDay1MorningFarmPhase = nextDay === 1 && nextPhase === 'morning';
  const battleProb = isDay1MorningFarmPhase
    ? 0
    : Math.min(battleCap, battleBase + nextDay * battleScale + fogBonus + paceBonus);

  const eventOffset = Number(pvpProbCfg.eventOffset ?? 0.3);
  const eventMax = Number(pvpProbCfg.eventMax ?? 0.95);
  const eventProbBase = Math.min(eventMax, (battleProb * 0.55) + eventOffset + restrictedRatio * 0.10);
  const eventProb = isDay1MorningFarmPhase
    ? Math.min(eventProbBase, Math.max(0, Math.min(0.12, Number(pvpProbCfg.day1MorningPairEventProb ?? 0.02))))
    : eventProbBase;

  const pvpMinSameZone = Math.max(2, Math.floor(Number(pvpProbCfg.encounterMinSameZone ?? 2)));
  const assistWindowPhases = Math.max(1, Math.floor(Number(pvpProbCfg.assistWindowPhases ?? 2)));
  const earlyRouteFarmPhase = isDay1MorningFarmPhase || (nextDay === 1 && nextPhase === 'night') || (nextDay === 2 && nextPhase === 'morning');
  const isEarlyRouteFarmingActor = (actor) => {
    if (!earlyRouteFarmPhase || suddenDeath) return false;
    const plan = Array.isArray(actor?.routePlanZoneIds) ? actor.routePlanZoneIds : [];
    if (!plan.length) return false;
    return Math.max(0, Number(actor?.routePlanIndex || 0)) < plan.length;
  };

  return {
    assistWindowPhases,
    battleProb,
    earlyRouteFarmPhase,
    eventProb,
    isDay1MorningFarmPhase,
    isEarlyRouteFarmingActor,
    pvpMinSameZone,
    pvpProbCfg,
    restrictedRatio,
    suddenDeath,
  };
}

function pickPvpTarget(list, survivorMap, phaseIdxNow, rng = Math.random) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const noisy = list.filter((target) => {
    const runtimeTarget = survivorMap?.get?.(target?._id);
    return Number(runtimeTarget?._immediateDanger || 0) > 0
      && Number(runtimeTarget?._immediateDangerUntilPhaseIdx ?? -1) === phaseIdxNow;
  });
  const pool = noisy.length ? noisy : list;
  const picked = pool[Math.floor(rng() * pool.length)];
  return picked ? survivorMap?.get?.(picked._id) || null : null;
}

export {
  buildPvpPhaseRuntime,
  pickPvpTarget,
};
