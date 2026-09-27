import { getActorDimensionRiftId, getCombatSpaceId, WORLD_COMBAT_SPACE } from '../../../utils/combatSpaceLogic.js';
import { isDimensionRiftDefeated } from '../../../utils/dimensionRiftDefeatLogic.js';
import { getForcedControlEffect } from '../../../utils/statusLogic.js';
import { areSameTeam } from './teamRuntime.js';
import { canObserveActor } from './combatSpatialRuntime.js';
import { getCombatIntentOpponents } from './combatTimingRuntime.js';
import { cancelCharacterCast } from './characterCastRuntime.js';

const idOf = (actor) => String(actor?._id || actor?.id || '');
const isWorldActor = (actor) => Number(actor?.hp || 0) > 0 && !isDimensionRiftDefeated(actor)
  && !getActorDimensionRiftId(actor) && getCombatSpaceId(actor) === WORLD_COMBAT_SPACE;

function canJoinBossHunt(actor, roster, {
  nowSec = 0, ruleset = {}, isSoloMatch = false, forbiddenIds = new Set(),
} = {}) {
  if (!actor || isSoloMatch || actor._wildlifeHunt || !isWorldActor(actor)
    || forbiddenIds.has(String(actor.zoneId || '')) || getForcedControlEffect(actor)
    || Number(actor._recentCombatUntil || 0) > nowSec
    || actor._growthPlan && !actor._growthPlan.openingComplete && !actor._growthPlan.blocked) return false;
  const ratio = Math.max(0.05, Math.min(0.8, Number(ruleset?.ai?.huntRetreatHpRatio ?? 0.22)));
  if (Number(actor.hp) / Math.max(1, Number(actor.maxHp || 1)) <= ratio
    || Number(actor.hp) <= Math.max(0, Number(ruleset?.ai?.escapeHpBelow || 0), Number(ruleset?.ai?.recoverHpBelow || 0))) return false;
  const cast = actor._pendingCharacterCast;
  if (cast && !cast.bossAssistEncounterId) return false;
  if (getCombatIntentOpponents(actor, roster, nowSec).length || roster.some((other) =>
    isWorldActor(other) && !areSameTeam(actor, other) && String(other.zoneId) === String(actor.zoneId)
    && canObserveActor(actor, other, roster))) return false;
  return true;
}

// Select from live actors; never copy the owner's claim/target onto a helper.
// This remains read-only, deterministic and reconstructible after JSON load.
export function getBossAssistOwner(actor, roster, options = {}) {
  if (!canJoinBossHunt(actor, roster, options)) return null;
  const cast = actor._pendingCharacterCast;
  return roster.filter((owner) => {
    const hunt = owner?._wildlifeHunt;
    return idOf(owner) !== idOf(actor) && isWorldActor(owner) && !owner._combatIntent
      && areSameTeam(actor, owner) && String(owner.zoneId) === String(actor.zoneId)
      && hunt?.isBossReward && Number(hunt.target?.hp || 0) > 0 && String(hunt.zoneId) === String(actor.zoneId)
      && (!cast || cast.bossAssistEncounterId === hunt.id);
  }).sort((a, b) => idOf(a).localeCompare(idOf(b)))[0] || null;
}

export function getBossHuntSuccessor(owner, roster, options = {}) {
  const hunt = owner?._wildlifeHunt;
  if (!hunt?.isBossReward || Number(hunt.target?.hp || 0) <= 0) return null;
  return roster.filter((actor) => idOf(actor) !== idOf(owner) && areSameTeam(actor, owner)
    && String(actor.zoneId || '') === String(hunt.zoneId || '') && !actor._combatIntent
    && canJoinBossHunt(actor, roster, options)
    && (!actor._pendingCharacterCast || actor._pendingCharacterCast.bossAssistEncounterId === hunt.id))
    .sort((a, b) => Number(Object.hasOwn(hunt.assistDamageDealt || {}, idOf(b)))
      - Number(Object.hasOwn(hunt.assistDamageDealt || {}, idOf(a))) || idOf(a).localeCompare(idOf(b)))[0] || null;
}

export function getBossAssistAssignments(roster, options = {}) {
  const assignments = new Map();
  // Avoid scanning all actors when no boss encounter is active.
  if (!roster.some((row) => row?._wildlifeHunt?.isBossReward)) return assignments;
  for (const actor of roster) {
    const owner = getBossAssistOwner(actor, roster, options);
    if (owner) assignments.set(idOf(actor), idOf(owner));
  }
  return assignments;
}

export function reconcileBossAssists(roster, options = {}, actions = {}) {
  const assignments = getBossAssistAssignments(roster, options);
  for (const actor of roster) {
    const owner = roster.find((row) => idOf(row) === assignments.get(idOf(actor)));
    const hunt = actor._wildlifeHunt || owner?._wildlifeHunt;
    const cast = actor._pendingCharacterCast;
    if (cast?.bossAssistEncounterId && cast.bossAssistEncounterId !== hunt?.id) {
      cancelCharacterCast(actor, options.nowSec || 0, 'hunt_end', actions);
    }
    if (actor._wildlifeHunt) continue;
    for (const key of ['_spatialMotion', '_spatialLastSeen']) {
      const targetId = String(actor[key]?.targetId || '');
      if (targetId.startsWith('wildlife:') && targetId !== idOf(hunt?.target)) actor[key] = null;
    }
  }
  return assignments;
}
