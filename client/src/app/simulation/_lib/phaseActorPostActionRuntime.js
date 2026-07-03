import { shouldForceDay1HeroGearCatchup } from './routePlanProgressRuntime';

export function runActorPostActionPhase({
  actions = {},
  state = {},
} = {}) {
  const {
    actor,
    canReviveThisMatch = false,
    damagePerTick = 0,
    forbiddenIds = new Set(),
    nextDay,
    nextPhase,
    phaseIdxNow = 0,
    reviveCutoffIdx = -1,
    ruleset,
    sourceActor,
    useDetonation = false,
  } = state;
  const {
    addLog = () => {},
    emitDeathRunEventOnce = () => {},
    getZoneName = (zoneId) => String(zoneId || ''),
    runDay1HeroGear = () => {},
    setDeathMetadata = () => {},
  } = actions;

  const updated = actor || {};
  const forceEarlyHeroRouteCompletionAnyAction = shouldForceDay1HeroGearCatchup(updated, nextDay, nextPhase);
  if (forceEarlyHeroRouteCompletionAnyAction) {
    runDay1HeroGear(updated, {
      allowAbstractFallback: true,
      forceRouteCompletion: true,
      routeCompletionTier: Number(ruleset?.ai?.day1AbstractFallbackMaxTier ?? 4),
    });
  }

  if (ruleset?.id === 'ER_S11') {
    const energyCfg = ruleset?.gadgetEnergy || {};
    const maxEnergy = Number(energyCfg.max ?? 100);
    const gain = Number(energyCfg.gainPerPhase ?? 10);
    const curEnergy = Number(updated.gadgetEnergy ?? 0);
    updated.gadgetEnergy = Math.min(maxEnergy, curEnergy + gain);
    if (!updated.cooldowns) updated.cooldowns = { portableSafeZone: 0, cnotGate: 0 };
    if (updated.safeZoneUntil === undefined || updated.safeZoneUntil === null) updated.safeZoneUntil = 0;
  }

  if (useDetonation) {
    const detCfg = ruleset?.detonation || {};
    if (updated.detonationSec === undefined || updated.detonationSec === null) updated.detonationSec = Number(detCfg.startSec ?? 20);
    if (updated.detonationMaxSec === undefined || updated.detonationMaxSec === null) updated.detonationMaxSec = Number(detCfg.maxSec ?? 30);
  }

  if (!useDetonation) {
    if (forbiddenIds.size > 0 && forbiddenIds.has(String(updated.zoneId))) {
      updated.hp = Math.max(0, Number(updated.hp || 0) - damagePerTick);
      if (updated.hp > 0) {
        addLog(`☠️ [${updated.name}] 금지구역(${getZoneName(updated.zoneId)}) 피해: HP -${damagePerTick}`, 'death');
      }
    }

    if (updated.hp <= 0 && Number(sourceActor?.hp || 0) > 0) {
      setDeathMetadata(updated, 'forbidden_zone', { causeName: '금지구역 피해' });
      addLog(`💀 [${sourceActor?.name || updated.name}]이(가) 금지구역을 벗어나지 못하고 사망했습니다.`, 'death');
      updated.deadAtPhaseIdx = phaseIdxNow;
      updated.reviveEligible = canReviveThisMatch && phaseIdxNow <= reviveCutoffIdx;
      emitDeathRunEventOnce(updated, { reason: 'forbidden_zone', cause: '금지구역 피해' });
      return {
        actor: updated,
        died: true,
      };
    }
  }

  return {
    actor: updated,
    died: false,
  };
}
