import { pickRiftEntrantTeams, resolveDimensionRiftWinner } from './dimensionRiftRuntime.js';
import { getActorTeamId } from './teamRuntime.js';
import { isAiRecoveryLocked } from './survivorLifecycleRuntime.js';
import { dimensionRiftSpaceId, enterDimensionRiftSpace, getDimensionRiftEntryIssue, leaveDimensionRiftSpace } from './dimensionRiftSpaceRuntime.js';
import { getCombatSpaceId, WORLD_COMBAT_SPACE } from '../../../utils/combatSpaceLogic.js';
import { isDimensionRiftDefeated } from '../../../utils/dimensionRiftDefeatLogic.js';

const idOf = (actor) => String(actor?._id || actor?.id || '');
const alive = (actor) => actor && Number.isFinite(Number(actor.hp)) && Number(actor.hp) > 0;
const seconds = (value) => Math.round(Number(value) * 1e6) / 1e6;
const positive = (value, fallback) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;

export function findActorDimensionRift(spawn, actor) {
  if (spawn?.dimensionRiftMatchClosure) return null;
  return (spawn?.dimensionRifts || []).find((rift) => !rift.resolved && !rift.matchClosure && String(rift.zoneId) === String(actor?.zoneId)
    && actor?._lastDimensionRiftExit?.riftId !== rift.id
    && (rift.entrants || []).some((entry) => !entry.outcome && !entry.memberDepartures?.[idOf(actor)]
      && (entry.memberIds || []).includes(idOf(actor)))) || null;
}

// This observer owns no damage, region movement, resurrection or private clock. The
// ordinary combat/movement runtime must first commit the actual roster change.
export function advanceDimensionRiftContest(rift, roster, {
  nowSec, phaseStartSec, phaseDurationSec, day, phase, phaseIdxNow, rule = {},
  forbiddenIds = new Set(), usedTeamIds = new Set(),
} = {}) {
  const delta = { joined: [], departed: [], spaceChanges: [], activeTeams: [], resolution: null };
  const now = seconds(nowSec);
  if (!rift || rift.resolved || rift.matchClosure || !Number.isFinite(now) || now < 0) return delta;
  if (rift.lastObservedAtSec != null && now < Number(rift.lastObservedAtSec)) return delta;
  const byId = new Map((roster || []).filter((actor) => idOf(actor)).map((actor) => [idOf(actor), actor]));
  const spaceId = dimensionRiftSpaceId(rift);
  const release = (actor, reason, options = {}) => {
    const change = leaveDimensionRiftSpace(actor, rift, now, reason, options);
    if (change) delta.spaceChanges.push(change);
  };
  const close = (reason, winner = null, teams = []) => {
    rift.resolved = true;
    rift.status = winner ? 'settled' : 'closed';
    rift.winnerTeamId = String(winner?.teamId || '');
    const losers = winner ? teams.filter((team) => team.teamId !== winner.teamId).map((team) => team.teamId) : [];
    rift.loserTeamId = losers[0] || '';
    rift.resolution = { id: `${rift.id}:resolution`, atSec: now, reason,
      winnerTeamId: rift.winnerTeamId, loserTeamIds: losers,
      // An already extracted, still-living teammate fought for this winning
      // team. Voluntary withdrawals and actual match deaths are not recipients.
      winnerMemberIds: winner ? winner.memberIds.filter((id) => alive(byId.get(id))
        && getActorTeamId(byId.get(id)) === winner.teamId
        && (!winner.memberDepartures?.[id] || winner.memberDepartures[id].reason === 'defeated')) : [] };
    delta.resolution = rift.resolution;
    delta.activeTeams = [];
    // A terminal objective boundary must not strand a malformed saved member.
    // Invalid admissions still receive no winner eligibility or defeat return.
    byId.forEach((actor) => release(actor, reason, { allowInvalidEntry: true }));
    return delta;
  };
  if (Number(rift.day) !== Number(day) || String(rift.phase) !== String(phase)) return close('window_expired');
  if (forbiddenIds.has(String(rift.zoneId))) return close('zone_closed');
  if (rule.enabled === false) return close('disabled');
  if (rift.openedAtSec == null) {
    const start = Number(phaseStartSec);
    const duration = Number(phaseDurationSec);
    // Unknown timing is not permission to grant an instantaneous free win.
    if (!Number.isFinite(start) || start < 0 || !Number.isFinite(duration) || duration <= 0 || now < start) return delta;
    rift.openedAtSec = seconds(start);
    rift.closesAtSec = seconds(start + duration);
    rift.entryClosesAtSec = seconds(Math.min(rift.closesAtSec, start + positive(rule.entryWindowSec, 45)));
  }
  const validClock = [rift.openedAtSec, rift.entryClosesAtSec, rift.closesAtSec].every(Number.isFinite)
    && rift.openedAtSec >= 0 && rift.openedAtSec <= rift.entryClosesAtSec
    && rift.entryClosesAtSec <= rift.closesAtSec;
  if (!validClock) return close('invalid_timing');
  // A legitimate future opening is not corruption and must not be closed by
  // an early observer. No participant can have a valid admission before it.
  if (now < rift.openedAtSec) return delta;
  rift.lastObservedAtSec = now;
  if (!Array.isArray(rift.entrants)) rift.entrants = [];
  // A saved combat-space label is not proof of a valid admission time. Do not
  // invent one: quarantine the actor back to the entrance and exclude that
  // member from this result before any combat or reward selection can use it.
  for (const actor of byId.values()) {
    if (getCombatSpaceId(actor) !== spaceId) continue;
    const entryIssue = getDimensionRiftEntryIssue(actor, rift, now);
    if (!entryIssue) continue;
    const memberEntry = rift.entrants.find((entry) => (entry.memberIds || []).includes(idOf(actor)));
    if (memberEntry) {
      if (!memberEntry.memberDepartures) memberEntry.memberDepartures = {};
      if (!memberEntry.memberDepartures[idOf(actor)]) memberEntry.memberDepartures[idOf(actor)] = {
        reason: 'membership_invalid', atSec: now, entryIssue,
      };
    }
    release(actor, 'membership_invalid', { allowInvalidEntry: true });
  }
  const local = [...byId.values()].filter((actor) => alive(actor) && String(actor.zoneId) === String(rift.zoneId));

  // The IDs admitted before the entry deadline survive JSON save/restore.
  // Travelling actors have their destination zone early, but cannot enter yet.
  if (now < rift.entryClosesAtSec) {
    const willingTeams = new Set(local.filter((actor) => actor._objectiveContestType === 'dimension_rift'
      && (phaseIdxNow == null || Number(actor._objectiveContestUntilPhaseIdx) === Number(phaseIdxNow)))
      .map(getActorTeamId));
    rift.entrants.forEach((entry) => { if (!entry.outcome) willingTeams.add(entry.teamId); });
    const eligible = local.filter((actor) => willingTeams.has(getActorTeamId(actor)) && Number(actor._actionReadyAtSec || 0) <= now
      && [WORLD_COMBAT_SPACE, spaceId].includes(getCombatSpaceId(actor)) && actor._lastDimensionRiftExit?.riftId !== rift.id
      && !isDimensionRiftDefeated(actor) && !actor._pendingCharacterCast && !isAiRecoveryLocked(actor, now));
    const available = eligible.filter((actor) => !usedTeamIds.has(getActorTeamId(actor))
      || rift.entrants.some((entry) => entry.teamId === getActorTeamId(actor)));
    const candidates = pickRiftEntrantTeams({ ...rift, maxTeams: available.length || 1 }, available);
    for (const team of candidates) {
      let entry = rift.entrants.find((row) => row.teamId === team.teamId);
      if (entry?.outcome) continue;
      if (!entry) {
        if (rift.entrants.length >= positive(rift.maxTeams, 2)) continue;
        entry = { teamId: team.teamId, teamName: team.teamName, enteredAtSec: now, memberIds: [] };
        rift.entrants.push(entry);
        usedTeamIds.add(entry.teamId);
      }
      const additions = team.members.map(idOf).filter((id) => !entry.memberIds.includes(id));
      entry.memberIds.push(...additions);
      if (additions.length) delta.joined.push({ teamId: entry.teamId, teamName: entry.teamName, memberIds: additions });
    }
  }
  rift.entrantTeamIds = rift.entrants.map((entry) => entry.teamId);
  const teams = rift.entrants.map((entry) => {
    const members = entry.memberIds.map((id) => byId.get(id));
    if (!entry.memberDepartures) entry.memberDepartures = {};
    for (const actor of members) {
      if (!actor || entry.memberDepartures[idOf(actor)]) continue;
      const inRegion = String(actor.zoneId) === String(rift.zoneId);
      const left = !inRegion || getActorTeamId(actor) !== entry.teamId || actor._lastDimensionRiftExit?.riftId === rift.id
        || ![WORLD_COMBAT_SPACE, spaceId].includes(getCombatSpaceId(actor));
      if (entry.outcome || !alive(actor) || left || isDimensionRiftDefeated(actor)) {
        const invalidMembership = actor?._lastDimensionRiftExit?.riftId === rift.id
          && actor._lastDimensionRiftExit.reason === 'membership_invalid';
        const reason = invalidMembership ? 'membership_invalid'
          : isDimensionRiftDefeated(actor) ? 'defeated' : alive(actor) ? 'withdrawn' : 'eliminated';
        entry.memberDepartures[idOf(actor)] = { reason, atSec: now };
        release(actor, reason);
      } else {
        const change = enterDimensionRiftSpace(actor, rift, now);
        if (change) delta.spaceChanges.push(change);
      }
    }
    const present = members.filter((actor) => alive(actor) && !entry.memberDepartures[idOf(actor)]
      && getCombatSpaceId(actor) === spaceId && getActorTeamId(actor) === entry.teamId && String(actor.zoneId) === String(rift.zoneId));
    const unknown = members.some((actor, index) => !actor && !entry.memberDepartures[entry.memberIds[index]]);
    if (!entry.outcome && !present.length && !unknown) {
      entry.outcome = Object.values(entry.memberDepartures).some((row) => row.reason === 'membership_invalid')
        ? 'invalid' : Object.values(entry.memberDepartures).some((row) => row.reason === 'defeated')
          ? 'defeated' : members.some(alive) ? 'withdrawn' : 'eliminated';
      entry.leftAtSec = now;
      delta.departed.push({ teamId: entry.teamId, reason: entry.outcome, memberIds: [...entry.memberIds] });
    }
    return { ...entry, members: entry.outcome ? [] : present, unknown: !entry.outcome && unknown };
  });
  delta.activeTeams = teams.filter((team) => !team.outcome && team.members.length);
  rift.status = teams.length >= 2 ? 'contested' : 'open';
  const result = resolveDimensionRiftWinner(teams, { entryClosed: now >= rift.entryClosesAtSec });
  if (result) return close(result.uncontested ? 'uncontested' : 'last_present_team', result.winner, teams);
  if (now >= rift.closesAtSec) return close(teams.length ? 'no_decisive_result' : 'no_entrants');
  return delta;
}
