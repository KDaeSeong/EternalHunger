import { useEffect, useRef } from 'react';
import { getMatchStartInfo } from './matchRosterRuntime';
import { createPhaseDeathRuntime } from './phaseDeathRuntime';
import { finalizeSimulationPhase } from './phaseFinalizationRuntime';
import { beginSimulationPhase, prepareForbiddenZonePhase } from './phasePreparationRuntime';
import { runPvpActionLoop } from './phasePvpActionLoopRuntime';
import { runPhaseActorActionPipeline } from './phaseActorActionPipelineRuntime';
import { runPhaseRevival } from './phaseRevivalRuntime';
import {
  buildStarterLoadoutSurvivorsForPhase,
  prepareWorldSpawnsForPhase,
} from './phaseSpawnRuntime';
import { runPhaseWorldResolution } from './phaseWorldResolutionRuntime';
import { finishSimulationGame } from './finishGameRuntime';
import {
  getAliveTeams,
  normalizeRuntimeSurvivorList,
} from './simulationEngine';

const HYPERLOOP_DELAY_SEC = 3;

export function useSimulationPhaseController({
  actions = {},
  helpers = {},
  refs = {},
  state = {},
} = {}) {
  const {
    activeMapIdRef,
    activeMapRef,
    autoSpeedRef,
    fullLogEntriesRef,
    fullLogsRef,
    isAdvancingRef,
    isFinishingRef,
    proceedPhaseGuardedRef,
    startStarterLoadoutAppliedRef,
    suddenDeathActiveRef,
    suddenDeathEndAtSecRef,
    suddenDeathForbiddenAnnouncedRef,
  } = refs;
  const {
    activeMap,
    activeMapId,
    assistCounts,
    autoPlay,
    autoSpeed,
    craftables,
    day,
    dead,
    droneOffers,
    isAdvancing,
    isGameOver,
    itemKeyById,
    itemMetaById,
    itemNameById,
    kiosks,
    killCounts,
    loading,
    matchSec,
    pendingTranscendPick,
    phase,
    publicItems,
    runSeed,
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
    grantMasteries,
    grantMastery,
    grantPvpDamageMastery,
    grantPvpKillMastery,
    normalizeAutoSpeed,
    persistSimEquipmentsFromChars,
    refreshMapSettingsFromServer,
    resetPhaseLogs,
    setAssistCounts,
    setAutoPlay,
    setCredits,
    setDay,
    setDead,
    setForbiddenAddedNow,
    setIsAdvancing,
    setIsGameOver,
    setKillCounts,
    setMatchSec,
    setPendingTranscendPick,
    setPhase,
    setResultSummary,
    setRunEvents,
    setShowResultModal,
    setSpawnState,
    setSurvivors,
    setWinner,
  } = actions;

  const matchStartInfo = getMatchStartInfo(survivors, settings);
  const startBlocked = day === 0 && !matchStartInfo.ready;
  const startBlockedText = matchStartInfo.matchMode === 'solo'
    ? `⚠️ 솔로 인원 부족 (${matchStartInfo.participantCount}/2명)`
    : `⚠️ 팀 부족 (${matchStartInfo.teamCount}/2팀 · ${matchStartInfo.participantCount}명)`;

  async function finishGame(finalSurvivors, latestKillCounts, latestAssistCounts, options = {}) {
    return finishSimulationGame({
      finalSurvivors,
      latestAssistCounts,
      latestKillCounts,
      options,
      refs: {
        fullLogsRef,
        isFinishingRef,
      },
      state: {
        assistCounts,
        dead,
        killCounts,
        settings,
      },
      actions: {
        addLog,
        setAutoPlay,
        setCredits,
        setIsGameOver,
        setResultSummary,
        setShowResultModal,
        setWinner,
      },
    });
  }
  const finishGameRef = useRef(finishGame);

  useEffect(() => {
    finishGameRef.current = finishGame;
  });

  async function proceedPhase() {
    const {
      atNow,
      baseCredits,
      battleSettings,
      canReviveThisMatch,
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
    } = beginSimulationPhase({
      refs: {
        autoSpeedRef,
        suddenDeathActiveRef,
        suddenDeathEndAtSecRef,
      },
      state: {
        autoSpeed,
        day,
        matchSec,
        phase,
        settings,
      },
      actions: {
        addLog,
        normalizeAutoSpeed,
        resetPhaseLogs,
        setDay,
        setMatchSec,
        setPhase,
      },
    });
    let earnedCredits = baseCredits;

    let pendingPickAssigned = false;

    const {
      damagePerTick,
      forbiddenIds,
      mapIdNow,
      mapObj,
      suddenDeathSafeZoneIds,
      totalZones,
    } = prepareForbiddenZonePhase({
      refs: {
        activeMapIdRef,
        activeMapRef,
        suddenDeathActiveRef,
        suddenDeathForbiddenAnnouncedRef,
      },
      state: {
        activeMap,
        activeMapId,
        nextDay,
        nextPhase,
        ruleset,
        settings,
        useDetonation,
        zones,
      },
      helpers: {
        getForbiddenAddedZoneIdsForPhase,
        getForbiddenZoneIdsForPhase,
        getZoneName,
      },
      actions: {
        addLog,
        setForbiddenAddedNow,
      },
    });

    const {
      reviveCutoffIdx,
      wipeProtectionCutoffIdx,
      revivedNow,
    } = runPhaseRevival({
      state: {
        canReviveThisMatch,
        dead,
        forbiddenIds,
        kiosks,
        mapObj,
        phaseIdxNow,
        phaseStartSec,
        publicItems,
        reviveCfg: ruleset?.revive || {},
        ruleset,
        survivors,
        useDetonation,
      },
      actions: {
        addLog,
        atNow,
        emitRunEvent,
        setDead,
      },
    });
    const nextSpawn = prepareWorldSpawnsForPhase({
      state: {
        forbiddenIds,
        mapIdNow,
        mapObj,
        matchMode: matchCfgNow.matchMode,
        nextDay,
        nextPhase,
        ruleset,
        spawnState,
        zones,
      },
      actions: {
        addLog,
        atNow,
        emitRunEvent,
      },
    });

    let phaseSurvivors = buildStarterLoadoutSurvivorsForPhase({
      refs: {
        startStarterLoadoutAppliedRef,
      },
      state: {
        nextDay,
        nextPhase,
        publicItems,
        ruleset,
        survivors,
      },
      actions: {
        addLog,
      },
    });

    if (revivedNow.length) phaseSurvivors = [...phaseSurvivors, ...revivedNow];
    phaseSurvivors = normalizeRuntimeSurvivorList(phaseSurvivors);

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
      setDead,
    });
    const movePowerContext = { ruleset, battleSettings };
    const actorActionPipelineResult = runPhaseActorActionPipeline({
      state: {
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
        phaseSurvivors,
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
    pendingPickAssigned = actorActionPipelineResult.pendingPickAssigned;
    if (Array.isArray(actorActionPipelineResult.newlyDead) && actorActionPipelineResult.newlyDead.length) {
      newlyDead.push(...actorActionPipelineResult.newlyDead);
    }
    let updatedSurvivors = Array.isArray(actorActionPipelineResult.updatedSurvivors)
      ? actorActionPipelineResult.updatedSurvivors
      : [];

    const worldResolutionResult = runPhaseWorldResolution({
      refs: {
        suddenDeathActiveRef,
      },
      state: {
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
    const pvpActionLoopResult = await runPvpActionLoop({
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
        phaseDurationSec,
        phaseIdxNow,
        phaseSurvivors,
        publicItems,
        reviveCutoffIdx,
        ruleset,
        tickSec,
        updatedSurvivors,
        useDetonation,
        zoneGraph,
      },
      actions: {
        addEarnedCredits: (amount) => {
          earnedCredits += Math.max(0, Number(amount || 0));
        },
        addLog,
        appendPhaseDeadSnapshots,
        applyErTraitAfterBattle,
        applyErWeaponSkillAfterCombat,
        atNow,
        emitConsumableRunEvent,
        emitDeathRunEventOnce,
        emitEffectRunEvents,
        emitRunEvent,
        flushDeadSnapshots,
        getZoneName,
        grantPvpDamageMastery,
        grantPvpKillMastery,
        reserveVisibleSecond,
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
    const phaseFinalizationResult = await finalizeSimulationPhase({
      refs: {
        suddenDeathActiveRef,
        suddenDeathEndAtSecRef,
      },
      state: {
        assistCounts,
        baseCredits,
        canReviveThisMatch,
        dead,
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
        addLog,
        appendPhaseDeadSnapshots,
        applyUserEconomyProgress,
        emitDeathRunEventOnce,
        finishGame,
        flushDeadSnapshots,
        persistSimEquipmentsFromChars,
        reconcileZeroHpDeaths,
        runVisibleClockToPhaseEnd,
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

  async function proceedPhaseGuarded() {
    if (isAdvancingRef.current) return;
    if (loading) return;
    if (isGameOver) return;
    const startInfo = getMatchStartInfo(survivors, settings);
    if (day === 0 && !startInfo.ready) {
      const needText = startInfo.matchMode === 'solo' ? '솔로는 생존자 2명 이상이 필요합니다.' : '스쿼드는 서로 다른 팀 2개 이상이 필요합니다.';
      addLog(`⚠️ 게임 시작 불가: ${needText} (현재 ${startInfo.participantCount}명 / ${startInfo.teamCount}팀)`, 'system');
      return;
    }
    if (showMarketPanel && pendingTranscendPick) {
      addLog('🎁 초월 장비 선택 상자: 먼저 선택을 완료하세요.', 'system');
      return;
    }

    isAdvancingRef.current = true;
    setIsAdvancing(true);
    try {
      if (day === 0 && matchSec === 0) {
        await refreshMapSettingsFromServer('start');
      }

      if (day === 0 && matchSec === 0) {
        setRunEvents([{
          kind: 'run_start',
          at: { day, phase, sec: matchSec },
          seed: runSeed,
          matchMode: startInfo.matchMode,
          teamSize: startInfo.teamSize,
          maxTeams: startInfo.maxTeams,
          participantCount: startInfo.participantCount,
          teamCount: startInfo.teamCount,
        }]);
      }
      await proceedPhase();
    } finally {
      isAdvancingRef.current = false;
      setIsAdvancing(false);
    }
  }

  useEffect(() => {
    proceedPhaseGuardedRef.current = proceedPhaseGuarded;
  });

  useEffect(() => {
    if (loading || isGameOver) return;
    if (day === 0) return;
    if (!Array.isArray(survivors)) return;
    const aliveTeams = getAliveTeams(survivors);
    if (aliveTeams.length > 1) return;
    const finalSurvivors = aliveTeams[0]?.members || survivors;
    const id = window.setTimeout(() => {
      finishGameRef.current?.(finalSurvivors, killCounts, assistCounts);
    }, 0);
    return () => window.clearTimeout(id);
  }, [survivors, day, loading, isGameOver, killCounts, assistCounts]);

  useEffect(() => {
    if (!autoPlay) return;
    if (loading) return;
    if (isAdvancing) return;
    if (isGameOver) return;
    if (showMarketPanel && pendingTranscendPick) return;
    if (startBlocked) return;

    const speed = normalizeAutoSpeed(autoSpeedRef.current || autoSpeed);
    const delayMs = Math.max(80, Math.round(220 / speed));

    const id = window.setTimeout(() => {
      proceedPhaseGuardedRef.current?.();
    }, delayMs);

    return () => window.clearTimeout(id);
  }, [autoPlay, autoSpeed, autoSpeedRef, matchSec, loading, isAdvancing, isGameOver, showMarketPanel, pendingTranscendPick, day, phase, settings?.rulesetId, survivors.length, startBlocked, normalizeAutoSpeed, proceedPhaseGuardedRef]);

  return {
    proceedPhase,
    proceedPhaseGuarded,
    startBlocked,
    startBlockedText,
  };
}
