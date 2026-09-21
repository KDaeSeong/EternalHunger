import { absorbShieldDamage, canonicalizeEffectName, getActiveStatusEffects, getDamageBlockReason } from '../../../utils/statusLogic.js';
import { commitRuntimeHpDamage } from '../../../utils/dimensionRiftDefeatLogic.js';
import { recordEquipmentSkillImpact } from './equipmentEffectRuntime.js';

// Commit one landed damage packet, not a damage preview. The first positive
// direct hit wakes sleep even when an existing shield absorbs all damage.
// DOT/environmental ticking is not a direct attack in this project's rules.
export function applyCombatHit(attacker, defender, packet, { shieldBlock, emitRunEvent = () => {}, addLog = () => {}, at = null } = {}) {
  const hpBefore = Number(defender.hp);
  const maxHpBefore = Number(defender.maxHp);
  const blockedReason = packet.blockedReason || getDamageBlockReason(attacker, defender, { type: packet.type });
  const incoming = Math.max(0, Number(packet.damage) || 0);
  const sleeping = !blockedReason && incoming > 0 && Number(defender.hp) > 0
    ? getActiveStatusEffects(defender).filter((effect) => effect.tags.includes('wake_on_hit')) : [];
  const bonus = Math.round(incoming * sleeping.reduce((max, effect) => Math.max(max, Number(effect.wakeDamagePct) || 0), 0));
  const damage = incoming + bonus;
  let afterShield = 0;
  if (!blockedReason && Number(defender.hp) > 0 && damage > 0) {
    if (shieldBlock) afterShield = Math.max(0, Number(shieldBlock(defender, damage)) || 0);
    else {
      const shield = absorbShieldDamage(defender, damage);
      defender.activeEffects = shield.character.activeEffects;
      afterShield = shield.damage;
    }
  }
  const { hpDamage, defeat } = commitRuntimeHpDamage(defender, afterShield, {
    atSec: at?.sec, by: attacker?._id, cause: packet.skill || packet.type || 'combat',
  });
  if (defeat) {
    emitRunEvent('dimension_rift_defeat', { ...defeat, zoneId: String(defender.zoneId || '') }, at);
    addLog(`🌀 [${defender.name}] 차원의 틈 전투 불능 · 경기 사망/전리품 없음`, 'highlight');
  }
  if (sleeping.length) {
    const names = new Set(sleeping.map((effect) => effect.name));
    defender.activeEffects = (defender.activeEffects || []).filter((effect) => !names.has(canonicalizeEffectName(effect.name)));
    emitRunEvent('sleep_break', { who: String(defender._id || ''), by: String(attacker?._id || ''),
      zoneId: String(defender.zoneId || ''), bonusDamage: bonus, hpDamage, hpAfter: defender.hp }, at);
    addLog(`💤 [${defender.name}] 피격으로 수면 해제 · 추가 피해 ${bonus} (보호막 적용 전)`, 'combat-detail');
  }
  const impact = { packet: { ...packet, ...(sleeping.length ? { damage, sleepBonusDamage: bonus } : {}) },
    blockedReason, hpDamage, defeat, absorbed: blockedReason ? 0 : Math.max(0, damage - afterShield),
    hpBefore, maxHpBefore, hpAfter: defender.hp, maxHpAfter: Number(defender.maxHp) };
  recordEquipmentSkillImpact(attacker, defender, impact, { at, emitRunEvent, addLog });
  return impact;
}
