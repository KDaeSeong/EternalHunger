import {
  areSameTeam,
  upsertRuntimeSurvivor,
} from './simulationEngine';
import { recordCombatContribution } from './teamCombatRuntime';
import { applyCombatDamageLifesteal } from './combatDamageRuntime.js';
import { isTargetableByStatus, getDamageBlockReason } from '../../../utils/statusLogic.js';
import { getSpatialPosition } from './combatSpatialRuntime.js';
import { applyCombatHit } from './combatImpactRuntime.js';
import { captureCombatHealth, recordCombatHealth, formatCombatHealthChange } from './combatObservationRuntime.js';
import { applyCharacterSkillStatusEffects } from './characterStatusSkillRuntime.js';
import { shareCombatSpace, getCombatSpaceId, WORLD_COMBAT_SPACE } from '../../../utils/combatSpaceLogic.js';

export function createPhaseCombatSkillSplashRuntime({
  actions = {},
  state = {},
} = {}) {
  const {
    newDeadIds = [],
    phaseIdxNow = 0,
    survivorMap = new Map(),
  } = state;
  const {
    addLog = () => {},
    applyCombatElimination = () => ({ assistId: null }),
    atNow = () => null,
    emitRunEvent = () => {},
    grantPvpDamageMastery = () => {},
    shieldBlock = (_target, rawDamage) => Math.max(0, Number(rawDamage || 0)),
  } = actions;

  const getCharacterSkillSplashTargets = (attacker, primaryTarget) => {
    const zoneId = String(primaryTarget?.zoneId || attacker?.zoneId || '');
    const attackerId = String(attacker?._id || '');
    const primaryId = String(primaryTarget?._id || '');
    if (!zoneId || !attackerId || !shareCombatSpace(attacker, primaryTarget)) return [];

    return Array.from(survivorMap.values()).filter((survivor) => {
      const survivorId = String(survivor?._id || '');
      if (!survivorId || survivorId === attackerId || survivorId === primaryId) return false;
      if (newDeadIds.includes(survivorId) || Number(survivor?.hp || 0) <= 0) return false;
      if (!isTargetableByStatus(survivor)) return false;
      if (!shareCombatSpace(attacker, survivor) || String(survivor?.zoneId || '') !== zoneId) return false;
      return !areSameTeam(attacker, survivor);
    });
  };

  const applyCharacterSkillSplashDamage = (attacker, splashHits) => {
    if (!attacker || !Array.isArray(splashHits) || splashHits.length <= 0) return 0;
    attacker = survivorMap.get(String(attacker._id || '')) || attacker;
    let total = 0;

    for (const hit of splashHits) {
      const targetId = String(hit?.target?._id || '');
      const splashTarget = survivorMap.get(targetId);
      if (!targetId || !shareCombatSpace(attacker, splashTarget) || newDeadIds.includes(targetId) || Number(splashTarget?.hp || 0) <= 0) continue;
      const blockedReason = getDamageBlockReason(attacker, splashTarget, { type: hit.packet?.type || 'skill' });
      if (blockedReason && (blockedReason !== 'invulnerable' || !hit.statusPayload)) continue;
      const center = hit.centerPosition; const position = getSpatialPosition(splashTarget);
      const areaDistance = center && position && center.zoneId === position.zoneId
        && String(center.combatSpaceId || WORLD_COMBAT_SPACE) === getCombatSpaceId(splashTarget)
        ? Math.hypot(position.x - center.x, position.y - center.y) : Infinity;
      if (center && areaDistance > Number(hit.radius || 0) + 1e-6) continue;

      const raw = Math.max(0, Number(hit?.damage || 0));
      if (raw <= 0 && !hit.statusPayload) continue;

      const prevDamagedBySplash = String(splashTarget?.lastDamagedBy || '');
      const prevDamagedPhaseIdxSplash = Number(splashTarget?.lastDamagedPhaseIdx ?? -9999);
      const healthBefore = { attacker: captureCombatHealth(attacker), target: captureCombatHealth(splashTarget) };
      const impact = applyCombatHit(attacker, splashTarget, { ...hit.packet, type: hit.packet?.type || 'skill', damage: raw },
        { shieldBlock, emitRunEvent, addLog, at: atNow() });
      const finalSplash = impact.hpDamage;
      applyCharacterSkillStatusEffects(attacker, splashTarget, hit.statusPayload, { onlyTarget: true, emitRunEvent, addLog, at: atNow(),
        allowTarget: !['blind', 'evade', 'untargetable'].includes(impact.blockedReason) });
      if (finalSplash <= 0) continue;

      applyCombatDamageLifesteal(attacker, finalSplash, { type: hit.packet?.type || 'skill', area: hit.packet?.area ?? !hit.primary, addLog });
      emitRunEvent('damage', { who: String(attacker._id), targetId, ...hit.packet,
        ...(impact.packet.sleepBonusDamage != null ? { damage: impact.packet.damage, sleepBonusDamage: impact.packet.sleepBonusDamage } : {}),
        ...(center ? { areaDistance, radius: hit.radius, centerPosition: { ...center }, targetPosition: { ...position } } : {}),
        hpDamage: finalSplash, absorbed: impact.absorbed, hpBefore: impact.hpBefore, maxHpBefore: impact.maxHpBefore,
        hpAfter: impact.hpAfter, maxHpAfter: impact.maxHpAfter, zoneId: String(splashTarget.zoneId || '') }, atNow());
      recordCombatContribution(splashTarget, attacker, finalSplash, phaseIdxNow, Number(atNow()?.sec || 0));
      splashTarget.lastDamagedBy = String(attacker?._id || '');
      splashTarget.lastDamagedPhaseIdx = phaseIdxNow;
      total += finalSplash;

      const hitKindText = hit?.primary ? '스킬 피해' : '광역 피해';
      const healthText = formatCombatHealthChange(healthBefore.target, captureCombatHealth(splashTarget));
      addLog(`🌀 ${hitKindText}: [${attacker.name}] ${String(hit?.skill || '스킬')} → [${splashTarget.name}] -${finalSplash}${healthText ? ` · ${healthText}` : ''}${impact.absorbed > 0 ? ` · 보호막 흡수 ${impact.absorbed}` : ''}`, 'highlight');
      emitRunEvent('battle', {
        a: String(attacker?._id || ''),
        b: targetId,
        winner: Number(splashTarget.hp || 0) <= 0 ? String(attacker?._id || '') : '',
        lethal: Number(splashTarget.hp || 0) <= 0,
        damage: finalSplash,
        health: recordCombatHealth(healthBefore, attacker, splashTarget),
        zoneId: String(splashTarget?.zoneId || attacker?.zoneId || ''),
        subkind: hit?.primary ? 'character_skill_direct' : 'character_skill_splash',
      }, atNow());
      grantPvpDamageMastery(attacker, { damageDealt: finalSplash, damageTaken: 0 }, hit?.primary ? '스킬' : '스킬 광역');

      if (Number(splashTarget.hp || 0) <= 0) {
        applyCombatElimination(attacker, splashTarget, {
          prevDamagedBy: prevDamagedBySplash,
          prevDamagedPhaseIdx: prevDamagedPhaseIdxSplash,
          killText: '스킬 처치',
          deathReason: 'character_skill_splash',
          deathCauseName: `${String(hit?.skill || '스킬')} ${hit?.primary ? '피해' : '광역 피해'}`,
          damageDealt: finalSplash,
          deferAftermath: Number(attacker?._actionReadyAtSec || 0) > Number(atNow()?.sec || 0),
        });
      } else {
        upsertRuntimeSurvivor(survivorMap, splashTarget);
      }
    }

    return total;
  };

  return {
    applyCharacterSkillSplashDamage,
    getCharacterSkillSplashTargets,
  };
}
