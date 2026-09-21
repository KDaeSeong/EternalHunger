import { normalizeEquipmentEffects } from '../../../utils/equipmentEffectContract.js';
import { getCombatEquipment } from '../../../utils/battleEquipmentLogic.js';
import { getStatGrowthLevel } from '../../../utils/erStats.js';
import { getCombatSpaceId, shareCombatSpace } from '../../../utils/combatSpaceLogic.js';
import { isDimensionRiftDefeated } from '../../../utils/dimensionRiftDefeatLogic.js';
import { getCombatStats } from './combatDamageRuntime.js';
import { roundCombatTime } from './combatTimingRuntime.js';
import { getSpatialPosition } from './combatSpatialRuntime.js';
import { areSameTeam } from './teamRuntime.js';

const idOf = actor => String(actor?._id || '');
const alive = actor => Number.isFinite(Number(actor?.hp)) && Number(actor.hp) > 0 && !isDimensionRiftDefeated(actor);
const experiment = actor => Boolean(idOf(actor)) && !idOf(actor).startsWith('wildlife:');
const stateOf = actor => actor?._equipmentEffectState || { cooldowns: {}, pending: [], sequence: 0 };
const atTime = (at, nowSec) => ({ ...(at || {}), sec: roundCombatTime(nowSec) });

export function equipmentEffectBaseDamage(actor, definition) {
  const stats = getCombatStats(actor), damage = definition.damage;
  return damage.base + damage.perLevel * getStatGrowthLevel(actor)
    + damage.attackPowerRatio * stats.attackPower + damage.skillAmpRatio * stats.skillAmp;
}

// Called only after a real impact has settled. All state is JSON-safe and is
// replaced rather than mutating a shared snapshot's nested queue/cooldowns.
export function recordEquipmentSkillImpact(actor, target, impact, { at = null, emitRunEvent = () => {}, addLog = () => {} } = {}) {
  const packet = impact?.packet, nowSec = Number(at?.sec);
  if (!alive(actor) || !experiment(actor) || !experiment(target) || areSameTeam(actor, target)
    || !shareCombatSpace(actor, target) || String(actor.zoneId) !== String(target.zoneId)
    || !Number.isFinite(nowSec) || nowSec < 0 || !packet || packet.equipmentEffectId || impact.blockedReason
    || !(packet.type === 'skill' || packet.type === 'true' && packet.castId)
    || !(impact.hpBefore > 0) || !(impact.hpDamage > 0 || impact.absorbed > 0)) return null;

  const choices = getCombatEquipment(actor).flatMap(item => {
    const qty = item.qty === undefined ? 1 : item.qty;
    if (!Number.isSafeInteger(qty) || qty <= 0 || item.craftComponent
      || !['무기', 'weapon', '방어구', 'armor'].includes(item.type)) return [];
    const result = normalizeEquipmentEffects(item.equipmentEffects);
    const itemId = String(item.itemId || item._id || item.id || '');
    return result.ok && itemId ? result.effects.map(definition => ({ itemId, itemName: String(item.name || itemId),
      definition, expectedRaw: equipmentEffectBaseDamage(actor, definition) })) : [];
  }).sort((a, b) => b.expectedRaw - a.expectedRaw || a.itemId.localeCompare(b.itemId));
  const chosen = choices[0];
  if (!chosen) return null;
  const previous = stateOf(actor), kind = chosen.definition.kind, cooldown = previous.cooldowns?.[kind];
  const hitId = JSON.stringify([idOf(actor), idOf(target), nowSec, packet.castId || '', packet.skill || '', packet.type]);
  if (Number(cooldown?.readyAtSec || 0) > nowSec || cooldown?.lastHitId === hitId
    || Number(cooldown?.lastHitAtSec ?? -1) > nowSec) return null;
  const sequence = Number(previous.sequence || 0) + 1;
  const pending = { id: `${idOf(actor)}:equipment:${sequence}`, kind, targetId: idOf(target),
    itemId: chosen.itemId, itemName: chosen.itemName, definition: structuredClone(chosen.definition),
    scheduledAtSec: roundCombatTime(nowSec), dueAtSec: roundCombatTime(nowSec + chosen.definition.delaySec),
    combatSpaceId: getCombatSpaceId(actor), triggerPosition: { ...getSpatialPosition(target) }, hitId };
  actor._equipmentEffectState = { ...previous, sequence,
    cooldowns: { ...previous.cooldowns, [kind]: { readyAtSec: roundCombatTime(nowSec + chosen.definition.cooldownSec),
      lastHitId: hitId, lastHitAtSec: nowSec } }, pending: [...(previous.pending || []), pending] };
  emitRunEvent('equipment_effect', { who: idOf(actor), targetId: pending.targetId, effectId: pending.id,
    effectKind: kind, itemId: pending.itemId, itemName: pending.itemName, stage: 'scheduled',
    delaySec: chosen.definition.delaySec, dueAtSec: pending.dueAtSec, cooldownUntil: actor._equipmentEffectState.cooldowns[kind].readyAtSec,
    zoneId: String(target.zoneId || '') }, atTime(at, nowSec));
  addLog(`💥 [${actor.name}] ${pending.itemName} · 파열 예약: [${target.name}] 중심 ${chosen.definition.delaySec}초 뒤`, 'combat-detail');
  return pending;
}

// Explicit custom-simulator policy: follow the target's current position in
// the same combat space. Death/defeat or leaving that space cancels. Unequipping
// or becoming stunned does not recall an already scheduled effect.
export function equipmentEffectCancelReason(actor, target, pending) {
  if (!alive(actor)) return 'source_dead';
  if (!alive(target)) return 'target_dead';
  if (getCombatSpaceId(actor) !== pending.combatSpaceId || getCombatSpaceId(target) !== pending.combatSpaceId) return 'space_changed';
  if (areSameTeam(actor, target)) return 'team_changed';
  if (!normalizeEquipmentEffects([pending.definition]).ok) return 'invalid_effect';
  return '';
}

export function removePendingEquipmentEffect(actor, id) {
  const previous = stateOf(actor);
  const pending = (previous.pending || []).find(row => row.id === id);
  if (!pending) return null;
  actor._equipmentEffectState = { ...previous, pending: previous.pending.filter(row => row.id !== id) };
  return pending;
}

export function cancelEquipmentEffect(actor, pending, reason, { at = null, emitRunEvent = () => {}, addLog = () => {} } = {}) {
  if (!removePendingEquipmentEffect(actor, pending.id)) return false;
  const labels = { source_dead: '시전자 사망 또는 전투 불능', target_dead: '대상 사망 또는 전투 불능',
    space_changed: '차원의 틈 등 전장 공간 변경', team_changed: '대상 소속 변경', invalid_effect: '지원하지 않는 효과' };
  emitRunEvent('equipment_effect', { who: idOf(actor), targetId: pending.targetId, effectId: pending.id,
    effectKind: pending.kind, itemId: pending.itemId, itemName: pending.itemName, stage: 'cancelled', reason,
    dueAtSec: pending.dueAtSec, zoneId: String(actor.zoneId || '') }, at);
  addLog(`💥 [${actor.name}] ${pending.itemName} · 파열 취소: ${labels[reason] || reason}`, 'combat-detail');
  return true;
}

export function reconcileEquipmentEffects(roster, nowSec, actions = {}) {
  const byId = new Map(roster.map(actor => [idOf(actor), actor]));
  for (const actor of roster) for (const pending of stateOf(actor).pending || []) {
    const reason = equipmentEffectCancelReason(actor, byId.get(pending.targetId), pending);
    if (reason) cancelEquipmentEffect(actor, pending, reason, { ...actions, at: atTime(actions.atNow?.(), nowSec) });
  }
}

export function findNextEquipmentEffectAction(survivorMap, nowSec) {
  let next = null;
  for (const actor of survivorMap.values()) for (const pending of stateOf(actor).pending || []) {
    if (!Number.isFinite(pending.dueAtSec)) continue;
    const candidate = { actorId: idOf(actor), targetId: pending.targetId, effectId: pending.id,
      scheduler: 'equipment', atSec: Math.max(nowSec, pending.dueAtSec) };
    if (!next || candidate.atSec < next.atSec || candidate.atSec === next.atSec && candidate.effectId.localeCompare(next.effectId) < 0) next = candidate;
  }
  return next;
}
