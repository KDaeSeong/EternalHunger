import { getCombatSpaceId } from '../../../utils/combatSpaceLogic.js';
import { isDimensionRiftDefeated } from '../../../utils/dimensionRiftDefeatLogic.js';
import { getSpatialPosition } from './combatSpatialRuntime.js';
import { areSameTeam } from './teamRuntime.js';
import { applyCombatHit } from './combatImpactRuntime.js';
import { calculateCombatDamage, applyCombatDamageLifesteal } from './combatDamageRuntime.js';
import { recordCombatContribution } from './teamCombatRuntime.js';
import { captureCombatHealth, recordCombatHealth, formatCombatHealthChange } from './combatObservationRuntime.js';
import { equipmentEffectBaseDamage, equipmentEffectCancelReason, removePendingEquipmentEffect, cancelEquipmentEffect } from './equipmentEffectRuntime.js';
import { settleEquipmentNotifications } from './equipmentEffectNotificationRuntime.js';

export function resolveEquipmentEffectDamage(options) {
  return settleEquipmentNotifications(options.actions, actions => settleEquipmentEffectDamage({ ...options, actions }));
}

function settleEquipmentEffectDamage({ actor, effectId, survivorMap, nowSec, phaseIdxNow = 0, actions = {} }) {
  const pending = (actor?._equipmentEffectState?.pending || []).find(row => row.id === effectId);
  if (!pending || pending.dueAtSec > nowSec) return { handled: false, performed: false };
  const { addLog = () => {}, emitRunEvent = () => {}, atNow = () => ({ sec: nowSec }), shieldBlock,
    grantPvpDamageMastery = () => {}, applyCombatElimination = () => {} } = actions;
  const target = survivorMap.get(pending.targetId);
  const reason = equipmentEffectCancelReason(actor, target, pending);
  if (reason) {
    cancelEquipmentEffect(actor, pending, reason, { addLog, emitRunEvent, at: atNow() });
    return { handled: true, performed: false, reason };
  }
  const center = { ...getSpatialPosition(target) }, radius = pending.definition.radius;
  const baseDamage = equipmentEffectBaseDamage(actor, pending.definition);
  // Snapshot every packet before kill/level/loot side effects change offense.
  const hits = [...survivorMap.values()].filter(row => row && Number(row.hp) > 0 && !isDimensionRiftDefeated(row)
    && !String(row._id).startsWith('wildlife:') && !areSameTeam(actor, row)
    && getCombatSpaceId(row) === pending.combatSpaceId && String(row.zoneId) === String(center.zoneId))
    .map(row => ({ target: row, position: { ...getSpatialPosition(row) } }))
    .filter(row => Math.hypot(row.position.x - center.x, row.position.y - center.y) <= radius + 1e-6)
    .sort((a, b) => String(a.target._id).localeCompare(String(b.target._id)))
    .map(row => ({ ...row, packet: { ...calculateCombatDamage(actor, row.target, { type: 'skill', baseDamage }),
      area: true, skill: '파열', equipmentEffectId: pending.id, itemId: pending.itemId } }));
  // Retrying callbacks or loading the next JSON snapshot cannot detonate twice.
  removePendingEquipmentEffect(actor, pending.id);
  actor._equipmentEffectState = { ...actor._equipmentEffectState,
    resolvedCount: Number(actor._equipmentEffectState.resolvedCount || 0) + 1 };
  emitRunEvent('equipment_effect', { who: String(actor._id), targetId: pending.targetId, effectId: pending.id,
    effectKind: pending.kind, itemId: pending.itemId, itemName: pending.itemName, stage: 'triggered',
    dueAtSec: pending.dueAtSec, radius, baseDamage, centerPosition: center, zoneId: String(center.zoneId) }, atNow());
  let damage = 0;
  for (const hit of hits) {
    const victim = hit.target, victimId = String(victim._id);
    const before = { attacker: captureCombatHealth(actor), target: captureCombatHealth(victim) };
    const prevDamagedBy = String(victim.lastDamagedBy || ''), prevDamagedPhaseIdx = Number(victim.lastDamagedPhaseIdx ?? -9999);
    const impact = applyCombatHit(actor, victim, hit.packet, { shieldBlock, emitRunEvent, addLog, at: atNow() });
    const hpDamage = impact.hpDamage;
    applyCombatDamageLifesteal(actor, hpDamage, { type: 'skill', area: true, addLog });
    emitRunEvent('damage', { ...impact.packet, who: String(actor._id), targetId: victimId, hpDamage,
      blockedReason: impact.blockedReason || '', absorbed: impact.absorbed,
      hpBefore: impact.hpBefore, maxHpBefore: impact.maxHpBefore, hpAfter: impact.hpAfter, maxHpAfter: impact.maxHpAfter,
      centerPosition: center, targetPosition: hit.position, radius, zoneId: String(victim.zoneId) }, atNow());
    if (hpDamage > 0) {
      recordCombatContribution(victim, actor, hpDamage, phaseIdxNow, nowSec);
      victim.lastDamagedBy = String(actor._id); victim.lastDamagedPhaseIdx = phaseIdxNow;
      grantPvpDamageMastery(actor, { damageDealt: hpDamage, damageTaken: 0 }, '파열');
      grantPvpDamageMastery(victim, { damageDealt: 0, damageTaken: hpDamage }, '파열 피격');
    }
    damage += hpDamage;
    const health = recordCombatHealth(before, actor, victim);
    addLog(`💥 [${actor.name}] ${pending.itemName} · 파열 → [${victim.name}] HP -${hpDamage} · ${formatCombatHealthChange(before.target, captureCombatHealth(victim))}${impact.absorbed ? ` · 보호막 흡수 ${impact.absorbed}` : ''}${impact.blockedReason ? ' · 피해 차단' : ''}`, 'highlight');
    emitRunEvent('battle', { a: String(actor._id), b: victimId, winner: victim.hp <= 0 ? String(actor._id) : '',
      lethal: victim.hp <= 0, damage: hpDamage, health, subkind: 'equipment_effect', equipmentEffectId: pending.id,
      itemId: pending.itemId, itemName: pending.itemName, zoneId: String(victim.zoneId) }, atNow());
    if (victim.hp <= 0) applyCombatElimination(actor, victim, { prevDamagedBy, prevDamagedPhaseIdx,
      killText: '파열 처치', deathReason: 'equipment_effect', deathCauseName: `${pending.itemName} · 파열`,
      damageDealt: hpDamage, deferAftermath: true });
  }
  return { handled: true, performed: true, damage, effectId: pending.id };
}
