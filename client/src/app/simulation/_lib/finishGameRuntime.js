import { apiPost, getUser, updateStoredUser } from '../../../utils/api';
import { LEGACY_HOF_KEY, emitHallOfFameSync, writeHallOfFameState } from '../../../utils/hallOfFame';
import { getMatchConfig, normalizeMatchMode } from './matchRosterRuntime';
import { buildLpRewardSummary, formatLpRewardBreakdown } from './lpRewardRuntime';
import { dedupeRuntimeParticipants, getRuntimeActorKey } from './runtimeParticipantRuntime';
import {
  getActorTeamId,
  getActorTeamName,
  getAliveTeams,
  getWinningTeam,
} from './teamRuntime';
import {
  mergeStoredUserProgress,
  normalizeUserStatistics,
  saveLocalHallOfFameBackup,
} from './userProgress';

export async function finishSimulationGame(opts = {}) {
  const {
    finalSurvivors,
    latestAssistCounts,
    latestKillCounts,
    options = {},
    refs = {},
    state = {},
    actions = {},
  } = opts;

  const { fullLogsRef, isFinishingRef } = refs;
  const {
    assistCounts,
    dead,
    devRunTainted,
    killCounts,
    settings,
    winnerPredictionId,
  } = state;
  const {
    addLog,
    setAutoPlay,
    setCredits,
    setIsGameOver,
    setResultSummary,
    setShowResultModal,
    setWinner,
  } = actions;

  if (isFinishingRef?.current) return;
  if (isFinishingRef) isFinishingRef.current = true;

  setAutoPlay?.(false);
  const finalKills = latestKillCounts || killCounts;
  const finalAssists = latestAssistCounts || assistCounts;
  const finalAlive = Array.isArray(finalSurvivors) ? finalSurvivors : [];
  const finalDead = Array.isArray(options?.finalDead) ? options.finalDead : dead;
  const winningTeam = getWinningTeam(finalAlive, finalKills, finalAssists);
  const winner = winningTeam?.representative || finalAlive[0];
  const participants = dedupeRuntimeParticipants([
    ...finalAlive,
    ...(Array.isArray(finalDead) ? finalDead : []),
  ]);
  const matchCfgForResult = getMatchConfig(settings);
  const totalTeamCount = new Set(
    participants.map((p) => String(p?.teamId || p?.matchTeamId || p?._id || p?.id || '').trim()).filter(Boolean)
  ).size;

  const winnerId = getRuntimeActorKey(winner);
  const myKills = winnerId ? Number(finalKills[winnerId] || 0) : 0;
  const myAssists = winnerId ? Number(finalAssists[winnerId] || 0) : 0;
  const isDevRunTainted = Boolean(devRunTainted);
  const lpRewardSummary = buildLpRewardSummary({
    getActorKey: getRuntimeActorKey,
    isDevRunTainted,
    participants,
    predictedWinnerId: winnerPredictionId,
    winner,
    winningTeam,
  });
  const rewardLP = lpRewardSummary.totalLP;
  const topKillLeader = [...participants]
    .sort((a, b) => {
      const aId = getRuntimeActorKey(a);
      const bId = getRuntimeActorKey(b);
      return (Number(finalKills?.[bId] || 0) - Number(finalKills?.[aId] || 0)) ||
        (Number(finalAssists?.[bId] || 0) - Number(finalAssists?.[aId] || 0));
    })[0] || null;
  const winnerTeamAliveCount = winningTeam ? Math.max(0, Number(winningTeam?.aliveCount || winningTeam?.members?.length || 0)) : 0;
  const winnerTeamOriginalSize = winningTeam ? Math.max(winnerTeamAliveCount, Number(winningTeam?.originalSize || winnerTeamAliveCount || 1)) : 0;
  const winnerTeamMissingCount = Math.max(0, winnerTeamOriginalSize - winnerTeamAliveCount);
  const winnerTeamRosterNames = Array.isArray(winningTeam?.rosterNames) && winningTeam.rosterNames.length
    ? winningTeam.rosterNames
    : participants
      .filter((p) => winningTeam?.teamId && getActorTeamId(p) === winningTeam.teamId)
      .map((p) => String(p?.name || '').trim())
      .filter(Boolean);

  setWinner?.(winner);
  setIsGameOver?.(true);
  setShowResultModal?.(true);
  setResultSummary?.({
    rewardLP,
    rewardBaseLP: lpRewardSummary.baseLP,
    rewardPredictionBonusLP: lpRewardSummary.predictionBonusLP,
    winnerPrediction: {
      predictedId: lpRewardSummary.predictedWinnerId,
      predictedName: lpRewardSummary.predictedName,
      correct: lpRewardSummary.predictionCorrect,
      bonusLP: lpRewardSummary.predictionBonusLP,
    },
    myKills,
    myAssists,
    participantsCount: participants.length,
    saveStatus: isDevRunTainted
      ? { hallOfFame: 'skipped_devtools', userStats: 'skipped_devtools' }
      : { hallOfFame: winner ? 'pending' : 'skipped', userStats: 'pending' },
    userProgress: null,
    devRunTainted: isDevRunTainted,
    matchMode: matchCfgForResult.matchMode,
    teamSize: matchCfgForResult.teamSize,
    maxTeams: matchCfgForResult.maxTeams,
    teamCount: totalTeamCount,
    aliveTeamCount: getAliveTeams(finalAlive).length,
    winnerTeam: winningTeam
      ? {
          teamId: winningTeam.teamId,
          teamName: winningTeam.teamName,
          aliveCount: winnerTeamAliveCount,
          originalSize: winnerTeamOriginalSize,
          missingCount: winnerTeamMissingCount,
          capacity: Number(winningTeam?.capacity || matchCfgForResult.teamSize || winnerTeamOriginalSize || 1),
          rosterNames: winnerTeamRosterNames,
          members: winningTeam.members.map((member) => ({
            id: getRuntimeActorKey(member),
            name: member?.name,
            hp: Number(member?.hp || 0),
            teamSlot: Number(member?.matchTeamSlot || member?.teamSlot || 0),
          })),
        }
      : null,
    topKillLeader: topKillLeader
      ? {
          id: getRuntimeActorKey(topKillLeader),
          name: topKillLeader.name,
          kills: Number(finalKills?.[getRuntimeActorKey(topKillLeader)] || 0),
          assists: Number(finalAssists?.[getRuntimeActorKey(topKillLeader)] || 0),
        }
      : null,
  });

  if (winner) {
    const matchModeNow = normalizeMatchMode(settings?.matchMode);
    addLog?.(
      matchModeNow === 'solo'
        ? `🏆 게임 종료! 최후의 생존자: [${winner.name}]`
        : `🏆 게임 종료! 최후의 팀: ${winningTeam?.teamName || getActorTeamName(winner)} (생존 ${winnerTeamAliveCount}/${winnerTeamOriginalSize}) / 대표 생존자: [${winner.name}]`,
      'highlight'
    );
  } else {
    addLog?.('💀 생존자가 아무도 없습니다...', 'death');
  }

  if (isDevRunTainted) {
    addLog?.('개발자 도구 조작이 감지되어 명예의 전당 기록과 보상 지급을 건너뜁니다.', 'system');
    return;
  }

  try {
    const me = getUser();
    const username = me?.username || me?.id || 'guest';
    saveLocalHallOfFameBackup(winner, finalKills, finalAssists, participants);

    if (winner) {
      writeHallOfFameState({ username }, (current) => {
        const nextHallOfFameState = { ...(current || {}), chars: { ...(current?.chars || {}) } };
        if (nextHallOfFameState._migratedFromPlayerV1) return nextHallOfFameState;
        try {
          const legacyRaw = localStorage.getItem(LEGACY_HOF_KEY);
          const legacy = legacyRaw ? JSON.parse(legacyRaw) : null;
          const legacyWins = Number(legacy?.wins?.[username] || 0);
          const legacyKills = Number(legacy?.kills?.[username] || 0);
          if (legacyWins > 0 || legacyKills > 0) {
            const wid = String(winner?._id ?? winner?.id ?? '');
            if (wid) {
              const entry = nextHallOfFameState.chars[wid] || { name: winner?.name || wid, wins: 0, kills: 0, assists: 0 };
              entry.wins = Number(entry.wins || 0) + legacyWins;
              entry.kills = Number(entry.kills || 0) + legacyKills;
              nextHallOfFameState.chars[wid] = entry;
            }
          }
        } catch {}
        nextHallOfFameState._migratedFromPlayerV1 = true;
        return nextHallOfFameState;
      }, { migratedLegacy: true });
    }

    if (winner) {
      const raw = localStorage.getItem(LEGACY_HOF_KEY);
      const data = raw ? JSON.parse(raw) : { wins: {}, kills: {} };
      if (!data.wins) data.wins = {};
      if (!data.kills) data.kills = {};
      const winnerKey = String(winner?._id ?? winner?.id ?? '');
      const kills = Number(finalKills?.[winnerKey] || 0);
      data.wins[username] = Number(data.wins[username] || 0) + 1;
      data.kills[username] = Number(data.kills[username] || 0) + kills;
      localStorage.setItem(LEGACY_HOF_KEY, JSON.stringify(data));
    }
    emitHallOfFameSync({ username }, { reason: 'finishGame' });
  } catch (error) {
    console.error('hall of fame sync failed', error);
  }

  try {
    if (winner) {
      const aliveIds = new Set(finalAlive.map((actor) => getRuntimeActorKey(actor)).filter(Boolean));
      const compactParticipants = participants.map((participant) => {
        const id = getRuntimeActorKey(participant);
        return {
          _id: id,
          id,
          charId: id,
          name: String(participant?.name || participant?.nickname || participant?.charName || id || 'Unknown'),
          alive: aliveIds.has(id),
          teamId: getActorTeamId(participant),
          teamName: getActorTeamName(participant),
          teamSlot: Number(participant?.matchTeamSlot || participant?.teamSlot || 0),
          rosterIds: Array.isArray(participant?.matchTeamRosterIds) ? participant.matchTeamRosterIds : [],
          rosterNames: Array.isArray(participant?.matchTeamRosterNames) ? participant.matchTeamRosterNames : [],
        };
      });
      const compactFullLogs = (Array.isArray(fullLogsRef?.current) ? fullLogsRef.current : [])
        .slice(-350)
        .map((line) => String(line || '').slice(0, 600));
      await apiPost('/game/end', {
        winnerId,
        winnerTeamId: winningTeam?.teamId || getActorTeamId(winner),
        matchMode: matchCfgForResult.matchMode,
        teamSize: matchCfgForResult.teamSize,
        killCounts: finalKills,
        assistCounts: finalAssists,
        fullLogs: compactFullLogs,
        participants: compactParticipants,
      });
      addLog?.('✅ 명예의 전당 저장 완료', 'system');
      setResultSummary?.((prev) => ({
        ...(prev || {}),
        saveStatus: { ...(prev?.saveStatus || {}), hallOfFame: 'success' },
      }));
    }
  } catch (error) {
    console.error(error);
    addLog?.('⚠️ 명예의 전당 저장 실패', 'death');
    setResultSummary?.((prev) => ({
      ...(prev || {}),
      saveStatus: { ...(prev?.saveStatus || {}), hallOfFame: 'error' },
    }));
  }

  try {
    const res = await apiPost('/user/update-stats', {
      kills: myKills,
      isWin: Boolean(winner),
      lpEarned: rewardLP,
    });

    if (typeof res?.credits === 'number') setCredits?.(res.credits);

    if (res?.user && typeof res.user === 'object') {
      updateStoredUser((currentUser) => mergeStoredUserProgress(currentUser, res.user));
    } else if (typeof res?.newLp === 'number' || typeof res?.credits === 'number' || res?.statistics) {
      updateStoredUser((currentUser) => mergeStoredUserProgress(currentUser, {
        lp: typeof res?.newLp === 'number' ? res.newLp : currentUser?.lp,
        credits: typeof res?.credits === 'number' ? res.credits : currentUser?.credits,
        statistics: res?.statistics || currentUser?.statistics,
      }));
    }

    setResultSummary?.((prev) => ({
      ...(prev || {}),
      rewardLP: typeof res?.lpEarnedApplied === 'number' ? res.lpEarnedApplied : (prev?.rewardLP ?? rewardLP),
      rewardBaseLP: prev?.rewardBaseLP ?? lpRewardSummary.baseLP,
      rewardPredictionBonusLP: prev?.rewardPredictionBonusLP ?? lpRewardSummary.predictionBonusLP,
      userProgress: {
        lp: typeof res?.newLp === 'number' ? res.newLp : Number(res?.user?.lp || 0),
        credits: typeof res?.credits === 'number' ? res.credits : Number(res?.user?.credits || 0),
        statistics: normalizeUserStatistics(res?.statistics || res?.user?.statistics),
      },
      saveStatus: { ...(prev?.saveStatus || {}), userStats: 'success' },
    }));

    addLog?.(
      `💾 [전적 저장 완료] LP +${typeof res?.lpEarnedApplied === 'number' ? res.lpEarnedApplied : rewardLP} 획득 (${formatLpRewardBreakdown(lpRewardSummary)}) (현재 총 LP: ${res?.newLp ?? res?.user?.lp ?? '?'})`,
      'system'
    );
  } catch (error) {
    addLog?.(`⚠️ 전적 저장 실패: ${error?.response?.data?.error || '서버 오류'}`, 'death');
    setResultSummary?.((prev) => ({
      ...(prev || {}),
      saveStatus: { ...(prev?.saveStatus || {}), userStats: 'error' },
    }));
  }
}
