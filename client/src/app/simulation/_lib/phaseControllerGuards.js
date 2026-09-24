import { getMatchStartInfo } from './matchRosterRuntime';
import { getActorTeamId } from './teamRuntime';

export function getSimulationStartGate({ day = 0, settings = {}, survivors = [] } = {}) {
  const matchStartInfo = getMatchStartInfo(survivors, settings);
  const startBlocked = day === 0 && !matchStartInfo.ready;
  const startBlockedText = matchStartInfo.matchMode === 'solo'
    ? `⚠️ 솔로 인원 부족 (${matchStartInfo.participantCount}/2명)`
    : `⚠️ 팀 부족 (${matchStartInfo.teamCount}/2팀 · ${matchStartInfo.participantCount}명)`;

  return {
    matchStartInfo,
    startBlocked,
    startBlockedText,
  };
}

export async function runGuardedPhaseAdvance({
  refs = {},
  state = {},
  actions = {},
  proceedPhase = async () => {},
} = {}) {
  const {
    isAdvancingRef,
  } = refs;
  const {
    day,
    isGameOver,
    loading,
    matchSec,
    pendingTranscendPick,
    phase,
    runSeed,
    settings,
    showMarketPanel,
    survivors,
  } = state;
  const {
    addLog,
    refreshMapSettingsFromServer,
    setIsAdvancing,
    setRunEvents,
  } = actions;

  if (isAdvancingRef?.current || refs.mapPreparationRef?.current) return;
  if (loading) return;
  if (isGameOver) return;

  const { matchStartInfo } = getSimulationStartGate({ day, settings, survivors });
  if (day === 0 && !matchStartInfo.ready) {
    const needText = matchStartInfo.matchMode === 'solo'
      ? '솔로는 생존자 2명 이상이 필요합니다.'
      : '스쿼드는 서로 다른 팀 2개 이상이 필요합니다.';
    addLog?.(`⚠️ 게임 시작 불가: ${needText} (현재 ${matchStartInfo.participantCount}명 / ${matchStartInfo.teamCount}팀)`, 'system');
    return;
  }
  if (showMarketPanel && pendingTranscendPick) {
    addLog?.('🎁 초월 장비 선택 상자: 먼저 선택을 완료하세요.', 'system');
    return;
  }

  if (isAdvancingRef) isAdvancingRef.current = true;
  setIsAdvancing?.(true);
  try {
    if (day === 0 && matchSec === 0) {
      actions.lockRunInputs?.();
      await refreshMapSettingsFromServer?.('start');
    }

    if (day === 0 && matchSec === 0) {
      setRunEvents?.([{
        kind: 'run_start',
        at: { day, phase, sec: matchSec },
        seed: runSeed,
        matchMode: matchStartInfo.matchMode,
        teamSize: matchStartInfo.teamSize,
        maxTeams: matchStartInfo.maxTeams,
        participantCount: matchStartInfo.participantCount,
        teamCount: matchStartInfo.teamCount,
        participants: (Array.isArray(survivors) ? survivors : []).map((actor) => ({
          id: String(actor?._id || actor?.id || ''),
          name: String(actor?.name || ''),
          teamId: getActorTeamId(actor),
          weaponType: String(actor?.weaponType || ''),
        })),
      }]);
    }
    await proceedPhase();
  } finally {
    if (isAdvancingRef) isAdvancingRef.current = false;
    setIsAdvancing?.(false);
  }
}
