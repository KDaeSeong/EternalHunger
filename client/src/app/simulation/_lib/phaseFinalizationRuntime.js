import { getRuntimeActorKey } from './runtimeParticipantRuntime';
import { normalizeRuntimeSurvivor } from './survivorRuntime';
import { getMatchEndState } from './matchEndRuntime';
import { closeDimensionRiftsAtMatchEnd } from './dimensionRiftMatchEndRuntime.js';
import { getActiveSimulationRandom, runSimulationSteps } from '../../../utils/simulationRandom.js';

export function finalizeSimulationPhase(options = {}) {
  return runSimulationSteps(getActiveSimulationRandom(), finalizationSteps(options));
}

function* finalizationSteps({ actions = {}, state = {} } = {}) {
  const { assistCounts = {}, baseCredits = 0, canReviveThisMatch = false, dead = [],
    getPhaseRuntimeOffsetSec = () => 0, isSoloMatch = false, killCounts = {}, newDeadIds = [],
    nextDay = 1, nextPhase = 'morning', nextSpawn, phaseDeadSnapshots = [], phaseDurationSec = 0,
    phaseIdxNow = 0, phaseStartSec = 0, reviveCutoffIdx = 0, wipeProtectionCutoffIdx = -1,
    roundAssists = {}, roundKills = {}, survivorMap = new Map(), ruleset = {}, battleSettings = {},
  } = state;
  const { addLog = () => {}, finishGame = () => {}, persistSimEquipmentsFromChars = () => Promise.resolve(),
    reconcileZeroHpDeaths = () => {}, runVisibleClockToPhaseEnd = () => Promise.resolve(),
    setAssistCounts = () => {}, setKillCounts = () => {}, setMatchSec = () => {},
    setSpawnState = () => {}, setSurvivors = () => {}, emitRunEvent = () => {},
    publishFinalFrame,
  } = actions;

  reconcileZeroHpDeaths({ canReviveThisMatch, newDeadIds, reviveCutoffIdx, survivorMap });
  const updatedKillCounts = { ...killCounts };
  for (const [id, kills] of Object.entries(roundKills)) updatedKillCounts[id] = (updatedKillCounts[id] || 0) + kills;
  const updatedAssistCounts = isSoloMatch ? {} : { ...assistCounts };
  if (!isSoloMatch) for (const [id, assists] of Object.entries(roundAssists)) updatedAssistCounts[id] = (updatedAssistCounts[id] || 0) + assists;

  const finalStepSurvivors = [...survivorMap.values()]
    .filter((actor) => Number(actor.hp) > 0 && !newDeadIds.includes(actor._id))
    .map((actor) => normalizeRuntimeSurvivor(actor));
  const finalAliveIds = new Set(finalStepSurvivors.map((actor) => String(actor._id)));
  const finalDead = [...new Map([...dead, ...phaseDeadSnapshots].map((actor) => [getRuntimeActorKey(actor), actor])).values()]
    .filter((actor) => !finalAliveIds.has(String(actor._id)));
  const ending = getMatchEndState({ survivors: finalStepSurvivors, dead: finalDead,
    canReviveThisMatch, phaseIdxNow, wipeProtectionCutoffIdx });
  if (ending.deferredForRevive) addLog('🛡️ 부활 가능한 팀이 남아 있어 경기 종료를 보류합니다.', 'system');
  if (!ending.finished) yield runVisibleClockToPhaseEnd();

  const endedAtSec = Math.round((phaseStartSec + (ending.finished ? getPhaseRuntimeOffsetSec() : phaseDurationSec)) * 1e6) / 1e6;
  const riftEnd = ending.finished ? closeDimensionRiftsAtMatchEnd(nextSpawn, [...finalDead, ...finalStepSurvivors], {
    nowSec: endedAtSec, day: nextDay, phase: nextPhase, ruleset, battleSettings, actions: { addLog, emitRunEvent },
  }) : null;
  if (baseCredits > 0) finalStepSurvivors.forEach((actor) => { actor.simCredits = Number(actor.simCredits || 0) + baseCredits; });
  persistSimEquipmentsFromChars(finalStepSurvivors, `phase:d${nextDay}_${nextPhase}`).catch(() => {});
  if (publishFinalFrame) {
    publishFinalFrame({ survivors: finalStepSurvivors, dead: finalDead, spawnState: nextSpawn,
      matchSec: endedAtSec, killCounts: updatedKillCounts, assistCounts: updatedAssistCounts });
  } else {
    setSurvivors(finalStepSurvivors);
    setSpawnState(nextSpawn);
    setMatchSec(endedAtSec);
    setKillCounts(updatedKillCounts);
    setAssistCounts(updatedAssistCounts);
  }
  if (ending.finished) {
    const at = { day: nextDay, phase: nextPhase, sec: endedAtSec };
    const lastDeath = phaseDeadSnapshots.slice().sort((a, b) => Number(b._deathAt || 0) - Number(a._deathAt || 0))[0];
    const summary = { outcome: ending.outcome, atSec: endedAtSec, day: nextDay, phase: nextPhase,
      cause: String(lastDeath?._deathBy || lastDeath?.deathReason || ''),
      causeName: String(lastDeath?._deathCauseName || lastDeath?.deathCauseName || ''),
      finalZoneStage: nextSpawn?.endgame?.stage || '', winnerTeamId: ending.aliveTeams[0]?.teamId || '',
      dimensionRifts: riftEnd?.summary || null };
    emitRunEvent('match_end', summary, at);
    finishGame(ending.aliveTeams[0]?.members || [], updatedKillCounts, updatedAssistCounts, { finalDead, ending: summary });
  }
  return { finalAliveTeams: ending.aliveTeams, finalStepSurvivors, shouldReturn: ending.finished, updatedAssistCounts, updatedKillCounts };
}
