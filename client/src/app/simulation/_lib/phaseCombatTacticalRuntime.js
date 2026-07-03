import { buildErBehaviorModifier } from '../../../utils/erMeta';
import { applyHealingModifier } from '../../../utils/statusLogic';
import {
  buildTacStatusEffects,
  getTacCooldownSec,
  getTacEffectNumber,
  getTacTrigger,
  normalizeSupportedTacSkill,
} from '../tacticalSkillTable';
import {
  applyRuntimeEffectPayloads,
  consumeShieldDamage,
} from './simulationEngine';
import { collectRuntimeEffectResultTexts } from './runtimeStatus';

export function createPhaseCombatTacticalRuntime({
  actions = {},
  state = {},
} = {}) {
  const {
    absNow = 0,
    battleSettings = {},
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
    return getTacCooldownSec(name, 1 + level);
  };

  const canUseTac = (actor) => (absNow >= Number(actor?._tacNextAbsSec || 0));

  const applyTacUse = (actor, name) => {
    if (!actor) return;
    const normalized = normalizeTac(name);
    actor._tacNextAbsSec = absNow + tacCdSec(normalized, actor);
    actor._tacLastUsed = normalized;
    actor._tacLastUsedAt = absNow;
  };

  const applyCombatTacAttack = (attacker, defender, baseDmg) => {
    const tac = normalizeTac(attacker?.tacticalSkill);
    const trigger = getTacTrigger(tac, 'combat');
    const level = tacModuleLevel(attacker);
    const hp = Number(attacker?.hp || 0);
    const maxHp = Math.max(1, Number(attacker?.maxHp || 100));
    if (!trigger || !canUseTac(attacker)) return Math.max(0, Math.floor(Number(baseDmg || 0)));
    if (Number(trigger?.hpBelow || 999) < 999 && hp > Number(trigger?.hpBelow || 999)) return Math.max(0, Math.floor(Number(baseDmg || 0)));

    let damage = Math.max(0, Math.floor(Number(baseDmg || 0)));
    const flat = getTacEffectNumber(tac, 'openerFlatDmg', 1 + level, 0);
    const heal = getTacEffectNumber(tac, 'selfHeal', 1 + level, 0);
    const cost = getTacEffectNumber(tac, 'selfCost', 1 + level, 0);
    const regenRecovery = getTacEffectNumber(tac, 'regenRecovery', 1 + level, 0);
    if (cost > 0 && hp <= Math.max(12, cost + 2)) return damage;

    applyTacUse(attacker, tac);
    if (cost > 0) attacker.hp = Math.max(1, hp - cost);
    const finalHeal = heal > 0 ? applyHealingModifier(attacker, heal) : 0;
    if (finalHeal > 0) attacker.hp = Math.min(maxHp, Number(attacker.hp || hp) + finalHeal);

    const sourceKey = `tac_${String(tac || '').replace(/\s+/g, '_')}`;
    const tacEffects = applyRuntimeEffectPayloads(attacker, buildTacStatusEffects(tac, 1 + level, sourceKey, { target: 'self' }));
    const targetTacEffects = applyRuntimeEffectPayloads(defender, buildTacStatusEffects(tac, 1 + level, sourceKey, { target: 'enemy' }));
    damage += flat;

    if (flat > 0 || finalHeal > 0 || cost > 0 || regenRecovery > 0 || tacEffects.results.length > 0 || targetTacEffects.results.length > 0) {
      const bits = [];
      if (flat > 0) bits.push(`추가 피해 +${flat}`);
      if (finalHeal > 0) bits.push(`HP +${finalHeal}`);
      if (cost > 0) bits.push(`HP -${cost}`);
      bits.push(...collectRuntimeEffectResultTexts(tacEffects.results));
      bits.push(...collectRuntimeEffectResultTexts(targetTacEffects.results, { subjectName: defender.name }));
      if (bits.length) addLog(`🧠 [${attacker.name}] 전술 스킬(${tac}): ${bits.join(', ')}`, 'highlight');
    }

    emitRunEvent('skill', { who: String(attacker?._id || ''), whoName: attacker?.name, skill: String(tac || ''), mode: 'combat_attack', zoneId: String(attacker?.zoneId || defender?.zoneId || '') }, atNow());
    emitEffectRunEvents(attacker, tacEffects.results, { source: 'tactical', skill: String(tac || ''), reason: 'combat_attack', zoneId: String(attacker?.zoneId || defender?.zoneId || '') }, atNow());
    emitEffectRunEvents(defender, targetTacEffects.results, { source: 'tactical', skill: String(tac || ''), reason: 'combat_attack_target', zoneId: String(defender?.zoneId || attacker?.zoneId || '') }, atNow());
    return Math.max(0, damage);
  };

  const shieldBlock = (defender, rawDmg) => {
    let damage = Math.max(0, Number(rawDmg || 0));
    if (damage <= 0) return damage;

    const preShield = consumeShieldDamage(defender, damage);
    if (preShield.absorbed > 0) {
      addLog(`🛡️ [${defender.name}] 보호막: 피해 -${preShield.absorbed}`, 'system');
      damage = Math.max(0, Number(preShield.damage || 0));
      if (damage <= 0) return 0;
    }

    const erDefense = buildErBehaviorModifier(defender, battleSettings);
    const erBlockRaw = Math.min(Math.max(0, damage * 0.35), Math.max(0, Number(erDefense?.damageBlock || 0)));
    const erBlock = Math.min(Math.max(0, Math.round(erBlockRaw)), Math.ceil(damage));
    if (erBlock > 0) {
      damage = Math.max(0, damage - erBlock);
      if (erBlock >= 5) addLog(`🛡️ [${defender.name}] ER 방어: 피해 -${erBlock}`, 'system');
      if (damage <= 0) return 0;
    }

    const tac = normalizeTac(defender?.tacticalSkill);
    const defenseTac = ['초월', '아티팩트', '무효화'];
    if (!defenseTac.includes(tac)) return damage;
    if (!canUseTac(defender)) return damage;

    const trigger = getTacTrigger(tac, 'combatDefense');
    const minDamage = Math.max(0, Number(trigger?.minIncomingDmg ?? 0));
    if (minDamage > 0 && damage < minDamage) return damage;

    const level = tacModuleLevel(defender);
    const negateLethal = getTacEffectNumber(tac, 'negateLethal', 1 + level, 0) > 0;
    if (negateLethal && damage >= Number(defender?.hp || 0)) {
      applyTacUse(defender, tac);
      addLog(`🗿 [${defender.name}] 전술 스킬(${tac}): 치명타격 무효`, 'highlight');
      return Math.max(0, Number(defender?.hp || 0) - 1);
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
      if (bits.length) addLog(`⚡ [${defender.name}] 전술 스킬(${tac}): ${bits.join(', ')}`, 'highlight');
    }
    emitRunEvent('skill', { who: String(defender?._id || ''), whoName: defender?.name, skill: String(tac || ''), mode: 'combat_defense', zoneId: String(defender?.zoneId || '') }, atNow());
    emitEffectRunEvents(defender, tacEffects.results, { source: 'tactical', skill: String(tac || ''), reason: 'combat_defense', zoneId: String(defender?.zoneId || '') }, atNow());
    return Math.max(0, Number(blocked?.damage || damage));
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
