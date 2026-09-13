import { getCombatSpaceId, WORLD_COMBAT_SPACE } from '../../../utils/combatSpaceLogic.js';
import { isDimensionRiftDefeated } from '../../../utils/dimensionRiftDefeatLogic.js';
import { normalizeStatusEffect } from '../../../utils/statusEffectDefinitions.js';
export { getActorDimensionRiftId } from '../../../utils/combatSpaceLogic.js';

const idOf = (actor) => String(actor?._id || actor?.id || '');
export const dimensionRiftSpaceId = (rift) => `dimension_rift:${String(rift?.id || '')}`;

export function getDimensionRiftEntryIssue(actor, rift, nowSec = null) {
  if (!actor || !rift?.id || getCombatSpaceId(actor) !== dimensionRiftSpaceId(rift)) return 'combat_space';
  const entry = actor._dimensionRiftEntry;
  if (!entry || String(entry.riftId || '') !== String(rift.id)) return 'missing_or_mismatched_entry';
  if (!Number.isFinite(entry.enteredAtSec)) return 'invalid_entry_time';
  if (entry.enteredAtSec < 0) return 'negative_entry_time';
  if (Number.isFinite(nowSec) && entry.enteredAtSec > nowSec) return 'future_entry_time';
  if (Number.isFinite(rift.openedAtSec) && entry.enteredAtSec < rift.openedAtSec) return 'before_open';
  if (Number.isFinite(rift.entryClosesAtSec) && entry.enteredAtSec >= rift.entryClosesAtSec) return 'after_entry_close';
  return '';
}

function changeSpace(actor, nextSpaceId) {
  actor._combatSpaceId = nextSpaceId;
  if (actor._spatial) actor._spatial = { ...actor._spatial, combatSpaceId: nextSpaceId };
  actor._combatIntent = null;
  actor._spatialMotion = null;
  actor._spatialLastSeen = null;
  actor._forcedControlState = null;
  actor._combatContributions = {};
  actor.lastDamagedBy = '';
  actor.lastDamagedPhaseIdx = -9999;
  // Do not heal, cleanse, refund attacks/skills, or erase an in-flight cast.
  // The cast reconciler cancels a cast whose recorded space no longer matches.
}

export function enterDimensionRiftSpace(actor, rift, nowSec) {
  if (!Number.isFinite(nowSec) || nowSec < 0) return null;
  if (!actor || !rift?.id || rift.resolved || rift.matchClosure || !Number.isFinite(Number(actor.hp)) || Number(actor.hp) <= 0 || String(actor.zoneId) !== String(rift.zoneId)) return null;
  const spaceId = dimensionRiftSpaceId(rift);
  if (getCombatSpaceId(actor) === spaceId) return null;
  if (getCombatSpaceId(actor) !== WORLD_COMBAT_SPACE || actor._lastDimensionRiftExit?.riftId === rift.id) return null;
  actor._dimensionRiftDefeat = null;
  actor._dimensionRiftEntry = { riftId: rift.id, enteredAtSec: nowSec, originZoneId: String(actor.zoneId),
    originPosition: actor._spatial ? structuredClone(actor._spatial) : null };
  changeSpace(actor, spaceId);
  return { who: idOf(actor), riftId: rift.id, combatSpaceId: spaceId, atSec: nowSec, direction: 'enter' };
}

export function leaveDimensionRiftSpace(actor, rift, nowSec, reason, options = {}) {
  if (!Number.isFinite(nowSec) || nowSec < 0) return null;
  if (!actor || getCombatSpaceId(actor) !== dimensionRiftSpaceId(rift)) return null;
  const entry = actor._dimensionRiftEntry;
  const entryIssue = getDimensionRiftEntryIssue(actor, rift, nowSec);
  if (entryIssue && options.allowInvalidEntry !== true) return null;
  if (!entryIssue && nowSec < entry.enteredAtSec) return null;
  const defeat = isDimensionRiftDefeated(actor) ? { ...actor._dimensionRiftDefeat } : null;
  const exitCause = reason;
  if (defeat) reason = 'defeated';
  changeSpace(actor, WORLD_COMBAT_SPACE);
  if (entry?.originPosition && String(actor.zoneId) === entry.originZoneId) {
    actor._spatial = { ...structuredClone(entry.originPosition), combatSpaceId: WORLD_COMBAT_SPACE };
  }
  actor._dimensionRiftEntry = null;
  actor._dimensionRiftDefeat = null;
  actor._lastDimensionRiftExit = { riftId: rift.id, atSec: nowSec, reason,
    ...(entryIssue ? { entryIssue } : {}), ...(defeat ? { defeat, exitCause } : {}) };
  if (defeat && actor._lastDimensionRiftDefeatReturn?.id !== defeat.id) {
    // Project return policy, not resurrection or a resource refill. The receipt
    // precedes observers and survives JSON, so repeated cleanup cannot refresh it.
    actor._lastDimensionRiftDefeatReturn = { id: defeat.id, atSec: nowSec, protectionUntilSec: nowSec + 3 };
    actor.activeEffects = [...(actor.activeEffects || []), normalizeStatusEffect({ name: '무적',
      remainingDuration: 3, durationUnit: 'sec', sourceId: defeat.id, tags: ['rift_return'] })];
    actor.safeZoneUntil = Math.max(Number(actor.safeZoneUntil || 0), nowSec + 3);
    actor._recentCombatUntil = Math.max(Number(actor._recentCombatUntil || 0), nowSec + 8);
    actor._recentCombatWith = defeat.by;
    actor._recentCombatReason = 'dimension_rift_defeat_return';
    actor.aiCurrentAction = 'dimension_rift_defeat_return';
  }
  return { who: idOf(actor), riftId: rift.id, combatSpaceId: WORLD_COMBAT_SPACE, atSec: nowSec,
    direction: 'leave', reason, ...(entryIssue ? { entryIssue } : {}), ...(defeat ? { defeat, exitCause } : {}) };
}

// A removed/closed objective in restored input must not strand a living actor
// in an invisible encounter space. This changes no HP or resurrection state.
export function releaseOrphanedDimensionRiftSpaces(roster, rifts, nowSec) {
  const changes = [];
  for (const actor of roster || []) {
    const spaceId = getCombatSpaceId(actor);
    if (!spaceId.startsWith('dimension_rift:')) continue;
    const riftId = spaceId.slice('dimension_rift:'.length);
    if (!riftId) continue;
    const rift = (rifts || []).find((row) => String(row.id) === riftId);
    const targetRift = rift || { id: riftId };
    const member = rift?.entrants?.find((row) => (row.memberIds || []).includes(idOf(actor)));
    const entryIssue = getDimensionRiftEntryIssue(actor, targetRift, nowSec);
    if (rift && !rift.resolved && !rift.matchClosure && member && !member.outcome
      && !member.memberDepartures?.[idOf(actor)] && !entryIssue) continue;
    const reason = entryIssue ? 'membership_invalid' : 'membership_closed';
    const change = leaveDimensionRiftSpace(actor, targetRift, nowSec, reason,
      { allowInvalidEntry: Boolean(entryIssue) });
    if (change) changes.push(change);
  }
  return changes;
}
