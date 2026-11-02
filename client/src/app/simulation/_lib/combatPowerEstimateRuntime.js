import { getCombatStats } from './combatDamageRuntime.js';
import { getSpatialStats } from './combatSpatialRuntime.js';
import { getCharacterSkillDef, getCharacterSkillLevel, levelValue, areCharacterSkillsEnabled } from './characterSkillDefinitionRuntime.js';
import { getActorCooldownReductions, resolveCharacterSkillCooldownSec } from './cooldownRuntime.js';
import { readHpDamageRatio } from '../../../utils/characterSkillHpDamageUnit.js';
import { getShieldValue, getRegenValue } from '../../../utils/statusLogic.js';
import { getCombatEquipment, getEquipmentStatValues } from '../../../utils/battleEquipmentLogic.js';
import { getStatGrowthLevel } from '../../../utils/erStats.js';

const positive = value => Math.max(0, Number(value) || 0);

// 관측·경로 탐색에서도 사용하는 순수 추정이다. 판정/난수/런타임 상태는 바꾸지 않는다.
export function createCombatPowerSkillSnapshot(actor, settings = {}) {
  if (!areCharacterSkillsEnabled(settings)) return [];
  return ['q', 'w', 'e', 'r'].map(slot => ({ def: getCharacterSkillDef(actor, slot),
    index: getCharacterSkillLevel(actor, slot) - 1 })).filter(row => row.def);
}

export function getCombatPowerBreakdown(actor, settings = {}, preparedSkills = null) {
  const stats = getCombatStats(actor);
  const spatial = getSpatialStats(actor);
  const speed = Math.max(0.1, Math.min(3, stats.attackSpeed));
  const critical = 1 + Math.min(1, positive(stats.critChance)) * (0.75 + positive(stats.critDamageIncrease));
  const basicDps = positive(stats.attackPower) * speed * critical * (1 + positive(stats.basicAttackAmp));
  let skillDps = 0, supportPerSec = 0, control = 0;
  const reductions = areCharacterSkillsEnabled(settings) ? getActorCooldownReductions(actor) : null;
  for (const { def, index } of preparedSkills || createCombatPowerSkillSnapshot(actor, settings)) {
    const cooldown = Math.max(1, resolveCharacterSkillCooldownSec(actor, def, settings, reductions));
    const support = ['heal_skill', 'shield_skill', 'support_skill'].includes(def.type);
    if (support) {
      supportPerSec += (levelValue(def.heal, index) + levelValue(def.shield, index)
        + stats.skillAmp * positive(def.skillAmpScale)) / cooldown;
    } else {
      let raw = levelValue(def.flatDamage ?? def.firstFlat, index)
        + stats.attackPower * positive(def.attackPowerScale)
        + stats.skillAmp * positive(def.skillAmpScale ?? def.firstSkillAmpScale);
      raw += 150 * readHpDamageRatio(levelValue(def.maxHpPct, index), def.hpDamagePercentUnit)
        + 100 * readHpDamageRatio(levelValue(def.currentHpPct, index), def.hpDamagePercentUnit);
      if (def.type === 'basic_attack_enhance') raw += levelValue(def.secondFlat, index)
        + stats.attackPower * positive(def.secondAttackPowerScale) + stats.skillAmp * positive(def.secondSkillAmpScale);
      skillDps += raw / cooldown;
    }
    control += (def.statusEffects?.length || 0) / cooldown;
  }
  const appliedEquipmentHp = positive(actor?._equipmentMaxHpApplied);
  const actualMax = Math.max(1, Number(actor?.maxHp || stats.maxHp) || 1);
  // 아직 런타임 정규화를 거치지 않은 장비 후보도 현재 장착 체력까지 비교한다.
  const equipmentHp = getCombatEquipment(actor).reduce((sum, item) => sum
    + positive(getEquipmentStatValues(item, getStatGrowthLevel(actor)).hp), 0);
  const maxHp = Math.max(stats.maxHp, actualMax - appliedEquipmentHp + equipmentHp);
  const hpRatio = Math.max(0, Math.min(1, Number(actor?.hp ?? actualMax) / actualMax));
  const durability = maxHp * (1 + positive(stats.defense) / 100) * (0.5 + hpRatio * 0.5);
  const sustain = Math.min(28, positive(getShieldValue(actor)) * 0.35 + positive(getRegenValue(actor)));
  const referenceDefense = Math.max(0, 50 * (1 - Math.min(1, positive(stats.armorPen))) - positive(stats.armorPenFlat));
  const penetrationValue = 150 / (100 + referenceDefense);
  const offense = (basicDps + skillDps) * penetrationValue
    * (1 + positive(stats.damageIncrease)) * (1 + positive(stats.finalDamageIncrease));
  const role = String(actor?.erRole || '');
  const durabilityWeight = role === 'tank' ? 0.12 : role === 'bruiser' ? 0.1 : 0.075;
  const total = offense * 0.65 + durability * durabilityWeight + supportPerSec * 1.5
    + spatial.attackRange * 1.5 + spatial.sightRange * 0.25 + control * 4 + sustain;
  return { total, basicDps, skillDps, supportPerSec, durability, maxHp, attackSpeed: speed };
}
