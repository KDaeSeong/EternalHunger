import { EFFECT_KNOCKBACK, canonicalizeEffectName, getActiveStatusEffects } from '../../../utils/statusEffectDefinitions.js';
import { canMoveByStatus, isTargetableByStatus } from '../../../utils/statusEffectSelectors.js';
import { getActorDimensionRiftId, getCombatSpaceId } from '../../../utils/combatSpaceLogic.js';
import { isDimensionRiftDefeated } from '../../../utils/dimensionRiftDefeatLogic.js';
import { getSpatialPosition, SPATIAL_REGION_SIZE } from './combatSpatialRuntime.js';

const round = (value) => Math.round(value * 1e6) / 1e6;
const isKnockback = (effect) => canonicalizeEffectName(effect?.name) === EFFECT_KNOCKBACK;
const validOrigin = (point, actor) => point && point.zoneId === String(actor.zoneId)
  && point.combatSpaceId === getCombatSpaceId(actor) && Number.isFinite(point.x) && Number.isFinite(point.y)
  && point.x >= 0 && point.x <= SPATIAL_REGION_SIZE && point.y >= 0 && point.y <= SPATIAL_REGION_SIZE;

function consumeImpulse(actor, effect, outcome = 'applied') {
  actor.activeEffects = (actor.activeEffects || []).map((row) => isKnockback(row)
    && row.knockbackSerial === effect.knockbackSerial ? { ...row, knockbackConsumed: true, knockbackOutcome: outcome } : row);
}

// Tactical skills with an explicit distance use the chosen combat target as
// the simulation's cursor direction. This coordinate move exists only inside
// a valid rift admission; the field flee/chase abstraction remains unchanged.
export function resolveRiftTacticalMovement(actor, target, {
  skill = '', distance = 0, nowSec,
} = {}, actions = {}) {
  const riftId = getActorDimensionRiftId(actor);
  const targetRiftId = getActorDimensionRiftId(target);
  const requestedDistance = distance;
  if (!riftId || targetRiftId !== riftId || !Number.isFinite(nowSec) || nowSec < 0
    || !Number.isFinite(requestedDistance) || requestedDistance <= 0
    || !Number.isFinite(Number(actor?.hp)) || Number(actor.hp) <= 0
    || !Number.isFinite(Number(target?.hp)) || Number(target.hp) <= 0
    || isDimensionRiftDefeated(actor) || isDimensionRiftDefeated(target)
    || !isTargetableByStatus(target) || !canMoveByStatus(actor)
    || String(actor.zoneId) !== String(target.zoneId) || getCombatSpaceId(actor) !== getCombatSpaceId(target)
    || actor._dimensionRiftEntry.enteredAtSec > nowSec || target._dimensionRiftEntry.enteredAtSec > nowSec) return null;
  const from = getSpatialPosition(actor); const toward = getSpatialPosition(target);
  if (!from || !toward) return null;
  const normalizedSkill = String(skill || '').trim();
  const useAtSec = actor._tacLastUsedAt;
  if (!normalizedSkill || actor._tacLastUsed !== normalizedSkill || !Number.isFinite(useAtSec) || useAtSec !== nowSec) return null;
  const id = `${riftId}:${actor._dimensionRiftEntry.enteredAtSec}:tactical:${normalizedSkill}:${useAtSec}`;
  if (actor._lastRiftTacticalMovementReceipt?.id === id) return null;
  const dx = toward.x - from.x; const dy = toward.y - from.y;
  const length = Math.hypot(dx, dy);
  const travel = Math.min(requestedDistance, length);
  const to = length > 0 ? { ...from, x: round(from.x + dx / length * travel), y: round(from.y + dy / length * travel) } : { ...from };
  const receipt = { id, who: String(actor._id || actor.id || ''), targetId: String(target._id || target.id || ''),
    riftId, combatSpaceId: getCombatSpaceId(actor), zoneId: String(actor.zoneId), atSec: nowSec,
    skill: normalizedSkill, from: { ...from }, toward: { ...toward }, to: { ...to }, requestedDistance,
    actualDistance: round(Math.hypot(to.x - from.x, to.y - from.y)), stoppedAtTarget: travel < requestedDistance,
    reason: 'tactical_movement' };
  // Commit the receipt first so an observer callback or restored duplicate
  // cannot move the same skill use twice.
  actor._lastRiftTacticalMovementReceipt = receipt;
  actor._spatial = to;
  actor._spatialMotion = null;
  actions.emitRunEvent?.('spatial_displacement', receipt, { ...actions.atNow?.(), sec: nowSec });
  actions.addLog?.(`↔️ [${actor.name || receipt.who}] 차원의 틈 전술 이동(${normalizedSkill}) ${receipt.actualDistance}m${receipt.stoppedAtTarget ? ' · 대상 위치에서 멈춤' : ''}`, 'combat-detail');
  return receipt;
}

// Project arena rule: an impulse moves along the ray away from the recorded
// caster position, in meters inside the existing 24m square, never to a region.
// It is displacement, not walking: roots/stuns do not cancel the impulse.
export function resolveRiftKnockbacks(roster, nowSec, actions = {}) {
  const results = [];
  if (!Number.isFinite(nowSec) || nowSec < 0) return results;
  for (const actor of roster || []) {
    const riftId = getActorDimensionRiftId(actor);
    if (!riftId || !Number.isFinite(Number(actor.hp)) || actor.hp <= 0 || isDimensionRiftDefeated(actor)
      || !isTargetableByStatus(actor) || nowSec < actor._dimensionRiftEntry.enteredAtSec) continue;
    const effect = getActiveStatusEffects(actor).find((row) => isKnockback(row) && !row.knockbackConsumed
      && row.knockbackTargetSpaceId === getCombatSpaceId(actor)
      && row.knockbackTargetEntryAtSec === actor._dimensionRiftEntry.enteredAtSec);
    if (!effect || !Number.isSafeInteger(effect.knockbackSerial) || effect.knockbackSerial <= 0
      || effect.knockbackAppliedAtSec != null && (!Number.isFinite(effect.knockbackAppliedAtSec) || effect.knockbackAppliedAtSec > nowSec)) continue;
    const id = `${riftId}:${actor._dimensionRiftEntry.enteredAtSec}:knockback:${effect.knockbackSerial}`;
    const previous = actor._lastRiftKnockbackReceipt;
    if (previous?.id === id) { consumeImpulse(actor, effect, 'duplicate'); continue; }
    if (previous?.serial >= effect.knockbackSerial) { consumeImpulse(actor, effect, 'stale'); continue; }
    if (previous?.atSec > nowSec) continue;
    const from = getSpatialPosition(actor);
    const origin = effect.sourcePosition;
    const targetAtHit = effect.knockbackTargetPosition;
    const distance = effect.knockbackDistance;
    if (!from || !validOrigin(origin, actor) || !validOrigin(targetAtHit, actor) || !Number.isFinite(distance) || distance <= 0) {
      const reason = !from ? 'target_position_unknown' : !validOrigin(origin, actor) ? 'source_position_unknown'
        : !validOrigin(targetAtHit, actor) ? 'impact_position_unknown' : 'invalid_distance';
      if (actor._riftKnockbackNotice?.id !== id || actor._riftKnockbackNotice?.reason !== reason) {
        actor._riftKnockbackNotice = { id, reason };
        actions.emitRunEvent?.('spatial_displacement_pending', { who: String(actor._id || actor.id || ''),
          riftId, reason, impulseId: id }, { ...actions.atNow?.(), sec: nowSec });
      }
      continue;
    }
    const dx = targetAtHit.x - origin.x; const dy = targetAtHit.y - origin.y;
    const length = Math.hypot(dx, dy);
    // Coincident positions choose +X deterministically, like the existing fear geometry.
    const ux = length ? dx / length : 1; const uy = length ? dy / length : 0;
    const edgeX = ux > 0 ? (SPATIAL_REGION_SIZE - from.x) / ux : ux < 0 ? -from.x / ux : Infinity;
    const edgeY = uy > 0 ? (SPATIAL_REGION_SIZE - from.y) / uy : uy < 0 ? -from.y / uy : Infinity;
    const travel = Math.max(0, Math.min(distance, edgeX, edgeY));
    const to = { ...from, x: round(from.x + ux * travel), y: round(from.y + uy * travel) };
    const receipt = { id, serial: effect.knockbackSerial, who: String(actor._id || actor.id || ''),
      riftId, combatSpaceId: getCombatSpaceId(actor), zoneId: String(actor.zoneId), atSec: nowSec,
      effectAppliedAtSec: effect.knockbackAppliedAtSec, sourceActorId: effect.sourceActorId || '',
      sourcePosition: { ...origin }, targetPositionAtHit: { ...targetAtHit }, from: { ...from }, to: { ...to }, requestedDistance: distance,
      actualDistance: round(Math.hypot(to.x - from.x, to.y - from.y)), clipped: travel < distance, reason: 'knockback' };
    // Commit before observers: repeated reconciliation/JSON/callback re-entry
    // cannot apply one impulse twice, even if its original effect is restored.
    actor._spatial = to;
    actor._spatialMotion = null;
    if (actor._pendingCharacterCast) actor._pendingCharacterCast = { ...actor._pendingCharacterCast, statusInterrupt: EFFECT_KNOCKBACK };
    actor._lastRiftKnockbackReceipt = receipt;
    actor._riftKnockbackNotice = null;
    consumeImpulse(actor, effect);
    results.push(receipt);
    actions.emitRunEvent?.('spatial_displacement', receipt, { ...actions.atNow?.(), sec: nowSec });
    actions.addLog?.(`↔️ [${actor.name || receipt.who}] 차원의 틈 내부 넉백 ${receipt.actualDistance}m${receipt.clipped ? ' · 전장 경계에서 멈춤' : ''}`, 'combat-detail');
  }
  return results;
}
