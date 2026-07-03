import {
  createRunSupportFallback,
  itemName,
  topEntries,
} from './runSummaryShared';

export function buildRunSupportSummary({ runEvents, itemNameById }) {
  const out = createRunSupportFallback();
  const itemAcc = {};
  const effectAcc = {};
  const tacticalSkillAcc = {};
  const weaponSkillAcc = {};
  const characterSkillAcc = {};

  for (const event of (Array.isArray(runEvents) ? runEvents : [])) {
    if (!event) continue;
    if (event.kind === 'use') {
      if (event.manual) out.manualUseCount += 1;
      else out.autoUseCount += 1;
      out.totalHeal += Math.max(0, Number(event.heal || 0));
      out.totalSatiety += Math.max(0, Number(event.satiety || 0));
      const id = String(event.itemId || '');
      if (id) itemAcc[id] = (itemAcc[id] || 0) + 1;
    }
    if (event.kind === 'skill') {
      out.skillUseCount += 1;
      const skillName = String(event.skill || '').trim();
      const mode = String(event.mode || '').trim();
      if (mode === 'weapon_skill') {
        out.weaponSkillCount += 1;
        if (skillName) weaponSkillAcc[skillName] = (weaponSkillAcc[skillName] || 0) + 1;
      } else if (mode === 'character_skill') {
        out.characterSkillCount += 1;
        if (skillName) characterSkillAcc[skillName] = (characterSkillAcc[skillName] || 0) + 1;
      } else {
        out.tacticalSkillCount += 1;
        if (skillName) tacticalSkillAcc[skillName] = (tacticalSkillAcc[skillName] || 0) + 1;
      }
    }
    if (event.kind === 'effect') {
      const effectName = String(event.effect || '');
      const outcome = String(event.outcome || '');
      if (outcome === 'applied') out.appliedEffects += 1;
      else if (outcome === 'immune') out.immuneEffects += 1;
      else if (outcome === 'resisted') out.resistedEffects += 1;
      if (effectName && outcome === 'applied') effectAcc[effectName] = (effectAcc[effectName] || 0) + 1;
    }
  }

  const topItems = topEntries(itemAcc, 3).map(([id, count]) => `${itemName(itemNameById, id)}x${count}`).join(', ');
  const topEffects = topEntries(effectAcc, 4).map(([name, count]) => `${name}x${count}`).join(', ');
  const topTacticalSkills = topEntries(tacticalSkillAcc, 3).map(([name, count]) => `${name}x${count}`).join(', ');
  const topWeaponSkills = topEntries(weaponSkillAcc, 3).map(([name, count]) => `${name}x${count}`).join(', ');
  const topCharacterSkills = topEntries(characterSkillAcc, 3).map(([name, count]) => `${name}x${count}`).join(', ');
  const skillBits = [
    `전술 ${out.tacticalSkillCount}회`,
    `무기 ${out.weaponSkillCount}회`,
    `캐릭터 ${out.characterSkillCount}회`,
    topTacticalSkills ? `전술 TOP ${topTacticalSkills}` : '',
    topWeaponSkills ? `무기 TOP ${topWeaponSkills}` : '',
    topCharacterSkills ? `캐릭터 TOP ${topCharacterSkills}` : '',
  ].filter(Boolean);
  return {
    ...out,
    topItems,
    topEffects,
    topTacticalSkills,
    topWeaponSkills,
    topCharacterSkills,
    line: `use ${out.autoUseCount + out.manualUseCount}회 (auto ${out.autoUseCount} / dev ${out.manualUseCount}) · heal ${out.totalHeal} · 포만감 ${out.totalSatiety} · skill ${out.skillUseCount} · effect ${out.appliedEffects}/${out.immuneEffects}/${out.resistedEffects}`,
    combatLine: skillBits.length ? skillBits.join(' · ') : '',
  };
}
