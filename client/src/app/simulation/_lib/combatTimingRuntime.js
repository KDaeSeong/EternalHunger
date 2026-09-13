import { getCombatStats } from './combatDamageRuntime.js';
import { isDimensionRiftDefeated } from '../../../utils/dimensionRiftDefeatLogic.js';
import { getActiveStatusEffects, getStoredActiveStatusEffects, getForcedControlEffect, canBasicAttackByStatus } from '../../../utils/statusLogic.js';
import { areSameTeam, getActorTeamId } from './teamRuntime.js';
import { isAiRecoveryLocked } from './survivorLifecycleRuntime.js';
import { findCharacterSkillChoice } from './characterCastRuntime.js';
import { simulationRandom } from '../../../utils/simulationRandom.js';
import { getCombatSpaceId, shareCombatSpace, WORLD_COMBAT_SPACE } from '../../../utils/combatSpaceLogic.js';
import { canObserveActor, spatialDistance, getSpatialStats, planSpatialApproach, planSpatialPatrol, rememberSpatialContact,
  getForcedControlMotion, isInBasicAttackRange, SPATIAL_STEP_SEC } from './combatSpatialRuntime.js';

const idOf = (actor) => String(actor?._id || actor?.id || '');
export const roundCombatTime = (value) => Math.round(Number(value) * 1e6) / 1e6;

export function getBasicAttackIntervalSec(actor) {
  // Actor stat rules already cap attack speed at 3 before equipment. Apply
  // that same project cap to the final equipped rate used by the clock.
  const speed = Math.max(0.1, Math.min(3, getCombatStats(actor).attackSpeed));
  return roundCombatTime(1 / speed);
}

export function isBasicAttackReady(actor, nowSec) {
  return Number(actor?._basicAttackReadyAtSec || 0) <= Number(nowSec);
}

export function reserveBasicAttack(actor, nowSec) {
  const intervalSec = getBasicAttackIntervalSec(actor);
  actor._lastBasicAttackAtSec = Number(nowSec);
  actor._basicAttackReadyAtSec = roundCombatTime(Number(nowSec) + intervalSec);
  return intervalSec;
}

function statusReleaseDelay(actor, tag) {
  return getActiveStatusEffects(actor).reduce((delay, effect) => !effect.tags.includes(tag) ? delay
    : Math.max(delay, effect.remainingDuration == null ? Infinity : effect.remainingDuration), 0);
}

export function getCombatIntentOpponents(actor, roster, nowSec = 0) {
  if (isDimensionRiftDefeated(actor)) return [];
  if (getForcedControlEffect(actor)) {
    const plan = getForcedControlMotion(actor, roster);
    const target = plan?.source;
    return plan?.control.mode === 'taunt' && target && !isDimensionRiftDefeated(target) && !areSameTeam(actor, target)
      && !isAiRecoveryLocked(actor, nowSec) && !isAiRecoveryLocked(target, nowSec) ? [target] : [];
  }
  const intent = actor?._combatIntent;
  if (!intent || Number(actor.hp || 0) <= 0 || String(actor.zoneId) !== intent.zoneId
    || String(intent.combatSpaceId || WORLD_COMBAT_SPACE) !== getCombatSpaceId(actor) || isAiRecoveryLocked(actor, nowSec)) return [];
  return roster.filter((row) => Number(row?.hp || 0) > 0 && !isDimensionRiftDefeated(row) && !areSameTeam(actor, row)
    && shareCombatSpace(actor, row) && String(row.zoneId) === intent.zoneId && getActorTeamId(row) === intent.enemyTeamId
    && !isAiRecoveryLocked(row, nowSec) && canObserveActor(actor, row, roster));
}

export function engageCombatParticipants(actor, target, roster, nowSec, { teamCombat = true } = {}) {
  if (!actor || !target || !shareCombatSpace(actor, target) || isDimensionRiftDefeated(actor) || isDimensionRiftDefeated(target)) return;
  const leaders = [actor, target];
  for (let side = 0; side < leaders.length; side++) {
    const leader = leaders[side]; const enemy = leaders[1 - side];
    for (const row of roster) {
      if (Number(row?.hp || 0) <= 0 || isDimensionRiftDefeated(row) || !shareCombatSpace(leader, row) || String(row.zoneId) !== String(leader.zoneId)
        || !areSameTeam(leader, row) || (!teamCombat && idOf(row) !== idOf(leader)) || isAiRecoveryLocked(row, nowSec)) continue;
      const zoneId = String(leader.zoneId); const enemyTeamId = getActorTeamId(enemy);
      if (row._combatIntent?.zoneId !== zoneId || row._combatIntent?.enemyTeamId !== enemyTeamId) row._combatInitiative = simulationRandom();
      const heldFocus = row._combatIntent?.zoneId === zoneId && row._combatIntent?.enemyTeamId === enemyTeamId
        ? row._combatIntent.focusTargetId : '';
      row._combatIntent = { zoneId, combatSpaceId: getCombatSpaceId(leader), enemyTeamId, targetId: idOf(enemy), focusTargetId: heldFocus || '' };
    }
  }
}

// Find a real future attack, independently of the encounter-discovery queue.
// No stored "missed turns": after stun/travel the next attack starts from now.
export function findNextCombatAction(survivorMap, nowSec, newDeadIds = [], settings = {}) {
  const roster = [...survivorMap.values()].filter((row) => !newDeadIds.includes(idOf(row)));
  let next = null;
  const priority = { status_boundary: -1, skill_release: 0, skill_expire: 0, skill_start: 1, basic: 2, approach: 3 };
  const consider = (candidate, actor) => {
    if (!candidate || !Number.isFinite(candidate.atSec)) return;
    candidate.combatSpaceId = getCombatSpaceId(actor);
    candidate.initiative = Number(actor._combatInitiative || 0);
    if (!next || candidate.atSec < next.atSec || candidate.atSec === next.atSec && (
      priority[candidate.actionType] < priority[next.actionType]
      || priority[candidate.actionType] === priority[next.actionType] && (candidate.initiative < next.initiative
        || candidate.initiative === next.initiative && candidate.actorId.localeCompare(next.actorId) < 0))) next = candidate;
  };
  for (const actor of roster) {
    if (Number(actor.hp || 0) <= 0 || isDimensionRiftDefeated(actor)) { actor._spatialMotion = null; continue; }
    // Timed wildlife encounters have their own hostile target and scheduler.
    // They re-enter PvP scheduling after that claim is completed or released.
    if (actor._wildlifeHunt) continue;
    const statusExpiry = getStoredActiveStatusEffects(actor).reduce((seconds, effect) =>
      effect.remainingDuration != null && Number.isFinite(effect.remainingDuration)
        ? Math.min(seconds, effect.remainingDuration) : seconds, Infinity);
    if (Number.isFinite(statusExpiry)) consider({ actorId: idOf(actor),
      atSec: roundCombatTime(nowSec + statusExpiry), actionType: 'status_boundary' }, actor);
    if (actor._armedCharacterSkill) consider({ actorId: idOf(actor), atSec: Math.max(nowSec, actor._armedCharacterSkill.expiresAtSec), actionType: 'skill_expire' }, actor);
    const forced = getForcedControlMotion(actor, roster);
    if (forced) {
      actor._spatialMotion = null;
      consider({ actorId: idOf(actor), atSec: roundCombatTime(nowSec + SPATIAL_STEP_SEC), actionType: 'approach' }, actor);
      const target = getCombatIntentOpponents(actor, roster, nowSec)[0];
      if (target && !actor._pendingCharacterCast && canBasicAttackByStatus(actor, target) && isInBasicAttackRange(actor, target, roster)) {
        consider({ actorId: idOf(actor), targetId: idOf(target), actionType: 'basic',
          atSec: roundCombatTime(Math.max(nowSec, Number(actor._actionReadyAtSec || 0), Number(actor._basicAttackReadyAtSec || 0))) }, actor);
      }
      continue;
    }
    if (actor._pendingCharacterCast) {
      consider({ actorId: idOf(actor), targetId: actor._pendingCharacterCast.targetId,
        atSec: Math.max(nowSec, actor._pendingCharacterCast.releaseAtSec), actionType: 'skill_release' }, actor);
      continue;
    }
    if (!actor._combatIntent) { consider(planSpatialPatrol(actor, nowSec), actor); continue; }
    const opponents = getCombatIntentOpponents(actor, roster, nowSec);
    if (!opponents.length) {
      const searching = planSpatialApproach(actor, null, nowSec, roster);
      if (searching) consider(searching, actor);
      else { actor._combatIntent = null; consider(planSpatialPatrol(actor, nowSec), actor); }
      continue;
    }
    const choice = findCharacterSkillChoice(actor, opponents, roster, nowSec, settings);
    if (choice) consider({ actorId: idOf(actor), targetId: choice.targetId, atSec: choice.atSec, choice, actionType: 'skill_start' }, actor);
    const actionDelay = Math.max(statusReleaseDelay(actor, 'action_block'), statusReleaseDelay(actor, 'basic_block'));
    const candidates = opponents.map((target) => ({ target, delay: statusReleaseDelay(target, 'untargetable') }))
      .sort((a, b) => a.delay - b.delay || Number(idOf(b.target) === actor._combatIntent.targetId) - Number(idOf(a.target) === actor._combatIntent.targetId));
    const reachable = candidates.filter(({ target }) => spatialDistance(actor, target) <= getSpatialStats(actor).attackRange + 1e-6);
    if (!reachable.length) {
      const nearest = [...candidates].sort((a, b) => spatialDistance(actor, a.target) - spatialDistance(actor, b.target))[0].target;
      consider(planSpatialApproach(actor, nearest, nowSec, roster), actor);
      continue;
    }
    actor._spatialMotion = null;
    const { target, delay } = reachable[0];
    rememberSpatialContact(actor, target, nowSec, roster);
    const atSec = roundCombatTime(Math.max(Number(nowSec) + Math.max(actionDelay, delay), Number(actor._basicAttackReadyAtSec || 0), Number(actor._actionReadyAtSec || 0)));
    consider({ actorId: idOf(actor), targetId: idOf(target), atSec, actionType: 'basic' }, actor);
  }
  return next;
}
