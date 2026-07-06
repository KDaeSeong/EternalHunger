import { useMemo, useState } from 'react';
import {
  CHARACTER_SKILL_SLOT_LABELS,
  CHARACTER_SKILL_SLOTS,
  compileNaturalSkillDescription,
} from '../../../utils/characterSkillCompiler';
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

function hasAnyLevelValue(list) {
  return (Array.isArray(list) ? list : []).some((value) => Number(value || 0) > 0);
}

function summarizeCompiledSkill(slot, skill, warnings = []) {
  const label = CHARACTER_SKILL_SLOT_LABELS[slot] || String(slot || '').toUpperCase();
  const damageBits = [];
  if (hasAnyLevelValue(skill.firstFlat)) damageBits.push(`1타 ${skill.firstFlat.join('/')}`);
  if (hasAnyLevelValue(skill.secondFlat)) damageBits.push(`2타 ${skill.secondFlat.join('/')}`);
  if (hasAnyLevelValue(skill.currentHpPct)) damageBits.push(`현재 체력 ${skill.currentHpPct.join('/')}%`);
  if (hasAnyLevelValue(skill.secondCurrentHpPct)) damageBits.push(`2타 현재 체력 ${skill.secondCurrentHpPct.join('/')}%`);
  if (hasAnyLevelValue(skill.maxHpPct)) damageBits.push(`최대 체력 ${skill.maxHpPct.join('/')}%`);
  if (hasAnyLevelValue(skill.secondMaxHpPct)) damageBits.push(`2타 최대 체력 ${skill.secondMaxHpPct.join('/')}%`);

  return {
    tone: warnings.length ? 'warning' : 'success',
    title: warnings.length ? `${label} 자동 작성 확인 필요` : `${label} 자동 작성 완료`,
    lines: [
      `타입 ${skill.type} / 조건 ${skill.useCondition || 'auto'} / 대상 ${skill.targetPriority || 'auto'} / 지원 ${skill.supportTargetScope || 'auto'}`,
      `쿨다운 ${skill.cooldownSec || 0}초 / 재발동 ${skill.recastWindowSec || 0}초 / 사거리 ${skill.range || 0} / 범위 ${skill.radius || 0}`,
      `선딜 ${skill.castDelaySec || 0}초 / 후딜 ${skill.recoveryDelaySec || 0}초`,
      damageBits.length ? `피해: ${damageBits.join(', ')}` : '피해/회복/보호막 수치가 없으면 수동 입력에서 보완하세요.',
      ...warnings,
    ],
  };
}

export function useCharacterSkillConfigEditor({
  characters,
  setCharacters,
} = {}) {
  const [configCharId, setConfigCharId] = useState(null);
  const [editTacticalSkill, setEditTacticalSkill] = useState('블링크');
  const [editCharacterSkillCode, setEditCharacterSkillCode] = useState('');
  const [editCharacterSkillLevels, setEditCharacterSkillLevels] = useState(() => normalizeCharacterSkillLevels());
  const [editCharacterSkills, setEditCharacterSkills] = useState(() => normalizeCharacterSkillsForEditor());
  const [activeSkillSlot, setActiveSkillSlot] = useState('q');
  const [manualSkillInputEnabled, setManualSkillInputEnabled] = useState(false);
  const [skillCompileNotice, setSkillCompileNotice] = useState(null);

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
    setSkillCompileNotice(summarizeCompiledSkill(skillSlot, result.skill, result.warnings || []));
  };

  const openConfigModal = (char) => {
    const id = characterId(char);
    if (!id) return;
    setConfigCharId(id);
    setEditTacticalSkill(normalizeSupportedTacSkill(char?.tacticalSkill) || '블링크');
    setEditCharacterSkillCode(String(char?.characterSkillCode || char?.erSubject || '').trim());
    setEditCharacterSkillLevels(normalizeCharacterSkillLevels(char?.characterSkillLevels));
    setEditCharacterSkills(normalizeCharacterSkillsForEditor(char?.characterSkills));
    setActiveSkillSlot('q');
    setManualSkillInputEnabled(false);
    setSkillCompileNotice(null);
  };

  const closeConfigModal = () => {
    setConfigCharId(null);
    setSkillCompileNotice(null);
  };

  const saveConfigModal = () => {
    if (!configCharId) return;
    setCharacters((prev) =>
      prev.map((char) => {
        const id = characterId(char);
        if (String(id) !== String(configCharId)) return char;
        return {
          ...char,
          goalGearTier: 6,
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
    editTacticalSkill,
    manualSkillInputEnabled,
    openConfigModal,
    saveConfigModal,
    setActiveSkillSlot,
    setEditCharacterSkillCode,
    setEditCharacterSkillLevels,
    setEditTacticalSkill,
    setManualSkillInputEnabled,
    skillCompileNotice,
    updateEditSkill,
    updateEditSkillLevelValue,
  };
}
