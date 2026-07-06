import { buildErBehaviorModifier } from '../../../utils/erMeta';
import {
  EFFECT_AIRBORNE,
  EFFECT_STUN,
  hasActionBlockStatus,
} from '../../../utils/statusLogic';
import {
  areSameTeam,
  buildRuntimeSurvivorMap,
  getEquipMoveSpeed,
  getPerkAggressionBias,
  hasActiveEffect,
  isAiRecoveryLocked,
  normalizeRuntimeSurvivor,
  normalizeRuntimeSurvivorList,
  shuffleArray,
  upsertRuntimeSurvivor,
} from './simulationEngine';
import { decayActorSatiety } from './satietyRuntime';
import { createPhaseConsumableRuntime } from './consumableRuntime';
import { runPhaseCombatEncounter } from './phaseCombatEncounterRuntime';
import {
  estimatePvpPower,
  pickUnbiasedBattle as pickUnbiasedBattleRuntime,
  shouldAvoidCombatByPvpPower,
} from './pvpMatchupRuntime';
import {
  buildPvpPhaseRuntime,
  pickPvpTarget,
} from './pvpPhaseRuntime';
import { resolvePvpAvoidanceMove } from './phasePvpAvoidanceRuntime';

export async function runPvpActionLoop({
  actions = {},
  state = {},
} = {}) {
  const {
    battleSettings = {},
    canReviveThisMatch = false,
    craftables,
    currentActionSec = () => 0,
    fogLocalSec = 0,
    forbiddenIds = new Set(),
    getPhaseRuntimeOffsetSec = () => 0,
    isSoloMatch = false,
    itemMetaById,
    itemNameById,
    mapObj,
    nextDay = 1,
    nextPhase = 'morning',
    phaseDurationSec = 0,
    phaseIdxNow = 0,
    phaseSurvivors = [],
    publicItems = [],
    reviveCutoffIdx = 0,
    ruleset = {},
    tickSec = 1,
    updatedSurvivors = [],
    useDetonation = false,
    zoneGraph = {},
  } = state;
  const {
    addEarnedCredits = () => {},
    addLog = () => {},
    appendPhaseDeadSnapshots = (actor) => actor,
    applyErTraitAfterBattle = () => null,
    applyErWeaponSkillAfterCombat = () => null,
    atNow = () => null,
    emitConsumableRunEvent = () => {},
    emitDeathRunEventOnce = () => {},
    emitEffectRunEvents = () => {},
    emitRunEvent = () => {},
    flushDeadSnapshots = () => {},
    getZoneName = (zoneId) => String(zoneId || ''),
    grantPvpDamageMastery = () => {},
    grantPvpKillMastery = () => {},
    reserveActionSecond = () => {},
    reserveVisibleSecond = () => Promise.resolve(),
    setDeathMetadata = () => {},
  } = actions;
  const {
    assistWindowPhases,
    battleProb,
    isDay1MorningFarmPhase,
    isEarlyRouteFarmingActor,
    pvpMinSameZone,
    pvpProbCfg,
    restrictedRatio,
    suddenDeath,
    totalZonesCount,
  } = buildPvpPhaseRuntime({
    fogLocalSec,
    forbiddenIds,
    mapObj,
    nextDay,
    nextPhase,
    ruleset,
  });

  if (!battleSettings.battle) battleSettings.battle = {};
  battleSettings.battle.pressure = restrictedRatio;
  battleSettings.battle.isNight = (nextPhase === 'night');
  const pvpMatchupContext = { ruleset, battleSettings, nextDay };
  const estimatePower = (actor) => estimatePvpPower(actor, pvpMatchupContext);
  const shouldAvoidCombatByPower = (actor, opponent) => shouldAvoidCombatByPvpPower(actor, opponent, pvpMatchupContext);
  const pickUnbiasedBattle = (actor, opponent) => pickUnbiasedBattleRuntime(actor, opponent, pvpMatchupContext);

  const survivorMap = buildRuntimeSurvivorMap(normalizeRuntimeSurvivorList(updatedSurvivors));
  let todaysSurvivors = [];
  const newDeadIds = [];
  const refillActionWave = () => {
    const liveActors = Array.from(survivorMap.values())
      .filter((survivor) => survivor?._id && !newDeadIds.includes(survivor._id) && Number(survivor.hp || 0) > 0)
      .map((survivor) => normalizeRuntimeSurvivor(survivor));
    todaysSurvivors = shuffleArray(liveActors);
    return todaysSurvivors.length;
  };

  const roundKills = {};
  const roundAssists = {};

  const consCfg = ruleset?.consumables || {};
  const { tryUseConsumable } = createPhaseConsumableRuntime({
    addLog,
    atNow,
    consCfg,
    emitConsumableRunEvent,
    emitEffectRunEvents,
    phaseIdxNow,
    survivorMap,
  });

  while (getPhaseRuntimeOffsetSec() < phaseDurationSec) {
    if (todaysSurvivors.length <= 0 && refillActionWave() <= 0) break;

    let actor = todaysSurvivors.pop();
    actor = actor?._id ? survivorMap.get(String(actor._id)) : null;
    if (!actor) continue;
    actor = normalizeRuntimeSurvivor(actor);
    decayActorSatiety(actor, consCfg?.satietyDecayPerAction ?? 1);
    await reserveVisibleSecond(tickSec);

    if (!actor?._id || newDeadIds.includes(actor._id) || actor.hp <= 0) continue;
    if (hasActionBlockStatus(actor)) {
      const blockName = hasActiveEffect(actor, EFFECT_STUN)
        ? EFFECT_STUN
        : hasActiveEffect(actor, EFFECT_AIRBORNE)
          ? EFFECT_AIRBORNE
          : '행동 불가';
      addLog(`💫 [${actor.name}] ${blockName} 상태로 행동하지 못했습니다.`, 'system');
      upsertRuntimeSurvivor(survivorMap, actor);
      continue;
    }

    tryUseConsumable(actor, 'turn_start');

    let gatherPvpBonus = 0;
    const gatherUntil = Number(actor?._gatherPvpBonusUntilPhaseIdx ?? -1);
    if (gatherUntil === phaseIdxNow) {
      gatherPvpBonus = Math.max(0, Number(actor?._gatherPvpBonus || 0));
    } else if (gatherUntil > -1 && gatherUntil < phaseIdxNow) {
      actor._gatherPvpBonus = 0;
      actor._gatherPvpBonusUntilPhaseIdx = null;
    }

    const actorRecoveryLocked = isAiRecoveryLocked(actor, currentActionSec());
    const potentialTargets = todaysSurvivors.filter((target) => {
      if (!target || newDeadIds.includes(target._id)) return false;
      if (String(target?._id || '') === String(actor?._id || '')) return false;
      if (areSameTeam(actor, target)) return false;
      if (String(target?.zoneId || '') !== String(actor?.zoneId || '')) return false;
      if (actorRecoveryLocked || isAiRecoveryLocked(target, currentActionSec())) return false;
      return true;
    });
    const canDual = potentialTargets.length >= (pvpMinSameZone - 1);

    const dangerUntil = Number(actor?._immediateDangerUntilPhaseIdx ?? -1);
    if (dangerUntil > -1 && dangerUntil < phaseIdxNow) {
      actor._immediateDanger = 0;
      actor._immediateDangerUntilPhaseIdx = null;
    }

    const pvpTarget = canDual ? pickPvpTarget(potentialTargets, survivorMap, phaseIdxNow) : null;
    const rand = Math.random();

    const midgameCombatWindow = !suddenDeath && Number(nextDay || 0) >= 2 && Number(nextDay || 0) <= 4;
    const lowHpAvoidCombat = !suddenDeath && Number(actor.hp || 0) > 0 && Number(actor.hp || 0) <= Number(ruleset?.ai?.recoverHpBelow ?? 38);
    const densityFactor = Math.min(1, Math.max(0, potentialTargets.length / 3));
    const pressureMult = 0.75 + 0.25 * restrictedRatio;
    const densityMult = 0.55 + 0.45 * densityFactor;
    const nightMult = (nextPhase === 'night') ? 1.05 : 1.0;
    const actorAggro = getPerkAggressionBias(actor);
    const midgameEncounterBonus = midgameCombatWindow ? Math.max(0, Number(pvpProbCfg.midgameEncounterBonus ?? 0.10)) : 0;
    const lowHpEncounterMult = lowHpAvoidCombat
      ? Math.max(0.12, Math.min(1, Number(midgameCombatWindow ? (pvpProbCfg.midgameLowHpEncounterMult ?? 0.70) : (pvpProbCfg.lowHpEncounterMult ?? 0.38))))
      : 1;
    const battleProb2Base = suddenDeath ? Math.max(0.95, battleProb) : (battleProb * densityMult * pressureMult * nightMult * lowHpEncounterMult);
    const actorMs = getEquipMoveSpeed(actor);
    const actorEr = buildErBehaviorModifier(actor, battleSettings);
    const earlyRouteFarming = isEarlyRouteFarmingActor(actor);
    const immediateDangerNow = Number(actor?._immediateDanger || 0) > 0 && Number(actor?._immediateDangerUntilPhaseIdx ?? -1) === phaseIdxNow;
    const actorObjectivePressure = Number(actor?._objectiveContestUntilPhaseIdx ?? -1) === phaseIdxNow
      ? Math.max(0, Number(actor?._objectiveContestPressure || 0))
      : 0;
    if (Number(actor?._objectiveContestUntilPhaseIdx ?? -1) > -1 && Number(actor?._objectiveContestUntilPhaseIdx ?? -1) < phaseIdxNow) {
      actor._objectiveContestType = '';
      actor._objectiveContestSubkind = '';
      actor._objectiveContestPressure = 0;
      actor._objectiveContestUntilPhaseIdx = null;
    }
    const targetObjectivePressure = pvpTarget && Number(pvpTarget?._objectiveContestUntilPhaseIdx ?? -1) === phaseIdxNow
      ? Math.max(0, Number(pvpTarget?._objectiveContestPressure || 0))
      : 0;
    const objectiveEncounterBonus = suddenDeath ? 0 : Math.max(actorObjectivePressure, targetObjectivePressure);
    const earlyFarmEncounterMult = earlyRouteFarming ? Math.max(0.05, Math.min(1, Number(pvpProbCfg.earlyRouteFarmEncounterMult ?? 0.38))) : 1;
    const evadeBonus = suddenDeath ? 0 : Math.min(0.18, actorMs * 0.9);
    const aggressionEncounterBonus = suddenDeath ? 0 : Math.max(-0.06, Math.min(0.16, actorAggro * 0.18));
    const erEncounterBonus = suddenDeath ? 0 : Math.max(-0.08, Math.min(0.16, Number(actorEr?.aggressionBias || 0) + Number(actorEr?.chaseBonus || 0) * 0.35 - Number(actorEr?.escapeBonus || 0) * 0.45));
    const battleProb2 = isDay1MorningFarmPhase
      ? 0
      : Math.min(0.99, Math.max(0, battleProb2Base * earlyFarmEncounterMult + gatherPvpBonus * (earlyRouteFarming ? 0.55 : 1) + objectiveEncounterBonus + midgameEncounterBonus + aggressionEncounterBonus + erEncounterBonus - evadeBonus));
    if (lowHpAvoidCombat && canDual) {
      addLog(`🛡️ [${actor.name}] 저HP로 교전 회피`, 'system');
    }

    if (canDual && earlyRouteFarming && rand < battleProb2 && pvpTarget) {
      const baseAvoid = Number(pvpProbCfg.earlyRouteFarmAvoidChance ?? 0.72);
      const avoidChance = Math.max(0.12, Math.min(0.92,
        baseAvoid
        + Number(actorEr?.escapeBonus || 0) * 0.55
        - Math.max(0, actorAggro) * 0.12
        - (immediateDangerNow ? 0.28 : 0)
      ));
      if (Math.random() < avoidChance) {
        resolvePvpAvoidanceMove({
          actions: { addLog, atNow, emitRunEvent, getZoneName },
          state: {
            actor,
            currentActionSec,
            forbiddenIds,
            newDeadIds,
            opponent: pvpTarget,
            reason: 'early_route_avoid',
            recoverSec: 4,
            ruleset,
            safeZoneSec: 3,
            survivorMap,
            zoneGraph,
          },
          text: {
            holdLog: () => `🏃 [${actor.name}] 초반 루트 파밍 중 교전 회피`,
            holdReason: 'early_route_avoid_hold',
            holdRecoverSec: 3,
            moveLog: ({ dest, from }) => `🏃 [${actor.name}] 초반 루트 파밍 중 교전 회피: ${getZoneName(from)} → ${getZoneName(dest)}`,
          },
        });
        continue;
      }
    }

    if (canDual && rand < battleProb2) {
      const targetEval = pvpTarget;
      const avoidInfo = targetEval ? shouldAvoidCombatByPower(actor, targetEval) : null;
      if (avoidInfo) {
        const opponentName = String(targetEval?.name || '상대');
        const delta = Number(avoidInfo.opP || 0) - Number(avoidInfo.myP || 0);
        const avoidChanceBase = Number(ruleset?.ai?.fightAvoidChance ?? 0.75);
        const avoidChance = Math.min(0.95, avoidChanceBase + Math.min(0.25, actorMs * 1.5));
        const extremeRatio = Number(ruleset?.ai?.fightAvoidExtremeRatio ?? 0.30);
        const extremeDelta = Number(ruleset?.ai?.fightAvoidExtremeDelta ?? 25);
        const willAvoid = suddenDeath ? false : ((avoidInfo.ratio < extremeRatio || delta >= extremeDelta) ? true : (Math.random() < avoidChance));

        if (!willAvoid) {
          addLog(`🔥 [${actor.name}] 불리하지만 [${opponentName}]과 교전합니다!`, 'highlight');
        } else {
          resolvePvpAvoidanceMove({
            actions: { addLog, atNow, emitRunEvent, getZoneName },
            state: {
              actor,
              currentActionSec,
              forbiddenIds,
              newDeadIds,
              opponent: targetEval,
              reason: 'avoid_power',
              recoverSec: 6,
              ruleset,
              safeZoneSec: 4,
              survivorMap,
              zoneGraph,
            },
            text: {
              holdLog: () => `🏃 [${actor.name}] 전투력 열세로 [${opponentName}] 교전 회피`,
              holdReason: 'avoid_power_hold',
              holdRecoverSec: 4,
              moveLog: ({ dest, from }) => `🏃 [${actor.name}] 전투력 열세로 [${opponentName}] 교전 회피: ${getZoneName(from)} → ${getZoneName(dest)}`,
            },
          });
          continue;
        }
      }
    }

    if (canDual && rand < battleProb2) {
      let target = pvpTarget;
      if (!target) {
        upsertRuntimeSurvivor(survivorMap, actor);
        continue;
      }

      const targetIndex = todaysSurvivors.findIndex((candidate) => candidate._id === target._id);
      if (targetIndex > -1) todaysSurvivors.splice(targetIndex, 1);

      const combatEncounterResult = runPhaseCombatEncounter({
        state: {
          actor,
          assistWindowPhases,
          battleSettings,
          canReviveThisMatch,
          craftables,
          currentActionSec,
          estimatePower,
          forbiddenIds,
          isDay1MorningFarmPhase,
          isSoloMatch,
          itemMetaById,
          itemNameById,
          midgameCombatWindow,
          newDeadIds,
          nextDay,
          phaseIdxNow,
          phaseSurvivors,
          pickUnbiasedBattle,
          publicItems,
          restrictedRatio,
          reviveCutoffIdx,
          roundAssists,
          roundKills,
          ruleset,
          shouldAvoidCombatByPower,
          survivorMap,
          target,
          todaysSurvivors,
          totalZonesCount,
          useDetonation,
          zoneGraph,
        },
        actions: {
          addEarnedCredits,
          addLog,
          appendPhaseDeadSnapshots,
          applyErTraitAfterBattle,
          applyErWeaponSkillAfterCombat,
          atNow,
          emitDeathRunEventOnce,
          emitEffectRunEvents,
          emitRunEvent,
          flushDeadSnapshots,
          getZoneName,
          grantPvpDamageMastery,
          grantPvpKillMastery,
          reserveActionSecond,
          setDeathMetadata,
          tryUseConsumable,
        },
      });
      actor = combatEncounterResult.actor || actor;
      target = combatEncounterResult.target || target;
      if (combatEncounterResult.skipRemainingTurn) continue;
    }

    upsertRuntimeSurvivor(survivorMap, actor);
  }

  return {
    estimatePower,
    newDeadIds,
    roundAssists,
    roundKills,
    survivorMap,
  };
}
