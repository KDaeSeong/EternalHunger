import { applyHealingModifier, canUseSkillByStatus, isTargetableByStatus } from '../../../utils/statusLogic';
import { restoreRuntimeHp, describeHpRecovery } from './healthRecoveryRuntime.js';
import {
  buildTacStatusEffects,
  getTacEffectNumber,
  getTacTrigger,
  normalizeSupportedTacSkill,
} from '../tacticalSkillTable';
import {
  applyRuntimeEffectPayloads,
  consumeShieldDamage,
} from './simulationEngine';
import { collectRuntimeEffectResultTexts } from './runtimeStatus';
import { resolveRiftTacticalMovement } from './riftDisplacementRuntime.js';
import { getActorDimensionRiftId, getCombatSpaceId, shareCombatSpace, WORLD_COMBAT_SPACE } from '../../../utils/combatSpaceLogic.js';
import { resolveTacticalSkillCooldownSec } from './cooldownRuntime.js';
import { TACTICAL_EFFECT_SCHEMA } from './tacticalEffectEvidenceRuntime.js';

export function createPhaseCombatTacticalRuntime({
  actions = {},
  state = {},
} = {}) {
  const {
    absNow = 0,
    ruleset = {},
  } = state;
  const {
    addLog = () => {},
    atNow = () => null,
    emitEffectRunEvents = () => {},
    emitRunEvent = () => {},
  } = actions;

  const tacModuleLevel = (actor) => {
    const mode = String(ruleset?.ai?.tacModuleUpgradeMode || 'level');
    if (mode === 'level') {
      const level = Math.max(1, Math.min(2, Math.floor(Number(actor?.tacticalSkillLevel || 1))));
      return level - 1;
    }

    const inventory = Array.isArray(actor?.inventory) ? actor.inventory : [];
    let count = 0;
    for (const item of inventory) {
      const name = String(item?.name || '').trim();
      const tags = Array.isArray(item?.tags) ? item.tags : [];
      const isModule = name.includes('전술 강화 모듈') || tags.some((tag) => String(tag).toLowerCase().includes('tac_skill_module'));
      if (!isModule) continue;
      count += Math.max(0, Number(item?.qty || 1));
    }
    return Math.max(0, Math.min(1, Math.floor(count)));
  };

  const normalizeTac = (value) => normalizeSupportedTacSkill(value);

  const tacCdSec = (name, actor) => {
    const level = tacModuleLevel(actor);
    return resolveTacticalSkillCooldownSec(actor, name, 1 + level);
  };

  const canUseTac = (actor) => {
    const tac = normalizeTac(actor?.tacticalSkill);
    const level = 1 + tacModuleLevel(actor);
    return Number(actor?.hp || 0) > 0 && canUseSkillByStatus(actor, {
      includesMovement: getTacEffectNumber(tac, 'movementDistance', level, 0) > 0,
    }) && absNow >= Number(actor?._tacNextAbsSec || 0);
  };

  const applyTacUse = (actor, name) => {
    if (!actor) return;
    const normalized = normalizeTac(name);
    actor._tacNextAbsSec = absNow + tacCdSec(normalized, actor);
    actor._tacLastUsed = normalized;
    actor._tacLastUsedAt = absNow;
  };

  const emitTacticalUse = (actor, tac, mode, { opponentId = '', targetId = '', ...receipt }) => {
    emitRunEvent('skill', { who: String(actor?._id || ''), whoName: actor?.name,
      teamId: String(actor?.matchTeamId || actor?.teamId || ''), skill: String(tac || ''), source: 'tactical', mode,
      targetId: String(targetId), opponentId: String(opponentId), zoneId: String(actor?.zoneId || ''),
      heal: receipt.hpRecovered, tacticalEffect: { schema: TACTICAL_EFFECT_SCHEMA,
        level: 1 + tacModuleLevel(actor), cooldownUntil: Number(actor._tacNextAbsSec),
        hpSpent: 0, hpRecovered: 0, damagePrevented: 0, damageAdded: 0,
        existingShieldAbsorbed: 0, movementDistance: 0, lethalPrevented: false, ...receipt },
    }, atNow());
  };

  const applyCombatTacAttack = (attacker, defender, baseDmg) => {
    const tac = normalizeTac(attacker?.tacticalSkill);
    const trigger = getTacTrigger(tac, 'combat');
    const level = tacModuleLevel(attacker);
    const hp = Number(attacker?.hp || 0);
    const maxHp = Math.max(1, Number(attacker?.maxHp || 100));
    const validSpaceMember = (actor) => getCombatSpaceId(actor) === WORLD_COMBAT_SPACE
      || Boolean(getActorDimensionRiftId(actor)) && actor._dimensionRiftEntry.enteredAtSec <= absNow;
    if (!trigger || !canUseTac(attacker) || !isTargetableByStatus(defender)
      || String(attacker?.zoneId || '') !== String(defender?.zoneId || '') || !shareCombatSpace(attacker, defender)
      || !validSpaceMember(attacker) || !validSpaceMember(defender)) return Math.max(0, Math.floor(Number(baseDmg || 0)));
    if (Number(trigger?.hpBelow || 999) < 999 && hp > Number(trigger?.hpBelow || 999)) return Math.max(0, Math.floor(Number(baseDmg || 0)));

    let damage = Math.max(0, Math.floor(Number(baseDmg || 0)));
    const flat = getTacEffectNumber(tac, 'openerFlatDmg', 1 + level, 0);
    const heal = getTacEffectNumber(tac, 'selfHeal', 1 + level,
      getTacEffectNumber(tac, 'healCap', 1 + level, 0));
    const cost = getTacEffectNumber(tac, 'selfCost', 1 + level, 0);
    const regenRecovery = getTacEffectNumber(tac, 'regenRecovery', 1 + level, 0);
    if (cost > 0 && hp <= Math.max(12, cost + 2)) return damage;

    const cooldownBefore = Number(attacker._tacNextAbsSec || 0);
    applyTacUse(attacker, tac);
    const tacticalMovement = resolveRiftTacticalMovement(attacker, defender, {
      skill: tac, distance: getTacEffectNumber(tac, 'movementDistance', 1 + level, 0), nowSec: absNow,
    }, { atNow, emitRunEvent, addLog });
    if (cost > 0) attacker.hp = Math.max(1, hp - cost);
    const hpSpent = Math.max(0, hp - Number(attacker.hp));
    const requestedHeal = heal > 0 ? applyHealingModifier(attacker, heal) : 0;
    const finalHeal = restoreRuntimeHp(attacker, requestedHeal, maxHp);

    const sourceKey = `tac_${String(tac || '').replace(/\s+/g, '_')}`;
    const tacEffects = applyRuntimeEffectPayloads(attacker, buildTacStatusEffects(tac, 1 + level, sourceKey, { target: 'self' }));
    const targetTacEffects = applyRuntimeEffectPayloads(defender,
      buildTacStatusEffects(tac, 1 + level, sourceKey, { target: 'enemy' }),
      { sourceActor: attacker, nowSec: absNow, at: atNow(), emitRunEvent, addLog });
    damage += flat;

    if (flat > 0 || finalHeal > 0 || cost > 0 || regenRecovery > 0 || tacticalMovement
      || tacEffects.results.length > 0 || targetTacEffects.results.length > 0) {
      const bits = [];
      if (flat > 0) bits.push(`추가 피해 +${flat}`);
      if (finalHeal > 0) bits.push(describeHpRecovery(attacker, finalHeal));
      if (cost > 0) bits.push(`HP -${cost}`);
      if (tacticalMovement) bits.push(`내부 이동 ${tacticalMovement.actualDistance}m`);
      bits.push(...collectRuntimeEffectResultTexts(tacEffects.results));
      bits.push(...collectRuntimeEffectResultTexts(targetTacEffects.results, { subjectName: defender.name }));
      if (bits.length) addLog(`🧠 [${attacker.name}] 전술 스킬(${tac}): ${bits.join(', ')}`, 'combat-detail');
    }

    emitTacticalUse(attacker, tac, 'combat_attack', { opponentId: defender?._id, targetId: defender?._id,
      hpBefore: hp, hpAfter: Number(attacker.hp), hpSpent, hpRecovered: finalHeal, cooldownBefore,
      damageBefore: Math.max(0, Math.floor(Number(baseDmg || 0))), damageAfter: Math.max(0, damage),
      damageAdded: flat, movementDistance: Math.max(0, Number(tacticalMovement?.actualDistance || 0)) });
    emitEffectRunEvents(attacker, tacEffects.results, { source: 'tactical', skill: String(tac || ''), reason: 'combat_attack', zoneId: String(attacker?.zoneId || defender?.zoneId || '') }, atNow());
    emitEffectRunEvents(defender, targetTacEffects.results, { source: 'tactical', skill: String(tac || ''), reason: 'combat_attack_target', zoneId: String(defender?.zoneId || attacker?.zoneId || '') }, atNow());
    return Math.max(0, damage);
  };

  const shieldBlock = (defender, rawDmg, impactContext = {}) => {
    let damage = Math.max(0, Number(rawDmg || 0));
    if (damage <= 0) return damage;

    const preShield = consumeShieldDamage(defender, damage);
    damage = Math.max(0, Number(preShield.damage || 0));
    if (preShield.absorbed > 0) {
      addLog(`🛡️ [${defender.name}] 보호막: 피해 -${preShield.absorbed}`, 'combat-detail');
    }
    if (damage <= 0) return 0;

    const tac = normalizeTac(defender?.tacticalSkill);
    const defenseTac = ['초월', '아티팩트', '무효화'];
    if (!defenseTac.includes(tac)) return damage;
    if (!canUseTac(defender)) return damage;

    const trigger = getTacTrigger(tac, 'combatDefense');
    const minDamage = Math.max(0, Number(trigger?.minIncomingDmg ?? 0));
    if (minDamage > 0 && damage < minDamage) return damage;

    const level = tacModuleLevel(defender);
    const cooldownBefore = Number(defender._tacNextAbsSec || 0);
    const hpBefore = Number(defender.hp);
    const emitDefenseUse = (remaining, lethalPrevented = false) => emitTacticalUse(defender, tac, 'combat_defense', {
      opponentId: impactContext.attackerId, targetId: defender?._id,
      hpBefore, hpAfter: Number(defender.hp), cooldownBefore, damageBefore: damage, damageAfter: remaining,
      damagePrevented: Math.max(0, damage - remaining), existingShieldAbsorbed: Math.max(0, Number(preShield.absorbed || 0)),
      lethalPrevented,
    });
    const negateLethal = getTacEffectNumber(tac, 'negateLethal', 1 + level, 0) > 0;
    if (negateLethal && damage >= Number(defender?.hp || 0)) {
      applyTacUse(defender, tac);
      addLog(`🗿 [${defender.name}] 전술 스킬(${tac}): 치명타격 무효`, 'combat-detail');
      const remaining = Math.max(0, Number(defender?.hp || 0) - 1);
      emitDefenseUse(remaining, true);
      return remaining;
    }

    const blockCap = getTacEffectNumber(tac, 'block', 1 + level, 0);
    const shieldValue = getTacEffectNumber(tac, 'shieldValue', 1 + level, blockCap);
    if (blockCap <= 0 && shieldValue <= 0) return damage;

    applyTacUse(defender, tac);
    const tacEffects = applyRuntimeEffectPayloads(defender, buildTacStatusEffects(tac, 1 + level, `tac_${String(tac || '').replace(/\s+/g, '_')}`));
    const blocked = consumeShieldDamage(defender, damage);
    const block = Math.max(0, Number(blocked?.absorbed || 0));
    if (block > 0 || tacEffects.results.length > 0) {
      const bits = [];
      bits.push(...collectRuntimeEffectResultTexts(tacEffects.results));
      if (block > 0) bits.push(`피해 -${block}`);
      if (bits.length) addLog(`⚡ [${defender.name}] 전술 스킬(${tac}): ${bits.join(', ')}`, 'combat-detail');
    }
    emitDefenseUse(Math.max(0, Number(blocked?.damage ?? damage)));
    emitEffectRunEvents(defender, tacEffects.results, { source: 'tactical', skill: String(tac || ''), reason: 'combat_defense', zoneId: String(defender?.zoneId || '') }, atNow());
    return Math.max(0, Number(blocked?.damage ?? damage));
  };

  return {
    applyCombatTacAttack,
    applyTacUse,
    canUseTac,
    normalizeTac,
    shieldBlock,
    tacModuleLevel,
  };
}
