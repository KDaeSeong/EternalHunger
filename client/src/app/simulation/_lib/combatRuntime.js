import { normalizeErStats } from '../../../utils/erStats';
import {
  EFFECT_AIRBORNE,
  EFFECT_COOLDOWN_DOWN,
  EFFECT_COOLDOWN_UP,
  EFFECT_HASTE,
  EFFECT_KNOCKBACK,
  EFFECT_SLOW,
  applyHealingModifier,
  makeCooldownRateEffect,
  makeHealReductionEffect,
  makeLifestealEffect,
  makeMoveSpeedEffect,
  makeShieldEffect,
  makeStatBuffEffect,
  makeStatusValueEffect,
} from '../../../utils/statusLogic';
import {
  ER_WEAPON_SKILLS,
  buildErBehaviorModifier,
  getErTrait,
} from '../../../utils/erMeta';
import {
  applyRuntimeEffectPayloads,
  describeRuntimeEffect,
  shouldLogRuntimeEffectApplication,
} from './runtimeStatus';

function readStat(actor, keys) {
  const st = normalizeErStats(actor?.stats || actor || {});
  for (const k of keys) {
    const v = Number(st?.[k] ?? st?.[String(k).toLowerCase?.()] ?? 0);
    if (Number.isFinite(v)) return v;
  }
  return 0;
}

function roughPower(actor) {
  const stats = normalizeErStats(actor?.stats || actor || {});
  return (
    Number(stats.attackPower || 0) +
    Number(stats.skillAmp || 0) * 0.35 +
    Number(stats.defense || 0) * 0.85 +
    Number(stats.attackSpeed || 0) * 10 +
    Number(stats.attackRange || 0) * 1.5 +
    Number(stats.sightRange || 0) * 0.4 +
    Number(stats.maxHp || 0) * 0.08
  );
}

function canonicalizeCharName(name) {
  return (name || '')
    .replace(/\s*[•·・]\s*/g, '·')
    .replace(/\s*-\s*/g, '·')
    .replace(/\s+/g, ' ')
    .trim();
}

function cloneForBattle(obj) {
  try {
    return structuredClone(obj);
  } catch {
    return JSON.parse(JSON.stringify(obj));
  }
}

function applyErTraitAfterBattle(actor, opts = {}) {
  if (!actor || Number(actor?.hp || 0) <= 0) return null;
  const trait = getErTrait(actor);
  const code = String(trait?.code || '');
  if (!code) return null;

  const maxHp = Math.max(1, Number(actor?.maxHp || 100));
  const hp = Math.max(0, Number(actor?.hp || 0));
  const effects = [];
  const bits = [];

  if (code === 'devour') {
    const baseHeal = opts?.lethal ? 9 : 5;
    const rawHeal = Math.min(Math.max(0, maxHp - hp), baseHeal + Math.floor(Number(opts?.damageDealt || 0) * 0.06));
    const heal = applyHealingModifier(actor, rawHeal);
    if (heal > 0) {
      actor.hp = Math.min(maxHp, hp + heal);
      bits.push(`HP +${heal}`);
    }
  } else if (code === 'adrenaline') {
    effects.push(makeStatBuffEffect('adrenaline', { attackSpeed: 0.04, attackPower: 2 }, 2, 'er_trait_adrenaline', { tags: ['positive', 'trait', 'adrenaline'] }));
  } else if (code === 'ampDrone') {
    effects.push(makeStatBuffEffect('focus', { skillAmp: 6, sightRange: 0.2 }, 2, 'er_trait_amp_drone', { tags: ['positive', 'trait', 'amp'] }));
  } else if (code === 'fortress') {
    effects.push(makeShieldEffect(opts?.lethal ? 10 : 7, 2, 'er_trait_fortress', { tags: ['positive', 'trait', 'shield'] }));
  } else if (code === 'sprint') {
    effects.push(makeStatBuffEffect('sprint', { attackSpeed: 0.05, sightRange: 0.2 }, 2, 'er_trait_sprint', { tags: ['positive', 'trait', 'mobility'] }));
  }

  const applied = effects.length ? applyRuntimeEffectPayloads(actor, effects) : null;
  (applied?.results || []).forEach((row) => {
    if (row?.reason === 'immune') bits.push(`${String(row?.effect?.name || '효과')} 면역`);
    else if (row?.reason === 'resisted') bits.push(`${String(row?.effect?.name || '효과')} 저항`);
    else if (row?.applied && shouldLogRuntimeEffectApplication(row.effect)) {
      const desc = describeRuntimeEffect(row.effect);
      if (desc) bits.push(desc);
    }
  });

  if (bits.length) {
    opts?.addLog?.(`🧬 [${actor.name}] 특성(${trait.name || code}) 발동: ${bits.join(', ')}`, 'system');
  }
  return { trait: code, applied: bits.length > 0 };
}

function applyErWeaponSkillAfterCombat(attacker, defender, opts = {}) {
  if (!attacker || !defender) return { damage: 0, applied: false };
  if (Number(attacker?.hp || 0) <= 0) return { damage: 0, applied: false };

  const er = buildErBehaviorModifier(attacker, opts?.settings || {});
  const skill = ER_WEAPON_SKILLS[er?.weaponType] || null;
  if (!skill?.name) return { damage: 0, applied: false };

  const damageDealt = Math.max(0, Number(opts?.damageDealt || 0));
  if (damageDealt <= 0 && !opts?.lethalPreview) return { damage: 0, applied: false };

  const mastery = Math.max(1, Math.floor(Number(er?.masteryLevel || 1)));
  if (mastery < 5) return { damage: 0, applied: false, skill: skill.name, locked: true };
  const nowSec = Math.max(0, Number(opts?.nowSec ?? opts?.at?.sec ?? 0));
  const currentCooldown = Math.max(0, Number(attacker?.cooldowns?.weaponSkill || 0));
  const nextReadySec = Math.max(0, Number(attacker?._weaponSkillNextAbsSec || 0));
  if (currentCooldown > 0 || (nowSec > 0 && nextReadySec > nowSec)) {
    return {
      damage: 0,
      applied: false,
      skill: skill.name,
      cooldown: true,
      cooldownSec: currentCooldown || Math.max(0, nextReadySec - nowSec),
    };
  }

  const procChance = Math.min(0.78, Math.max(0.24, 0.36 + mastery * 0.01 + (opts?.lethalPreview ? 0.1 : 0)));
  if (Math.random() >= procChance) return { damage: 0, applied: false };

  const baseCooldownSec = Math.max(18, Number(opts?.settings?.battle?.weaponSkillCooldownSec ?? opts?.settings?.weaponSkillCooldownSec ?? 34));
  const masteryCooldownReduction = Math.min(8, Math.max(0, Math.floor((mastery - 1) / 3)));
  const cooldownSec = Math.max(16, Math.round(baseCooldownSec - masteryCooldownReduction));
  if (!attacker.cooldowns || typeof attacker.cooldowns !== 'object') attacker.cooldowns = {};
  attacker.cooldowns.weaponSkill = cooldownSec;
  if (nowSec > 0) attacker._weaponSkillNextAbsSec = nowSec + cooldownSec;
  attacker._weaponSkillLastUsed = String(skill.name || '');
  attacker._weaponSkillLastUsedAt = nowSec;

  const bits = [];
  const effects = [];
  const defenderEffects = [];
  let extraDamage = 0;

  const scoreScale = Math.max(0, Number(skill.scoreScale || 0));
  const flat = Math.max(0, Number(skill.openerFlatDmg || 0));
  const crit = Math.max(0, Number(skill.critChancePlus || 0));
  const amp = Math.max(0, Number(skill.skillAmpPlus || 0));
  const block = Math.max(0, Number(skill.block || 0));
  const lifesteal = Math.max(0, Number(skill.lifestealPlus || 0));
  const mobility = Math.max(0, Number(skill.chaseBonus || 0), Number(skill.escapeBonus || 0));

  if (Number(defender?.hp || 0) > 0) {
    const pressure = scoreScale * 42 + flat + crit * 70 + amp * 55;
    const rolled = Math.round(pressure + Math.max(0, mastery - 1) * 0.18);
    extraDamage = Math.min(Math.max(0, Number(defender.hp || 0)), Math.max(0, rolled));
    if (extraDamage >= 3) {
      defender.hp = Math.max(0, Number(defender.hp || 0) - extraDamage);
      bits.push(`추가 피해 +${extraDamage}`);
    } else {
      extraDamage = 0;
    }
  }

  if (block > 0) {
    const shield = Math.min(14, Math.max(3, Math.round(block * 0.9 + mastery * 0.2)));
    effects.push(makeShieldEffect(shield, 2, 'er_weapon_skill_block', { tags: ['positive', 'weapon_skill', 'shield'] }));
  }

  if (lifesteal > 0) {
    const maxHp = Math.max(1, Number(attacker?.maxHp || 100));
    const hp = Math.max(0, Number(attacker?.hp || 0));
    const rawHeal = Math.min(Math.max(0, maxHp - hp), Math.max(1, Math.round(damageDealt * lifesteal * 3 + (opts?.lethalPreview ? 4 : 1))));
    const heal = applyHealingModifier(attacker, rawHeal);
    if (heal > 0) {
      attacker.hp = Math.min(maxHp, hp + heal);
      bits.push(`HP +${heal}`);
    }
    effects.push(makeLifestealEffect(Math.max(0.04, lifesteal * 2), 2, 'er_weapon_skill_lifesteal', { tags: ['positive', 'weapon_skill', 'lifesteal'] }));
  }

  const statBuff = {};
  if (amp > 0) {
    statBuff.skillAmp = (statBuff.skillAmp || 0) + 5;
    statBuff.sightRange = (statBuff.sightRange || 0) + 0.2;
  }
  if (mobility > 0) {
    statBuff.attackSpeed = (statBuff.attackSpeed || 0) + 0.04;
    statBuff.attackPower = (statBuff.attackPower || 0) + 1;
  }
  if (Object.keys(statBuff).length) {
    effects.push(makeStatBuffEffect('무기 템포', statBuff, 2, 'er_weapon_skill_tempo', { tags: ['positive', 'weapon_skill'] }));
  }

  if (skill.name === '어퍼컷') {
    defenderEffects.push(makeStatusValueEffect(EFFECT_AIRBORNE, 2, 'er_weapon_skill_airborne', { tags: ['negative', 'weapon_skill', 'cc', 'airborne', 'action_block'] }));
  } else if (skill.name === '풀스윙') {
    defenderEffects.push(makeStatusValueEffect(EFFECT_KNOCKBACK, 2, 'er_weapon_skill_knockback', { knockbackDistance: 1, tags: ['negative', 'weapon_skill', 'cc', 'knockback', 'forced_move'] }));
  } else if (skill.name === '갑옷깨기') {
    defenderEffects.push(makeHealReductionEffect(0.35, 2, 'er_weapon_skill_antiheal', { tags: ['negative', 'weapon_skill', 'heal_reduction'] }));
  } else if (skill.name === '마름쇠' || skill.name === '갈고리') {
    defenderEffects.push(makeMoveSpeedEffect(EFFECT_SLOW, -0.16, 2, 'er_weapon_skill_slow', { tags: ['negative', 'weapon_skill', 'slow', 'move'] }));
  } else if (skill.name === '불협화음') {
    defenderEffects.push(makeCooldownRateEffect(EFFECT_COOLDOWN_UP, 0.18, 2, 'er_weapon_skill_discord', { tags: ['negative', 'weapon_skill', 'cooldown'] }));
  }
  if (mobility > 0) {
    effects.push(makeStatusValueEffect(EFFECT_HASTE, 2, 'er_weapon_skill_haste', { moveSpeedBonus: Math.max(0.04, mobility * 1.5), cooldownRateBonus: 0.08, tags: ['positive', 'weapon_skill', 'haste', 'move', 'cooldown'] }));
  }
  if (skill.name === '무빙 리로드') {
    effects.push(makeCooldownRateEffect(EFFECT_COOLDOWN_DOWN, 0.18, 2, 'er_weapon_skill_reload', { tags: ['positive', 'weapon_skill', 'cooldown'] }));
  }

  const applied = effects.length ? applyRuntimeEffectPayloads(attacker, effects) : null;
  const defenderApplied = defenderEffects.length ? applyRuntimeEffectPayloads(defender, defenderEffects) : null;
  (applied?.results || []).forEach((row) => {
    if (row?.reason === 'immune') bits.push(`${String(row?.effect?.name || '효과')} 면역`);
    else if (row?.reason === 'resisted') bits.push(`${String(row?.effect?.name || '효과')} 저항`);
    else if (row?.applied && shouldLogRuntimeEffectApplication(row.effect)) {
      const desc = describeRuntimeEffect(row.effect);
      if (desc) bits.push(desc);
    }
  });
  (defenderApplied?.results || []).forEach((row) => {
    if (row?.reason === 'immune') bits.push(`${defender.name} ${String(row?.effect?.name || '효과')} 면역`);
    else if (row?.reason === 'resisted') bits.push(`${defender.name} ${String(row?.effect?.name || '효과')} 저항`);
    else if (row?.applied && shouldLogRuntimeEffectApplication(row.effect)) {
      const desc = describeRuntimeEffect(row.effect);
      if (desc) bits.push(`${defender.name} ${desc}`);
    }
  });

  if (!bits.length) return { damage: extraDamage, applied: false, skill: skill.name };

  opts?.addLog?.(`🗡️ [${attacker.name}] 무기 스킬(${skill.name}): ${bits.join(', ')}`, 'combat-detail');
  opts?.emitRunEvent?.('skill', {
    who: String(attacker?._id || ''),
    whoName: attacker?.name,
    skill: String(skill.name || ''),
    mode: 'weapon_skill',
    zoneId: String(attacker?.zoneId || defender?.zoneId || ''),
    cooldownSec,
  }, opts?.at || null);
  opts?.emitEffectRunEvents?.(attacker, applied?.results || [], { source: 'weapon_skill', skill: String(skill.name || ''), reason: 'combat_after', zoneId: String(attacker?.zoneId || defender?.zoneId || '') }, opts?.at || null);
  opts?.emitEffectRunEvents?.(defender, defenderApplied?.results || [], { source: 'weapon_skill', skill: String(skill.name || ''), reason: 'combat_after_target', zoneId: String(defender?.zoneId || attacker?.zoneId || '') }, opts?.at || null);
  return { damage: extraDamage, applied: true, skill: skill.name, cooldownSec };
}

export {
  applyErTraitAfterBattle,
  applyErWeaponSkillAfterCombat,
  canonicalizeCharName,
  cloneForBattle,
  readStat,
  roughPower,
};
