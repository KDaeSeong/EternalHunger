import { getActorGrowthProgress } from '../../src/app/simulation/_lib/growthPlanRuntime.js';
import { getActorTeamId } from '../../src/app/simulation/_lib/teamRuntime.js';
import { getInvItemId, inferEquipSlot, inferItemCategory } from '../../src/app/simulation/_lib/inventoryRules.js';
import { areEquipmentWeaponTypesCompatible } from '../../src/utils/equipmentCatalog.js';
import { getCombatSpaceId } from '../../src/utils/combatSpaceLogic.js';
import { isDimensionRiftDefeated } from '../../src/utils/dimensionRiftDefeatLogic.js';

const actorId = (actor) => String(actor?._id || actor?.id || '');
const slots = ['weapon', 'head', 'clothes', 'arm', 'shoes'];
const share = (part, total) => total ? Math.round(part / total * 1000) / 1000 : 0;
const sortedIds = (actors) => actors.map(actorId).sort();
const sameIds = (left, right) => left.length === right.length && left.every((id, index) => id === right[index]);
const quantity = (entry) => {
  const raw = entry?.qty === undefined ? 1 : entry.qty;
  const value = typeof raw === 'number' || typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
};

// A diagnostic consumer of published, owned frames; never a planner, writer,
// RNG source or frame-retention mechanism. Dead members are not silently
// removed from a started attempt so their surviving allies can score success.
export function createMatchDistributionFrameTracker({ initialActors = [], items = [], firstDayDeadlineSec = null } = {}) {
  const byItemId = new Map(items.map((item) => [String(item._id), item]));
  const growthRows = new Map(initialActors.map((actor) => {
    const progress = getActorGrowthProgress(actor, items);
    return [actorId(actor), { actorId: actorId(actor), name: actor.name, teamId: getActorTeamId(actor),
      totalSlots: progress.totalSlots, targetIds: [...progress.targetIds].sort(),
      initialGoalIssues: structuredClone(progress.goalIssues), goalIdentityChanged: false,
      completeAtSec: null, heroEquippedAtSec: null, diedBeforeCompletion: false }];
  }));
  if (growthRows.size !== initialActors.length || growthRows.has('')) throw Error('Initial participant IDs must be unique and nonempty.');
  const active = new Map(), finished = [], consumedIntent = new Map(), closedAt = new Map();
  let lastSec = 0;
  const heroEquipped = (actor) => slots.every((slot) => {
    const id = String(actor.equipped?.[slot] || '');
    const entry = (actor.inventory || []).find((row) => getInvItemId(row) === id && quantity(row) > 0);
    if (!id || !entry) return false;
    const item = { ...byItemId.get(id), ...entry };
    return byItemId.has(id) && inferItemCategory(item) === 'equipment' && item.lockedByAdmin !== 'deleted'
      && inferEquipSlot(item) === slot && Number(item.tier) >= 4
      && (slot !== 'weapon' || areEquipmentWeaponTypesCompatible(actor.weaponType, item.weaponType));
  });
  const recordsFor = (members, teamId, spaceId) => members.flatMap((actor) => {
    const record = actor._teamRegroup;
    return record?.version === 1 && !record.cleared && record.teamId === teamId && record.combatSpaceId === spaceId
      && record.memberCount === members.length && Number.isFinite(record.at?.sec) && record.at.sec <= lastSec
      ? [{ actorId: actorId(actor), record }] : [];
  });
  const joinSignals = (records) => records.filter(({ record }) => ['joining', 'waiting', 'arrived'].includes(record.status));
  const signalKey = (signals) => JSON.stringify(signals.map(({ actorId: id, record }) =>
    [id, record.at.sec, record.status, record.targetZoneId, record.memberCount]).sort((a, b) => a[0].localeCompare(b[0])));
  function finish(teamId, episode, outcome, sec) {
    finished.push({ ...episode, endedAtSec: sec, durationSec: Number((sec - episode.startedAtSec).toFixed(6)), outcome });
    active.delete(teamId);
    closedAt.set(teamId, sec);
  }
  function observe(frame) {
    const sec = Number(frame.matchSec);
    if (!Number.isFinite(sec) || sec < lastSec) throw Error('Diagnostic frames must use a monotonic match clock.');
    lastSec = sec;
    const living = (frame.survivors || []).filter((actor) => Number(actor.hp) > 0);
    const byActorId = new Map(living.map((actor) => [actorId(actor), actor]));
    const deadIds = new Set((frame.dead || []).filter((actor) => Number(actor.hp) <= 0).map(actorId));
    for (const row of growthRows.values()) {
      const actor = byActorId.get(row.actorId);
      if (!actor) { if (deadIds.has(row.actorId) && row.completeAtSec == null) row.diedBeforeCompletion = true; continue; }
      if (row.completeAtSec == null && row.totalSlots > 0) {
        const progress = getActorGrowthProgress(actor, items);
        const initialGoal = progress.totalSlots === row.totalSlots && sameIds([...progress.targetIds].sort(), row.targetIds);
        if (!initialGoal) row.goalIdentityChanged = true;
        if (initialGoal && progress.openingComplete && progress.completedSlots === row.totalSlots) row.completeAtSec = sec;
      }
      if (row.heroEquippedAtSec == null && heroEquipped(actor)) row.heroEquippedAtSec = sec;
    }
    const groups = new Map();
    for (const actor of living) {
      const teamId = getActorTeamId(actor);
      if (!groups.has(teamId)) groups.set(teamId, []);
      groups.get(teamId).push(actor);
    }
    const closedNow = new Set();
    for (const [teamId, episode] of active) {
      const members = groups.get(teamId) || [];
      const originalMembers = episode.memberIds.map((id) => byActorId.get(id));
      let outcome = '';
      if (originalMembers.some((actor) => !actor)) outcome = 'member_death';
      else if (originalMembers.some((actor) => getActorTeamId(actor) !== teamId) || !sameIds(sortedIds(members), episode.memberIds)) outcome = 'roster_change';
      else if (originalMembers.some((actor) => getCombatSpaceId(actor) !== episode.combatSpaceId || isDimensionRiftDefeated(actor))) outcome = 'space_change';
      else if (originalMembers.every((actor) => actor.zoneId && actor.zoneId === originalMembers[0].zoneId)) outcome = 'completed';
      else {
        const records = recordsFor(members, teamId, episode.combatSpaceId);
        for (const { record } of records) if (!episode.reasons.includes(record.status)) episode.reasons.push(record.status);
        // Recovery, threat and action holds are pauses, not fake new attempts.
        if (!records.some(({ record }) => record.status !== 'opening')) outcome = 'intent_cleared';
      }
      if (outcome) {
        finish(teamId, episode, outcome, sec);
        closedNow.add(teamId);
        consumedIntent.set(teamId, signalKey(joinSignals(recordsFor(members, teamId, episode.combatSpaceId))));
      }
    }
    for (const [teamId, members] of groups) {
      if (active.has(teamId) || closedNow.has(teamId) || members.length < 2) continue;
      const spaces = new Set(members.map(getCombatSpaceId));
      if (spaces.size !== 1 || members.some(isDimensionRiftDefeated)) continue;
      const spaceId = getCombatSpaceId(members[0]);
      const signals = joinSignals(recordsFor(members, teamId, spaceId));
      const key = signalKey(signals);
      const separated = new Set(members.map((actor) => String(actor.zoneId || ''))).size > 1;
      if (!separated) { consumedIntent.set(teamId, key); continue; }
      if (!signals.length || consumedIntent.get(teamId) === key) continue;
      // Revival/space restoration can make old memberCount/space records
      // match again. That does not constitute a new post-closure decision.
      if (closedAt.has(teamId) && !signals.some(({ record }) => record.at.sec > closedAt.get(teamId))) continue;
      active.set(teamId, { teamId, combatSpaceId: spaceId, memberIds: sortedIds(members), startedAtSec: sec,
        reasons: [...new Set(signals.map(({ record }) => record.status))] });
      consumedIntent.set(teamId, key);
    }
  }
  function report() {
    const rows = [...growthRows.values()];
    const episodes = [...finished, ...[...active.values()].map((episode) => ({ ...episode, endedAtSec: null,
      durationSec: Number((lastSec - episode.startedAtSec).toFixed(6)), outcome: 'unfinished' }))];
    const outcomes = {};
    for (const episode of episodes) outcomes[episode.outcome] = (outcomes[episode.outcome] || 0) + 1;
    const completed = outcomes.completed || 0;
    return structuredClone({ growth: { total: rows.length, goalParticipants: rows.filter((row) => row.totalSlots > 0).length,
      complete: rows.filter((row) => row.completeAtSec != null).length, firstDayDeadlineSec,
      beforeFirstNightEnd: rows.filter((row) => row.completeAtSec != null && firstDayDeadlineSec != null && row.completeAtSec < firstDayDeadlineSec).length,
      fiveSlotHeroEquipped: rows.filter((row) => row.heroEquippedAtSec != null).length, rows },
    regroup: { started: episodes.length, completed, completionShare: share(completed, episodes.length), outcomes, episodes,
      scope: 'Full starting living team roster, fixed through the attempt; all started outcomes remain in the denominator. Partial pair contact and cross-space cohorts are not full-team completion.' } });
  }
  return { observe, report };
}

export function summarizeMovement(initialActors = [], events = []) {
  const paths = new Map(initialActors.map((actor) => [actorId(actor), [String(actor.zoneId || '')]]));
  const lastMove = new Map(), reversalsByReason = {}, reversalsByActor = {}, reversalPairs = {}, reversalSamples = [];
  let moves = 0, reversals = 0, continuityBreaks = 0;
  for (const event of events) {
    const id = String(event?.who || '');
    if (!id) continue;
    if (['death', 'revive', 'dimension_rift_space'].includes(event.kind)) {
      if (paths.has(id)) continuityBreaks++;
      paths.delete(id); lastMove.delete(id); continue;
    }
    if (event.kind !== 'move' || !event.from || !event.to || event.from === event.to) continue;
    const from = String(event.from), to = String(event.to);
    let path = paths.get(id) || [from];
    if (path.at(-1) !== from) { path = [from]; lastMove.delete(id); continuityBreaks++; }
    const previous = lastMove.get(id);
    if (path.length > 1 && to === path.at(-2)) {
      reversals++;
      const reason = String(event.reason || 'unknown'), priorReason = String(previous?.reason || 'unknown');
      reversalsByReason[reason] = (reversalsByReason[reason] || 0) + 1;
      reversalsByActor[id] = (reversalsByActor[id] || 0) + 1;
      const pair = `${priorReason}->${reason}`;
      reversalPairs[pair] = (reversalPairs[pair] || 0) + 1;
      if (reversalSamples.length < 8) {
        const atSec = Number(event.at?.sec ?? event.sec ?? 0), previousAtSec = Number(previous?.at?.sec ?? previous?.sec ?? 0);
        reversalSamples.push({ actorId: id, previousAtSec, atSec, elapsedSec: Number((atSec - previousAtSec).toFixed(6)), from, to, priorReason, reason });
      }
    }
    // Only the last two zones are needed to recognize the next A-B-A.
    paths.set(id, [path.at(-1), to]); lastMove.set(id, event); moves++;
  }
  return { moves, reversals, reversalShare: share(reversals, moves), reversalsByReason, reversalPairs, reversalSamples,
    topReversalActors: Object.entries(reversalsByActor).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5),
    continuityBreaks, classification: 'observed movement reversals, not automatic bugs' };
}
