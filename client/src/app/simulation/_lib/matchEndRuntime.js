import { dedupeRuntimeParticipants } from './runtimeParticipantRuntime';
import { getActorTeamId, getAliveTeams } from './teamRuntime';
import { isTeamWipeReviveProtected } from './revivalPolicyRuntime.js';

// The clock and phase finalizer share this decision. UI snapshots must never
// declare victory while a wiped team still has its opening revival protection.
export function getMatchEndState({ survivors = [], dead = [], canReviveThisMatch = false, phaseIdxNow = 0, wipeProtectionCutoffIdx = -1 } = {}) {
  const aliveTeams = getAliveTeams(survivors.filter((actor) => Number(actor?.hp) > 0));
  const aliveIds = new Set(aliveTeams.map((team) => team.teamId));
  const protectedIds = new Set();
  if (canReviveThisMatch && phaseIdxNow <= wipeProtectionCutoffIdx) {
    for (const actor of dedupeRuntimeParticipants(dead)) {
      if (isTeamWipeReviveProtected(actor, { canReviveThisMatch, phaseIdxNow, wipeProtectionCutoffIdx })) protectedIds.add(getActorTeamId(actor));
    }
  }
  const protectedContest = new Set([...aliveIds, ...protectedIds]);
  const deferredForRevive = aliveTeams.length <= 1 && protectedContest.size > aliveTeams.length;
  return { aliveTeams, deferredForRevive, finished: aliveTeams.length <= 1 && !deferredForRevive,
    outcome: aliveTeams.length === 0 ? 'no_survivors' : 'last_team' };
}
