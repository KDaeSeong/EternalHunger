import { useMemo, useState } from 'react';
import { CHARACTER_SKILL_SLOTS, compileNaturalSkillDescription } from '../../../utils/characterSkillCompiler';
import { normalizeSupportedTacSkill } from '../../simulation/tacticalSkillTable';
import {
  characterId,
  cleanNumber,
  createDefaultCharacterSkill,
  normalizeCharacterSkillForEditor,
  normalizeCharacterSkillLevels,
  normalizeCharacterSkillsForEditor,
  normalizeSkillLevelArray,
} from './characterEditorRuntime';

const normalizeEditableSkillSlot = (slot) => (
  CHARACTER_SKILL_SLOTS.includes(String(slot || '').toLowerCase()) ? String(slot || '').toLowerCase() : 'q'
);

export function useCharacterSkillConfigEditor({
  characters,
  setCharacters,
} = {}) {
  const [configCharId, setConfigCharId] = useState(null);
  const [editGoalGearTier, setEditGoalGearTier] = useState(6);
  const [editTacticalSkill, setEditTacticalSkill] = useState('블링크');
  const [editCharacterSkillCode, setEditCharacterSkillCode] = useState('');
  const [editCharacterSkillLevels, setEditCharacterSkillLevels] = useState(() => normalizeCharacterSkillLevels());
  const [editCharacterSkills, setEditCharacterSkills] = useState(() => normalizeCharacterSkillsForEditor());
  const [activeSkillSlot, setActiveSkillSlot] = useState('q');
  const [manualSkillInputEnabled, setManualSkillInputEnabled] = useState(false);

  const configChar = useMemo(
    () => characters.find((c) => String(characterId(c)) === String(configCharId)) || null,
    [characters, configCharId]
  );

  const updateEditSkill = (slot, field, value) => {
    const skillSlot = normalizeEditableSkillSlot(slot);
    setEditCharacterSkills((prev) => ({
      ...prev,
      [skillSlot]: {
        ...createDefaultCharacterSkill(prev?.[skillSlot] || {}, skillSlot),
        [field]: value,
      },
    }));
  };

  const updateEditSkillLevelValue = (slot, field, index, value) => {
    const skillSlot = normalizeEditableSkillSlot(slot);
    setEditCharacterSkills((prev) => {
      const skill = createDefaultCharacterSkill(prev?.[skillSlot] || {}, skillSlot);
      const isPercentField = field === 'secondMaxHpPct' || field === 'secondCurrentHpPct' || field === 'maxHpPct' || field === 'currentHpPct';
      const list = normalizeSkillLevelArray(skill[field], 0, { percent: isPercentField });
      list[index] = cleanNumber(value, 0);
      return {
        ...prev,
        [skillSlot]: {
          ...skill,
          [field]: list,
        },
      };
    });
  };

  const compileEditSkillDescription = (slot = activeSkillSlot) => {
    const skillSlot = normalizeEditableSkillSlot(slot);
    const skill = createDefaultCharacterSkill(editCharacterSkills?.[skillSlot] || {}, skillSlot);
    const result = compileNaturalSkillDescription(skill.sourceText, skill, skillSlot);
    setEditCharacterSkills((prev) => ({
      ...prev,
      [skillSlot]: normalizeCharacterSkillForEditor({ [skillSlot]: result.skill }, skillSlot),
    }));
    if (result.warnings?.length) {
      alert(result.warnings.join('\n'));
    }
  };

  const openConfigModal = (char) => {
    const id = characterId(char);
    if (!id) return;
    setConfigCharId(id);
    const tier = Number(char?.goalGearTier || 6);
    setEditGoalGearTier([4, 5, 6].includes(tier) ? tier : 6);
    setEditTacticalSkill(normalizeSupportedTacSkill(char?.tacticalSkill) || '블링크');
    setEditCharacterSkillCode(String(char?.characterSkillCode || char?.erSubject || '').trim());
    setEditCharacterSkillLevels(normalizeCharacterSkillLevels(char?.characterSkillLevels));
    setEditCharacterSkills(normalizeCharacterSkillsForEditor(char?.characterSkills));
    setActiveSkillSlot('q');
    setManualSkillInputEnabled(false);
  };

  const closeConfigModal = () => setConfigCharId(null);

  const saveConfigModal = () => {
    if (!configCharId) return;
    setCharacters((prev) =>
      prev.map((char) => {
        const id = characterId(char);
        if (String(id) !== String(configCharId)) return char;
        return {
          ...char,
          goalGearTier: Number(editGoalGearTier || 6),
          tacticalSkill: normalizeSupportedTacSkill(editTacticalSkill),
          characterSkillCode: String(editCharacterSkillCode || '').trim(),
          characterSkillLevel: editCharacterSkillLevels.q,
          characterSkillLevels: normalizeCharacterSkillLevels(editCharacterSkillLevels),
          characterSkills: normalizeCharacterSkillsForEditor(editCharacterSkills),
        };
      })
    );
    closeConfigModal();
  };

  return {
    activeSkillSlot,
    closeConfigModal,
    compileEditSkillDescription,
    configChar,
    editCharacterSkillCode,
    editCharacterSkillLevels,
    editCharacterSkills,
    editGoalGearTier,
    editTacticalSkill,
    manualSkillInputEnabled,
    openConfigModal,
    saveConfigModal,
    setActiveSkillSlot,
    setEditCharacterSkillCode,
    setEditCharacterSkillLevels,
    setEditGoalGearTier,
    setEditTacticalSkill,
    setManualSkillInputEnabled,
    updateEditSkill,
    updateEditSkillLevelValue,
  };
}
