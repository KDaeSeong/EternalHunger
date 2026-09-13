import { createPhaseDeathRuntime } from './phaseDeathRuntime';
import { finalizeSimulationPhase } from './phaseFinalizationRuntime';
import { runPvpActionLoop } from './phasePvpActionLoopRuntime';
import { runPhaseActorActionPipeline } from './phaseActorActionPipelineRuntime';
import { runSimulationPhaseSetup } from './simulationPhaseSetupRuntime';
import { runPhaseWorldResolution } from './phaseWorldResolutionRuntime';
import { runDimensionRiftPhase } from './phaseDimensionRiftRuntime';
import { createPhaseActionTimeline } from './phaseActionTimelineRuntime';
import { advanceSpatialMovement, syncSpatialPositions } from './combatSpatialRuntime.js';
import { applyActorPhaseStatusTick } from './phaseActorStatusRuntime';
import { runDetonationTickPhase } from './phaseDetonationTickRuntime';
import { advanceEndgamePressure } from './suddenDeathRuntime';
import { getMatchEndState } from './matchEndRuntime';
import { combineSimulationCounts, createSimulationFrame, publishSimulationFrame } from './simulationFrameRuntime';
import { createSeedRng } from './randomSeedRuntime';
import { getActiveSimulationRandom, runSimulationSteps } from '../../../utils/simulationRandom.js';
import { advanceTimedWildlifeEffects, getWildlifeCombatRoster } from './wildlifeCombatRuntime.js';
import { requestSimulationMainThreadYield } from './simulationCooperativeYieldRuntime.js';

const HYPERLOOP_DELAY_SEC = 3;

export function runSimulationPhaseCycle(options = {}) {
  const { runRandomRef } = options.refs || {};
  const { day, matchSec, runSeed } = options.state || {};
  if (runRandomRef && (!runRandomRef.current || (day === 0 && matchSec === 0))) {
    runRandomRef.current = createSeedRng(`RUN:${String(runSeed || '').trim() || '0'}`);
  }
  return runSimulationSteps(runRandomRef?.current || getActiveSimulationRandom(), simulationPhaseSteps(options));
}

function* simulationPhaseSteps({
  actions = {},
  helpers = {},
  refs = {},
  state = {},
} = {}) {
  // Revival payments and runtime normalization may mutate actors. Own these
  // inputs before setup; neither the previous render nor a saved frame is live.
  state = { ...state, survivors: structuredClone(state.survivors || []), dead: structuredClone(state.dead || []) };
  let currentDead = state.dead;
  let currentForbiddenAdded = [];
  const runtimeActions = { ...actions,
    setDay: () => {}, setPhase: () => {}, setMatchSec: () => {},
    setDead: (value) => { currentDead = typeof value === 'function' ? value(currentDead) : value; },
    setForbiddenAddedNow: (value) => { currentForbiddenAdded = value; },
  };
  const {
    activeMapIdRef,
    activeMapRef,
    autoSpeedRef,
    fullLogEntriesRef,
    startStarterLoadoutAppliedRef,
    suddenDeathActiveRef,
    suddenDeathEndAtSecRef,
    suddenDeathForbiddenAnnouncedRef,
  } = refs;
  const {
    activeMap,
    activeMapId,
    assistCounts,
    autoSpeed,
    craftables,
    day,
    dead,
    droneOffers,
    itemKeyById,
    itemMetaById,
    itemNameById,
    kiosks,
    killCounts,
    matchSec,
    pendingTranscendPick,
    phase,
    publicItems,
    selectedCharId,
    settings,
    showMarketPanel,
    spawnState,
    survivors,
    zoneGraph,
    zones,
  } = state;
  const {
    getForbiddenAddedZoneIdsForPhase,
    getForbiddenZoneIdsForPhase,
    getZoneName,
    isHyperloopTransit,
  } = helpers;
  const {
    addLog,
    applyErTraitAfterBattle,
    applyErWeaponSkillAfterCombat,
    applyLootCraftResult,
    applyUserEconomyProgress,
    emitConsumableRunEvent,
    emitCraftRunEvent,
    emitEffectRunEvents,
    emitItemGainIfAny,
    emitObjectiveRunEvent,
    emitQueueRunEvent,
    emitRunEvent,
    finishGame,
    grantMasteries,
    grantMastery,
    grantPvpDamageMastery,
    grantPvpKillMastery,
    normalizeAutoSpeed,
    persistSimEquipmentsFromChars,
    resetPhaseLogs,
    setAssistCounts,
    setDay,
    setDead,
    setForbiddenAddedNow,
    setKillCounts,
    setMatchSec,
    setPendingTranscendPick,
    setPhase,
    setSpawnState,
    setSurvivors,
  } = actions;

  const {
    atNow: phaseAtNow,
    baseCredits,
    battleSettings,
    canReviveThisMatch,
    commitVisibleClock,
    currentActionSec: phaseCurrentActionSec,
    damagePerTick,
    fogLocalSec,
    forbiddenIds,
    getPhaseRuntimeOffsetSec,
    isSoloMatch,
    mapObj,
    marketRules,
    nextDay,
    nextPhase,
    nextSpawn,
    phaseDurationSec,
    phaseIdxNow,
    phaseStartSec,
    phaseSurvivors,
    reserveActionSecond,
    reviveCutoffIdx,
    ruleset,
    runVisibleClockToPhaseEnd,
    suddenDeathSafeZoneIds,
    tickSec,
    useDetonation,
    wipeProtectionCutoffIdx,
  } = runSimulationPhaseSetup({
    actions: runtimeActions,
    helpers,
    refs,
    state,
  });
  let earnedCredits = baseCredits;
  let pendingPickAssigned = false;
  let timelineActionSec = null;
  const currentActionSec = () => timelineActionSec ?? phaseCurrentActionSec();
  const atNow = () => ({ ...phaseAtNow(), sec: currentActionSec() });
  const actionIntervalSec = Math.max(1, Math.floor(Number(ruleset?.ai?.growthActionIntervalSec) || 20));

  const newlyDead = [];
  const phaseDeathLogStartIndex = Array.isArray(fullLogEntriesRef.current) ? fullLogEntriesRef.current.length : 0;
  const {
    appendPhaseDeadSnapshots,
    emitDeathRunEventOnce,
    flushDeadSnapshots,
    phaseDeadSnapshots,
    reconcileZeroHpDeaths,
    setDeathMetadata,
  } = createPhaseDeathRuntime({
    addLog,
    atNow,
    currentActionSec,
    emitRunEvent,
    fullLogEntriesRef,
    phaseDeathLogStartIndex,
    phaseIdxNow,
    ruleset,
    setDead: runtimeActions.setDead,
  });
  const movePowerContext = { ruleset, battleSettings };
  const runGrowthActions = (roster) => runPhaseActorActionPipeline({
    state: {
      actionIntervalSec,
      statusElapsedSec: 0,
      canReviveThisMatch,
      craftables,
      currentActionSec,
      damagePerTick,
      droneOffers,
      forbiddenIds,
      hyperloopDelaySec: HYPERLOOP_DELAY_SEC,
      isSoloMatch,
      itemKeyById,
      itemMetaById,
      itemNameById,
      kiosks,
      mapObj,
      marketRules,
      movePowerContext,
      nextDay,
      nextPhase,
      nextSpawn,
      pendingPickAssigned,
      pendingTranscendPick,
      phaseDurationSec,
      phaseIdxNow,
      phaseSurvivors: roster,
      publicItems,
      reviveCutoffIdx,
      ruleset,
      selectedCharId,
      showMarketPanel,
      useDetonation,
      zoneGraph,
      zones,
    },
    actions: {
      addLog,
      applyLootCraftResult,
      atNow,
      emitCraftRunEvent,
      emitDeathRunEventOnce,
      emitItemGainIfAny,
      emitObjectiveRunEvent,
      emitQueueRunEvent,
      emitRunEvent,
      getZoneName,
      grantMastery,
      grantMasteries,
      isHyperloopTransit,
      reserveActionSecond,
      setDeathMetadata,
      setPendingTranscendPick,
    },
  });
  let updatedSurvivors = phaseSurvivors;
  const getRiftRevivalContext = () => ({ canReviveThisMatch, reviveCfg: ruleset?.revive || {},
    dead: [...currentDead, ...phaseDeadSnapshots], rosterComplete: true });

  const worldResolutionResult = runPhaseWorldResolution({
    refs: {
      suddenDeathActiveRef,
    },
    state: {
      deferTimeTicks: true,
      revivalContext: getRiftRevivalContext(),
      canReviveThisMatch,
      currentActionSec,
      fogLocalSec,
      forbiddenIds,
      isSoloMatch,
      itemMetaById,
      itemNameById,
      mapObj,
      movePowerContext,
      newlyDead,
      nextDay,
      nextPhase,
      nextSpawn,
      phaseDurationSec,
      phaseIdxNow,
      phaseStartSec,
      publicItems,
      reviveCutoffIdx,
      ruleset,
      suddenDeathSafeZoneIds,
      tickSec,
      updatedSurvivors,
      useDetonation,
      zoneGraph,
      zones,
    },
    actions: {
      addLog,
      appendPhaseDeadSnapshots,
      atNow,
      emitDeathRunEventOnce,
      emitItemGainIfAny,
      emitRunEvent,
      flushDeadSnapshots,
      getZoneName,
      setDeathMetadata,
    },
  });
  updatedSurvivors = worldResolutionResult.updatedSurvivors;
  const advanceRifts = (roster) => runDimensionRiftPhase({
    state: { currentActionSec, forbiddenIds, isSoloMatch, itemMetaById, itemNameById,
      nextDay, nextPhase, nextSpawn, phaseIdxNow, phaseStartSec, phaseDurationSec,
      publicItems, ruleset, updatedSurvivors: roster, revivalContext: getRiftRevivalContext() },
    actions: { addLog, atNow, emitItemGainIfAny, emitRunEvent, getZoneName },
  });
  let liveMap;
  let timelineDeadIds;
  const shouldEndMatch = () => getMatchEndState({
    survivors: [...liveMap.values()].filter((actor) => !timelineDeadIds.includes(actor._id)),
    dead: [...currentDead, ...phaseDeadSnapshots], canReviveThisMatch, phaseIdxNow, wipeProtectionCutoffIdx,
  }).finished;
  const publishFrame = (overrides = {}) => publishSimulationFrame(createSimulationFrame({
    day: nextDay, phase: nextPhase, matchSec: Math.round((phaseStartSec + getPhaseRuntimeOffsetSec()) * 1e6) / 1e6,
    dead: [...currentDead, ...phaseDeadSnapshots], spawnState: nextSpawn,
    forbiddenIds, forbiddenAddedNow: currentForbiddenAdded, mapId: mapObj?._id,
    ...overrides,
  }), actions);
  const commitTimelineActors = (actors, deaths = []) => {
    actors.forEach((actor) => liveMap.set(String(actor._id), actor));
    deaths.forEach((actor) => {
      liveMap.set(String(actor._id), actor);
      if (!timelineDeadIds.includes(actor._id)) timelineDeadIds.push(actor._id);
    });
    if (deaths.length) flushDeadSnapshots(appendPhaseDeadSnapshots(deaths));
  };
  const timeline = createPhaseActionTimeline({
    durationSec: phaseDurationSec,
    intervalSec: actionIntervalSec,
    onGrowth: (offset) => {
      timelineActionSec = Math.round((phaseStartSec + offset) * 1e6) / 1e6;
      // Admission/closure and damaged saved memberships are boundaries at this
      // exact second. Resolve them before field growth can inspect the actor.
      advanceRifts([...liveMap.values()]);
      if (shouldEndMatch()) return;
      const result = runGrowthActions([...liveMap.values()].filter((actor) => Number(actor.hp) > 0 && !timelineDeadIds.includes(actor._id)));
      pendingPickAssigned = result.pendingPickAssigned;
      commitTimelineActors(result.updatedSurvivors, result.newlyDead);
      syncSpatialPositions(getWildlifeCombatRoster([...liveMap.values()]));
      advanceRifts([...liveMap.values()]);
    },
    onElapsed: (offset, elapsedSec) => {
      timelineActionSec = Math.round((phaseStartSec + offset) * 1e6) / 1e6;
      // Quarantine invalid arena memberships before movement, DOT and field
      // hazards process this interval. The post-interval observation below
      // still commits defeats and deadlines that occur at its far boundary.
      advanceRifts([...liveMap.values()]);
      advanceSpatialMovement(getWildlifeCombatRoster([...liveMap.values()]), phaseStartSec + offset, elapsedSec);
      timelineActionSec = Math.round((phaseStartSec + offset + elapsedSec) * 1e6) / 1e6;
      advanceTimedWildlifeEffects([...liveMap.values()], { startSec: phaseStartSec + offset, elapsedSec });
      const statusActors = [];
      const statusDeaths = [];
      for (const actor of liveMap.values()) {
        if (Number(actor.hp) <= 0 || timelineDeadIds.includes(actor._id)) continue;
        const result = applyActorPhaseStatusTick({
          state: { actor, elapsedSec, startSec: phaseStartSec + offset, canReviveThisMatch, phaseIdxNow, reviveCutoffIdx },
          actions: { addLog, emitDeathRunEventOnce, setDeathMetadata, emitRunEvent, atNow },
        });
        (result.died ? statusDeaths : statusActors).push(result.actor);
      }
      const detonation = runDetonationTickPhase({
        state: {
          canReviveThisMatch, fogLocalSec, forbiddenIds, mapObj, phaseDurationSec,
          startOffsetSec: offset, endOffsetSec: offset + elapsedSec,
          phaseIdxNow, phaseStartSec, reviveCutoffIdx, ruleset,
          suddenDeathActive: Boolean(suddenDeathActiveRef?.current), tickSec: 1,
          updatedSurvivors: statusActors, useDetonation, zoneGraph,
          intervalStartActors: [...liveMap.values()],
        },
        actions: { addLog, atNow, emitDeathRunEventOnce, getZoneName, setDeathMetadata },
      });
      commitTimelineActors(detonation.updatedSurvivors, [...statusDeaths, ...detonation.newlyDead]);
      // Resolve the elapsed interval with its existing zones, then announce the
      // boundary change before movement/growth at that exact same second.
      const previousForbiddenCount = forbiddenIds.size;
      if (advanceEndgamePressure(nextSpawn.endgame, forbiddenIds, timelineActionSec, { addLog, emitRunEvent, atNow, getZoneName })) {
        currentForbiddenAdded = [...forbiddenIds].slice(previousForbiddenCount);
      }
      advanceRifts([...liveMap.values()]);
    },
  });
  const advanceWorld = ({ survivorMap, newDeadIds, offsetSec }) => {
    liveMap = survivorMap;
    timelineDeadIds = newDeadIds;
    try {
      timeline.advanceTo(offsetSec);
      timelineActionSec = Math.round((phaseStartSec + offsetSec) * 1e6) / 1e6;
      advanceRifts([...liveMap.values()]);
    }
    finally { timelineActionSec = null; }
  };
  const phaseSetupYield = requestSimulationMainThreadYield();
  if (phaseSetupYield) yield phaseSetupYield;
  const pvpActionLoopResult = yield runPvpActionLoop({
    state: {
      battleSettings,
      canReviveThisMatch,
      craftables,
      currentActionSec,
      fogLocalSec,
      forbiddenIds,
      getPhaseRuntimeOffsetSec,
      isSoloMatch,
      itemMetaById,
      itemNameById,
      mapObj,
      nextDay,
      nextPhase,
      nextSpawn,
      phaseDurationSec,
      phaseIdxNow,
      phaseSurvivors: updatedSurvivors,
      publicItems,
      reviveCutoffIdx,
      ruleset,
      tickSec,
      updatedSurvivors,
      useDetonation,
      zoneGraph,
    },
    actions: {
      requestMainThreadYield: requestSimulationMainThreadYield,
      advanceWorld,
      shouldEndMatch,
      resolveWorldObjectives: ({ survivorMap }) => advanceRifts([...survivorMap.values()]),
      publishActionFrame: async ({ survivorMap, roundKills, roundAssists, wait = true }) => {
        publishFrame({ survivors: [...survivorMap.values()],
          killCounts: combineSimulationCounts(killCounts, roundKills),
          assistCounts: isSoloMatch ? {} : combineSimulationCounts(assistCounts, roundAssists) });
        if (wait) await commitVisibleClock();
      },
      addEarnedCredits: (amount) => {
        earnedCredits += Math.max(0, Number(amount || 0));
      },
      addLog,
      applyLootCraftResult,
      appendPhaseDeadSnapshots,
      applyErTraitAfterBattle,
      applyErWeaponSkillAfterCombat,
      atNow,
      emitConsumableRunEvent,
      emitDeathRunEventOnce,
      emitEffectRunEvents,
      emitItemGainIfAny,
      emitObjectiveRunEvent,
      emitRunEvent,
      flushDeadSnapshots,
      getZoneName,
      grantPvpDamageMastery,
      grantPvpKillMastery,
      grantMasteries,
      reserveActionSecond,
      setDeathMetadata,
    },
  });
  const {
    estimatePower,
    newDeadIds,
    roundAssists,
    roundKills,
    survivorMap,
  } = pvpActionLoopResult;
  const phaseFinalizationYield = requestSimulationMainThreadYield();
  if (phaseFinalizationYield) yield phaseFinalizationYield;
  const phaseFinalizationResult = yield finalizeSimulationPhase({
    refs: {
      suddenDeathActiveRef,
      suddenDeathEndAtSecRef,
    },
    state: {
      assistCounts,
      battleSettings,
      baseCredits,
      canReviveThisMatch,
      dead: currentDead,
      earnedCredits,
      estimatePower,
      getPhaseRuntimeOffsetSec,
      isSoloMatch,
      killCounts,
      matchSec,
      newDeadIds,
      nextDay,
      nextPhase,
      nextSpawn,
      phaseDeadSnapshots,
      phaseDurationSec,
      phaseIdxNow,
      phaseStartSec,
      reviveCutoffIdx,
      wipeProtectionCutoffIdx,
      roundAssists,
      roundKills,
      ruleset,
      survivorMap,
    },
    actions: {
      publishFinalFrame: publishFrame,
      addLog,
      appendPhaseDeadSnapshots,
      applyUserEconomyProgress,
      emitDeathRunEventOnce,
      finishGame,
      flushDeadSnapshots,
      persistSimEquipmentsFromChars,
      reconcileZeroHpDeaths,
      runVisibleClockToPhaseEnd,
      emitRunEvent,
      setAssistCounts,
      setDeathMetadata,
      setKillCounts,
      setMatchSec,
      setSpawnState,
      setSurvivors,
    },
  });
  if (phaseFinalizationResult?.shouldReturn) return;
}
