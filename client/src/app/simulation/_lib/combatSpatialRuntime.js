import { getEffectiveStats, getActiveStatusEffects, getStoredActiveStatusEffects, getMoveSpeedStatusBonus, isTargetableByStatus,
  getForcedControlEffect, isForcedControlEffect, canMoveByStatus, hasMovementInterruptStatus } from '../../../utils/statusLogic.js';
import { getCombatEquipment } from '../../../utils/battleEquipmentLogic.js';
import { areSameTeam } from './teamRuntime.js';
import { getActorPerkEffects, perkNumber } from './perkRuntime.js';
import { getCombatSpaceId, shareCombatSpace, WORLD_COMBAT_SPACE } from '../../../utils/combatSpaceLogic.js';

// Project geometry, not the original game's terrain scale. Each region owns a
// 24 m square; region transport still uses the existing graph/arrival lock.
export const SPATIAL_REGION_SIZE = 24;
export const SPATIAL_STEP_SEC = 0.25;
export const SPATIAL_MEMORY_SEC = 3;
const idOf = (actor) => String(actor?._id || actor?.id || '');
const round = (value) => Math.round(value * 1e6) / 1e6;
const clamp = (value) => Math.max(0, Math.min(SPATIAL_REGION_SIZE, value));
const validPoint = (point, zoneId, combatSpaceId = WORLD_COMBAT_SPACE) => point && point.zoneId === String(zoneId || '') && point.zoneId
  && String(point.combatSpaceId || WORLD_COMBAT_SPACE) === combatSpaceId
  && Number.isFinite(point.x) && Number.isFinite(point.y)
  && point.x >= 0 && point.x <= SPATIAL_REGION_SIZE && point.y >= 0 && point.y <= SPATIAL_REGION_SIZE;

export function getSpatialPosition(actor) {
  const point = actor?._spatial;
  return validPoint(point, actor?.zoneId, getCombatSpaceId(actor)) ? point : null;
}

export function getSpatialLastSeen(actor) {
  const seen = actor?._spatialLastSeen;
  return validPoint(seen, actor?.zoneId, getCombatSpaceId(actor)) && seen.targetId && Number.isFinite(seen.seenAtSec) ? seen : null;
}

export function rememberSpatialContact(actor, target, nowSec, roster) {
  if (String(actor.zoneId) !== String(target?.zoneId) || !canObserveActor(actor, target, roster)) return;
  actor._spatialLastSeen = { ...getSpatialPosition(target), targetId: idOf(target), seenAtSec: nowSec };
}

export function initializeSpatialPosition(actor, { reset = false } = {}) {
  const existing = !reset && getSpatialPosition(actor);
  if (existing) return { ...existing };
  const zoneId = String(actor?.zoneId || '');
  if (!zoneId || !idOf(actor)) return null;
  let hash = 2166136261;
  const combatSpaceId = getCombatSpaceId(actor);
  const salt = `${idOf(actor)}:${zoneId}${combatSpaceId === WORLD_COMBAT_SPACE ? '' : `:${combatSpaceId}`}`;
  for (const char of salt) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return { zoneId, ...(combatSpaceId !== WORLD_COMBAT_SPACE ? { combatSpaceId } : {}),
    x: round(4 + (hash & 65535) / 65535 * 16), y: round(4 + (hash >>> 16) / 65535 * 16) };
}

export function syncSpatialPositions(roster) {
  for (const actor of roster) {
    if (!getSpatialPosition(actor)) actor._spatial = initializeSpatialPosition(actor);
    if (hasMovementInterruptStatus(actor)) actor._spatialMotion = null;
    if (!validPoint(actor._spatialMotion, actor.zoneId, getCombatSpaceId(actor)) || !Number.isFinite(actor._spatialMotion.stopRange)
      || actor._spatialMotion.stopRange < 0) actor._spatialMotion = null;
    if (!getSpatialLastSeen(actor)) actor._spatialLastSeen = null;
  }
}

export function spatialDistance(a, b) {
  const from = getSpatialPosition(a); const to = getSpatialPosition(b);
  return shareCombatSpace(a, b) && from && to && from.zoneId === to.zoneId ? Math.hypot(from.x - to.x, from.y - to.y) : Infinity;
}

export function getSpatialStats(actor) {
  const stats = { ...getEffectiveStats(actor) };
  let speedRatio = getMoveSpeedStatusBonus(actor) + Number(actor?.permanentMoveSpeed || actor?.itemPermanentBonuses?.moveSpeed || 0)
    + perkNumber(getActorPerkEffects(actor)?.moveSpeedPlus || 0);
  for (const item of getCombatEquipment(actor)) {
    stats.attackRange += Number(item.stats?.attackRange || 0);
    stats.sightRange += Number(item.stats?.sightRange || 0);
    speedRatio += Number(item.stats?.moveSpeed || 0);
  }
  return { attackRange: Math.max(0.5, stats.attackRange), sightRange: Math.max(1, stats.sightRange),
    moveSpeed: Math.max(0.1, stats.moveSpeed * Math.max(0.25, 1 + speedRatio)) };
}

export function canSeeActor(observer, target) {
  return Number(observer?.hp || 0) > 0 && Number(target?.hp || 0) > 0
    && spatialDistance(observer, target) <= getSpatialStats(observer).sightRange + 1e-6;
}

export function canObserveActor(actor, target, roster = [actor]) {
  return shareCombatSpace(actor, target) && (canSeeActor(actor, target)
    || roster.some((ally) => shareCombatSpace(actor, ally) && areSameTeam(actor, ally) && canSeeActor(ally, target)));
}

export function isInBasicAttackRange(actor, target, roster = [actor]) {
  return isTargetableByStatus(target) && spatialDistance(actor, target) <= getSpatialStats(actor).attackRange + 1e-6
    && canObserveActor(actor, target, roster);
}

export function forcedControlKey(effect) {
  return `${effect.name}:${effect.sourceActorId || ''}:${effect.controlSerial || 0}`;
}

// A control command is not an AI chase. Its caster has an explicit actor ID;
// skill source IDs and display names are never interpreted as participant IDs.
export function getForcedControlMotion(actor, roster) {
  const control = getForcedControlEffect(actor);
  if (!control) return null;
  const from = getSpatialPosition(actor);
  const source = roster.find((row) => idOf(row) === String(control.sourceActorId || '') && Number(row.hp || 0) > 0
    && shareCombatSpace(actor, row) && String(row.zoneId) === String(actor.zoneId));
  const observed = source && canObserveActor(actor, source, roster);
  const prior = actor._forcedControlState?.key === forcedControlKey(control) ? actor._forcedControlState.sourcePosition : null;
  const spaceId = getCombatSpaceId(actor);
  const sourcePosition = observed ? getSpatialPosition(source) : validPoint(prior, actor.zoneId, spaceId) ? prior
    : validPoint(control.sourcePosition, actor.zoneId, spaceId) ? control.sourcePosition : null;
  const result = { control, sourcePosition, source: observed ? source : null, motion: null };
  if (!from || !sourcePosition) return result;
  let x = sourcePosition.x; let y = sourcePosition.y;
  if (control.mode === 'fear') {
    const dx = from.x - x; const dy = from.y - y; const distance = Math.hypot(dx, dy);
    // Coincident points choose +X deterministically, without drawing game RNG.
    const ux = distance ? dx / distance : 1; const uy = distance ? dy / distance : 0;
    // Intersect the ray with the first region edge. Clamping X/Y separately
    // would turn diagonal fear toward a corner instead of away from its caster.
    const edgeX = ux > 0 ? (SPATIAL_REGION_SIZE - from.x) / ux : ux < 0 ? -from.x / ux : Infinity;
    const edgeY = uy > 0 ? (SPATIAL_REGION_SIZE - from.y) / uy : uy < 0 ? -from.y / uy : Infinity;
    const reach = Math.max(0, Math.min(edgeX, edgeY));
    x = clamp(from.x + ux * reach);
    y = clamp(from.y + uy * reach);
  }
  result.motion = { zoneId: from.zoneId, combatSpaceId: spaceId, x, y, targetId: String(control.sourceActorId || ''),
    stopRange: control.mode === 'taunt' ? getSpatialStats(actor).attackRange : 0, reason: 'forced_control' };
  return result;
}

export function getSpatialSkillRange(actor, def, settings = {}) {
  return Number(def?.range) > 0 ? Number(def.range) : Number(settings?.skills?.defaultCharacterSkillRange) > 0
    ? Number(settings.skills.defaultCharacterSkillRange) : getSpatialStats(actor).attackRange;
}

export function isInSpatialSkillRange(actor, target, def, settings = {}, roster = [actor]) {
  if (idOf(actor) && idOf(actor) === idOf(target)) return true;
  return spatialDistance(actor, target) <= getSpatialSkillRange(actor, def, settings) + 1e-6
    && canObserveActor(actor, target, roster);
}

// Do not track an invisible actor's live coordinates. Continue to the last
// observed point for at most three seconds, then release the engagement.
export function planSpatialApproach(actor, target, nowSec, roster) {
  if (hasMovementInterruptStatus(actor)) { actor._spatialMotion = null; return null; }
  const point = getSpatialPosition(actor);
  if (!point || actor.hp <= 0) return null;
  const visible = target && canObserveActor(actor, target, roster);
  const old = getSpatialLastSeen(actor);
  if (visible) {
    const destination = getSpatialPosition(target);
    rememberSpatialContact(actor, target, nowSec, roster);
    actor._spatialMotion = { zoneId: point.zoneId, combatSpaceId: getCombatSpaceId(actor), targetId: idOf(target), x: destination.x, y: destination.y,
      seenAtSec: nowSec, stopRange: getSpatialStats(actor).attackRange, reason: 'approach' };
  } else if (!old || nowSec < old.seenAtSec || nowSec - old.seenAtSec >= SPATIAL_MEMORY_SEC) {
    actor._spatialMotion = null;
    actor._spatialLastSeen = null;
    return null;
  } else actor._spatialMotion = { ...old, stopRange: 0, reason: 'last_seen' };
  return spatialTick(actor, nowSec);
}

function spatialTick(actor, nowSec) {
  const delay = getSpatialMoveDelay(actor, nowSec);
  return Number.isFinite(delay) ? { actorId: idOf(actor), targetId: actor._spatialMotion?.targetId || '',
    atSec: round(nowSec + Math.max(SPATIAL_STEP_SEC, delay)), actionType: 'approach' } : null;
}

// Explore known ground, not a hidden opponent's coordinates. This also avoids
// a final-region stalemate when the remaining teams cannot initially see each other.
export function planSpatialPatrol(actor, nowSec) {
  if (hasMovementInterruptStatus(actor)) { actor._spatialMotion = null; return null; }
  const point = getSpatialPosition(actor);
  if (!point || actor.hp <= 0) return null;
  const old = actor._spatialMotion;
  if (old?.reason !== 'patrol' || !validPoint(old, point.zoneId, getCombatSpaceId(actor)) || Math.hypot(old.x - point.x, old.y - point.y) < 0.01) {
    const waypoints = [[4, 4], [20, 4], [20, 20], [4, 20], [12, 12]];
    const rawIndex = Number(actor._spatialPatrolIndex);
    const index = Number.isSafeInteger(rawIndex) && rawIndex >= 0 ? rawIndex : 0;
    const salt = [...idOf(actor)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const [x, y] = waypoints[(index + salt) % waypoints.length];
    actor._spatialPatrolIndex = index + 1;
    actor._spatialMotion = { zoneId: point.zoneId, combatSpaceId: getCombatSpaceId(actor), x, y, targetId: '', stopRange: 0, reason: 'patrol' };
  }
  return spatialTick(actor, nowSec);
}

export function getSpatialMoveDelay(actor, nowSec, { forced = false } = {}) {
  const statusDelay = getActiveStatusEffects(actor).reduce((delay, effect) =>
    effect.tags.some((tag) => tag === 'move_block' || tag === 'action_block' || !forced && tag === 'voluntary_block')
      ? Math.max(delay, effect.remainingDuration == null ? Infinity : effect.remainingDuration) : delay, 0);
  return Math.max(0, statusDelay, Number(actor._actionReadyAtSec || 0) - nowSec, Number(actor._recentCombatUntil || 0) - nowSec);
}

function movementBudget(actor, startSec, elapsedSec, { forced = false } = {}) {
  const effects = getStoredActiveStatusEffects(actor);
  const delay = Math.max(0, Number(actor._actionReadyAtSec || 0) - startSec, Number(actor._recentCombatUntil || 0) - startSec);
  if (delay >= elapsedSec) return 0;
  const boundaries = [...new Set([delay, elapsedSec, ...effects.map((effect) => effect.remainingDuration)
    .filter((end) => end != null && end > delay && end < elapsedSec)])].sort((a, b) => a - b);
  let distance = 0;
  for (let i = 1; i < boundaries.length; i++) {
    const from = boundaries[i - 1];
    const snapshot = { ...actor, activeEffects: effects.filter((effect) => effect.remainingDuration == null || effect.remainingDuration > from)
      .map((effect) => effect.remainingDuration == null ? effect : { ...effect, remainingDuration: round(effect.remainingDuration - from) }) };
    if (!canMoveByStatus(snapshot, { forced }) || getSpatialMoveDelay(snapshot, startSec + from, { forced }) > 0) continue;
    distance += getSpatialStats(snapshot).moveSpeed * (boundaries[i] - from);
  }
  return distance;
}

// Advance everyone from the same pre-step snapshot, before status expiration.
// This keeps movement independent of roster iteration or display frequency.
export function advanceSpatialMovement(roster, startSec, elapsedSec) {
  syncSpatialPositions(roster);
  if (!Number.isFinite(elapsedSec) || elapsedSec <= 0) return 0;
  if (!roster.some((actor) => getStoredActiveStatusEffects(actor).some((effect) => isForcedControlEffect(effect)
    || effect.tags.includes('movement_interrupt')))) {
    return advanceSpatialSegment(roster, roster, startSec, elapsedSec);
  }
  const boundaries = new Set([0, elapsedSec]);
  for (let at = (Math.floor(startSec / SPATIAL_STEP_SEC) + 1) * SPATIAL_STEP_SEC; at < startSec + elapsedSec; at += SPATIAL_STEP_SEC) {
    if (at > startSec) boundaries.add(round(at - startSec));
  }
  for (const actor of roster) for (const effect of getStoredActiveStatusEffects(actor)) {
    if (effect.remainingDuration > 0 && effect.remainingDuration < elapsedSec) boundaries.add(effect.remainingDuration);
  }
  const ordered = [...boundaries].sort((a, b) => a - b);
  let updates = 0;
  for (let i = 1; i < ordered.length; i++) {
    const from = ordered[i - 1];
    const snapshots = roster.map((actor) => ({ ...actor, activeEffects: getStoredActiveStatusEffects(actor)
      .filter((effect) => effect.remainingDuration == null || effect.remainingDuration > from)
      .map((effect) => effect.remainingDuration == null ? effect : { ...effect, remainingDuration: round(effect.remainingDuration - from) }) }));
    updates += advanceSpatialSegment(roster, snapshots, startSec + from, ordered[i] - from);
  }
  return updates;
}

function advanceSpatialSegment(roster, snapshots, startSec, elapsedSec) {
  const updates = [];
  for (const [index, actor] of snapshots.entries()) {
    if (hasMovementInterruptStatus(actor)) { roster[index]._spatialMotion = null; continue; }
    const forced = getForcedControlMotion(actor, snapshots);
    const motion = forced ? forced.motion : actor._spatialMotion; const from = getSpatialPosition(actor);
    if (!motion || !from || !validPoint(motion, from.zoneId, getCombatSpaceId(actor)) || actor.hp <= 0 || actor._pendingCharacterCast) continue;
    const available = motion.reason === 'last_seen'
      ? Math.max(0, Math.min(elapsedSec, motion.seenAtSec + SPATIAL_MEMORY_SEC - startSec)) : elapsedSec;
    const dx = motion.x - from.x; const dy = motion.y - from.y; const distance = Math.hypot(dx, dy);
    const travel = Math.min(Math.max(0, distance - motion.stopRange), movementBudget(actor, startSec, available, { forced: !!forced }));
    if (forced?.sourcePosition && roster[index]._forcedControlState?.key === forcedControlKey(forced.control)) {
      roster[index]._forcedControlState = { ...roster[index]._forcedControlState, sourcePosition: { ...forced.sourcePosition } };
    }
    if (distance > 0 && travel > 0) updates.push([roster[index], { ...from,
      x: round(clamp(from.x + dx / distance * travel)), y: round(clamp(from.y + dy / distance * travel)) }]);
  }
  for (const [actor, point] of updates) actor._spatial = point;
  return updates.length;
}
