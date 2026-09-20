import { simulationRandom } from '../../../utils/simulationRandom.js';
import { isDimensionRiftDefeated } from '../../../utils/dimensionRiftDefeatLogic.js';
import { hasActionBlockStatus, isTargetableByStatus, canUseSkillByStatus, canBasicAttackByStatus } from '../../../utils/statusLogic.js';
import { applyCombatHit } from './combatImpactRuntime.js';
import { applyPreparedCharacterSkill } from './characterSkillRuntime.js';
import { applyCharacterSkillStatusEffects } from './characterStatusSkillRuntime.js';
import { consumeArmedCharacterSkill } from './characterCastRuntime.js';
import { areSameTeam } from './teamRuntime.js';
import { recordCombatContribution } from './teamCombatRuntime.js';
import { calculateCombatDamage, applyCombatDamageLifesteal } from './combatDamageRuntime.js';
import { isBasicAttackReady, reserveBasicAttack } from './combatTimingRuntime.js';
import { isInBasicAttackRange, isInSpatialSkillRange, spatialDistance, getSpatialPosition, getSpatialStats, getSpatialSkillRange } from './combatSpatialRuntime.js';

function getSameZoneSupportTargets(actor, roster) {
  return roster.filter((row) => row && String(row._id) !== String(actor._id) && Number(row.hp || 0) > 0
    && String(row.zoneId) === String(actor.zoneId) && areSameTeam(actor, row));
}

// A single directional hit. The legacy export name is retained for callers;
// no selected "winner", combat score, date or finishing lottery sets damage.
export function resolveCombatWinnerOutcome({ actions = {}, combatElimination = {}, flee = {}, skillSplash = {},
  state = {}, tactical = {} } = {}) {
  const { actor, target, battleSettings = {}, currentActionSec = () => 0, phaseIdxNow = 0, pvpCfg = {},
    supportRoster = [], strikeOnly = false, preparedSkill = null, targetKind = 'experiment' } = state;
  const { addLog = () => {}, applyErTraitAfterBattle = () => null, applyErWeaponSkillAfterCombat = () => null,
    atNow = () => null, emitRunEvent = () => {}, grantPvpDamageMastery = () => {} } = actions;
  const { applyCombatTacAttack = () => 0, shieldBlock = (_defender, damage) => damage } = tactical;
  const { applyCharacterSkillSplashDamage = () => 0, getCharacterSkillSplashTargets = () => [] } = skillSplash;
  const { resolveFleeSequence = () => null } = flee;
  const { applyCombatElimination = () => null } = combatElimination;
  const result = { actor, target, battleLog: '', handled: true, performed: false, skipRemainingTurn: false };
  if (!actor || !target || Number(actor.hp || 0) <= 0 || Number(target.hp || 0) <= 0 || hasActionBlockStatus(actor) || !isTargetableByStatus(target)) return result;
  if (preparedSkill && !canUseSkillByStatus(actor, preparedSkill.def)) return result;
  if (!preparedSkill && !canBasicAttackByStatus(actor, target)) return result;
  if (!preparedSkill && (actor._pendingCharacterCast || !isBasicAttackReady(actor, currentActionSec()) || Number(actor._actionReadyAtSec || 0) > currentActionSec())) return result;
  if (preparedSkill ? !isInSpatialSkillRange(actor, target, preparedSkill.def, battleSettings, supportRoster)
    : !isInBasicAttackRange(actor, target, supportRoster)) return result;
  result.performed = true;
  const prevDamagedBy = String(target.lastDamagedBy || '');
  const prevDamagedPhaseIdx = Number(target.lastDamagedPhaseIdx ?? -9999);
  const hpBefore = Math.max(0, Number(target.hp));
  const tacticalRaw = preparedSkill ? 0 : applyCombatTacAttack(actor, target, 0);
  const attackIntervalSec = preparedSkill ? 0 : reserveBasicAttack(actor, currentActionSec());
  const basic = preparedSkill ? null : calculateCombatDamage(actor, target);
  const skillOptions = {
    settings: battleSettings, nowSec: currentActionSec(), at: atNow(), addLog, emitRunEvent, basicCritical: basic?.critical,
    splashTargets: getCharacterSkillSplashTargets(actor, target),
    supportTargets: getSameZoneSupportTargets(actor, supportRoster), visionRoster: supportRoster, showLog: battleSettings?.skills?.showSkillLogs !== false,
  };
  const skillResult = preparedSkill ? applyPreparedCharacterSkill(actor, target, preparedSkill, skillOptions)
    : consumeArmedCharacterSkill(actor, target, basic.damage, skillOptions);
  const skills = { results: skillResult ? [skillResult] : [], splashHits: skillResult?.splashHits || [] };
  const packets = basic ? [{ ...basic, attackIntervalSec, nextAttackAtSec: actor._basicAttackReadyAtSec }] : [];
  if (tacticalRaw > 0) packets.push(calculateCombatDamage(actor, target, { type: 'skill', baseDamage: tacticalRaw }));
  packets.push(...(skills.results || []).map((row) => row.packet).filter(Boolean));
  let directDamage = 0;
  for (const packet of packets) {
    if (target.hp <= 0 || isDimensionRiftDefeated(target)) break;
    const impact = applyCombatHit(actor, target, packet, { shieldBlock, emitRunEvent, addLog, at: atNow() });
    const { blockedReason, hpDamage } = impact;
    directDamage += hpDamage;
    applyCombatDamageLifesteal(actor, hpDamage, { type: packet.type, area: packet.area, targetKind, addLog });
    emitRunEvent('damage', { who: String(actor._id), targetId: String(target._id), zoneId: String(target.zoneId || ''),
      ...impact.packet, distance: spatialDistance(actor, target),
      reach: preparedSkill ? getSpatialSkillRange(actor, preparedSkill.def, battleSettings) : getSpatialStats(actor).attackRange,
      fromPosition: { ...getSpatialPosition(actor) }, targetPosition: { ...getSpatialPosition(target) },
      ...(blockedReason ? { blockedReason } : {}), hpDamage,
      absorbed: impact.absorbed, hpAfter: target.hp }, atNow());
    const blockLabel = { blind: '실명으로 빗나감', evade: '회피로 빗나감', invulnerable: '무적으로 피해 무효', untargetable: '대상 지정 불가' }[blockedReason];
    addLog(`⚔️ [${actor.name}] → [${target.name}] ${packet.type === 'basic' ? '기본 공격' : packet.type === 'true' ? '고정 피해' : '스킬'}${packet.critical ? ' 치명타' : ''}: ${blockLabel || `HP -${hpDamage}`} (원피해 ${Number(packet.raw).toFixed(1)}, 적용 방어 ${Number(packet.appliedDefense).toFixed(1)})`, 'combat-detail');
  }
  const splashDamage = applyCharacterSkillSplashDamage(actor, skills.splashHits);
  // Weapon-specific follow-ups remain separate effects. Measure their actual
  // HP delta so an overkill report cannot grant fictitious damage or assists.
  const beforeWeapon = Number(target.hp);
  if (!preparedSkill && directDamage > 0 && beforeWeapon > 0 && !isDimensionRiftDefeated(target)) applyErWeaponSkillAfterCombat(actor, target, {
    damageDealt: directDamage, lethalPreview: false, settings: battleSettings, nowSec: currentActionSec(), at: atNow(),
    shieldBlock, emitRunEvent, addLog,
  });
  const weaponDamage = Math.max(0, beforeWeapon - Number(target.hp));
  if (skillResult?.statusPayload) applyCharacterSkillStatusEffects(actor, target, skillResult.statusPayload, {
    emitRunEvent, addLog, at: atNow(),
    allowTarget: !['blind', 'evade', 'untargetable'].includes(skillResult.packet?.blockedReason),
  });
  const totalDamage = Math.min(hpBefore, directDamage + weaponDamage);
  if (totalDamage > 0) {
    recordCombatContribution(target, actor, totalDamage, phaseIdxNow, currentActionSec());
    target.lastDamagedBy = String(actor._id);
    target.lastDamagedPhaseIdx = phaseIdxNow;
    grantPvpDamageMastery(actor, { damageDealt: totalDamage, damageTaken: 0 }, '실제 타격');
    grantPvpDamageMastery(target, { damageDealt: 0, damageTaken: totalDamage }, '피격');
  }
  let escape = null;
  if (target.hp > 0 && !isDimensionRiftDefeated(target) && totalDamage > 0 && target.hp <= Number(pvpCfg.criticalFleeHpBelow ?? 18)
    && simulationRandom() < Math.max(0, Math.min(1, Number(pvpCfg.criticalFleeChance ?? 0.78)))) {
    escape = resolveFleeSequence(target, actor, { curZone: String(target.zoneId || actor.zoneId || ''),
      forceAttempt: true, escapeText: '빈사 도주', moveReason: 'critical_flee', hpThreshold: Number(pvpCfg.criticalFleeHpBelow ?? 18) });
  }
  const lethal = Number(target.hp || 0) <= 0;
  if (!lethal && totalDamage > 0 && actor.hp > 0) applyErTraitAfterBattle(actor, { lethal: false, damageDealt: totalDamage, defeated: target });
  if (!areSameTeam(actor, target)) emitRunEvent('battle', { a: String(actor._id), b: String(target._id), winner: lethal ? String(actor._id) : '',
    lethal, damage: totalDamage, splashDamage, zoneId: String(actor.zoneId || target.zoneId || ''),
    ...(preparedSkill ? { subkind: 'character_skill_direct', castId: preparedSkill.castId } : {}) }, atNow());
  if (lethal) applyCombatElimination(actor, target, { prevDamagedBy, prevDamagedPhaseIdx, deferAftermath: strikeOnly,
    killText: '처치', deathReason: escape?.fatal ? 'critical_flee' : 'combat', deathCauseName: escape?.fatal ? '빈사 추격' : '교전',
    damageDealt: totalDamage });
  return result;
}
