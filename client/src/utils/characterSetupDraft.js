import setupContract from '../../../server/utils/characterSetupContract.js';
import { DEFAULT_ER_STATS, ER_STAT_KEYS, normalizeErStats } from './erStats.js';
import { CHARACTER_SKILL_SLOTS, createDefaultCompiledSkill, getCharacterSkillMovementError } from './characterSkillCompilerCore.js';
import { getCharacterStatusSkillError } from './characterStatusSkillDefinition.js';
import { normalizeWeaponTypes } from './equipmentCatalog.js';

export function normalizeCharacterSetupDraft(raw) {
  if (raw?.schema !== setupContract.SETUP_SCHEMA || raw?.origin !== 'ai-draft') throw new Error('지원하지 않는 자동 설정 초안입니다. 기존 설정은 유지됩니다.');
  const safe = setupContract.sanitizeCharacterSetup(raw, { mode: raw.mode, sources: raw.sources || [] });
  return { ...safe, stats: normalizeErStats(safe.stats), characterSkills: Object.fromEntries(
    CHARACTER_SKILL_SLOTS.map(slot => [slot, createDefaultCompiledSkill(safe.characterSkills[slot], slot)])) };
}

function authoredSkill(raw, slot) {
  if (!raw || typeof raw !== 'object') return false;
  if (raw.enabled === true || String(raw.name || '').trim() || String(raw.sourceText || '').trim()) return true;
  const empty = createDefaultCompiledSkill({}, slot);
  // Earlier blank account editors used 12s for E/R/passive; the runtime's
  // blanks use 18/60/0s. Neither shell is a manually authored skill by itself.
  const emptyCooldowns = { q: [7], w: [12], e: [12, 18], r: [12, 60], passive: [0, 12] };
  return Object.keys(empty).some(key => raw[key] !== undefined
    && !(key === 'cooldownSec' && emptyCooldowns[slot].includes(raw[key]))
    && JSON.stringify(raw[key]) !== JSON.stringify(empty[key]));
}
function authoredResource(raw) {
  return raw?.enabled === true || raw?.name && raw.name !== '고유 자원'
    || raw?.maxValue != null && Number(raw.maxValue) !== 100
    || Number(raw?.startValue || 0) !== 0 || Number(raw?.regenPerSec || 0) !== 0;
}

// Produce a patch, never a replacement character. IDs, records, images,
// inventory, loadouts, runtime HP and other people's data are not generated.
export function createCharacterSetupPatch(character, raw, { replaceExisting = false } = {}) {
  const draft = normalizeCharacterSetupDraft(raw);
  if (!character || typeof character !== 'object') throw new Error('편집할 캐릭터를 찾지 못했습니다.');
  const patch = {}, applied = [], preserved = [];
  const select = (key, proposed, isAuthored, label = key) => {
    if (isAuthored && !replaceExisting) preserved.push(label);
    else { patch[key] = structuredClone(proposed); applied.push(label); }
  };
  select('name', draft.name, Boolean(String(character.name || '').trim()), '이름');
  if (draft.gender) select('gender', draft.gender, Boolean(character.name && character.gender), '성별');
  if (draft.summary) select('summary', draft.summary, Boolean(String(character.summary || '').trim()), '설정 요약');
  const stats = normalizeErStats(character.stats);
  select('stats', draft.stats, ER_STAT_KEYS.some(key => stats[key] !== DEFAULT_ER_STATS[key]), '능력치');
  const weapons = normalizeWeaponTypes([...(character.erWeapons || []), character.weaponType]);
  if (weapons.length && !replaceExisting) preserved.push('무기');
  else { patch.erWeapons = [...draft.erWeapons]; patch.weaponType = draft.erWeapons[0]; applied.push('무기'); }
  const nextSkills = { ...character.characterSkills };
  const appliedSlots = [];
  for (const slot of CHARACTER_SKILL_SLOTS) {
    if (authoredSkill(character.characterSkills?.[slot], slot) && !replaceExisting) preserved.push(slot.toUpperCase());
    else {
      nextSkills[slot] = structuredClone(draft.characterSkills[slot]); appliedSlots.push(slot);
      applied.push(slot.toUpperCase());
    }
  }
  if (appliedSlots.length) patch.characterSkills = nextSkills;
  select('uniqueResource', draft.uniqueResource, authoredResource(character.uniqueResource), '고유 자원');
  const resource = patch.uniqueResource || character.uniqueResource;
  for (const slot of CHARACTER_SKILL_SLOTS) {
    const skill = nextSkills[slot];
    if (skill?.enabled !== true) continue;
    if (Number(skill.resourceCost || 0) > 0 || Number(skill.resourceGain || 0) > 0) {
      if (resource?.enabled !== true || Number(skill.resourceCost || 0) > Number(resource.maxValue)) {
        throw new Error(`${slot.toUpperCase()} 비용과 유지할 고유 자원이 맞지 않습니다. 고유 자원·스킬을 함께 확인한 뒤 적용해 주세요.`);
      }
    }
    if (appliedSlots.includes(slot)) {
      const error = getCharacterStatusSkillError(skill, slot) || getCharacterSkillMovementError(skill, slot);
      if (error) throw new Error(`${slot.toUpperCase()}: ${error}`);
    }
  }
  return { patch, applied, preserved, draft };
}
