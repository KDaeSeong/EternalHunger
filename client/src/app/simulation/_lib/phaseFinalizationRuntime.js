import { apiPost } from '../../../utils/api';
import { dedupeRuntimeParticipants } from './runtimeParticipantRuntime';
import { normalizeRuntimeSurvivor } from './survivorRuntime';
import {
  areSameTeam,
  getActorTeamId,
  getActorTeamName,
  getAliveTeams,
  pickTeamRepresentative,
} from './teamRuntime';
import { runForcedSuddenDeathClash } from './suddenDeathRuntime';

export async function finalizeSimulationPhase({
  actions = {},
  refs = {},
  state = {},
} = {}) {
  const {
    suddenDeathActiveRef,
    suddenDeathEndAtSecRef,
  } = refs;
  const {
    assistCounts = {},
    baseCredits = 0,
    canReviveThisMatch = false,
    dead = [],
    earnedCredits = 0,
    estimatePower = () => 0,
    getPhaseRuntimeOffsetSec = () => 0,
    isSoloMatch = false,
    killCounts = {},
    matchSec = 0,
    newDeadIds = [],
    nextDay = 1,
    nextPhase = 'morning',
    nextSpawn,
    phaseDeadSnapshots = [],
    phaseDurationSec = 0,
    phaseIdxNow = 0,
    phaseStartSec = 0,
    reviveCutoffIdx = 0,
    wipeProtectionCutoffIdx = -1,
    roundAssists = {},
    roundKills = {},
    ruleset,
    survivorMap = new Map(),
  } = state;
  const {
    addLog = () => {},
    appendPhaseDeadSnapshots = (actor) => actor,
    applyUserEconomyProgress = () => {},
    emitDeathRunEventOnce = () => {},
    finishGame = () => {},
    flushDeadSnapshots = () => {},
    persistSimEquipmentsFromChars = () => Promise.resolve(),
    reconcileZeroHpDeaths = () => {},
    runVisibleClockToPhaseEnd = () => Promise.resolve(),
    setAssistCounts = () => {},
    setDeathMetadata = () => {},
    setKillCounts = () => {},
    setMatchSec = () => {},
    setSpawnState = () => {},
    setSurvivors = () => {},
  } = actions;

  runForcedSuddenDeathClash({
    addLog,
    appendPhaseDeadSnapshots,
    assistCounts,
    emitDeathRunEventOnce,
    estimatePower,
    flushDeadSnapshots,
    killCounts,
    newDeadIds,
    phaseIdxNow,
    roundAssists,
    roundKills,
    ruleset,
    setDeathMetadata,
    suddenDeathActive: Boolean(suddenDeathActiveRef?.current),
    survivorMap,
  });

  reconcileZeroHpDeaths({
    canReviveThisMatch,
    newDeadIds,
    reviveCutoffIdx,
    survivorMap,
  });

  const updatedKillCounts = { ...killCounts };
  Object.keys(roundKills).forEach((killerId) => {
    updatedKillCounts[killerId] = (updatedKillCounts[killerId] || 0) + roundKills[killerId];
  });
  setKillCounts(updatedKillCounts);

  const updatedAssistCounts = isSoloMatch ? {} : { ...assistCounts };
  if (!isSoloMatch) {
    Object.keys(roundAssists).forEach((assistId) => {
      updatedAssistCounts[assistId] = (updatedAssistCounts[assistId] || 0) + (roundAssists[assistId] || 0);
    });
  }
  setAssistCounts(updatedAssistCounts);

  const finalStepSurvivors = Array.from(survivorMap.values())
    .filter((survivor) => !newDeadIds.includes(survivor?._id))
    .map((survivor) => normalizeRuntimeSurvivor(survivor));

  if (baseCredits > 0 && finalStepSurvivors.length > 0) {
    finalStepSurvivors.forEach((survivor) => {
      survivor.simCredits = Number(survivor.simCredits || 0) + baseCredits;
    });
  }

  persistSimEquipmentsFromChars(
    (Array.isArray(finalStepSurvivors) ? finalStepSurvivors : []),
    `phase:d${nextDay}_${nextPhase}`
  ).catch(() => {});

  const sdEndAt = suddenDeathEndAtSecRef?.current;
  const sdRemainAfter = (suddenDeathActiveRef?.current && typeof sdEndAt === 'number')
    ? Math.ceil(sdEndAt - (matchSec + phaseDurationSec))
    : null;
  const finalAliveTeams = getAliveTeams(finalStepSurvivors);
  const aliveTeamIds = new Set(finalAliveTeams.map((team) => String(team?.teamId || '')).filter(Boolean));
  const wipeProtectionActive = canReviveThisMatch && phaseIdxNow <= wipeProtectionCutoffIdx;
  const reviveProtectedDeadTeamIds = new Set(
    dedupeRuntimeParticipants([...(Array.isArray(dead) ? dead : []), ...phaseDeadSnapshots])
      .filter((actor) => {
        const deadAt = Number(actor?.deadAtPhaseIdx ?? -9999);
        return wipeProtectionActive
          && deadAt >= 0
          && deadAt <= wipeProtectionCutoffIdx
          && !actor?.revivedOnce;
      })
      .map((actor) => getActorTeamId(actor))
      .filter(Boolean)
  );
  const protectedContestTeamIds = new Set([...aliveTeamIds, ...reviveProtectedDeadTeamIds]);
  const shouldDeferEliminationForRevive = wipeProtectionActive
    && finalAliveTeams.length <= 1
    && protectedContestTeamIds.size > finalAliveTeams.length;
  const shouldFinishByElimination = finalAliveTeams.length <= 1 && !shouldDeferEliminationForRevive;
  if (shouldDeferEliminationForRevive) {
    addLog('🛡️ 스쿼드 전멸 방지: 2일차 낮까지 부활 가능한 팀이 남아 있어 게임 종료를 보류합니다.', 'system');
  }
  if (!shouldFinishByElimination) {
    await runVisibleClockToPhaseEnd();
  }

  if (suddenDeathActiveRef?.current && typeof sdEndAt === 'number' && sdRemainAfter <= 0 && finalAliveTeams.length > 1) {
    const scoredTeams = finalAliveTeams
      .map((team) => ({
        ...team,
        hpSum: team.members.reduce((sum, member) => sum + Math.max(0, Number(member?.hp || 0)), 0),
        kills: team.members.reduce((sum, member) => sum + Number(updatedKillCounts?.[member?._id] || 0), 0),
      }))
      .sort((a, b) => (b.hpSum - a.hpSum) || (b.kills - a.kills) || (b.members.length - a.members.length));
    const topScore = Number(scoredTeams[0]?.hpSum || 0);
    const topList = scoredTeams.filter((team) => Number(team?.hpSum || 0) === topScore);
    const winningTeam = topList[Math.floor(Math.random() * topList.length)] || scoredTeams[0];
    const forcedWinner = pickTeamRepresentative(winningTeam?.members || [], updatedKillCounts, updatedAssistCounts);
    const forcedDead = finalStepSurvivors
      .filter((survivor) => !areSameTeam(survivor, forcedWinner))
      .map((survivor) => {
        const deadActor = { ...survivor, hp: 0 };
        setDeathMetadata(deadActor, 'sudden_death_timeout', { causeName: '서든데스 시간 만료' });
        deadActor.deadAtPhaseIdx = phaseIdxNow;
        deadActor.reviveEligible = false;
        emitDeathRunEventOnce(deadActor, { reason: 'sudden_death_timeout', cause: '서든데스 시간 만료' });
        return deadActor;
      });
    const forcedDeadSnapshots = appendPhaseDeadSnapshots(forcedDead);
    flushDeadSnapshots(forcedDeadSnapshots);
    const winners = (Array.isArray(winningTeam?.members) ? winningTeam.members : [forcedWinner])
      .filter(Boolean)
      .map((survivor) => normalizeRuntimeSurvivor(survivor));
    const finalDeadForFinish = dedupeRuntimeParticipants([...(Array.isArray(dead) ? dead : []), ...phaseDeadSnapshots]);
    setSurvivors(winners);
    setMatchSec(phaseStartSec + phaseDurationSec);
    addLog(`⏱ 서든데스 종료! 제한시간 만료로 ${winningTeam?.teamName || getActorTeamName(forcedWinner)} 승리`, 'highlight');
    finishGame(winners, updatedKillCounts, updatedAssistCounts, { finalDead: finalDeadForFinish });
    return {
      finalAliveTeams,
      finalStepSurvivors,
      shouldReturn: true,
      updatedAssistCounts,
      updatedKillCounts,
    };
  }

  setSurvivors((Array.isArray(finalStepSurvivors) ? finalStepSurvivors : []).map((survivor) => normalizeRuntimeSurvivor(survivor)));
  setSpawnState(nextSpawn);
  setMatchSec(shouldFinishByElimination ? (phaseStartSec + getPhaseRuntimeOffsetSec()) : (phaseStartSec + phaseDurationSec));

  if (earnedCredits > 0) {
    apiPost('/credits/earn', { amount: earnedCredits })
      .then((res) => {
        applyUserEconomyProgress({ credits: res?.credits });
      })
      .catch(() => {});
  }

  if (shouldFinishByElimination) {
    const finalDeadForFinish = dedupeRuntimeParticipants([...(Array.isArray(dead) ? dead : []), ...phaseDeadSnapshots]);
    finishGame(finalAliveTeams[0]?.members || finalStepSurvivors, updatedKillCounts, updatedAssistCounts, { finalDead: finalDeadForFinish });
  }

  return {
    finalAliveTeams,
    finalStepSurvivors,
    shouldReturn: false,
    updatedAssistCounts,
    updatedKillCounts,
  };
}
