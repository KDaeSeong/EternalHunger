import { simulationRandom } from '../../../utils/simulationRandom.js';
import { buildErBehaviorModifier } from '../../../utils/erMeta';
import {
  EFFECT_AIRBORNE,
  EFFECT_STUN,
  hasActionBlockStatus,
  canMoveByStatus,
  isTargetableByStatus,
  getForcedControlEffect,
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
  shouldAvoidCombatByPvpPower,
} from './pvpMatchupRuntime';
import {
  buildPvpPhaseRuntime,
  pickPvpTarget,
} from './pvpPhaseRuntime';
import { resolvePvpAvoidanceMove } from './phasePvpAvoidanceRuntime';
import { assessTeamCombat } from './teamTacticsRuntime';
import { findNextCombatAction, roundCombatTime } from './combatTimingRuntime.js';
import { startCharacterCast, finishCharacterCast, reconcileCharacterCasts, findCharacterSkillChoice } from './characterCastRuntime.js';
import { resolveRiftKnockbacks } from './riftDisplacementRuntime.js';
import { getCombatIntentOpponents } from './combatTimingRuntime.js';
import { getActiveSimulationRandom, runSimulationSteps } from '../../../utils/simulationRandom.js';
import { canObserveActor, syncSpatialPositions } from './combatSpatialRuntime.js';
import { reconcileForcedControls } from './forcedControlRuntime.js';
import { getCombatSpaceId } from '../../../utils/combatSpaceLogic.js';
import { getWildlifeMasteryEntries } from '../../../utils/masteryLogic.js';
import { runHuntAction } from './phaseHuntActionRuntime.js';
import {
  collectTimedWildlifeOutcomes,
  completeTimedWildlifeEncounter,
  findNextWildlifeAction,
  getWildlifeCombatRoster,
  releaseTimedWildlifeEncounter,
  resolveTimedWildlifeAction,
  settleWildlifeClaim,
} from './wildlifeCombatRuntime.js';

export function runPvpActionLoop(options = {}) {
  return runSimulationSteps(getActiveSimulationRandom(), pvpActionSteps(options));
}

function* pvpActionSteps({
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
    nextSpawn = null,
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
    applyLootCraftResult = () => {},
    advanceWorld = () => {},
    shouldEndMatch = () => false,
    resolveWorldObjectives = () => {},
    addLog = () => {},
    appendPhaseDeadSnapshots = (actor) => actor,
    applyErTraitAfterBattle = () => null,
    applyErWeaponSkillAfterCombat = () => null,
    atNow = () => null,
    emitConsumableRunEvent = () => {},
    emitDeathRunEventOnce = () => {},
    emitEffectRunEvents = () => {},
    emitItemGainIfAny = () => {},
    emitObjectiveRunEvent = () => {},
    emitRunEvent = () => {},
    flushDeadSnapshots = () => {},
    getZoneName = (zoneId) => String(zoneId || ''),
    grantPvpDamageMastery = () => {},
    grantPvpKillMastery = () => {},
    grantMasteries = () => {},
    reserveActionSecond = () => {},
    publishActionFrame = () => Promise.resolve(),
    requestMainThreadYield = () => null,
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
  const survivorMap = buildRuntimeSurvivorMap(normalizeRuntimeSurvivorList(updatedSurvivors));
  const estimatePower = (actor) => estimatePvpPower(actor, pvpMatchupContext);
  const shouldAvoidCombatByPower = (actor, opponent) => {
    const individual = shouldAvoidCombatByPvpPower(actor, opponent, pvpMatchupContext);
    if (isSoloMatch || suddenDeath) return individual;
    const info = assessTeamCombat(actor, [...survivorMap.values()], {
      estimatePower, minRatio: Number(ruleset?.ai?.fightAvoidMinRatio ?? 0.4),
    });
    if (info.allyCount <= 1 && info.enemyCount <= 1) return individual;
    return info.shouldAvoid ? { myP: info.allyPower, opP: info.enemyPower, ratio: info.powerRatio, ...info } : null;
  };

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


  const runEncounter = (actor, target, actionType = 'discover', preparedSkill = null) => runPhaseCombatEncounter({
    state: { actor, target, assistWindowPhases, battleSettings, canReviveThisMatch, craftables,
      currentActionSec, estimatePower, forbiddenIds, isSoloMatch, itemMetaById, itemNameById,
      newDeadIds, nextDay, phaseIdxNow, phaseSurvivors, publicItems, restrictedRatio,
      reviveCutoffIdx, roundAssists, roundKills, ruleset, shouldAvoidCombatByPower,
      survivorMap, todaysSurvivors, totalZonesCount, useDetonation, zoneGraph, actionType, preparedSkill },
    actions: { addEarnedCredits, addLog, appendPhaseDeadSnapshots, applyErTraitAfterBattle,
      applyErWeaponSkillAfterCombat, atNow, emitDeathRunEventOnce, emitEffectRunEvents, emitRunEvent,
      flushDeadSnapshots, getZoneName, grantPvpDamageMastery, grantPvpKillMastery,
      setDeathMetadata, tryUseConsumable },
  });
  const castActions = { addLog, atNow, emitRunEvent };
  const reconcileCasts = () => {
    const roster = getWildlifeCombatRoster([...survivorMap.values()]);
    resolveRiftKnockbacks(roster, currentActionSec(), castActions);
    reconcileCharacterCasts(roster, currentActionSec(), battleSettings, castActions);
    reconcileForcedControls(roster, currentActionSec(), castActions);
  };
  const reconcileWildlife = () => {
    for (const outcome of collectTimedWildlifeOutcomes([...survivorMap.values()])) {
      const { actor, encounter } = outcome;
      if (!actor?._wildlifeHunt || String(actor._wildlifeHunt.id) !== String(encounter.id)) continue;
      if (outcome.type === 'cancel') {
        releaseTimedWildlifeEncounter(actor, nextSpawn, outcome.reason, { addLog, atNow, emitRunEvent }, currentActionSec());
        continue;
      }
      if (outcome.type === 'hunter_defeated') {
        settleWildlifeClaim(nextSpawn, encounter, { defeated: false, actor, at: atNow() });
        actor._wildlifeHunt = null;
        actor._huntActionKey = encounter.actionKey;
        actor.hp = 0;
        const priorDeathReason = String(actor._deathBy || actor.deathReason || '');
        const wildlifeCaused = !priorDeathReason || priorDeathReason === 'wildlife_hunt'
          || String(actor.lastDamagedBy || '') === String(encounter.target?._id || '');
        if (!wildlifeCaused) {
          emitRunEvent('hunt_end', { who: String(actor._id || ''), encounterId: encounter.id, kind: encounter.kind,
            zoneId: encounter.zoneId, wildlifeName: encounter.target?.name, outcome: 'interrupted_by_death',
            reason: actor._deathCauseName || actor.deathCauseName || priorDeathReason,
            damageDealt: encounter.damageDealt, damageTaken: encounter.damageTaken }, atNow());
          continue;
        }
        setDeathMetadata(actor, 'wildlife_hunt', { causeName: '야생동물의 실제 공격', by: String(encounter.target?._id || '') });
        actor.deadAtPhaseIdx = phaseIdxNow;
        actor.reviveEligible = canReviveThisMatch && phaseIdxNow <= reviveCutoffIdx;
        const entries = getWildlifeMasteryEntries({ damageDealt: encounter.damageDealt, damageTaken: encounter.damageTaken });
        if (entries.length) grantMasteries(actor, entries, '실시간 사냥');
        actor.hp = 0;
        addLog(`💀 [${actor.name}]이(가) ${encounter.target?.name || '야생동물'}의 공격으로 사망했습니다.`, 'death');
        emitDeathRunEventOnce(actor, { reason: 'wildlife_hunt', cause: '야생동물의 실제 공격', by: String(encounter.target?._id || '') });
        emitRunEvent('hunt_settlement', { who: String(actor._id || ''), encounterId: encounter.id,
          actionKey: encounter.actionKey, zoneId: encounter.zoneId, kind: encounter.kind, defeated: false, died: true,
          hpBefore: encounter.startedHp, hpAfter: 0, damage: encounter.damageTaken, damageDealt: encounter.damageDealt,
          credits: 0, receivedDrops: [], unreceivedDrops: [], posthumous: false, settlement: 'actual_encounter' }, atNow());
        emitRunEvent('hunt_end', { who: String(actor._id || ''), encounterId: encounter.id, kind: encounter.kind,
          zoneId: encounter.zoneId, wildlifeName: encounter.target?.name, outcome: 'hunter_defeated', damageDealt: encounter.damageDealt,
          damageTaken: encounter.damageTaken }, atNow());
        if (!newDeadIds.includes(String(actor._id))) newDeadIds.push(String(actor._id));
        flushDeadSnapshots(appendPhaseDeadSnapshots([actor]));
        continue;
      }
      if (outcome.type === 'target_defeated') {
        const completed = completeTimedWildlifeEncounter(actor, nextSpawn, { atNow, emitRunEvent });
        if (!completed) continue;
        runHuntAction({
          state: {
            actor,
            canReviveThisMatch,
            craftables,
            currentActionSec,
            itemMetaById,
            itemNameById,
            mapObj,
            nextDay,
            nextPhase,
            nextSpawn,
            phaseIdxNow,
            publicItems,
            reviveCutoffIdx,
            ruleset,
            preparedHunt: completed.reward,
            preparedHuntRole: completed.isBossReward ? 'boss' : completed.isMutantReward ? 'mutant' : 'ordinary',
            actualDamageDealt: completed.damageDealt,
            actualDamageTaken: completed.damageTaken,
            damageAlreadyApplied: true,
            encounterId: completed.id,
            settlementHpBefore: completed.startedHp,
          },
          actions: {
            addLog,
            applyLootCraftResult,
            atNow,
            emitDeathRunEventOnce,
            emitItemGainIfAny,
            emitObjectiveRunEvent,
            emitRunEvent,
            grantMasteries,
            setDeathMetadata,
          },
        });
        emitRunEvent('hunt_end', { who: String(actor._id || ''), encounterId: completed.id, kind: completed.kind,
          zoneId: completed.zoneId, wildlifeName: completed.target?.name, outcome: 'victory', damageDealt: completed.damageDealt,
          damageTaken: completed.damageTaken, elapsedSec: roundCombatTime(currentActionSec() - completed.startedAtSec) }, atNow());
      }
    }
  };
  let nextDecisionSec = roundCombatTime(currentActionSec() + tickSec);

  const initialWorldYield = requestMainThreadYield();
  if (initialWorldYield) yield initialWorldYield;
  advanceWorld({ survivorMap, newDeadIds, offsetSec: getPhaseRuntimeOffsetSec() });
  syncSpatialPositions(getWildlifeCombatRoster([...survivorMap.values()]));
  reconcileWildlife();
  reconcileCasts();
  const initialPublishYield = requestMainThreadYield();
  if (initialPublishYield) yield initialPublishYield;
  yield publishActionFrame({ survivorMap, newDeadIds, roundKills, roundAssists, wait: false });
  while (getPhaseRuntimeOffsetSec() < phaseDurationSec) {
    advanceWorld({ survivorMap, newDeadIds, offsetSec: getPhaseRuntimeOffsetSec() });
    syncSpatialPositions(getWildlifeCombatRoster([...survivorMap.values()]));
    reconcileWildlife();
    reconcileCasts();
    if (shouldEndMatch()) break;
    try {
      const nextPvpCombat = findNextCombatAction(survivorMap, currentActionSec(), newDeadIds, battleSettings);
      const nextWildlifeCombat = findNextWildlifeAction(survivorMap, currentActionSec(), newDeadIds, battleSettings, ruleset);
      const nextCombat = nextPvpCombat && (!nextWildlifeCombat || nextPvpCombat.atSec <= nextWildlifeCombat.atSec)
        ? { ...nextPvpCombat, scheduler: 'pvp' }
        : nextWildlifeCombat ? { ...nextWildlifeCombat, scheduler: 'wildlife' } : null;
      const scheduled = nextCombat && nextCombat.atSec <= nextDecisionSec;
      const actionAtSec = scheduled ? nextCombat.atSec : nextDecisionSec;
      reserveActionSecond(Math.max(0, roundCombatTime(actionAtSec - currentActionSec())));
      advanceWorld({ survivorMap, newDeadIds, offsetSec: getPhaseRuntimeOffsetSec() });
      reconcileWildlife();
      reconcileCasts();
      if (shouldEndMatch() || getPhaseRuntimeOffsetSec() >= phaseDurationSec) break;
      if (scheduled) {
        if (nextCombat.scheduler === 'wildlife') {
          const result = resolveTimedWildlifeAction(nextCombat, {
            survivorMap,
            nowSec: currentActionSec(),
            battleSettings,
            ruleset,
            phaseIdxNow,
            actions: { addLog, applyErTraitAfterBattle, applyErWeaponSkillAfterCombat, atNow,
              emitEffectRunEvents, emitRunEvent },
          });
          if (result.fled) {
            const fleeingActor = survivorMap.get(String(nextCombat.ownerId || ''));
            if (fleeingActor) releaseTimedWildlifeEncounter(fleeingActor, nextSpawn, '체력 열세로 후퇴',
              { addLog, atNow, emitRunEvent }, currentActionSec());
          }
          reconcileWildlife();
          continue;
        }
        const actor = survivorMap.get(nextCombat.actorId);
        const target = survivorMap.get(nextCombat.targetId);
        // Re-read after elapsed status/death/growth work; never use stale actors.
        if (actor && nextCombat.combatSpaceId !== getCombatSpaceId(actor)) continue;
        if (nextCombat.actionType === 'skill_expire' || nextCombat.actionType === 'approach' || nextCombat.actionType === 'status_boundary') continue;
        if (actor && nextCombat.actionType === 'skill_release') {
          const prepared = finishCharacterCast(actor, currentActionSec(), castActions);
          if (prepared && target) runEncounter(actor, target, 'skill_release', prepared);
        } else if (actor && nextCombat.actionType === 'skill_start') {
          const roster = [...survivorMap.values()];
          const choice = findCharacterSkillChoice(actor, getCombatIntentOpponents(actor, roster, currentActionSec()), roster, currentActionSec(), battleSettings);
          startCharacterCast(actor, choice, currentActionSec(), battleSettings, castActions);
        } else if (actor && target) runEncounter(actor, target, 'basic');
        continue;
      }
      nextDecisionSec = roundCombatTime(nextDecisionSec + tickSec);
      if (todaysSurvivors.length <= 0) refillActionWave();
      const queuedActor = todaysSurvivors.pop();
      let actor = queuedActor?._id ? survivorMap.get(String(queuedActor._id)) : null;
      if (!actor) continue;
      actor = normalizeRuntimeSurvivor(actor);
      if (actor._wildlifeHunt) {
        upsertRuntimeSurvivor(survivorMap, actor);
        continue;
      }
      decayActorSatiety(actor, consCfg?.satietyDecayPerAction ?? 1);

      if (!actor?._id || newDeadIds.includes(actor._id) || actor.hp <= 0) continue;
      if (getForcedControlEffect(actor)) continue;
      if (Number(actor._actionReadyAtSec || 0) > currentActionSec()) continue;
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
      const potentialTargets = [...survivorMap.values()].filter((target) => {
        if (!target || newDeadIds.includes(target._id)) return false;
        if (Number(target.hp || 0) <= 0) return false;
        if (!isTargetableByStatus(target)) return false;
        if (String(target?._id || '') === String(actor?._id || '')) return false;
        if (areSameTeam(actor, target)) return false;
        if (String(target?.zoneId || '') !== String(actor?.zoneId || '')) return false;
        if (actorRecoveryLocked || isAiRecoveryLocked(target, currentActionSec())) return false;
        return canObserveActor(actor, target, [...survivorMap.values()]);
      });
      const canDual = potentialTargets.length >= (pvpMinSameZone - 1);

      const dangerUntil = Number(actor?._immediateDangerUntilPhaseIdx ?? -1);
      if (dangerUntil > -1 && dangerUntil < phaseIdxNow) {
        actor._immediateDanger = 0;
        actor._immediateDangerUntilPhaseIdx = null;
      }

      const pvpTarget = canDual ? pickPvpTarget(potentialTargets, survivorMap, phaseIdxNow) : null;
      const rand = simulationRandom();

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

      if (canDual && earlyRouteFarming && rand < battleProb2 && pvpTarget && canMoveByStatus(actor)) {
        const baseAvoid = Number(pvpProbCfg.earlyRouteFarmAvoidChance ?? 0.72);
        const avoidChance = Math.max(0.12, Math.min(0.92,
          baseAvoid
          + Number(actorEr?.escapeBonus || 0) * 0.55
          - Math.max(0, actorAggro) * 0.12
          - (immediateDangerNow ? 0.28 : 0)
        ));
        if (simulationRandom() < avoidChance) {
          actor = upsertRuntimeSurvivor(survivorMap, actor);
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
              estimatePower,
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
        if (avoidInfo && canMoveByStatus(actor)) {
          const opponentName = String(targetEval?.name || '상대');
          const delta = Number(avoidInfo.opP || 0) - Number(avoidInfo.myP || 0);
          const avoidChanceBase = Number(ruleset?.ai?.fightAvoidChance ?? 0.75);
          const avoidChance = Math.min(0.95, avoidChanceBase + Math.min(0.25, actorMs * 1.5));
          const extremeRatio = Number(ruleset?.ai?.fightAvoidExtremeRatio ?? 0.30);
          const extremeDelta = Number(ruleset?.ai?.fightAvoidExtremeDelta ?? 25);
          const willAvoid = suddenDeath ? false : ((avoidInfo.ratio < extremeRatio || delta >= extremeDelta) ? true : (simulationRandom() < avoidChance));

          if (!willAvoid) {
            addLog(`🔥 [${actor.name}] 불리하지만 [${opponentName}]과 교전합니다!`, 'highlight');
          } else {
            actor = upsertRuntimeSurvivor(survivorMap, actor);
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
                estimatePower,
                safeZoneSec: 4,
                survivorMap,
                zoneGraph,
              },
              text: {
                holdLog: () => `🏃 [${actor.name}] 전투력 열세로 [${opponentName}] 교전 회피${avoidInfo.enemyCount ? ` (아군 ${avoidInfo.allyCount}명 / 적 ${avoidInfo.enemyCount}명)` : ''}`,
                holdReason: 'avoid_power_hold',
                holdRecoverSec: 4,
                moveLog: ({ dest, from }) => `🏃 [${actor.name}] 전투력 열세로 [${opponentName}] 교전 회피: ${getZoneName(from)} → ${getZoneName(dest)}${avoidInfo.enemyCount ? ` (아군 ${avoidInfo.allyCount}명 / 적 ${avoidInfo.enemyCount}명)` : ''}`,
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
        // Consumables and turn-start state belong to the authoritative roster.
        actor = upsertRuntimeSurvivor(survivorMap, actor);

        const combatEncounterResult = runEncounter(actor, target);
        actor = combatEncounterResult.actor || actor;
        target = combatEncounterResult.target || target;
        if (combatEncounterResult.skipRemainingTurn) continue;
      }

      upsertRuntimeSurvivor(survivorMap, actor);
    } finally {
      resolveWorldObjectives({ survivorMap, newDeadIds });
      reconcileWildlife();
      reconcileCasts();
      // Including skipped, travelling, stunned, dead, and match-ending turns:
      // resolve first, let the browser handle input/paint, publish the complete
      // frame, then wait for display time. The yield changes no game state.
      const framePublishYield = requestMainThreadYield();
      if (framePublishYield) yield framePublishYield;
      yield publishActionFrame({ survivorMap, newDeadIds, roundKills, roundAssists });
    }
  }
  advanceWorld({ survivorMap, newDeadIds, offsetSec: getPhaseRuntimeOffsetSec() });
  reconcileWildlife();
  const matchEnded = shouldEndMatch();
  const phaseEnded = getPhaseRuntimeOffsetSec() >= phaseDurationSec;
  if (matchEnded || phaseEnded) {
    const releaseReason = matchEnded ? '경기 종료' : '시간대 전환';
    for (const actor of survivorMap.values()) {
      if (actor?._wildlifeHunt) releaseTimedWildlifeEncounter(actor, nextSpawn, releaseReason,
        { addLog, atNow, emitRunEvent }, currentActionSec());
    }
    reconcileCasts();
  }

  return {
    estimatePower,
    newDeadIds,
    roundAssists,
    roundKills,
    survivorMap,
  };
}
